-- ============================================================================
-- Jusay — scheduled entitlement sweep
-- ============================================================================
--
-- Companion to supabase/entitlement_sync.sql. Run that file first.
--
-- WHY A SCHEDULE IS REQUIRED
--   The webhook no longer downgrades on cancellation, because the user may
--   still be inside a period they paid for. But nothing arrives from Razorpay
--   at the moment that period finally ends -- a cancelled subscription simply
--   goes quiet. Without this sweep, "keep Pro until period end" would silently
--   become "keep Pro forever".
--
--   So expiry is time-driven, not event-driven: once an hour, recompute every
--   payer's plan from the subscription facts. Users whose paid window has
--   closed drop to free; users with no subscription history (manually granted
--   Pro) are never touched.
--
-- IDEMPOTENT. Re-running replaces the job rather than stacking duplicates.
-- ============================================================================

create extension if not exists pg_cron;

-- Remove any previous version of the job before (re)creating it.
do $$
begin
  perform cron.unschedule('jusay-entitlement-sweep');
exception
  when others then null;  -- not scheduled yet
end;
$$;

-- Hourly, at minute 17 (off the hour to avoid the usual cron pile-up).
select cron.schedule(
  'jusay-entitlement-sweep',
  '17 * * * *',
  $$select public.sync_all_entitlements(true);$$
);
