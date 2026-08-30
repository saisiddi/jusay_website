import { supabase } from "@/lib/supabase";

/**
 * THE canonical Pro entitlement rule for Jusay.
 *
 * The desktop app implements the identical rule. If you change anything here,
 * the desktop app has to change with it or the two clients will disagree about
 * who is Pro — which is what produced the duplicate-payment bug this module
 * exists to kill.
 *
 * `isPro` is true when, for the authenticated user:
 *   profiles.plan === 'pro'
 *   AND a `subscriptions` row exists for that user_id with
 *       status IN ('active','trialing')
 *       AND (current_period_end IS NULL OR current_period_end > now())
 *
 * With one deliberate exception: when `profiles.plan === 'pro'` but no such
 * subscription row is found, the user is STILL Pro and we log a warning. The
 * profile row is written by the payment system itself; a missing or lagging
 * subscription row is an infrastructure hiccup, never a reason to downgrade
 * somebody who has paid. Never contradict the profile.
 *
 * Both reads are SELECT-only. This module never writes to `profiles` or
 * `subscriptions` — those tables belong to the payment backend.
 */

/** Subscription statuses that count as a live entitlement. */
export const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing"] as const;

export type EntitlementPlan = "free" | "pro";

/**
 * Where the Pro answer came from:
 *  - `subscription` → profile says pro AND a live subscription row backs it up
 *  - `profile`      → profile says pro but no live subscription row was found
 *                     (or the row has lapsed). Pro is honoured, warning logged.
 *  - `none`         → not Pro.
 */
export type EntitlementSource = "profile" | "subscription" | "none";

export interface Entitlement {
  plan: EntitlementPlan;
  isPro: boolean;
  /** Status of the subscription row we matched, when there was one. */
  status: string | null;
  /** ISO timestamp the current period ends, or null for open-ended rows. */
  currentPeriodEnd: string | null;
  source: EntitlementSource;
}

/** The answer for a signed-out visitor, or when everything failed to load. */
export const FREE_ENTITLEMENT: Entitlement = {
  plan: "free",
  isPro: false,
  status: null,
  currentPeriodEnd: null,
  source: "none",
};

/** Shape of the single `subscriptions` column set this rule needs. */
export interface SubscriptionSnapshot {
  status: string | null;
  current_period_end: string | null;
}

/** A `current_period_end` of null means open-ended, so it never expires. */
const isWithinPeriod = (currentPeriodEnd: string | null, now: number): boolean => {
  if (currentPeriodEnd === null || currentPeriodEnd === undefined) return true;
  const end = new Date(currentPeriodEnd).getTime();
  // An unparseable timestamp is treated as open-ended rather than expired —
  // erring toward the paying customer.
  if (Number.isNaN(end)) return true;
  return end > now;
};

const isActiveStatus = (status: string | null): boolean =>
  status !== null &&
  (ACTIVE_SUBSCRIPTION_STATUSES as readonly string[]).includes(status.toLowerCase());

/**
 * Applies the canonical rule to already-fetched rows. Pure and synchronous, so
 * the rule itself is testable without a database.
 *
 * @param plan  `profiles.plan` for the user (null when there is no profile row).
 * @param subscriptions Every `subscriptions` row for the user. Order does not matter.
 * @param now   Injectable clock, for tests.
 */
export const decideEntitlement = (
  plan: string | null | undefined,
  subscriptions: SubscriptionSnapshot[] | null | undefined,
  now: number = Date.now()
): Entitlement => {
  const profileSaysPro = (plan ?? "").toLowerCase() === "pro";
  const rows = subscriptions ?? [];

  const liveRow =
    rows.find((row) => isActiveStatus(row.status) && isWithinPeriod(row.current_period_end, now)) ??
    null;

  if (liveRow) {
    // A live subscription is authoritative on its own: it is the payment
    // system's most specific statement that this user is entitled right now.
    // Honouring it also covers the window where the webhook has written
    // `subscriptions` but not yet flipped `profiles.plan`.
    return {
      plan: "pro",
      isPro: true,
      status: liveRow.status,
      currentPeriodEnd: liveRow.current_period_end ?? null,
      source: "subscription",
    };
  }

  if (profileSaysPro) {
    // Profile says paid, no live subscription row backs it up. Stay Pro and
    // make the mismatch loud so it can be chased in the backend.
    const nearest = rows[0] ?? null;
    console.warn(
      "[jusay] entitlement mismatch: profiles.plan is 'pro' but no active/unexpired " +
        "subscription row was found. Honouring Pro from the profile. " +
        `rows=${rows.length}` +
        (nearest ? ` latestStatus=${nearest.status} latestEnd=${nearest.current_period_end}` : "")
    );
    return {
      plan: "pro",
      isPro: true,
      status: nearest?.status ?? null,
      currentPeriodEnd: nearest?.current_period_end ?? null,
      source: "profile",
    };
  }

  return FREE_ENTITLEMENT;
};

/**
 * Resolves the live entitlement for a user straight from Supabase.
 *
 * Read-only. Never throws: any failure resolves to the free entitlement so the
 * UI can render, and callers can retry (see `refreshEntitlement`).
 */
export const resolveEntitlement = async (userId: string | null | undefined): Promise<Entitlement> => {
  if (!userId) return FREE_ENTITLEMENT;

  const [profileResult, subscriptionResult] = await Promise.all([
    supabase.from("profiles").select("plan").eq("id", userId).maybeSingle(),
    supabase
      .from("subscriptions")
      .select("status, current_period_end")
      .eq("user_id", userId)
      .order("current_period_end", { ascending: false, nullsFirst: true }),
  ]);

  if (profileResult.error) {
    console.error("[jusay] entitlement: profiles read failed:", profileResult.error.message);
  }
  if (subscriptionResult.error) {
    console.error(
      "[jusay] entitlement: subscriptions read failed:",
      subscriptionResult.error.message
    );
  }

  const plan = (profileResult.data as { plan?: string | null } | null)?.plan ?? null;
  const rows = (subscriptionResult.data as SubscriptionSnapshot[] | null) ?? [];

  return decideEntitlement(plan, rows);
};
