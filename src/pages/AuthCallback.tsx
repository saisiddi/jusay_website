import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AlertCircle, Loader2 } from "lucide-react";
import Wordmark from "@/components/Wordmark";
import { useAuth } from "@/hooks/useAuth";
import { takeCheckoutIntent, startProCheckout } from "@/lib/checkout";

/**
 * Web OAuth landing route (/auth/web-callback).
 *
 * The Supabase client is configured with detectSessionInUrl, so it consumes the
 * code/tokens from this URL on load. This page only waits for the resulting
 * session and then forwards the user on.
 *
 * This is intentionally separate from the desktop hand-off page at
 * /auth/callback/index.html, which relays tokens to the local Jusay app.
 */
const TIMEOUT_MS = 12000;

const readOAuthError = (): string | null => {
  const fromQuery = new URLSearchParams(window.location.search);
  const fromHash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const description =
    fromQuery.get("error_description") ?? fromHash.get("error_description");
  const code = fromQuery.get("error") ?? fromHash.get("error");
  if (!description && !code) return null;
  return description ?? code;
};

const AuthCallback = () => {
  const navigate = useNavigate();
  const { session, profile, loading } = useAuth();
  const oauthError = useMemo(readOAuthError, []);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    document.title = "Signing you in — Jusay";
    return () => {
      document.title = "Jusay";
    };
  }, []);

  useEffect(() => {
    if (oauthError) return;
    const timer = window.setTimeout(() => setTimedOut(true), TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [oauthError]);

  useEffect(() => {
    if (oauthError || loading || !session) return;

    // Clean the OAuth params out of the address bar before moving on.
    window.history.replaceState({}, document.title, "/auth/web-callback");

    const pendingUpgrade = takeCheckoutIntent();
    if (pendingUpgrade) {
      void startProCheckout({
        plan: pendingUpgrade,
        fullName: profile?.full_name ?? session.user?.user_metadata?.full_name ?? null,
      }).then((started) => {
        if (!started) navigate("/account", { replace: true });
      });
      return;
    }

    navigate("/account", { replace: true });
  }, [oauthError, loading, session, profile, navigate]);

  const failed = Boolean(oauthError) || (timedOut && !session);

  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#faf9ff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <main
        style={{
          width: "100%",
          maxWidth: 400,
          background: "#ffffff",
          border: "1px solid rgba(124,58,237,0.12)",
          boxShadow: "0 4px 24px rgba(124,58,237,0.08)",
          borderRadius: 16,
          padding: 32,
          textAlign: "center",
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <Wordmark size={22} />
        </div>

        {failed ? (
          <>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: "rgba(220,38,38,0.08)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 14,
              }}
            >
              <AlertCircle style={{ width: 22, height: 22, color: "#dc2626" }} />
            </div>
            <h1 style={{ fontSize: 17, fontWeight: 700, color: "#2e2d2d", marginBottom: 8 }}>
              Sign-in didn't complete
            </h1>
            <p
              role="alert"
              style={{ fontSize: 13, color: "rgba(46,45,45,0.6)", lineHeight: 1.6, marginBottom: 20 }}
            >
              {oauthError ?? "We couldn't confirm your session. Please try signing in again."}
            </p>
            <Link
              to="/login"
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "10px 20px",
                borderRadius: 10,
                background: "#2e2d2d",
                color: "#ffffff",
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              Back to sign in
            </Link>
          </>
        ) : (
          <>
            <Loader2
              className="animate-spin"
              style={{ width: 28, height: 28, color: "#7C3AED", margin: "0 auto 16px" }}
            />
            <h1 style={{ fontSize: 17, fontWeight: 700, color: "#2e2d2d", marginBottom: 8 }}>
              Signing you in…
            </h1>
            <p style={{ fontSize: 13, color: "rgba(46,45,45,0.55)", lineHeight: 1.6 }}>
              Finishing up with Google. This only takes a moment.
            </p>
          </>
        )}
      </main>
    </div>
  );
};

export default AuthCallback;
