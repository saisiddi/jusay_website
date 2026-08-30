// ============================================
// Supabase Edge Function: razorpay-report (admin/diagnostic)
//
// Reads recent payments straight from Razorpay and surfaces the failed ones
// with their error fields, so "why did these payments fail" can be answered
// from the source of truth rather than guessed at.
//
// SAFETY
//   - Gated by the RECONCILE_TOKEN secret; not callable from a browser.
//   - Read-only: only GETs from the Razorpay API. Writes nothing.
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')!;
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')!;
const RECONCILE_TOKEN = Deno.env.get('RECONCILE_TOKEN') ?? '';

serve(async (req) => {
    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!RECONCILE_TOKEN || token !== RECONCILE_TOKEN) {
        return json(401, { success: false, error: 'Unauthorized' });
    }

    try {
        const url = new URL(req.url);
        const count = Math.min(parseInt(url.searchParams.get('count') || '30', 10) || 30, 100);
        const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);

        // Trace one payment -> invoice -> subscription, to rebuild a missing row.
        const lookupPayment = url.searchParams.get('payment');
        if (lookupPayment) {
            const pr = await fetch(`https://api.razorpay.com/v1/payments/${lookupPayment}`, {
                headers: { Authorization: `Basic ${auth}` },
            });
            const payment = pr.ok ? await pr.json() : { error: `payment ${pr.status}` };
            let invoice = null, subscription = null;
            if (payment.invoice_id) {
                const ir = await fetch(`https://api.razorpay.com/v1/invoices/${payment.invoice_id}`, {
                    headers: { Authorization: `Basic ${auth}` },
                });
                invoice = ir.ok ? await ir.json() : { error: `invoice ${ir.status}` };
                if (invoice?.subscription_id) {
                    const sr = await fetch(`https://api.razorpay.com/v1/subscriptions/${invoice.subscription_id}`, {
                        headers: { Authorization: `Basic ${auth}` },
                    });
                    subscription = sr.ok ? await sr.json() : { error: `subscription ${sr.status}` };
                }
            }
            return json(200, {
                success: true,
                payment: { id: payment.id, status: payment.status, amount: payment.amount, email: payment.email, invoice_id: payment.invoice_id },
                invoice: invoice && { id: invoice.id, subscription_id: invoice.subscription_id, status: invoice.status },
                subscription: subscription && { id: subscription.id, status: subscription.status, notes: subscription.notes, current_start: subscription.current_start, current_end: subscription.current_end },
            });
        }

        const res = await fetch(`https://api.razorpay.com/v1/payments?count=${count}`, {
            headers: { Authorization: `Basic ${auth}` },
        });
        if (!res.ok) {
            return json(502, { success: false, error: `Razorpay ${res.status}: ${await res.text()}` });
        }

        const body = await res.json();
        const items = Array.isArray(body.items) ? body.items : [];

        const summarise = (p: Record<string, unknown>) => ({
            id: p.id,
            status: p.status,
            amount: p.amount,
            method: p.method,
            email: p.email,
            contact: p.contact,
            created_at: new Date((p.created_at as number) * 1000).toISOString(),
            order_id: p.order_id ?? null,
            invoice_id: p.invoice_id ?? null,
            error_code: p.error_code,
            error_description: p.error_description,
            error_reason: p.error_reason,
            notes: p.notes ?? null,
        });

        const failed = items.filter((p: Record<string, unknown>) => p.status === 'failed').map(summarise);
        const captured = items
            .filter((p: Record<string, unknown>) => p.status === 'captured' || p.status === 'authorized')
            .map(summarise);

        // Small status tally for context.
        const byStatus: Record<string, number> = {};
        for (const p of items) byStatus[p.status] = (byStatus[p.status] ?? 0) + 1;

        return json(200, {
            success: true,
            fetched: items.length,
            byStatus,
            capturedCount: captured.length,
            captured,
            failedCount: failed.length,
            failed,
        });
    } catch (err) {
        return json(500, { success: false, error: String(err) });
    }
});

function json(status: number, body: unknown) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}
