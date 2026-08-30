-- ============================================================================
-- Jusay — allow Razorpay's real subscription statuses
-- ============================================================================
--
-- WHY
--   subscriptions.status was constrained to
--     ('active','cancelled','past_due','trialing','pending')
--   which does not include the two states that decide whether money was
--   actually collected:
--
--     created       - subscription exists, mandate NOT authenticated, ₹0 taken
--     authenticated - mandate live and the upfront amount captured, i.e. PAID
--
--   Because those values were rejected, an unpaid subscription could only ever
--   be stored as 'active', which is indistinguishable from a paid one. That is
--   what let a user who merely clicked "Upgrade to Pro" appear as Pro. Writes
--   attempting the correct value failed the CHECK, and since the payment
--   functions did not inspect their write errors, the failures were invisible.
--
--   Storing Razorpay's own vocabulary verbatim removes the ambiguity: paid and
--   unpaid are now different values, so no downstream rule has to guess.
--
-- ENTITLING vs NON-ENTITLING (see supabase/entitlement_sync.sql)
--   entitling      : active, trialing, authenticated
--                    (+ cancelled/completed while the paid period remains)
--   non-entitling  : created, pending, halted, paused, expired, past_due
--
-- IDEMPOTENT. Safe to re-run.
-- ============================================================================

alter table public.subscriptions
  drop constraint if exists subscriptions_status_check;

alter table public.subscriptions
  add constraint subscriptions_status_check
  check (status in (
    -- Razorpay subscription lifecycle
    'created',
    'authenticated',
    'active',
    'pending',
    'halted',
    'paused',
    'cancelled',
    'completed',
    'expired',
    -- legacy values already present in this table
    'past_due',
    'trialing'
  ));
