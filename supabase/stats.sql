-- ============================================================================
-- Jusay — public download counter + website view counter
-- ============================================================================
--
-- WHAT THIS CREATES
--   table     public.site_events        one row per event ('download' | 'view')
--   function  public.record_download()  logs a download
--   function  public.record_view()      logs a page view
--   function  public.get_public_stats() returns the two totals, nothing else
--
-- HOW TO RUN
--   Paste into Supabase -> SQL Editor -> Run. Nothing else needs to happen.
--
-- IDEMPOTENT
--   Safe to run more than once. The table and index use IF NOT EXISTS, the
--   functions use CREATE OR REPLACE, and the grants/revokes are re-runnable.
--   Re-running never drops data and never touches any other table.
--
-- PRIVACY MODEL: RLS + SECURITY DEFINER
--   site_events has row level security ENABLED and deliberately has NO
--   policies. With RLS on and zero policies, anon and authenticated can read
--   nothing, ever -- even by accident, even through PostgREST. Direct table
--   privileges are revoked from those roles on top of that.
--
--   The three functions are SECURITY DEFINER, so they run as the owner and
--   bypass RLS. They are the only doorway into the table, and each one is
--   narrow on purpose: two of them write a single sanitised row, and the third
--   returns only two aggregate numbers. Raw rows never leave the database.
--
--   Every function pins search_path to (public, pg_temp) so a hostile
--   schema on the caller's search_path cannot hijack an unqualified name --
--   the standard hardening for SECURITY DEFINER functions.
--
-- NO PII, BY DESIGN
--   This schema stores NO IP address, NO user agent, NO user id, NO session
--   id, and no cookie. record_view() also strips everything from the first
--   '?' or '#' onward, so query strings and fragments -- the usual place
--   access tokens, emails and referral ids leak into -- are never written.
--   There is nothing here to leak, subject-access-request, or regret.
--
-- KNOWN, ACCEPTED LIMITATION
--   anon may execute the two record functions, because the website calls them
--   before anyone signs in. Anyone can therefore call the RPC directly in a
--   loop and inflate these counters. That is acceptable for a public vanity
--   counter: nothing is billed, granted, or entitled off these numbers. Do
--   not use them for anything that matters. Rate limiting and bot filtering
--   are out of scope for this file.
--
-- CLIENT CALLS
--   supabase.rpc('record_download', { p_platform: 'windows' })
--   supabase.rpc('record_view', { p_path: '/' })
--   supabase.rpc('get_public_stats')
--
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Event table
-- ---------------------------------------------------------------------------

create table if not exists public.site_events (
  id          bigint generated always as identity primary key,
  kind        text not null check (kind in ('download', 'view')),
  created_at  timestamptz not null default now(),
  path        text,      -- set for 'view', null for 'download'
  platform    text       -- set for 'download', null for 'view'
);

comment on table public.site_events is
  'Append-only public download/view events. No IP, user agent or user id is stored. Read only via public.get_public_stats().';

-- Serves both aggregate counts and any future "last N days" query.
create index if not exists site_events_kind_created_at_idx
  on public.site_events (kind, created_at desc);


-- ---------------------------------------------------------------------------
-- 2. Lock the table down: RLS on, zero policies, no direct privileges
-- ---------------------------------------------------------------------------

alter table public.site_events enable row level security;

-- Intentionally no CREATE POLICY statements below this line.
-- RLS enabled + no policies = no client can see or write rows directly.
revoke all on table public.site_events from anon, authenticated;


-- ---------------------------------------------------------------------------
-- 3. record_download(p_platform)
-- ---------------------------------------------------------------------------

create or replace function public.record_download(p_platform text default 'windows')
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_platform text;
begin
  v_platform := left(trim(lower(coalesce(p_platform, ''))), 32);

  -- Anything unrecognised is recorded as the default rather than rejected:
  -- a bad argument should not cost us the download count.
  if v_platform not in ('windows', 'mac', 'linux') then
    v_platform := 'windows';
  end if;

  insert into public.site_events (kind, platform)
  values ('download', v_platform);
end;
$$;

comment on function public.record_download(text) is
  'Records one download event. Platform is normalised to windows|mac|linux.';


-- ---------------------------------------------------------------------------
-- 4. record_view(p_path)
-- ---------------------------------------------------------------------------

create or replace function public.record_view(p_path text default '/')
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_path text;
begin
  v_path := trim(coalesce(p_path, ''));

  -- Drop the query string and the fragment. Access tokens, emails and
  -- referral ids live there; none of it belongs in this table.
  v_path := split_part(v_path, '?', 1);
  v_path := split_part(v_path, '#', 1);

  v_path := left(trim(v_path), 128);

  if v_path = '' then
    v_path := '/';
  end if;

  insert into public.site_events (kind, path)
  values ('view', v_path);
end;
$$;

comment on function public.record_view(text) is
  'Records one page view. Path is stripped of query string and fragment, then truncated to 128 chars.';


-- ---------------------------------------------------------------------------
-- 5. get_public_stats()
-- ---------------------------------------------------------------------------

create or replace function public.get_public_stats()
returns table (downloads bigint, views bigint)
language sql
security definer
stable
set search_path = public, pg_temp
as $$
  select
    count(*) filter (where kind = 'download')::bigint as downloads,
    count(*) filter (where kind = 'view')::bigint     as views
  from public.site_events;
$$;

comment on function public.get_public_stats() is
  'Returns total downloads and total views. Exposes no rows, timestamps, paths or user data.';


-- ---------------------------------------------------------------------------
-- 6. Execute privileges
-- ---------------------------------------------------------------------------

-- Drop the implicit EXECUTE-to-PUBLIC grant first, then hand it back to the
-- two roles that actually need it. Order matters: revoke, then grant.
revoke execute on function public.record_download(text)  from public;
revoke execute on function public.record_view(text)      from public;
revoke execute on function public.get_public_stats()     from public;

grant execute on function public.record_download(text)  to anon, authenticated;
grant execute on function public.record_view(text)       to anon, authenticated;
grant execute on function public.get_public_stats()      to anon, authenticated;


-- ---------------------------------------------------------------------------
-- Verify (uncomment to run)
-- ---------------------------------------------------------------------------

-- select * from public.get_public_stats();
