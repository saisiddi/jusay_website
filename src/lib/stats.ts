import { supabase } from "@/lib/supabase";

/**
 * Public, aggregate-only counters for the marketing site.
 *
 * Both numbers come from SECURITY DEFINER RPCs, so anonymous visitors can read
 * the totals while Row Level Security keeps the underlying rows private:
 *   • members    → get_member_count()      (auth.users, all sign-in providers)
 *   • proMembers → get_pro_member_count()  (profiles.plan = 'pro')
 * See supabase/pro_members.sql.
 *
 * `members` counts people signed up through any method (Google, email, …)
 * rather than download-button clicks: a click fires before anyone commits and
 * one person can repeat it, whereas signing in is the real "using jusay"
 * moment, and the download is login-gated so every member passed through it.
 *
 * Each field is independent: a field is null when its RPC is unavailable or
 * fails, so one missing function never blanks the whole section.
 */
export interface PublicStats {
  /** Confirmed members across all sign-in methods, or null if unavailable. */
  members: number | null;
  /** People on a paid Pro plan, or null if unavailable. */
  proMembers: number | null;
}

const toNumber = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/**
 * Reads the public counters. Never throws. Returns null only when nothing at
 * all could be read (both RPCs failed), so callers can hide the section.
 */
export const fetchPublicStats = async (): Promise<PublicStats | null> => {
  const [memberRes, proRes] = await Promise.allSettled([
    supabase.rpc("get_member_count"),
    supabase.rpc("get_pro_member_count"),
  ]);

  let members: number | null = null;
  let proMembers: number | null = null;

  if (memberRes.status === "fulfilled" && !memberRes.value.error) {
    members = toNumber(memberRes.value.data);
  } else {
    const reason =
      memberRes.status === "rejected" ? memberRes.reason : memberRes.value.error;
    console.error("[jusay] get_member_count failed:", reason);
  }

  if (proRes.status === "fulfilled" && !proRes.value.error) {
    proMembers = toNumber(proRes.value.data);
  } else {
    const reason = proRes.status === "rejected" ? proRes.reason : proRes.value.error;
    console.error("[jusay] get_pro_member_count failed:", reason);
  }

  if (members === null && proMembers === null) return null;
  return { members, proMembers };
};

/**
 * Records one successful download via the shared `record_download` RPC
 * (supabase/stats.sql). This no longer feeds the public counter — it is kept
 * because it is the only record of actual installs, which is worth having.
 * Fire-and-forget: swallows every error and never blocks the file transfer.
 * No-op under the test runner so unit tests stay hermetic.
 */
export const recordDownload = async (platform = "windows"): Promise<void> => {
  if (import.meta.env?.MODE === "test") return;
  try {
    await supabase.rpc("record_download", { p_platform: platform });
  } catch (err) {
    console.error("[jusay] recordDownload failed:", err);
  }
};
