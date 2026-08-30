import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  supabase,
  signInWithGoogle as startGoogleSignIn,
  signOut as endSession,
} from "@/lib/supabase";
import {
  FREE_ENTITLEMENT,
  resolveEntitlement,
  type Entitlement,
} from "@/lib/entitlement";

/** Shape of the row we read from the existing `profiles` table (read-only). */
export interface JusayProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  plan: "free" | "pro" | null;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: JusayProfile | null;
  /** Full result of the canonical entitlement rule. See src/lib/entitlement.ts. */
  entitlement: Entitlement;
  /**
   * The one true Pro flag for the whole website. Comes from
   * `resolveEntitlement`, never from `profile.plan` alone — a profile read on
   * its own cannot see a subscription that has already gone live.
   */
  isPro: boolean;
  loading: boolean;
  /**
   * Re-runs the entitlement resolution against Supabase and updates context.
   * Resolves with the fresh entitlement so callers (e.g. the post-payment poll
   * on /account) can react without waiting for a re-render.
   */
  refreshEntitlement: () => Promise<Entitlement>;
  signInWithGoogle: (redirectTo?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const PROFILE_COLUMNS = "id, email, full_name, avatar_url, plan";

/**
 * Value equality for an entitlement. Focus/visibility re-resolution runs often,
 * and an unchanged answer should not produce a new context value.
 */
const sameEntitlement = (a: Entitlement, b: Entitlement): boolean =>
  a.plan === b.plan &&
  a.isPro === b.isPro &&
  a.status === b.status &&
  a.currentPeriodEnd === b.currentPeriodEnd &&
  a.source === b.source;

/**
 * Reads the signed-in user's profile row for display purposes (name, avatar,
 * email). The `plan` column here is informational only — entitlement decisions
 * go through `resolveEntitlement`.
 *
 * A missing row is not an error: the website treats "no profile yet" as free.
 */
const fetchProfile = async (userId: string): Promise<JusayProfile | null> => {
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("[jusay] could not load profile:", error.message);
    return null;
  }
  return (data as JusayProfile | null) ?? null;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<JusayProfile | null>(null);
  const [entitlement, setEntitlement] = useState<Entitlement>(FREE_ENTITLEMENT);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);
  /**
   * Current user id, kept in a ref so `refreshEntitlement` stays a stable
   * function that any consumer can call without re-subscribing to renders.
   */
  const userIdRef = useRef<string | null>(null);

  /** Reads profile + entitlement together for a given session. */
  const loadAccount = useCallback(async (nextSession: Session | null) => {
    const userId = nextSession?.user?.id ?? null;
    userIdRef.current = userId;

    if (!userId) {
      if (mounted.current) {
        setProfile(null);
        setEntitlement(FREE_ENTITLEMENT);
      }
      return;
    }

    const [row, resolved] = await Promise.all([
      fetchProfile(userId),
      resolveEntitlement(userId),
    ]);

    // A sign-out (or account switch) mid-flight must not apply stale results.
    if (!mounted.current || userIdRef.current !== userId) return;
    setProfile(row);
    setEntitlement((prev) => (sameEntitlement(prev, resolved) ? prev : resolved));
  }, []);

  const refreshEntitlement = useCallback(async (): Promise<Entitlement> => {
    const userId = userIdRef.current;
    if (!userId) {
      if (mounted.current) setEntitlement(FREE_ENTITLEMENT);
      return FREE_ENTITLEMENT;
    }
    const resolved = await resolveEntitlement(userId);
    if (mounted.current && userIdRef.current === userId) {
      setEntitlement((prev) => (sameEntitlement(prev, resolved) ? prev : resolved));
    }
    return resolved;
  }, []);

  useEffect(() => {
    mounted.current = true;

    // Initial read: restores a persisted session and completes an OAuth redirect.
    supabase.auth
      .getSession()
      .then(async ({ data, error }) => {
        if (error) console.error("[jusay] getSession failed:", error.message);
        if (!mounted.current) return;
        setSession(data?.session ?? null);
        await loadAccount(data?.session ?? null);
      })
      .catch((err) => console.error("[jusay] auth bootstrap failed:", err))
      .finally(() => {
        if (mounted.current) setLoading(false);
      });

    // Covers SIGNED_IN, TOKEN_REFRESHED, USER_UPDATED and SIGNED_OUT — every one
    // of them is a moment where the entitlement may have changed.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted.current) return;
      setSession(nextSession ?? null);
      setLoading(false);
      void loadAccount(nextSession ?? null);
    });

    return () => {
      mounted.current = false;
      subscription.subscription.unsubscribe();
    };
  }, [loadAccount]);

  /**
   * Re-resolve when the user comes back to the tab. This is what makes a plain
   * page refresh, a tab switch, or "paid on another tab" land on the right
   * state without anyone having to sign out and in again.
   */
  useEffect(() => {
    if (typeof window === "undefined") return;

    const onFocus = () => {
      if (userIdRef.current) void refreshEntitlement();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && userIdRef.current) {
        void refreshEntitlement();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [refreshEntitlement]);

  const signInWithGoogle = useCallback(async (redirectTo?: string) => {
    await startGoogleSignIn(redirectTo);
  }, []);

  const signOut = useCallback(async () => {
    await endSession();
    userIdRef.current = null;
    if (mounted.current) {
      setSession(null);
      setProfile(null);
      setEntitlement(FREE_ENTITLEMENT);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      profile,
      entitlement,
      isPro: entitlement.isPro,
      loading,
      refreshEntitlement,
      signInWithGoogle,
      signOut,
    }),
    [session, profile, entitlement, loading, refreshEntitlement, signInWithGoogle, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside an <AuthProvider>");
  return ctx;
};
