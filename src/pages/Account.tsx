import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Crown, Loader2, LogOut, Mail, Sparkles, User as UserIcon } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Wordmark from "@/components/Wordmark";
import { useAuth } from "@/hooks/useAuth";
import { startProCheckout } from "@/lib/checkout";

const Account = () => {
  const navigate = useNavigate();
  const { user, profile, loading, isPro, signOut } = useAuth();
  const reduceMotion = useReducedMotion();
  const [upgrading, setUpgrading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    document.title = "Your account — Jusay";
    return () => {
      document.title = "Jusay";
    };
  }, []);

  // Protected route: bounce anonymous visitors to sign-in.
  useEffect(() => {
    if (!loading && !user) navigate("/login", { replace: true });
  }, [loading, user, navigate]);

  const metadata = (user?.user_metadata ?? {}) as Record<string, string | undefined>;
  const email = profile?.email ?? user?.email ?? "";
  const fullName = profile?.full_name ?? metadata.full_name ?? metadata.name ?? "";
  const avatarUrl = profile?.avatar_url ?? metadata.avatar_url ?? metadata.picture ?? "";

  const handleUpgrade = async () => {
    setUpgrading(true);
    const started = await startProCheckout({ plan: "pro_monthly", fullName });
    // On success the browser navigates away; on failure re-enable the button.
    if (!started) setUpgrading(false);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await signOut();
    navigate("/", { replace: true });
  };

  if (loading || !user) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "#faf9ff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
        }}
      >
        <Loader2 className="animate-spin" style={{ width: 20, height: 20, color: "#7C3AED" }} />
        <span style={{ fontSize: 14, color: "rgba(46,45,45,0.6)" }}>Loading your account…</span>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#faf9ff" }}>
      <Navbar />

      <main style={{ padding: "140px 24px 80px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="badge-purple" style={{ display: "inline-flex", marginBottom: 16 }}>
              Your account
            </span>
            <h1
              style={{
                fontSize: 36,
                fontWeight: 800,
                letterSpacing: "-0.03em",
                color: "#2e2d2d",
                marginBottom: 8,
              }}
            >
              Welcome{fullName ? `, ${fullName.split(" ")[0]}` : ""}
            </h1>
            <p style={{ fontSize: 15, color: "rgba(46,45,45,0.55)", lineHeight: 1.7 }}>
              Manage your <Wordmark size={15} /> plan and sign-in details.
            </p>
          </motion.div>

          {/* Profile card */}
          <motion.section
            initial={reduceMotion ? false : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            style={{
              marginTop: 28,
              padding: 28,
              borderRadius: 16,
              background: "#ffffff",
              border: "1px solid rgba(124,58,237,0.12)",
              boxShadow: "0 4px 24px rgba(124,58,237,0.06)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={fullName ? `${fullName}'s profile picture` : "Your profile picture"}
                  referrerPolicy="no-referrer"
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: "1px solid rgba(124,58,237,0.15)",
                  }}
                />
              ) : (
                <div
                  aria-hidden="true"
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "50%",
                    background: "rgba(124,58,237,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <UserIcon style={{ width: 24, height: 24, color: "#7C3AED" }} />
                </div>
              )}

              <div style={{ minWidth: 0 }}>
                {fullName && (
                  <p style={{ fontSize: 18, fontWeight: 700, color: "#2e2d2d", marginBottom: 2 }}>
                    {fullName}
                  </p>
                )}
                <p
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 14,
                    color: "rgba(46,45,45,0.6)",
                    wordBreak: "break-all",
                  }}
                >
                  <Mail style={{ width: 14, height: 14, flexShrink: 0 }} aria-hidden="true" />
                  {email}
                </p>
              </div>
            </div>

            <div
              style={{
                height: 1,
                background: "rgba(46,45,45,0.08)",
                margin: "24px 0",
              }}
            />

            {/* Plan */}
            <p
              style={{
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "1.5px",
                color: isPro ? "#7C3AED" : "rgba(46,45,45,0.35)",
                marginBottom: 10,
              }}
            >
              Current plan
            </p>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: isPro ? "rgba(124,58,237,0.1)" : "rgba(46,45,45,0.06)",
                  }}
                >
                  <Crown
                    style={{ width: 16, height: 16, color: isPro ? "#7C3AED" : "#2e2d2d" }}
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <p style={{ fontSize: 16, fontWeight: 800, color: "#2e2d2d" }}>
                    {isPro ? "Pro" : "Free"}
                  </p>
                  <p style={{ fontSize: 12, color: "rgba(46,45,45,0.5)" }}>
                    {isPro
                      ? "Unlimited AI and grammar, cloud sync across devices."
                      : "25 uses/day. Upgrade for unlimited AI, grammar and cloud sync."}
                  </p>
                </div>
              </div>

              {isPro ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 14px",
                    borderRadius: 8,
                    background: "rgba(5,150,105,0.08)",
                    border: "1px solid rgba(5,150,105,0.25)",
                    color: "#047857",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  <Sparkles style={{ width: 14, height: 14 }} aria-hidden="true" />
                  Pro is active
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleUpgrade}
                  disabled={upgrading}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    padding: "11px 20px",
                    borderRadius: 10,
                    border: "none",
                    background: "linear-gradient(135deg, #7C3AED, #5b21b6)",
                    color: "#ffffff",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: upgrading ? "progress" : "pointer",
                    opacity: upgrading ? 0.7 : 1,
                    transition: "box-shadow 0.2s, opacity 0.2s",
                  }}
                  onMouseEnter={(e) => {
                    if (!upgrading)
                      e.currentTarget.style.boxShadow = "0 12px 32px rgba(124,58,237,0.28)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  {upgrading ? (
                    <Loader2 className="animate-spin" style={{ width: 14, height: 14 }} />
                  ) : (
                    <Sparkles style={{ width: 14, height: 14 }} aria-hidden="true" />
                  )}
                  {upgrading ? "Starting checkout…" : "Upgrade to Pro — first month free"}
                </button>
              )}
            </div>

            {!isPro && (
              <p style={{ fontSize: 11, color: "rgba(46,45,45,0.4)", marginTop: 12, lineHeight: 1.6 }}>
                First month free for new Pro users. Cancel anytime from Jusay app settings.
              </p>
            )}

            <div
              style={{
                height: 1,
                background: "rgba(46,45,45,0.08)",
                margin: "24px 0 20px",
              }}
            />

            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 18px",
                borderRadius: 10,
                background: "transparent",
                border: "1px solid rgba(46,45,45,0.15)",
                color: "#2e2d2d",
                fontSize: 13,
                fontWeight: 700,
                cursor: signingOut ? "progress" : "pointer",
                transition: "background-color 0.2s, border-color 0.2s",
              }}
              onMouseEnter={(e) => {
                if (signingOut) return;
                e.currentTarget.style.backgroundColor = "rgba(46,45,45,0.05)";
                e.currentTarget.style.borderColor = "rgba(46,45,45,0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.borderColor = "rgba(46,45,45,0.15)";
              }}
            >
              {signingOut ? (
                <Loader2 className="animate-spin" style={{ width: 14, height: 14 }} />
              ) : (
                <LogOut style={{ width: 14, height: 14 }} aria-hidden="true" />
              )}
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </motion.section>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Account;
