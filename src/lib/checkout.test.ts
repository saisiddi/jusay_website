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

  it("omits firstMonthFree unless the edge function granted it", () => {
    const without = new URL(buildCheckoutUrl("https://x.dev", base));
    expect(without.searchParams.has("firstMonthFree")).toBe(false);

    const withFlag = new URL(
      buildCheckoutUrl("https://x.dev", { ...base, firstMonthFree: true })
    );
    expect(withFlag.searchParams.get("firstMonthFree")).toBe("1");
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
