// ============================================
// Supabase Edge Function: razorpay-webhook
// Handles Razorpay payment events (subscription activated/cancelled)
//
// Activation promotes the profile to 'pro' directly. Cancellation NEVER
// downgrades on its own: it records that the subscription stopped renewing and
// then calls recompute_user_plan, which keeps Pro for as long as a paid period
// is still running and accounts for the user's other subscriptions. Access ends
// via the scheduled sweep in supabase/entitlement_sync.sql, at period end.
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RAZORPAY_WEBHOOK_SECRET = Deno.env.get('RAZORPAY_WEBHOOK_SECRET')!;

const DAY_MS = 24 * 60 * 60 * 1000;

// Bonus-month offer ("Pay 1 month and Get 1 month FREE"): the ₹49 upfront
// amount buys 60 days of access.
const BONUS_MONTH_ACCESS_DAYS = 60;

// HMAC SHA256 using Web Crypto API (built-in, no external deps)
async function verifySignature(body: string, signature: string): Promise<boolean> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(RAZORPAY_WEBHOOK_SECRET),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const hashArray = Array.from(new Uint8Array(sig));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex === signature;
}

serve(async (req) => {
    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
    }

    try {
        // ---- 1. Verify Razorpay signature ----
        const body = await req.text();
        const razorpaySignature = req.headers.get('x-razorpay-signature');

        if (!razorpaySignature) {
            console.error('[webhook] Missing Razorpay signature');
            return new Response('Missing signature', { status: 400 });
        }

        if (RAZORPAY_WEBHOOK_SECRET) {
            const valid = await verifySignature(body, razorpaySignature);
            if (!valid) {
                console.error('[webhook] Invalid signature');
                return new Response('Invalid signature', { status: 401 });
            }
        }

        // ---- 2. Parse webhook event ----
        const event = JSON.parse(body);
        const eventType = event.event;
        console.log(`[webhook] Event: ${eventType}`);

        // Use service role client for DB writes (no user context in webhooks)
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        // ---- 3. Handle events ----
        switch (eventType) {
            // `authenticated` is the bonus-month moment of truth: the ₹49 upfront amount
            // (subscription addon) has been collected and the mandate is live,
            // while the recurring cycle itself only starts on day 61.
            case 'subscription.authenticated':
            case 'subscription.activated':
            case 'subscription.charged': {
                const subscription = event.payload.subscription.entity;
                const subscriptionId = subscription.id;
                const userId = subscription.notes?.user_id;

                if (!userId) {
                    console.error('[webhook] No user_id in subscription notes');
                    return new Response('OK', { status: 200 });
                }

                console.log(`[webhook] Activating Pro for user ${userId}`);

                const subUpdate: Record<string, unknown> = { status: 'active' };

                if (subscription.current_start && subscription.current_end) {
                    // Billing cycle has started — Razorpay's own dates are authoritative.
                    subUpdate.current_period_start = new Date(subscription.current_start * 1000).toISOString();
                    subUpdate.current_period_end = new Date(subscription.current_end * 1000).toISOString();
                } else if (subscription.notes?.bonus_month === 'true') {
                    // Bonus-month subscriber, cycle not started yet (start_at = day 61), so
                    // Razorpay reports no period. The paid access window is 60 days
                    // from the upfront payment.
                    const accessDays =
                        parseInt(subscription.notes?.access_days || '', 10) || BONUS_MONTH_ACCESS_DAYS;
                    const start = new Date();
                    subUpdate.current_period_start = start.toISOString();
                    subUpdate.current_period_end = new Date(start.getTime() + accessDays * DAY_MS).toISOString();
                }
                // Otherwise leave the period columns alone — create-subscription
                // already wrote them and Razorpay has nothing better to offer.

                // Update subscription status
                await supabase
                    .from('subscriptions')
                    .update(subUpdate)
                    .eq('razorpay_subscription_id', subscriptionId);

                // UPSERT, not UPDATE. If the profile row is missing (the signup
                // trigger having skipped this user), a plain update writes
                // nothing and the paid user is stranded on Free. Insert-or-update
                // guarantees Pro is granted even when confirm-payment never ran
                // because the payer closed the tab.
                const emailNote = subscription.notes?.email;
                const { error: profErr } = await supabase
                    .from('profiles')
                    .upsert({
                        id: userId,
                        email: emailNote || `${userId}@no-email.local`,
                        plan: 'pro',
                        subscription_status: 'active',
                        updated_at: new Date().toISOString(),
                    }, { onConflict: 'id' });
                if (profErr) console.error(`[webhook] profile upsert failed for ${userId}: ${profErr.message}`);
                else console.log(`[webhook] User ${userId} upgraded to Pro`);
                break;
            }

            case 'subscription.cancelled':
            case 'subscription.completed': {
                const subscription = event.payload.subscription.entity;
                const subscriptionId = subscription.id;
                const userId = subscription.notes?.user_id;

                if (!userId) {
                    console.error('[webhook] No user_id in subscription notes');
                    return new Response('OK', { status: 200 });
                }

                console.log(`[webhook] Subscription ${subscriptionId} ended for user ${userId}`);

                // Mark THIS subscription as no longer renewing. Note we do not
                // touch current_period_end: the window the user already paid
                // for stays exactly as it was.
                await supabase
                    .from('subscriptions')
                    .update({ status: 'cancelled' })
                    .eq('razorpay_subscription_id', subscriptionId);

                // Never downgrade straight from this event. Two ways that was
                // wrong before:
                //   1. It ignored current_period_end, so someone who had paid
                //      through October lost Pro the day they stopped renewing.
                //   2. It ignored the user's OTHER subscriptions, so cancelling
                //      a duplicate/retried row demoted a user whose main
                //      subscription was still active.
                // recompute_user_plan re-derives the plan from every
                // subscription the user has, and keeps Pro while any paid
                // period is still running. Expiry is handled by the scheduled
                // sweep (see supabase/entitlement_sync.sql), not by this event.
                const { data: resolvedPlan, error: recomputeError } = await supabase.rpc(
                    'recompute_user_plan',
                    { p_user_id: userId, p_allow_downgrade: true }
                );

                if (recomputeError) {
                    // Leave the profile untouched rather than guessing. A wrong
                    // 'free' here is exactly the bug we are removing; the
                    // scheduled sweep will reconcile this user shortly.
                    console.error(
                        `[webhook] recompute_user_plan failed for ${userId}: ${recomputeError.message}. Profile left as-is.`
                    );
                } else {
                    console.log(`[webhook] User ${userId} plan recomputed -> ${resolvedPlan}`);
                }
                break;
            }

            case 'payment.failed': {
                const payment = event.payload.payment.entity;
                console.error(`[webhook] Payment failed: ${payment.id} - ${payment.error_description}`);
                break;
            }

            default:
                console.log(`[webhook] Unhandled event: ${eventType}`);
        }

        return new Response('OK', { status: 200 });

    } catch (error) {
        console.error('[webhook] Error:', error);
        return new Response('OK', { status: 200 });
    }
});
