import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { AlertCircle, Loader2 } from "lucide-react";
import Wordmark from "@/components/Wordmark";
import { useAuth } from "@/hooks/useAuth";

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

const Login = () => {
  const navigate = useNavigate();
  const { session, loading, signInWithGoogle } = useAuth();
  const reduceMotion = useReducedMotion();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Sign in — Jusay";
    return () => {
      document.title = "Jusay";
    };
  }, []);

  // Already signed in (or just came back from Google) → straight to the account page.
  useEffect(() => {
    if (!loading && session) navigate("/account", { replace: true });
  }, [loading, session, navigate]);

  const handleGoogle = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await signInWithGoogle(`${window.location.origin}/auth/web-callback`);
      // On success the browser leaves this page for Google's consent screen.
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not start Google sign-in. Please try again."
      );
      setSubmitting(false);
    }
  };

  const busy = loading || submitting;

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
          Sign in to Jusay
        </h1>
        <p style={{ fontSize: 14, lineHeight: 1.7, color: "rgba(46,45,45,0.6)", marginBottom: 24 }}>
          Use your Google account to manage your plan, sync your notes and start your free
          Pro month.
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
          {submitting ? (
            <Loader2 style={{ width: 16, height: 16 }} className="animate-spin" />
          ) : (
            <GoogleIcon />
          )}
          {submitting ? "Opening Google…" : "Continue with Google"}
        </button>

        {loading && !submitting && (
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
