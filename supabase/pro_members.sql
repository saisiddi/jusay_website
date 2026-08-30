-- ============================================================================
-- Jusay — public "paid members" counter
-- ============================================================================
--
-- Companion to supabase/stats.sql. That file owns downloads + views via the
-- site_events table; this file adds ONE more public number the marketing site
-- shows: how many people are on a paid Pro plan.
--
-- WHY A SEPARATE FUNCTION
--   get_public_stats() in stats.sql intentionally reads only site_events and
--   exposes nothing else. Paid-member count comes from the `profiles` table,
--   so it lives in its own SECURITY DEFINER function and is left untouched by
--   re-running stats.sql.
--
-- HOW TO RUN
--   Paste into Supabase -> SQL Editor -> Run. Idempotent (CREATE OR REPLACE).
--
-- PRIVACY
--   Returns a single integer. No row, id, email or name ever leaves the DB.
--   Mirrors the canonical entitlement rule: profiles.plan = 'pro' means paid.
--
-- CLIENT CALL
--   supabase.rpc('get_pro_member_count')
-- ============================================================================

create or replace function public.get_pro_member_count()
returns bigint
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select count(*)::bigint from public.profiles where plan = 'pro';
$$;

comment on function public.get_pro_member_count() is
  'Returns the number of paid Pro members. Exposes no rows or personal data.';

revoke execute on function public.get_pro_member_count() from public;
grant  execute on function public.get_pro_member_count() to anon, authenticated;
