-- ============================================================================
-- Jusay — one subscription row per Razorpay subscription id
-- ============================================================================
--
-- WHY
--   confirm-payment and razorpay-webhook upsert on razorpay_subscription_id
--   (INSERT ... ON CONFLICT (razorpay_subscription_id) DO UPDATE). Without a
--   UNIQUE constraint on that column the upsert errors at runtime
--   ("no unique or exclusion constraint matching the ON CONFLICT
--   specification"), so the self-healing writes would silently fail exactly
--   when they are needed. This adds the constraint the upserts rely on, and it
--   also prevents duplicate rows for the same Razorpay subscription.
--
--   Verified before adding: no duplicate and no null razorpay_subscription_id
--   values exist, so the constraint applies cleanly.
--
-- IDEMPOTENT. Safe to re-run.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'subscriptions_razorpay_subscription_id_key'
      and conrelid = 'public.subscriptions'::regclass
  ) then
    alter table public.subscriptions
      add constraint subscriptions_razorpay_subscription_id_key
      unique (razorpay_subscription_id);
  end if;
end;
$$;
