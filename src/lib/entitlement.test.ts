import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACTIVE_SUBSCRIPTION_STATUSES,
  FREE_ENTITLEMENT,
  decideEntitlement,
  type SubscriptionSnapshot,
} from "@/lib/entitlement";

/**
 * The canonical rule, exercised through the pure decision function so the
 * database is not in the way. `resolveEntitlement` is a thin fetch + delegate
 * on top of this, and the checkout guard test below covers that path.
 */

const NOW = Date.parse("2025-06-01T00:00:00.000Z");
const FUTURE = "2025-07-01T00:00:00.000Z";
const PAST = "2025-05-01T00:00:00.000Z";

const sub = (
  status: string | null,
  current_period_end: string | null
): SubscriptionSnapshot => ({ status, current_period_end });

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe("decideEntitlement", () => {
  it("pro profile + active subscription in period → Pro from the subscription", () => {
    const result = decideEntitlement("pro", [sub("active", FUTURE)], NOW);
    expect(result).toEqual({
      plan: "pro",
      isPro: true,
      status: "active",
      currentPeriodEnd: FUTURE,
      source: "subscription",
    });
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("pro profile + expired current_period_end → still Pro, with a warning", () => {
    const result = decideEntitlement("pro", [sub("active", PAST)], NOW);
    expect(result.isPro).toBe(true);
    expect(result.plan).toBe("pro");
    // The profile is the payment system's own write; never contradict it.
    expect(result.source).toBe("profile");
    expect(result.currentPeriodEnd).toBe(PAST);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("pro profile + no subscription row at all → still Pro, with a warning", () => {
    const result = decideEntitlement("pro", [], NOW);
    expect(result).toEqual({
      plan: "pro",
      isPro: true,
      status: null,
      currentPeriodEnd: null,
      source: "profile",
    });
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("free profile + no subscription → Free, no warning", () => {
    const result = decideEntitlement("free", [], NOW);
    expect(result).toEqual(FREE_ENTITLEMENT);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("free profile + active subscription → Pro (the webhook beat the profile write)", () => {
    const result = decideEntitlement("free", [sub("active", FUTURE)], NOW);
    expect(result.isPro).toBe(true);
    expect(result.plan).toBe("pro");
    expect(result.source).toBe("subscription");
  });

  it("null current_period_end on an active row → Pro (open-ended period)", () => {
    const result = decideEntitlement("pro", [sub("active", null)], NOW);
    expect(result.isPro).toBe(true);
    expect(result.currentPeriodEnd).toBeNull();
    expect(result.source).toBe("subscription");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("counts every status the rule allows, and nothing else", () => {
    for (const status of ACTIVE_SUBSCRIPTION_STATUSES) {
      expect(decideEntitlement("free", [sub(status, FUTURE)], NOW).isPro).toBe(true);
    }
    for (const status of ["cancelled", "canceled", "halted", "created", "paused", "expired"]) {
      expect(decideEntitlement("free", [sub(status, FUTURE)], NOW).isPro).toBe(false);
    }
  });

  it("picks the live row out of a mixed history", () => {
    const result = decideEntitlement(
      "pro",
      [sub("cancelled", PAST), sub("halted", FUTURE), sub("trialing", FUTURE)],
      NOW
    );
    expect(result.source).toBe("subscription");
    expect(result.status).toBe("trialing");
  });

  it("treats a missing profile row and missing subscriptions as Free", () => {
    expect(decideEntitlement(null, null, NOW)).toEqual(FREE_ENTITLEMENT);
    expect(decideEntitlement(undefined, undefined, NOW)).toEqual(FREE_ENTITLEMENT);
  });

  it("free profile + only an expired subscription → Free", () => {
    expect(decideEntitlement("free", [sub("active", PAST)], NOW).isPro).toBe(false);
  });
});
