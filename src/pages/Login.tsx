import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import Wordmark from "@/components/Wordmark";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { hasPendingDownload, resumePendingDownload } from "@/lib/download";
import { rememberCheckoutIntent, startProCheckout, takeCheckoutIntent } from "@/lib/checkout";

/** Official Google mark (Simple Icons / Google branding guidelines). */
const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path
      fill="#4285F4"
      d="M23.06 12.25c0-.85-.08-1.67-.22-2.45H12v4.63h6.19a5.3 5.3 0 0 1-2.3 3.48v2.9h3.72c2.17-2 3.45-4.95 3.45-8.56Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.11 0 5.72-1.03 7.61-2.79l-3.72-2.89c-1.03.69-2.35 1.1-3.89 1.1-3 0-5.54-2.02-6.44-4.74H1.71v3A11.99 11.99 0 0 0 12 24Z"
    />
    <path
      fill="#FBBC05"
      d="M5.56 14.68a7.2 7.2 0 0 1 0-4.6v-3H1.71a12 12 0 0 0 0 10.6l3.85-3Z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.69 0 3.21.58 4.4 1.72l3.3-3.3C17.71 1.19 15.1 0 12 0 7.44 0 3.5 2.62 1.71 6.44l3.85 3c.9-2.72 3.44-4.69 6.44-4.69Z"
    />
  </svg>
);

type Mode = "signin" | "signup";

/**
 * Turns a Supabase auth error into something a person can act on.
 * Supabase returns fairly terse strings, so the common ones are mapped by hand.
 */
const friendlyAuthError = (raw: string, mode: Mode): string => {
  const message = raw.toLowerCase();

  if (message.includes("email not confirmed") || message.includes("not confirmed")) {
    return "Your email isn't confirmed yet. Open the confirmation link we emailed you, then sign in.";
  }
  if (message.includes("invalid login credentials")) {
    return "That email and password don't match. Check your password, or create an account if you're new.";
  }
  if (
    message.includes("already registered") ||
    message.includes("already been registered") ||
    message.includes("user already exists")
  ) {
    return "That email already has an account. Sign in instead, or reset your password.";
  }
  if (message.includes("password should be at least")) {
    return "Passwords need at least 6 characters.";
  }
  if (message.includes("unable to validate email") || message.includes("invalid email")) {
    return "That doesn't look like a valid email address.";
  }
  if (message.includes("rate limit") || message.includes("too many")) {
    return "Too many attempts. Wait a minute and try again.";
  }
  if (message.includes("signups not allowed") || message.includes("signup is disabled")) {
    return "New sign-ups are paused right now. Try Google sign-in instead.";
  }
  return raw || (mode === "signup" ? "Could not create your account." : "Could not sign you in.");
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 12px",
  borderRadius: 10,
  border: "1px solid rgba(46,45,45,0.15)",
  background: "#ffffff",
  color: "#2e2d2d",
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 700,
  color: "rgba(46,45,45,0.6)",
  marginBottom: 6,
};

