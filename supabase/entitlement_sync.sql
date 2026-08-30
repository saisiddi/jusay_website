-- ============================================================================
-- Jusay — entitlement truth: derive profiles.plan from subscription facts
-- ============================================================================
--
-- WHY THIS EXISTS
--   Paying users were being shown "Free". Two defects in the Razorpay webhook's
--   cancellation branch caused it:
--
--     1. IMMEDIATE DOWNGRADE ON CANCEL. `subscription.cancelled` set
--        profiles.plan = 'free' straight away, ignoring current_period_end.
--        A user who paid for a window ending in October lost access the same
--        day the subscription stopped renewing.
--
--     2. CROSS-SUBSCRIPTION DOWNGRADE. The branch downgraded the profile
--        without asking whether the user still had ANOTHER live subscription.
--        Anyone with a duplicate/retried subscription got demoted the moment
--        any one of their rows was cancelled -- even while another was active.
--
--   The webhook is fixed separately. This file makes the DATABASE the single
--   source of truth so the two clients (website + desktop app) agree without
--   either of them needing to special-case anything: both already read
--   profiles.plan, so correcting the data corrects both at once.
--
-- THE RULE (one definition, used by repair AND by the scheduled sweep)
--   A subscription row entitles its user when:
--     - status is active / trialing / authenticated, and the period has not
--       ended (current_period_end IS NULL counts as open-ended); OR
--     - status is cancelled / completed AND current_period_end is a real
--       timestamp still in the future -- i.e. already paid for, not renewing.
--   Statuses such as created, pending, halted, paused, expired and failed
--   never entitle: nothing was successfully collected.
--
-- SAFETY: NEVER DEMOTE A COMPED ACCOUNT
--   Downgrades apply only to users who have at least one subscription row, so
--   manually granted Pro accounts (no subscription history) are left untouched.
--
-- IDEMPOTENT. Safe to re-run.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Does this user currently hold a paid entitlement?
-- ---------------------------------------------------------------------------
create or replace function public.has_live_entitlement(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.subscriptions s
    where s.user_id = p_user_id
      and (
        -- Live and renewing (or open-ended).
        (
          lower(coalesce(s.status, '')) in ('active', 'trialing', 'authenticated')
          and (s.current_period_end is null or s.current_period_end > now())
        )
        -- Paid through, but not renewing: honour the window they bought.
        or (
          lower(coalesce(s.status, '')) in ('cancelled', 'canceled', 'completed')
          and s.current_period_end is not null
          and s.current_period_end > now()
        )
      )
  );
$$;

comment on function public.has_live_entitlement(uuid) is
  'True when the user has a subscription that entitles them right now, including a cancelled-but-not-yet-expired paid period.';

-- ---------------------------------------------------------------------------
-- 1b. Ambiguous state: "still active here, but the period looks stale"
-- ---------------------------------------------------------------------------
-- A row that says active/trialing/authenticated while current_period_end sits
-- in the past means one of two things, and we cannot tell which from our data:
--   (a) the subscription really is still charging at Razorpay and we simply
--       missed a `subscription.charged` webhook, so our period is out of date;
--   (b) it died and our row was never updated.
-- Demoting on (a) would take Pro from somebody who is still paying -- the exact
-- failure we are removing. So this state never triggers a downgrade; it is
-- surfaced for reconciliation against Razorpay instead.
create or replace function public.has_stale_active_subscription(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = p_user_id
      and lower(coalesce(s.status,'')) in ('active','trialing','authenticated')
      and s.current_period_end is not null
      and s.current_period_end <= now()
  );
$$;

comment on function public.has_stale_active_subscription(uuid) is
  'True when a subscription still claims to be active but its period has lapsed. Blocks automatic downgrade; needs a Razorpay cross-check.';

-- Users needing that manual cross-check.
create or replace view public.entitlement_review as
select
  p.id            as user_id,
  p.email,
  p.plan,
  p.subscription_status,
  s.razorpay_subscription_id,
  s.status        as sub_status,
  s.current_period_end
