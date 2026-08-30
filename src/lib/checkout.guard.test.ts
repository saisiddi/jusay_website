import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The duplicate-payment guard.
 *
 * `startProCheckout` must resolve the entitlement fresh and refuse to touch the
 * `create-subscription` edge function when the caller is already Pro. That call
 * is the point of no return — it is what creates a Razorpay subscription the
 * customer can then be charged for a second time.
 */
const mocks = vi.hoisted(() => ({
  resolveEntitlement: vi.fn(),
  getSession: vi.fn(),
  toast: {
    info: vi.fn(),
    error: vi.fn(),
    success: vi.fn(),
    loading: vi.fn(() => "toast-id"),
  },
}));

vi.mock("@/lib/entitlement", () => ({ resolveEntitlement: mocks.resolveEntitlement }));
vi.mock("@/lib/supabase", () => ({
  getSession: mocks.getSession,
  supabaseUrl: "https://test.supabase.co",
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));

const { startProCheckout } = await import("@/lib/checkout");

const SESSION = {
  access_token: "token-abc",
  user: { id: "user-1", email: "paid@jusay.in" },
};

const proEntitlement = {
  plan: "pro" as const,
  isPro: true,
  status: "active",
  currentPeriodEnd: "2099-01-01T00:00:00.000Z",
  source: "subscription" as const,
};

const freeEntitlement = {
  plan: "free" as const,
  isPro: false,
  status: null,
  currentPeriodEnd: null,
  source: "none" as const,
};

/** Every fetch the module makes, so we can prove which endpoints were hit. */
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  mocks.getSession.mockResolvedValue(SESSION);
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

const createSubscriptionCalls = () =>
  fetchMock.mock.calls.filter(([url]) => String(url).includes("create-subscription"));

describe("startProCheckout — already-Pro guard", () => {
  it("never calls create-subscription for a user who is already Pro", async () => {
    mocks.resolveEntitlement.mockResolvedValue(proEntitlement);
    const onAlreadyPro = vi.fn();

    const started = await startProCheckout({ onAlreadyPro });

    expect(started).toBe(false);
    expect(createSubscriptionCalls()).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.resolveEntitlement).toHaveBeenCalledWith("user-1");
  });

  it("tells the user they are already on Pro and sends them to /account", async () => {
    mocks.resolveEntitlement.mockResolvedValue(proEntitlement);
    const onAlreadyPro = vi.fn();

    await startProCheckout({ onAlreadyPro });

    expect(mocks.toast.info).toHaveBeenCalledWith(
      "You're already on Pro",
      expect.objectContaining({ description: expect.any(String) })
    );
    expect(onAlreadyPro).toHaveBeenCalledTimes(1);
  });

  it("holds the line even when the profile write has not landed yet", async () => {
    // Pro honoured from the subscription row alone — still no second checkout.
    mocks.resolveEntitlement.mockResolvedValue({ ...proEntitlement, source: "profile" });

    const started = await startProCheckout({ onAlreadyPro: vi.fn() });

    expect(started).toBe(false);
    expect(createSubscriptionCalls()).toHaveLength(0);
  });

  it("still creates the subscription for a genuinely free user", async () => {
    mocks.resolveEntitlement.mockResolvedValue(freeEntitlement);
    // Fail the edge-function call so the flow stops before navigating away;
    // the assertion is that the endpoint was reached at all.
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ success: false, error: "boom" }),
    });

    const started = await startProCheckout();

    expect(started).toBe(false);
    expect(createSubscriptionCalls()).toHaveLength(1);
  });

  it("checks entitlement before spending a network call on checkout", async () => {
    mocks.resolveEntitlement.mockResolvedValue(proEntitlement);

    await startProCheckout({ onAlreadyPro: vi.fn() });

    expect(mocks.resolveEntitlement).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });

  it("does not resolve entitlement (or charge) when nobody is signed in", async () => {
    mocks.getSession.mockResolvedValue(null);
    const onNeedsAuth = vi.fn();

    const started = await startProCheckout({ onNeedsAuth });

    expect(started).toBe(false);
    expect(onNeedsAuth).toHaveBeenCalledTimes(1);
    expect(mocks.resolveEntitlement).not.toHaveBeenCalled();
    expect(createSubscriptionCalls()).toHaveLength(0);
  });
});
