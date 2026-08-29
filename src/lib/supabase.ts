import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client for the JUSAY website.
 *
 * The URL and anon key are public by design (the anon key is guarded by Row Level
 * Security). They are read from Vite env vars with inline fallbacks so the site
 * keeps working on Vercel even before the env vars are configured.
 */
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? "https://rrromegwhhkyjsfxvesu.supabase.co";

const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJycm9tZWd3aGhreWpzZnh2ZXN1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyMjM1NDIsImV4cCI6MjA4Njc5OTU0Mn0.m0bJCOLoBFCMnFFhb2SaKoYandShMLxJ90etIDewErE";

/** Base URL of the Supabase project, used for edge function calls. */
export const supabaseUrl = SUPABASE_URL;

/** Anon key, needed as the `apikey` header on direct edge function calls. */
export const supabaseAnonKey = SUPABASE_ANON_KEY;

export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true,
    autoRefreshToken: true,
    flowType: "pkce",
    storageKey: "jusay-web-auth",
  },
});

/** Current session, or null when signed out. Never throws. */
export const getSession = async (): Promise<Session | null> => {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error("[jusay] getSession failed:", error.message);
    return null;
  }
  return data.session ?? null;
};

/**
 * Kick off the Google OAuth redirect.
 * @param redirectTo Absolute URL Supabase should return the browser to.
 *                   Defaults to the web callback route on the current origin.
 */
export const signInWithGoogle = async (redirectTo?: string) => {
  const target =
    redirectTo ??
    (typeof window !== "undefined" ? `${window.location.origin}/auth/web-callback` : undefined);

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: target,
      queryParams: { prompt: "select_account" },
    },
  });

  if (error) throw error;
};

/** Sign out of this browser. Never throws. */
export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) console.error("[jusay] signOut failed:", error.message);
};
