import { supabase } from "@/lib/supabase";

/**
 * Public, aggregate-only counters for the marketing site.
 *
 * Numbers come from SECURITY DEFINER RPCs so anonymous visitors can read the
 * totals while Row Level Security keeps the underlying rows private:
 *   • downloads   → get_public_stats()      (supabase/stats.sql, site_events)
 *   • proMembers  → get_pro_member_count()  (supabase/pro_members.sql, profiles)
 *
 * Each field is independent: a field is null when its RPC is unavailable or
 * fails, so one missing function never blanks the whole section.
 */
export interface PublicStats {
  /** Successful downloads recorded so far, or null if unavailable. */
  downloads: number | null;
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
  const [statsRes, proRes] = await Promise.allSettled([
    supabase.rpc("get_public_stats"),
    supabase.rpc("get_pro_member_count"),
  ]);

  let downloads: number | null = null;
  let proMembers: number | null = null;

  if (statsRes.status === "fulfilled" && !statsRes.value.error) {
    const data = statsRes.value.data;
    const row = Array.isArray(data) ? data[0] : data;
    downloads = toNumber(row?.downloads);
  } else {
    const reason =
      statsRes.status === "rejected" ? statsRes.reason : statsRes.value.error;
    console.error("[jusay] get_public_stats failed:", reason);
  }

  if (proRes.status === "fulfilled" && !proRes.value.error) {
    // Scalar RPC: `data` is the bigint directly.
    proMembers = toNumber(proRes.value.data);
  } else {
    const reason =
      proRes.status === "rejected" ? proRes.reason : proRes.value.error;
    console.error("[jusay] get_pro_member_count failed:", reason);
  }

  if (downloads === null && proMembers === null) return null;
  return { downloads, proMembers };
};

/**
 * Records one successful download via the shared `record_download` RPC
 * (supabase/stats.sql). Fire-and-forget: swallows every error and never blocks
 * the file transfer. No-op under the test runner so unit tests stay hermetic.
 */
export const recordDownload = async (platform = "windows"): Promise<void> => {
  if (import.meta.env?.MODE === "test") return;
  try {
    await supabase.rpc("record_download", { p_platform: platform });
  } catch (err) {
    console.error("[jusay] recordDownload failed:", err);
  }
};
