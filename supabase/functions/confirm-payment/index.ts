// ============================================
// Supabase Edge Function: confirm-payment
// Verifies Razorpay payment, activates subscription
// Handles the bonus month and monthly→annual upgrade bonus days
// ============================================

// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')!;
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')!;

const DAY_MS = 24 * 60 * 60 * 1000;

// Offer copy (single canonical string): "Pay 1 month and Get 1 month FREE".
// Mechanically: ₹49 paid today buys 60 days of access.
const BONUS_MONTH_ACCESS_DAYS = 60;
const BONUS_MONTH_LABEL = 'Pay 1 month and Get 1 month FREE';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const { subscriptionId, paymentId } = await req.json();
        if (!subscriptionId) {
            return jsonResponse(400, { success: false, error: 'Missing subscriptionId' });
        }

        const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);

        // ---- 1. Read the subscription (source of user_id + plan notes) ----
        const rzpResponse = await fetch(`https://api.razorpay.com/v1/subscriptions/${subscriptionId}`, {
            headers: { 'Authorization': `Basic ${auth}` },
        });
        if (!rzpResponse.ok) {
            return jsonResponse(502, { success: false, error: 'Could not verify subscription' });
        }
        const subscription = await rzpResponse.json();
        console.log(`[confirm] Sub ${subscriptionId} status: ${subscription.status}`);

        // ---- 1b. PROOF OF PAYMENT: verify the payment itself, not the
        // subscription's status.
        //
        // The subscription status is the wrong gate on both sides:
        //   - accepting 'created' handed Pro to people who never paid;
        //   - requiring 'active'/'authenticated' rejected people who DID pay,
        //     because right after a UPI charge Razorpay can still report the
        //     subscription as 'created'/'pending' for a few seconds -- a race
        //     that left real payers on Free.
        //
        // A captured/authorized PAYMENT is the unambiguous "money moved" signal
        // and it is not subject to that lag. The client always passes the
        // payment id, so verify it and confirm it belongs to THIS subscription
        // (a subscription's charge is settled through an invoice that carries
        // the subscription id).
        let paymentVerified = false;
        if (paymentId) {
            const payRes = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
                headers: { 'Authorization': `Basic ${auth}` },
            });
            if (payRes.ok) {
                const payment = await payRes.json();
                const paid = payment.status === 'captured' || payment.status === 'authorized';
                let belongs = true;
                if (payment.invoice_id) {
                    const invRes = await fetch(`https://api.razorpay.com/v1/invoices/${payment.invoice_id}`, {
                        headers: { 'Authorization': `Basic ${auth}` },
                    });
                    if (invRes.ok) {
                        const invoice = await invRes.json();
                        belongs = invoice.subscription_id === subscriptionId;
                    }
                }
                paymentVerified = paid && belongs;
                console.log(`[confirm] Payment ${paymentId}: status=${payment.status} belongs=${belongs} -> verified=${paymentVerified}`);
            } else {
                console.warn(`[confirm] Could not fetch payment ${paymentId}: ${payRes.status}`);
            }
        }

        // Fallback: no usable payment id, but the subscription itself already
        // reports a paid state (webhook may have advanced it). Still safe.
        const subscriptionPaid = subscription.status === 'active' || subscription.status === 'authenticated';

        if (!paymentVerified && !subscriptionPaid) {
            console.warn(
                `[confirm] Refusing Pro for ${subscriptionId}: no captured payment and subscription is '${subscription.status}'.`
            );
            return jsonResponse(402, {
                success: false,
                error: 'Payment not completed yet. If you were charged, Pro will activate automatically in a moment.',
            });
        }

        // ---- 2. Extract info from notes ----
        const userId = subscription.notes?.user_id;
        if (!userId) {
            return jsonResponse(400, { success: false, error: 'No user_id in subscription' });
        }

        const planType = subscription.notes?.plan_type || 'pro_monthly';
        const bonusDays = parseInt(subscription.notes?.bonus_days || '0', 10);
        const bonusMonth = subscription.notes?.bonus_month === 'true';

        // ---- 3. Calculate period ----
        const now = new Date();
        let periodEnd;
        if (bonusMonth) {
            // Bonus-month subscriber: the ₹49 upfront amount just paid covers 60 days.
            // Razorpay's own current_start/current_end are still null here — the
            // recurring cycle only begins at start_at (day 61) — so the access
            // window has to come from the offer, not from Razorpay.
            const accessDays = parseInt(subscription.notes?.access_days || '', 10) || BONUS_MONTH_ACCESS_DAYS;
            periodEnd = new Date(now.getTime() + accessDays * DAY_MS);
        } else if (subscription.current_end) {
            // Use Razorpay's actual period end + bonus days
            periodEnd = new Date(subscription.current_end * 1000 + bonusDays * DAY_MS);
        } else if (planType === 'pro_annual') {
            periodEnd = new Date(now.getTime() + (365 + bonusDays) * DAY_MS);
        } else {
            periodEnd = new Date(now.getTime() + 30 * DAY_MS);
        }

        // ---- 4. Update DB ----
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // Upsert the subscription row. create-subscription normally wrote it,
        // but if that insert ever failed (e.g. a constraint hiccup) this makes
        // the record exist rather than silently updating nothing.
        const { error: subError } = await supabase.from('subscriptions').upsert({
            user_id: userId,
            plan: 'pro',
            status: 'active',
            razorpay_subscription_id: subscriptionId,
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
        }, { onConflict: 'razorpay_subscription_id' });
        if (subError) console.error(`[confirm] subscription upsert failed: ${subError.message}`);

        // UPSERT the profile, not UPDATE. A plain update is a no-op when the
        // profile row is missing (the exact bug that left a paid user on Free),
        // so insert-or-update guarantees the paid user ends up Pro regardless.
        const { error: profError } = await supabase.from('profiles').upsert({
            id: userId,
            email: subscription.notes?.email || `${userId}@no-email.local`,
            plan: 'pro',
            subscription_status: 'active',
            updated_at: now.toISOString(),
        }, { onConflict: 'id' });
        if (profError) {
            console.error(`[confirm] profile upsert failed: ${profError.message}`);
            return jsonResponse(500, { success: false, error: 'Could not activate Pro. Please contact support.' });
        }

        console.log(`[confirm] User ${userId} → Pro (${planType}). Ends: ${periodEnd.toISOString()}. Bonus month: ${bonusMonth}. Upgrade bonus: ${bonusDays}d`);

        return jsonResponse(200, {
            success: true,
            plan: 'pro',
            userId,
            planType,
            bonusMonth,
            bonusMonthLabel: bonusMonth ? BONUS_MONTH_LABEL : null,
            currentPeriodEnd: periodEnd.toISOString(),
        });

    } catch (error) {
        console.error('[confirm] Error:', error);
        return jsonResponse(500, { success: false, error: 'Internal error' });
    }
});

function jsonResponse(status, data) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}