const Login = () => {
  const navigate = useNavigate();
  const { session, profile, loading, signInWithGoogle } = useAuth();
  const reduceMotion = useReducedMotion();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // A download click is what usually sends people here, so say so up front.
  const pendingDownload = useMemo(hasPendingDownload, []);

  useEffect(() => {
    document.title = "Sign in — Jusay";
    return () => {
      document.title = "Jusay";
    };
  }, []);

  // Deep link for shared links and QR codes: /login?upgrade=1 records the
  // upgrade intent up front, so a first-time visitor only has to tap
  // "Continue with Google" and the Pro checkout opens by itself. Declared
  // before the session effect below so the intent is already stored when that
  // effect calls takeCheckoutIntent(), and it rides out the Google redirect in
  // sessionStorage exactly like the download intent does.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const wantsUpgrade = params.get("upgrade");
    if (wantsUpgrade === "1" || wantsUpgrade === "pro_monthly") {
      rememberCheckoutIntent("pro_monthly");
    } else if (wantsUpgrade === "pro_annual") {
      rememberCheckoutIntent("pro_annual");
    }
  }, []);

  // Already signed in (or just came back from Google) → finish what they started.
  useEffect(() => {
    if (loading || !session) return;

    // A pending download fires right here — an anchor click, so it does not
    // navigate away and the upgrade intent below still gets its turn.
    resumePendingDownload();

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
  }, [loading, session, profile, navigate]);

  const handleGoogle = async () => {
    setError(null);
    setNotice(null);
    setGoogleBusy(true);
    try {
      await signInWithGoogle(`${window.location.origin}/auth/web-callback`);
      // On success the browser leaves this page for Google's consent screen.
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not start Google sign-in. Please try again."
      );
      setGoogleBusy(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Enter your email and password.");
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/web-callback` },
        });
        if (signUpError) {
          setError(friendlyAuthError(signUpError.message, "signup"));
          return;
        }
        // Supabase returns a user with no identities when the address is taken
        // and "confirm email" is on, rather than an explicit error.
        if (data.user && data.user.identities && data.user.identities.length === 0) {
          setError("That email already has an account. Sign in instead, or reset your password.");
          setMode("signin");
          return;
        }
        if (!data.session) {
          setNotice(
            `Check ${trimmedEmail} for a confirmation link. Once confirmed, come back and sign in.`
          );
          setPassword("");
          return;
        }
        // Email confirmation is off → the session effect above takes over.
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (signInError) {
        setError(friendlyAuthError(signInError.message, "signin"));
        return;
      }
      // Signed in → the session effect above resumes any pending download/upgrade.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async () => {
    setError(null);
    setNotice(null);
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Enter your email address first, then tap Forgot password.");
      return;
    }
    setSubmitting(true);
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${window.location.origin}/auth/web-callback`,
      });
      if (resetError) {
        setError(friendlyAuthError(resetError.message, "signin"));
        return;
      }
      setNotice(`Password reset link sent to ${trimmedEmail}. Check your inbox.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the reset email.");
    } finally {
      setSubmitting(false);
    }
  };

  const busy = loading || submitting || googleBusy;

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
      <motion.main
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#ffffff",
          border: "1px solid rgba(124,58,237,0.12)",
          boxShadow: "0 4px 24px rgba(124,58,237,0.08)",
          borderRadius: 16,
          padding: 32,
        }}
      >
        <Link
          to="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            textDecoration: "none",
            marginBottom: 24,
          }}
        >
          <img
            src="/jusay-mark.png"
            alt="Jusay logo"
            style={{ height: 28, width: 28 }}
            draggable={false}
          />
          <Wordmark size={20} />
        </Link>

        <h1
          style={{
            fontSize: 26,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "#2e2d2d",
            marginBottom: 8,
          }}
        >
          {mode === "signup" ? "Create your Jusay account" : "Sign in to Jusay"}
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: "rgba(46,45,45,0.6)", marginBottom: 24 }}>
          {pendingDownload
            ? "Sign in and your download starts automatically."
            : "Manage your plan, sync your notes and download Jusay for Windows."}
        </p>

        <button
          type="button"
          onClick={handleGoogle}
          disabled={busy}
          style={{
            width: "100%",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            padding: "12px 20px",
            borderRadius: 10,
            border: "1px solid rgba(46,45,45,0.15)",
            background: "#ffffff",
            color: "#2e2d2d",
            fontSize: 14,
            fontWeight: 700,
            cursor: busy ? "progress" : "pointer",
            opacity: busy ? 0.65 : 1,
            transition: "background-color 0.2s, border-color 0.2s",
          }}
          onMouseEnter={(e) => {
            if (busy) return;
            e.currentTarget.style.backgroundColor = "rgba(124,58,237,0.06)";
            e.currentTarget.style.borderColor = "rgba(124,58,237,0.35)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#ffffff";
            e.currentTarget.style.borderColor = "rgba(46,45,45,0.15)";
          }}
        >
          {googleBusy ? (
            <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />
          ) : (
            <GoogleIcon />
          )}
          {googleBusy ? "Opening Google…" : "Continue with Google"}
        </button>

        {/* Divider */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            margin: "20px 0",
          }}
        >
          <span style={{ flex: 1, height: 1, background: "rgba(46,45,45,0.1)" }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(46,45,45,0.35)", letterSpacing: "0.08em" }}>
            OR
          </span>
          <span style={{ flex: 1, height: 1, background: "rgba(46,45,45,0.1)" }} />
        </div>

        <form onSubmit={handleEmailSubmit} noValidate>
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="login-email" style={labelStyle}>
              Email
            </label>
            <input
              id="login-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={busy}
              style={inputStyle}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "rgba(124,58,237,0.55)";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(124,58,237,0.12)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(46,45,45,0.15)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label htmlFor="login-password" style={labelStyle}>
              Password
            </label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
              disabled={busy}
              style={inputStyle}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "rgba(124,58,237,0.55)";
                e.currentTarget.style.boxShadow = "0 0 0 3px rgba(124,58,237,0.12)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "rgba(46,45,45,0.15)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            style={{
              width: "100%",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "12px 20px",
              borderRadius: 10,
              border: "none",
              background: "linear-gradient(135deg, #7C3AED, #5b21b6)",
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 700,
              cursor: busy ? "progress" : "pointer",
              opacity: busy ? 0.7 : 1,
              transition: "box-shadow 0.2s, opacity 0.2s",
            }}
            onMouseEnter={(e) => {
              if (!busy) e.currentTarget.style.boxShadow = "0 12px 32px rgba(124,58,237,0.28)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            {submitting && <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />}
            {submitting
              ? mode === "signup"
                ? "Creating account…"
                : "Signing in…"
              : mode === "signup"
                ? "Create account"
                : "Sign in"}
          </button>
        </form>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginTop: 14,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signup" ? "signin" : "signup");
              setError(null);
              setNotice(null);
            }}
            disabled={busy}
            style={{
              background: "none",
              border: "none",
              padding: 0,
              fontSize: 13,
              fontWeight: 600,
              color: "#7C3AED",
              cursor: busy ? "progress" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
          </button>

          {mode === "signin" && (
            <button
              type="button"
              onClick={handleReset}
              disabled={busy}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                fontSize: 13,
                fontWeight: 500,
                color: "rgba(46,45,45,0.55)",
                cursor: busy ? "progress" : "pointer",
                fontFamily: "inherit",
              }}
            >
              Forgot password?
            </button>
          )}
        </div>

        {loading && !submitting && !googleBusy && (
          <p
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: "rgba(46,45,45,0.5)",
              marginTop: 14,
            }}
          >
            <Loader2 style={{ width: 14, height: 14 }} className="animate-spin" />
            Checking your session…
          </p>
        )}

        {notice && (
          <div
            role="status"
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              marginTop: 16,
              padding: "10px 12px",
              borderRadius: 8,
              background: "rgba(5,150,105,0.06)",
              border: "1px solid rgba(5,150,105,0.2)",
            }}
          >
            <CheckCircle2
              style={{ width: 16, height: 16, color: "#059669", flexShrink: 0, marginTop: 1 }}
            />
            <span style={{ fontSize: 13, color: "#047857", lineHeight: 1.5 }}>{notice}</span>
          </div>
        )}

        {error && (
          <div
            role="alert"
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              marginTop: 16,
              padding: "10px 12px",
              borderRadius: 8,
              background: "rgba(220,38,38,0.06)",
              border: "1px solid rgba(220,38,38,0.2)",
            }}
          >
            <AlertCircle style={{ width: 16, height: 16, color: "#dc2626", flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 13, color: "#b91c1c", lineHeight: 1.5 }}>{error}</span>
          </div>
        )}

        <p style={{ fontSize: 12, color: "rgba(46,45,45,0.45)", lineHeight: 1.6, marginTop: 24 }}>
          By continuing you agree to our{" "}
          <Link to="/terms" style={{ color: "#7C3AED", fontWeight: 600 }}>
            Terms
          </Link>{" "}
          and{" "}
          <Link to="/privacy" style={{ color: "#7C3AED", fontWeight: 600 }}>
            Privacy Policy
          </Link>
          .
        </p>

        <Link
          to="/"
          style={{
            display: "inline-block",
            marginTop: 16,
            fontSize: 13,
            color: "rgba(46,45,45,0.55)",
            textDecoration: "none",
            fontWeight: 500,
          }}
        >
          ← Back to home
        </Link>
      </motion.main>
    </div>
  );
};

export default Login;
