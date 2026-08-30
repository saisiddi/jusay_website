import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import type { Entitlement } from "@/lib/entitlement";

/**
 * `useAuth` is the single provider of the Pro flag, and it has to re-resolve on
 * its own when the user comes back to the tab. That behaviour is what makes a
 * plain refresh (TEST D) and a logout/login round trip (TEST E) show the right
 * plan without anybody clicking anything.
 */
const mocks = vi.hoisted(() => {
  const authCallbacks: Array<(event: string, session: unknown) => void> = [];
  return {
    authCallbacks,
    getSession: vi.fn(),
    onAuthStateChange: vi.fn((cb: (event: string, session: unknown) => void) => {
      authCallbacks.push(cb);
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    signOut: vi.fn(),
    signInWithGoogle: vi.fn(),
    resolveEntitlement: vi.fn(),
    /** Minimal `from().select().eq().maybeSingle()` chain for the profile read. */
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
      }),
    })),
  };
});

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
    },
    from: mocks.from,
  },
  signInWithGoogle: mocks.signInWithGoogle,
  signOut: mocks.signOut,
}));

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

vi.mock("@/lib/entitlement", () => ({
  resolveEntitlement: mocks.resolveEntitlement,
  FREE_ENTITLEMENT: FREE,
}));

const { AuthProvider, useAuth } = await import("@/hooks/useAuth");

const SESSION = { user: { id: "user-1", email: "paid@jusay.in" }, access_token: "t" };

const Probe = () => {
  const { isPro, loading, entitlement } = useAuth();
  return (
    <div>
      <span data-testid="plan">{loading ? "loading" : isPro ? "pro" : "free"}</span>
      <span data-testid="source">{entitlement.source}</span>
    </div>
  );
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authCallbacks.length = 0;
  mocks.getSession.mockResolvedValue({ data: { session: SESSION }, error: null });
});

describe("AuthProvider entitlement", () => {
  it("takes isPro from resolveEntitlement, not from profiles.plan", async () => {
    // The profile read is mocked to return no row at all; the only way this can
    // report Pro is by going through the entitlement resolver.
    mocks.resolveEntitlement.mockResolvedValue(PRO);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId("plan")).toHaveTextContent("pro"));
    expect(screen.getByTestId("source")).toHaveTextContent("subscription");
    expect(mocks.resolveEntitlement).toHaveBeenCalledWith("user-1");
  });

  it("re-resolves when the tab regains focus, upgrading free → pro with no reload", async () => {
    mocks.resolveEntitlement.mockResolvedValueOnce(FREE).mockResolvedValue(PRO);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId("plan")).toHaveTextContent("free"));

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });

    await waitFor(() => expect(screen.getByTestId("plan")).toHaveTextContent("pro"));
  });

  it("re-resolves when the document becomes visible again", async () => {
    mocks.resolveEntitlement.mockResolvedValueOnce(FREE).mockResolvedValue(PRO);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId("plan")).toHaveTextContent("free"));

    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => expect(screen.getByTestId("plan")).toHaveTextContent("pro"));
  });

  it("re-resolves on TOKEN_REFRESHED and SIGNED_IN", async () => {
    mocks.resolveEntitlement.mockResolvedValue(FREE);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId("plan")).toHaveTextContent("free"));

    const callback = mocks.authCallbacks[0];
    expect(callback).toBeTypeOf("function");

    mocks.resolveEntitlement.mockResolvedValue(PRO);
    await act(async () => {
      callback("TOKEN_REFRESHED", SESSION);
    });
    await waitFor(() => expect(screen.getByTestId("plan")).toHaveTextContent("pro"));

    mocks.resolveEntitlement.mockResolvedValue(FREE);
    await act(async () => {
      callback("SIGNED_IN", { user: { id: "user-2" }, access_token: "t2" });
    });
    await waitFor(() => expect(screen.getByTestId("plan")).toHaveTextContent("free"));
    expect(mocks.resolveEntitlement).toHaveBeenLastCalledWith("user-2");
  });

  it("drops back to free the moment the session goes away", async () => {
    mocks.resolveEntitlement.mockResolvedValue(PRO);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );
    await waitFor(() => expect(screen.getByTestId("plan")).toHaveTextContent("pro"));

    await act(async () => {
      mocks.authCallbacks[0]("SIGNED_OUT", null);
    });

    await waitFor(() => expect(screen.getByTestId("plan")).toHaveTextContent("free"));
    expect(screen.getByTestId("source")).toHaveTextContent("none");
  });

  it("does not resolve an entitlement for an anonymous visitor", async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    mocks.resolveEntitlement.mockResolvedValue(FREE);

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId("plan")).toHaveTextContent("free"));

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });

    expect(mocks.resolveEntitlement).not.toHaveBeenCalled();
  });
});