from public.profiles p
join public.subscriptions s on s.user_id = p.id
where lower(coalesce(s.status,'')) in ('active','trialing','authenticated')
  and s.current_period_end is not null
  and s.current_period_end <= now()
  and not public.has_live_entitlement(p.id);

comment on view public.entitlement_review is
  'Subscriptions that claim to be active but whose period has lapsed. Verify each against Razorpay: renew the period if still charging, else mark cancelled/expired.';

revoke all on public.entitlement_review from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Recompute one user's plan from those facts
-- ---------------------------------------------------------------------------
-- p_allow_downgrade = false is the safe mode used for repairs: it can only
-- promote a wrongly-demoted payer, never take Pro away from anyone.
create or replace function public.recompute_user_plan(
  p_user_id uuid,
  p_allow_downgrade boolean default true
)
returns text
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_entitled  boolean;
  v_has_subs  boolean;
  v_stale     boolean;
  v_plan      text;
  v_target    text;
begin
  select public.has_live_entitlement(p_user_id)          into v_entitled;
  select public.has_stale_active_subscription(p_user_id) into v_stale;
  select exists(select 1 from public.subscriptions where user_id = p_user_id) into v_has_subs;
  select plan into v_plan from public.profiles where id = p_user_id;

  if v_entitled then
    v_target := 'pro';
  elsif v_stale then
    -- Ambiguous (see has_stale_active_subscription): never auto-demote. Listed
    -- in public.entitlement_review for a Razorpay cross-check.
    v_target := coalesce(v_plan, 'free');
  elsif v_has_subs and p_allow_downgrade then
    -- Came through the payment system, subscription is unambiguously finished
    -- and the paid window has closed.
    v_target := 'free';
  else
    -- No subscription history (comped/manual Pro), or downgrades disabled.
    v_target := coalesce(v_plan, 'free');
  end if;

  if coalesce(v_plan, '') <> v_target then
    update public.profiles
       set plan = v_target,
           -- Keep the display field honest: 'active' while renewing,
           -- 'cancelled' when riding out a paid period, else 'inactive'.
           subscription_status = case
             when v_target = 'pro' and exists (
               select 1 from public.subscriptions
               where user_id = p_user_id
                 and lower(coalesce(status,'')) in ('active','trialing','authenticated')
                 and (current_period_end is null or current_period_end > now())
             ) then 'active'
             when v_target = 'pro' then 'cancelled'
             else 'inactive'
           end,
           updated_at = now()
     where id = p_user_id;
  end if;

  return v_target;
end;
$$;

comment on function public.recompute_user_plan(uuid, boolean) is
  'Sets profiles.plan from subscription facts. Pass false to promote-only (never demote).';

-- ---------------------------------------------------------------------------
-- 3. Sweep every payer. This is what the schedule calls.
-- ---------------------------------------------------------------------------
create or replace function public.sync_all_entitlements(
  p_allow_downgrade boolean default true
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r       record;
  v_count integer := 0;
  v_before text;
  v_after  text;
begin
  for r in select distinct user_id from public.subscriptions where user_id is not null loop
    select plan into v_before from public.profiles where id = r.user_id;
    v_after := public.recompute_user_plan(r.user_id, p_allow_downgrade);
    if coalesce(v_before,'') <> coalesce(v_after,'') then
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

comment on function public.sync_all_entitlements(boolean) is
  'Recomputes plan for every user with subscription history. Returns how many changed.';

-- ---------------------------------------------------------------------------
-- 4. Privileges: server-side only. No client may call these.
-- ---------------------------------------------------------------------------
revoke execute on function public.has_live_entitlement(uuid)              from public, anon, authenticated;
revoke execute on function public.has_stale_active_subscription(uuid)    from public, anon, authenticated;
grant  execute on function public.has_stale_active_subscription(uuid)    to service_role;
revoke execute on function public.recompute_user_plan(uuid, boolean)  from public, anon, authenticated;
revoke execute on function public.sync_all_entitlements(boolean)      from public, anon, authenticated;
grant  execute on function public.has_live_entitlement(uuid)          to service_role;
grant  execute on function public.recompute_user_plan(uuid, boolean)  to service_role;
grant  execute on function public.sync_all_entitlements(boolean)      to service_role;
