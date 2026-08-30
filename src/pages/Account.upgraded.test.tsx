import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import type { Entitlement } from "@/lib/entitlement";

/**
 * Post-payment sync on /account.
 *
 * The static checkout page hands the browser back with `?upgraded=1`. That flag
 * is only permission to go looking — Pro is rendered strictly because the
 * canonical resolution says so, and it is retried on a backoff because the
 * confirm-payment / webhook write can land a moment after the redirect.
 */
const FREE: Entitlement = {
  plan: "free",
  isPro: false,
  status: null,
  currentPeriodEnd: null,
  source: "none",
};

const PRO: Entitlement = {
  plan: "pro",
  isPro: true,
  status: "active",
  currentPeriodEnd: "2099-01-01T00:00:00.000Z",
  source: "subscription",
};

const mocks = vi.hoisted(() => ({
  resolve: vi.fn(),
  signOut: vi.fn(),
  startProCheckout: vi.fn(),
}));

/** A miniature but genuinely reactive stand-in for the real provider. */
vi.mock("@/hooks/useAuth", async () => {
  const React = await import("react");
  return {
    useAuth: () => {
      const [entitlement, setEntitlement] = React.useState<Entitlement>(FREE);
      const refreshEntitlement = React.useCallback(async () => {
        const next = (await mocks.resolve()) as Entitlement;
        setEntitlement(next);
        return next;
      }, []);
      return {
        user: { id: "user-1", email: "paid@jusay.in", user_metadata: {} },
        session: null,
        profile: null,
        entitlement,
        isPro: entitlement.isPro,
        loading: false,
        refreshEntitlement,
        signInWithGoogle: vi.fn(),
        signOut: mocks.signOut,
      };
    },
  };
});

vi.mock("@/lib/checkout", () => ({ startProCheckout: mocks.startProCheckout }));
vi.mock("@/components/Navbar", () => ({ default: () => null }));
vi.mock("@/components/Footer", () => ({ default: () => null }));

const { default: Account } = await import("@/pages/Account");

const renderAccount = () =>
  render(
    <BrowserRouter>
      <Account />
    </BrowserRouter>
  );

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState({}, "", "/account?upgraded=1");
});

afterEach(() => {
  vi.useRealTimers();
  window.history.replaceState({}, "", "/");
});

describe("/account?upgraded=1", () => {
  it("shows Pro once the resolution confirms it, and strips the flag", async () => {
    mocks.resolve.mockResolvedValue(PRO);

    renderAccount();

    await waitFor(() => expect(screen.getByText("Pro is active")).toBeInTheDocument());
    expect(window.location.search).toBe("");
    expect(mocks.resolve).toHaveBeenCalled();
  });

  it("shows 'Activating your Pro…' and never Pro while the write has not landed", async () => {
    vi.useFakeTimers();
    mocks.resolve.mockResolvedValue(FREE);

    renderAccount();

    // First attempt is immediate, so the activating state appears without timers.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText("Activating your Pro…")).toBeInTheDocument();
    expect(screen.queryByText("Pro is active")).not.toBeInTheDocument();
    // Crucially, no upgrade button while activating — that is the re-charge trap.
    expect(screen.queryByText(/Upgrade to Pro/)).not.toBeInTheDocument();

    // Walk the whole ~10s backoff out.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(11000);
    });

    expect(mocks.resolve).toHaveBeenCalledTimes(6);
    expect(screen.queryByText("Pro is active")).not.toBeInTheDocument();
    // Poll finished without Pro: back to the honest free state.
    expect(screen.getByText(/Upgrade to Pro/)).toBeInTheDocument();
  });

  it("flips to Pro mid-poll, as soon as an attempt returns Pro", async () => {
    vi.useFakeTimers();
    mocks.resolve
      .mockResolvedValueOnce(FREE)
      .mockResolvedValueOnce(FREE)
      .mockResolvedValue(PRO);

    renderAccount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText("Activating your Pro…")).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(screen.getByText("Pro is active")).toBeInTheDocument();
    // Stopped as soon as it had its answer, rather than burning the full backoff.
    expect(mocks.resolve).toHaveBeenCalledTimes(3);
  });

  it("does not poll at all without the flag", async () => {
    window.history.replaceState({}, "", "/account");
    mocks.resolve.mockResolvedValue(PRO);

    renderAccount();

    await waitFor(() => expect(screen.getByText("Free")).toBeInTheDocument());
    expect(mocks.resolve).not.toHaveBeenCalled();
    expect(screen.queryByText("Activating your Pro…")).not.toBeInTheDocument();
  });
});
