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

        // ---- 1. Verify with Razorpay ----
        const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
        const rzpResponse = await fetch(`https://api.razorpay.com/v1/subscriptions/${subscriptionId}`, {
            headers: { 'Authorization': `Basic ${auth}` },
        });

        if (!rzpResponse.ok) {
            return jsonResponse(502, { success: false, error: 'Could not verify subscription' });
        }

        const subscription = await rzpResponse.json();
        console.log(`[confirm] Sub ${subscriptionId} status: ${subscription.status}`);

        // Only states in which Razorpay has actually collected money may grant
        // Pro. 'created' was accepted here previously, which is a subscription
        // that exists but has never been authenticated -- no mandate, no rupee
        // taken. Anyone who clicked "Upgrade to Pro" and returned to the site
        // was therefore handed Pro for free.
        //
        //   created       -> nothing collected. Rejected.
        //   authenticated -> mandate live and the upfront amount captured. Paid.
        //   active        -> charging normally. Paid.
        const PAID_STATES = ['active', 'authenticated'];
        if (!PAID_STATES.includes(subscription.status)) {
            console.warn(
                `[confirm] Refusing to grant Pro for ${subscriptionId}: status '${subscription.status}' means no payment was collected.`
            );
            return jsonResponse(402, {
                success: false,
                error: `Payment not completed (subscription is '${subscription.status}').`,
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

        await supabase.from('subscriptions').update({
            status: 'active',
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
        }).eq('razorpay_subscription_id', subscriptionId);

        await supabase.from('profiles').update({
            plan: 'pro',
            subscription_status: 'active',
            updated_at: now.toISOString(),
        }).eq('id', userId);

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
