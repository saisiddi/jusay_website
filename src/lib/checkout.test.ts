import { describe, expect, it, beforeEach } from "vitest";
import {
  buildCheckoutUrl,
  rememberCheckoutIntent,
  takeCheckoutIntent,
} from "@/lib/checkout";

describe("buildCheckoutUrl", () => {
  const base = {
    subscriptionId: "sub_123",
    keyId: "rzp_test_abc",
    email: "aish@jusay.in",
    name: "Aishwanth",
    plan: "pro_monthly" as const,
  };

  it("points at the static checkout page on the given origin", () => {
    const url = new URL(buildCheckoutUrl("https://jusaywebsite.vercel.app", base));
    expect(url.origin).toBe("https://jusaywebsite.vercel.app");
    expect(url.pathname).toBe("/checkout/");
  });

  it("passes every parameter the checkout page reads", () => {
    const url = new URL(buildCheckoutUrl("https://jusaywebsite.vercel.app", base));
    expect(url.searchParams.get("subscription_id")).toBe("sub_123");
    expect(url.searchParams.get("key_id")).toBe("rzp_test_abc");
    expect(url.searchParams.get("email")).toBe("aish@jusay.in");
    expect(url.searchParams.get("name")).toBe("Aishwanth");
    expect(url.searchParams.get("plan")).toBe("pro_monthly");
  });

  it("omits bonusMonth unless the edge function granted the offer", () => {
    const without = new URL(buildCheckoutUrl("https://x.dev", base));
    expect(without.searchParams.has("bonusMonth")).toBe(false);

    const withFlag = new URL(
      buildCheckoutUrl("https://x.dev", { ...base, bonusMonth: true })
    );
    expect(withFlag.searchParams.get("bonusMonth")).toBe("1");
  });

  // The checkout page reads exactly `bonusMonth=1`; anything else silently
  // drops the offer copy and the customer sees the plain ₹49/month price.
  it("forwards bonusMonth as the literal '1' the checkout page tests for", () => {
    const url = new URL(buildCheckoutUrl("https://x.dev", { ...base, bonusMonth: true }));
    expect(url.searchParams.get("bonusMonth")).toBe("1");
    expect(url.searchParams.get("bonusMonth")).not.toBe("true");
  });

  it("treats a false or undefined bonusMonth as no offer", () => {
    const explicitFalse = new URL(
      buildCheckoutUrl("https://x.dev", { ...base, bonusMonth: false })
    );
    expect(explicitFalse.searchParams.has("bonusMonth")).toBe(false);

    const undefinedFlag = new URL(
      buildCheckoutUrl("https://x.dev", { ...base, bonusMonth: undefined })
    );
    expect(undefinedFlag.searchParams.has("bonusMonth")).toBe(false);
  });

  it("keeps bonusMonth alongside the monthly plan the offer applies to", () => {
    const url = new URL(
      buildCheckoutUrl("https://x.dev", { ...base, plan: "pro_monthly", bonusMonth: true })
    );
    // The checkout page gates the offer on plan === 'pro_monthly'.
    expect(url.searchParams.get("plan")).toBe("pro_monthly");
    expect(url.searchParams.get("bonusMonth")).toBe("1");
  });

  it("never advertises the old firstMonthFree param", () => {
    const url = new URL(
      buildCheckoutUrl("https://x.dev", { ...base, bonusMonth: true })
    );
    expect(url.searchParams.has("firstMonthFree")).toBe(false);
  });

  it("encodes values that need escaping and never double-slashes the path", () => {
    const url = new URL(
      buildCheckoutUrl("https://x.dev/", {
        ...base,
        email: "a+b@jusay.in",
        name: "Aish & Co",
      })
    );
    expect(url.pathname).toBe("/checkout/");
    expect(url.searchParams.get("email")).toBe("a+b@jusay.in");
    expect(url.searchParams.get("name")).toBe("Aish & Co");
  });
});

describe("checkout intent", () => {
  beforeEach(() => sessionStorage.clear());

  it("is empty when nothing was remembered", () => {
    expect(takeCheckoutIntent()).toBeNull();
  });

  it("round-trips once and then clears", () => {
    rememberCheckoutIntent("pro_monthly");
    expect(takeCheckoutIntent()).toBe("pro_monthly");
    expect(takeCheckoutIntent()).toBeNull();
  });

  it("ignores unexpected stored values", () => {
    sessionStorage.setItem("jusay:resume-checkout", "free_forever");
    expect(takeCheckoutIntent()).toBeNull();
  });
});

describe("web-initiated marker", () => {
  const base = {
    subscriptionId: "sub_123",
    keyId: "rzp_test_abc",
    email: "aish@jusay.in",
    name: "Aishwanth",
    plan: "pro_monthly" as const,
  };

  // The checkout page hands the browser back to /account?upgraded=1 only for
  // web-initiated payments. Desktop opens the same page without this marker.
  it("tags every website checkout with src=web", () => {
    const url = new URL(buildCheckoutUrl("https://jusaywebsite.vercel.app", base));
    expect(url.searchParams.get("src")).toBe("web");
  });

  it("keeps the marker alongside the offer flag", () => {
    const url = new URL(buildCheckoutUrl("https://x.dev", { ...base, bonusMonth: true }));
    expect(url.searchParams.get("src")).toBe("web");
    expect(url.searchParams.get("bonusMonth")).toBe("1");
  });
});
