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
  loading: boolean;
  isPro: boolean;
  signInWithGoogle: (redirectTo?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const PROFILE_COLUMNS = "id, email, full_name, avatar_url, plan";

/**
 * Reads the signed-in user's profile row. A missing row is not an error here —
 * the website treats "no profile yet" as the free plan.
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
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const loadProfile = useCallback(async (nextSession: Session | null) => {
    if (!nextSession?.user) {
      if (mounted.current) setProfile(null);
      return;
    }
    const row = await fetchProfile(nextSession.user.id);
    if (mounted.current) setProfile(row);
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
        await loadProfile(data?.session ?? null);
      })
      .catch((err) => console.error("[jusay] auth bootstrap failed:", err))
      .finally(() => {
        if (mounted.current) setLoading(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted.current) return;
      setSession(nextSession ?? null);
      setLoading(false);
      // Fire and forget: profile is supplementary to the session.
      void loadProfile(nextSession ?? null);
    });

    return () => {
      mounted.current = false;
      subscription.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const signInWithGoogle = useCallback(async (redirectTo?: string) => {
    await startGoogleSignIn(redirectTo);
  }, []);

  const signOut = useCallback(async () => {
    await endSession();
    if (mounted.current) {
      setSession(null);
      setProfile(null);
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      profile,
      loading,
      isPro: profile?.plan === "pro",
      signInWithGoogle,
      signOut,
    }),
    [session, profile, loading, signInWithGoogle, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside an <AuthProvider>");
  return ctx;
};
