-- ============================================================================
-- Jusay — guarantee every auth user has a profile row
-- ============================================================================
--
-- WHY (root cause of "paid but still Free")
--   The payment paths update Pro with:  UPDATE profiles SET plan='pro' WHERE id = <uid>
--   That is a no-op when the profile row does not exist. 16 of 62 auth users had
--   no profile, so a real payment for such a user updated zero rows and left them
--   Free -- exactly what happened to aishwanth.dev@gmail.com after paying.
--
--   The signup trigger existed but had clearly missed users (added after early
--   signups, and any error inside it silently dropped the row). This file:
--     1. backfills the missing profiles, and
--     2. rebuilds handle_new_user to be idempotent and never block signup.
--
--   The payment functions are also being changed to UPSERT the profile, so even
--   if a profile is somehow still missing at pay time, Pro is granted anyway.
--   Belt and braces on both sides.
--
-- IDEMPOTENT. Safe to re-run.
-- ============================================================================

-- 1) Backfill: one profile per auth user that lacks one.
insert into public.profiles (id, email, plan)
select u.id,
       coalesce(nullif(u.email, ''), u.id::text || '@no-email.local'),
       'free'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

-- 2) Harden the signup trigger so new users always get a profile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, plan)
  values (
    new.id,
    coalesce(nullif(new.email, ''), new.id::text || '@no-email.local'),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    'free'
  )
  on conflict (id) do nothing;   -- never fail signup on a re-run/race
  return new;
exception
  when others then
    -- A profile hiccup must never block account creation; the backfill and the
    -- upsert in the payment path both act as safety nets.
    raise warning '[handle_new_user] profile insert failed for %: %', new.id, sqlerrm;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
