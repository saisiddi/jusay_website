// ============================================
// Supabase Edge Function: create-subscription
// Creates a Razorpay subscription for authenticated user
// Handles: fresh subscribe (bonus month), monthly→annual upgrade
// ============================================

// @ts-nocheck
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID')!;
const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET')!;

const PLANS = {
    pro_monthly: { amount: 4900,  period: 'monthly', interval: 1 },  // ₹49/mo
    pro_annual:  { amount: 49000, period: 'yearly',  interval: 1 },  // ₹490/yr (₹41/mo × 12)
};

const DAY_MS = 24 * 60 * 60 * 1000;

// Offer copy (single canonical string): "Pay 1 month and Get 1 month FREE".
// Mechanically: pay one month today, get 60 days of access.
const BONUS_MONTH_ACCESS_DAYS = 60;
const BONUS_MONTH_LABEL = 'Pay 1 month and Get 1 month FREE';

// A monthly billing period never exceeds ~62 days (30/31-day cycles, or the
// 60-day bonus-month first cycle). Annual periods are 365+ days. Anything under
// this threshold is therefore a monthly subscription.
const MONTHLY_PERIOD_MAX_DAYS = 90;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        // ---- 1. Auth ----
        const authHeader = req.headers.get('authorization');
        if (!authHeader) return jsonResponse(401, { success: false, error: 'Missing authorization' });

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_ANON_KEY')!,
            { global: { headers: { Authorization: authHeader } } }
        );
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) return jsonResponse(401, { success: false, error: 'Invalid token' });

        // ---- 2. Parse plan type ----
        const { planType } = await req.json();
        if (!planType || !PLANS[planType]) {
            return jsonResponse(400, { success: false, error: 'Invalid plan type' });
        }

        const auth = btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`);
        const serviceClient = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // ---- 3. Check existing subscriptions ----
        const { data: existingSubs } = await serviceClient
            .from('subscriptions')
            .select('razorpay_subscription_id, status, current_period_start, current_period_end')
            .eq('user_id', user.id)
            .in('status', ['active', 'trialing'])
            .order('created_at', { ascending: false });

        let isUpgradeFromMonthly = false;
        let bonusDays = 0;

        // ---- Bonus-month eligibility ----
        // A user qualifies only if they have NEVER had a subscription row before
        // (any status). Monthly plan only.
        //
        // WHY THIS RAZORPAY PRIMITIVE (future `start_at` + `addons` upfront amount):
        // Razorpay's authentication transaction amount is decided by the
        // start-date/upfront-amount combination (docs: "How Subscriptions Work" →
        // Authentication Amount - Various Combinations):
        //   immediate start, no upfront  → plan amount charged now
        //   future start,   no upfront   → ₹5 token charge, auto-refunded
        //   immediate start, upfront     → upfront + plan amount charged now
        //   future start,   upfront      → upfront amount only
        // So a future `start_at` (= today + 60 days) plus an `addons` upfront
        // amount of ₹49 charges the customer exactly ₹49 today, gives 60 days of
        // access with no further charge, and starts the ₹49/month billing cycle on
        // day 61. `start_at` alone would have made month 1 genuinely free (₹5 auto
        // refunded), and an upfront amount with an immediate start would have
        // charged ₹98 today — neither matches the offer.
        const { count: priorSubCount } = await serviceClient
            .from('subscriptions')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', user.id);
        const bonusMonth = planType === 'pro_monthly' && (priorSubCount ?? 0) === 0;
        if (bonusMonth) {
            console.log(`[create-sub] First-time Pro user — ${BONUS_MONTH_LABEL}: ₹49 now, ${BONUS_MONTH_ACCESS_DAYS} days access`);
        }

        if (existingSubs && existingSubs.length > 0) {
            for (const sub of existingSubs) {
                // Check if current sub is monthly (a monthly period is < 90 days;
                // the bonus-month first cycle is 60 days, later cycles 30/31)
                if (sub.current_period_start && sub.current_period_end) {
                    const periodMs = new Date(sub.current_period_end).getTime() - new Date(sub.current_period_start).getTime();
                    const periodDays = periodMs / DAY_MS;
                    if (periodDays < MONTHLY_PERIOD_MAX_DAYS && planType === 'pro_annual') {
                        isUpgradeFromMonthly = true;
                        // Calculate remaining days of monthly as bonus
                        const remainingMs = new Date(sub.current_period_end).getTime() - Date.now();
                        bonusDays = Math.max(0, Math.ceil(remainingMs / DAY_MS));
                        console.log(`[create-sub] Monthly→Annual upgrade detected. ${bonusDays} bonus days from remaining monthly.`);
                    }
                }

                // Cancel old sub on Razorpay
                if (sub.razorpay_subscription_id) {
                    try {
                        await fetch(`https://api.razorpay.com/v1/subscriptions/${sub.razorpay_subscription_id}/cancel`, {
                            method: 'POST',
                            headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
                            body: JSON.stringify({ cancel_at_cycle_end: 0 }),
                        });
                    } catch (e) {
                        console.warn('[create-sub] Failed to cancel old sub:', e);
                    }
                }
                // Mark cancelled in DB
                await serviceClient.from('subscriptions')
                    .update({ status: 'cancelled' })
                    .eq('razorpay_subscription_id', sub.razorpay_subscription_id);
            }
        }

        // ---- 4. Create Razorpay plan ----
        const planConfig = PLANS[planType];
        const planResponse = await fetch('https://api.razorpay.com/v1/plans', {
            method: 'POST',
            headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                period: planConfig.period,
                interval: planConfig.interval,
                item: {
                    name: 'Jusay',
                    amount: planConfig.amount,
                    currency: 'INR',
                    description: `Jusay Pro ${planType === 'pro_monthly' ? 'Monthly' : 'Annual'} Subscription`,
                },
            }),
        });

        if (!planResponse.ok) {
            const errText = await planResponse.text();
            console.error('[create-sub] Plan creation error:', errText);
            return jsonResponse(502, { success: false, error: 'Failed to create plan.' });
        }

        const plan = await planResponse.json();

        // ---- 5. Create Razorpay subscription ----
        const subscriptionBody: Record<string, unknown> = {
            plan_id: plan.id,
            total_count: planType === 'pro_monthly' ? 120 : 10,
            quantity: 1,
            customer_notify: 1,
            notes: {
                user_id: user.id,
                email: user.email,
                plan_type: planType,
                bonus_days: String(bonusDays),
                is_upgrade: String(isUpgradeFromMonthly),
                bonus_month: String(bonusMonth),
                access_days: String(bonusMonth ? BONUS_MONTH_ACCESS_DAYS : 0),
            },
        };

        // Bonus month: charge ₹49 today as the authorisation transaction
        // (`addons` upfront amount) and push the recurring cycle out to day 61
        // (`start_at`), so the paid month covers days 1–30 and the free month
        // covers days 31–60. See the eligibility block above for the docs
        // reference behind this combination.
        if (bonusMonth) {
            subscriptionBody.start_at = Math.floor((Date.now() + BONUS_MONTH_ACCESS_DAYS * DAY_MS) / 1000);
            subscriptionBody.addons = [{
                item: {
                    name: `Jusay Pro — ${BONUS_MONTH_LABEL}`,
                    amount: planConfig.amount,   // ₹49, charged once, today
                    currency: 'INR',             // must match the plan currency
                },
            }];
        }

        const rzpResponse = await fetch('https://api.razorpay.com/v1/subscriptions', {
            method: 'POST',
            headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
            body: JSON.stringify(subscriptionBody),
        });

        if (!rzpResponse.ok) {
            const errText = await rzpResponse.text();
            console.error('[create-sub] Razorpay error:', errText);
            return jsonResponse(502, { success: false, error: 'Payment service error.' });
        }

        const subscription = await rzpResponse.json();

        // ---- 6. Store in DB ----
        const now = new Date();
        let periodEnd;
        if (planType === 'pro_monthly') {
            // Bonus-month first-time subscriber: 60 days of access for the ₹49 paid today.
            // Repeat monthly subscriber: plain 30-day cycle.
            periodEnd = new Date(now.getTime() + (bonusMonth ? BONUS_MONTH_ACCESS_DAYS : 30) * DAY_MS);
        } else {
            // Annual: 365 days + bonus days from monthly upgrade
            periodEnd = new Date(now.getTime() + (365 + bonusDays) * DAY_MS);
        }

        // Record the intent to subscribe, NOT an entitlement.
        //
        // This row is written the instant the user clicks "Upgrade to Pro",
        // before Razorpay has collected anything: the subscription we just
        // created is in Razorpay's `created` state, awaiting authentication.
        // Storing 'active' here (as this did previously) meant merely clicking
        // Upgrade granted Pro, because everything downstream reads an active
        // row with an unexpired period as proof of payment.
        //
        // So we mirror Razorpay's own initial status. Only razorpay-webhook,
        // on subscription.authenticated/activated/charged, promotes this row to
        // 'active' -- i.e. only real money moves it. The period columns are
        // written now because they are the window the payment will buy, and a
        // 'created' row never entitles anybody regardless of its dates.
        const { error: insertError } = await serviceClient.from('subscriptions').insert({
            user_id: user.id,
            plan: 'pro',
            status: 'created',
            razorpay_subscription_id: subscription.id,
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
        });

        // Log loudly rather than swallowing it. This write previously failed
        // unnoticed, leaving a paid user with no subscription row at all.
        if (insertError) {
            console.error(
                `[create-sub] FAILED to record subscription ${subscription.id} for ${user.id}: ${insertError.message}`
            );
        }

        console.log(`[create-sub] Created ${planType} for ${user.id}. Bonus month: ${bonusMonth}. Upgrade bonus: ${bonusDays}d. Ends: ${periodEnd.toISOString()}`);

        return jsonResponse(200, {
            success: true,
            bonusMonth,
            bonusMonthLabel: bonusMonth ? BONUS_MONTH_LABEL : null,
            accessDays: bonusMonth ? BONUS_MONTH_ACCESS_DAYS : null,
            amountDueNow: planConfig.amount,   // paise charged at checkout
            subscriptionId: subscription.id,
            url: subscription.short_url,
            keyId: RAZORPAY_KEY_ID,
            isUpgrade: isUpgradeFromMonthly,
            bonusDays,
        });

    } catch (error) {
        console.error('[create-sub] Error:', error);
        return jsonResponse(500, { success: false, error: 'Internal error' });
    }
});

function jsonResponse(status, data) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
}
