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
--   download is login-gated every member has passed through it.
--
-- ONE POPULATION, USED BY BOTH COUNTS  (this is the important part)
--   Both numbers are counted over the SAME set of accounts, defined once in
--   the countable_members view. When the two counts were defined separately
--   they disagreed: the members count excluded unconfirmed accounts while the
--   Pro count filtered nothing, so a real signup could be missing from the
--   total while still being counted as Pro. Sharing the definition makes that
--   impossible, and guarantees members >= pro_members at all times.
--
-- WHO COUNTS
--   Every real account: anyone who signed up through any provider, including
--   email signups that have not clicked the confirmation link yet -- they did
--   sign up, and a paying user must never be missing from the total.
--   Excluded: soft-deleted accounts and Supabase anonymous sessions, neither
--   of which is a person who joined.
--
-- HOW TO RUN
--   Paste into Supabase -> SQL Editor -> Run. Idempotent.
--
-- PRIVACY
--   Each function returns a single integer. No email, id or row ever leaves
--   the database, which is what allows auth.users to back a public number.
--   The view itself is revoked from anon/authenticated.
--
-- CLIENT CALLS
--   supabase.rpc('get_member_count')
--   supabase.rpc('get_pro_member_count')
-- ============================================================================

-- The single definition of "a member we count".
create or replace view public.countable_members as
select u.id
from auth.users u
where u.deleted_at is null
  and coalesce(u.is_anonymous, false) = false;

comment on view public.countable_members is
  'The one definition of a countable member: any real, non-deleted, non-anonymous account. Backs both public member counters.';

-- Never reachable from the browser; only the definer functions below read it.
revoke all on public.countable_members from anon, authenticated;

create or replace function public.get_member_count()
returns bigint
language sql
security definer
stable
set search_path = public, auth, pg_temp
as $$
  select count(*)::bigint from public.countable_members;
$$;

comment on function public.get_member_count() is
  'Total members across all sign-in providers (free and Pro). Returns a count only.';

create or replace function public.get_pro_member_count()
returns bigint
language sql
security definer
stable
set search_path = public, auth, pg_temp
as $$
  select count(*)::bigint
  from public.profiles p
  join public.countable_members m on m.id = p.id
  where p.plan = 'pro';
$$;

comment on function public.get_pro_member_count() is
  'Paid Pro members, counted over the same population as get_member_count(). Returns a count only.';

revoke execute on function public.get_member_count()     from public;
revoke execute on function public.get_pro_member_count() from public;
grant  execute on function public.get_member_count()     to anon, authenticated;
grant  execute on function public.get_pro_member_count() to anon, authenticated;
