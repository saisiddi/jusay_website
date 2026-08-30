-- =====================================================================
--  Jusay — public site stats (downloads + paid members)
--  Run this once in the Supabase project: Dashboard → SQL Editor → paste
--  → Run. Safe to re-run (idempotent).
--
--  Why functions instead of direct table reads?
--   • Anonymous visitors must see aggregate counts, but Row Level Security
--     (correctly) hides individual `profiles` / `subscriptions` rows.
--   • These SECURITY DEFINER functions return ONLY two integers — never any
--     personal data — so the numbers are public while the tables stay locked.
-- =====================================================================

-- 1) One row per successful website download.
create table if not exists public.downloads (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  user_id     uuid,
  platform    text not null default 'windows'
);

-- RLS on, with no client-facing policies: the table is reachable only through
-- the SECURITY DEFINER functions below, never directly from the browser.
alter table public.downloads enable row level security;

-- 2) Record one successful download. Called from the site on every completed
--    download (anonymous or signed-in). Attributes the row to the user when
--    a session exists, otherwise stays anonymous.
create or replace function public.record_download(p_platform text default 'windows')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.downloads (user_id, platform)
  values (auth.uid(), coalesce(nullif(p_platform, ''), 'windows'));
end;
$$;

-- 3) The two public counters. `pro_members` mirrors the canonical entitlement
--    rule: a profile whose plan is 'pro' has paid.
create or replace function public.get_public_stats()
returns table (downloads bigint, pro_members bigint)
language sql
security definer
set search_path = public
as $$
  select
    (select count(*) from public.downloads)                   as downloads,
    (select count(*) from public.profiles where plan = 'pro') as pro_members;
$$;

-- 4) Expose exactly these two functions to the web client. Nothing else.
grant execute on function public.record_download(text) to anon, authenticated;
grant execute on function public.get_public_stats()   to anon, authenticated;
