// ============================================
// Supabase Edge Function: reconcile-subscriptions
//
// Asks Razorpay what actually happened, and writes that truth into
// public.subscriptions.status.
//
// WHY THIS IS NEEDED
//   create-subscription used to insert rows as 'active' the moment somebody
//   clicked "Upgrade to Pro", and confirm-payment used to accept Razorpay's
//   'created' state as payment. Both are fixed, but rows written while they
//   were live still claim to be active without a rupee behind them. Only
//   Razorpay can say which subscriptions were really authenticated/charged, so
//   we read each one back and correct the local status.
//
// SAFETY
//   - Requires the service role key as a bearer token; never callable from a
//     browser session.
//   - Pass ?dry=1 to report what would change without writing anything.
//   - Only ever writes `status`. Periods, ids and profiles are left alone;
//     plans are recomputed afterwards by sync_all_entitlements.
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')!;
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// Dedicated shared secret for this maintenance endpoint, so it does not depend
// on which flavour of service key the project is currently issuing.
const RECONCILE_TOKEN = Deno.env.get('RECONCILE_TOKEN') ?? '';

serve(async (req) => {
    const token = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
    const authorised =
        (RECONCILE_TOKEN && token === RECONCILE_TOKEN) ||
        (SERVICE_ROLE_KEY && token === SERVICE_ROLE_KEY);
    if (!authorised) {
        return json(401, { success: false, error: 'Unauthorized' });
    }

    const dryRun = new URL(req.url).searchParams.get('dry') === '1';

    try {
        const supabase = createClient(Deno.env.get('SUPABASE_URL')!, SERVICE_ROLE_KEY);
        const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);

        const { data: rows, error } = await supabase
            .from('subscriptions')
            .select('id, user_id, status, razorpay_subscription_id, current_period_end');

        if (error) return json(500, { success: false, error: error.message });

        const changes: unknown[] = [];
        const unchanged: string[] = [];
        const failures: unknown[] = [];

        for (const row of rows ?? []) {
            const rzpId = row.razorpay_subscription_id;
            if (!rzpId) {
                failures.push({ id: row.id, reason: 'no razorpay_subscription_id' });
                continue;
            }

            const res = await fetch(`https://api.razorpay.com/v1/subscriptions/${rzpId}`, {
                headers: { Authorization: `Basic ${auth}` },
            });

            if (!res.ok) {
                // A 400/404 means Razorpay has no such subscription. Do NOT guess
                // a status from that: leave the row for a human to look at.
                failures.push({ id: row.id, rzpId, httpStatus: res.status });
                continue;
            }

            const sub = await res.json();
            const truth = String(sub.status ?? '').toLowerCase();

            if (!truth) {
                failures.push({ id: row.id, rzpId, reason: 'empty status from Razorpay' });
                continue;
            }

            if (truth === String(row.status ?? '').toLowerCase()) {
                unchanged.push(rzpId);
                continue;
            }

            if (!dryRun) {
                // Inspect the write. A silent failure here (a CHECK constraint
                // rejecting the status, say) would otherwise be reported as a
                // successful reconciliation while the row never moved.
                const { error: updateError } = await supabase
                    .from('subscriptions')
                    .update({ status: truth })
                    .eq('id', row.id);

                if (updateError) {
                    failures.push({
                        id: row.id,
                        rzpId,
                        attempted: truth,
                        reason: `update failed: ${updateError.message}`,
                    });
                    continue;
                }
            }

            changes.push({ rzpId, from: row.status, to: truth, userId: row.user_id });
        }

        // With statuses now truthful, re-derive every plan from them.
        let plansChanged: number | null = null;
        if (!dryRun) {
            const { data, error: rpcError } = await supabase.rpc('sync_all_entitlements', {
                p_allow_downgrade: true,
            });
            if (rpcError) console.error('[reconcile] sync_all_entitlements failed:', rpcError.message);
            else plansChanged = data as number;
        }

        return json(200, {
            success: true,
            dryRun,
            totalRows: rows?.length ?? 0,
            changed: changes.length,
            changes,
            unchangedCount: unchanged.length,
            failures,
            plansChanged,
        });
    } catch (err) {
        console.error('[reconcile] Error:', err);
        return json(500, { success: false, error: String(err) });
    }
});

function json(status: number, body: unknown) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}
