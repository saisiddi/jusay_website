-- ============================================================================
-- Jusay — public member counters (total members + paid members)
-- ============================================================================
--
-- Companion to supabase/stats.sql. That file owns the download/view event
-- counters; this file exposes the two people-counts the marketing site shows:
--
--   get_member_count()      every signed-up member (Google, email, any method)
--   get_pro_member_count()  the subset on a paid Pro plan
--
-- WHY MEMBERS AND NOT DOWNLOAD CLICKS
--   A download click is a weak signal: it fires before anyone commits, can be
--   repeated by one person, and misses everybody who installed from another
--   route. Signing in is the real "I'm using jusay" moment, and because the
--   download is login-gated every member has passed through it. So the member
--   count is both a truer and a steadier number than click events.
--
-- WHO COUNTS
--   Confirmed, live accounts only: soft-deleted users and Supabase anonymous
--   sessions are excluded, so the figure cannot be inflated by throwaway
--   sessions or by signups that never verified.
--
-- HOW TO RUN
--   Paste into Supabase -> SQL Editor -> Run. Idempotent (CREATE OR REPLACE).
--
-- PRIVACY
--   Each function returns a single integer. No email, id or row ever leaves
--   the database, which is what allows auth.users to back a public number.
--
-- CLIENT CALLS
--   supabase.rpc('get_member_count')
--   supabase.rpc('get_pro_member_count')
-- ============================================================================

create or replace function public.get_member_count()
returns bigint
language sql
security definer
stable
set search_path = public, auth, pg_temp
as $$
  select count(*)::bigint
  from auth.users
  where deleted_at is null
    and confirmed_at is not null
    and coalesce(is_anonymous, false) = false;
$$;

comment on function public.get_member_count() is
  'Total confirmed, non-deleted members across all sign-in providers. Returns a count only.';

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

revoke execute on function public.get_member_count()     from public;
revoke execute on function public.get_pro_member_count() from public;
grant  execute on function public.get_member_count()     to anon, authenticated;
grant  execute on function public.get_pro_member_count() to anon, authenticated;
