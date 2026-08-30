import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { CalendarClock, Crown, Loader2, LogOut, Mail, Sparkles, User as UserIcon } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Wordmark from "@/components/Wordmark";
import { useAuth } from "@/hooks/useAuth";
import { startProCheckout } from "@/lib/checkout";

/** The one canonical offer line. Keep in sync with src/components/Pricing.tsx. */
const OFFER_LINE = "Pay 1 month and Get 1 month FREE";

/**
 * Post-payment sync schedule, in milliseconds between attempts.
 *
 * The static checkout page sends the browser here with `?upgraded=1` as soon as
 * `confirm-payment` returns, but that function (and the Razorpay webhook behind
 * it) can finish writing `profiles`/`subscriptions` a beat later. So we re-run
 * the canonical resolution on a backoff instead of trusting the query param.
 * Sum is 10s: the first check is immediate, then 1s, 1.5s, 2s, 2.5s, 3s.
 */
const UPGRADE_POLL_DELAYS_MS = [0, 1000, 1500, 2000, 2500, 3000];

/** Query flag the checkout page appends after a successful confirm-payment. */
const UPGRADED_PARAM = "upgraded";

const formatDate = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const Account = () => {
  const navigate = useNavigate();
  const { user, profile, loading, isPro, entitlement, refreshEntitlement, signOut } = useAuth();
  const reduceMotion = useReducedMotion();
  const [upgrading, setUpgrading] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  /** True while we are waiting for a just-completed payment to land in the DB. */
  const [activating, setActivating] = useState(false);
  const pollStarted = useRef(false);

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

  /**
   * Post-payment sync. `?upgraded=1` only tells us to go looking; Pro is shown
   * strictly because `resolveEntitlement` says so.
   */
  const pollForUpgrade = useCallback(async () => {
    setActivating(true);
    try {
      for (const delay of UPGRADE_POLL_DELAYS_MS) {
        if (delay > 0) await new Promise((resolve) => window.setTimeout(resolve, delay));
        const resolved = await refreshEntitlement();
        if (resolved.isPro) return;
      }
      // Still not Pro after ~10s. The webhook may yet land; a refresh or tab
      // focus will pick it up, and the entitlement rule never shows a false Pro.
      console.warn(
        "[jusay] payment reported success but the entitlement is still free after polling."
      );
    } finally {
      setActivating(false);
    }
  }, [refreshEntitlement]);

  useEffect(() => {
    if (loading || !user || pollStarted.current) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get(UPGRADED_PARAM) !== "1") return;
    pollStarted.current = true;

    // Strip the flag straight away so a reload or a shared link cannot re-trigger it.
    params.delete(UPGRADED_PARAM);
    const query = params.toString();
    window.history.replaceState(
      {},
      document.title,
      `${window.location.pathname}${query ? `?${query}` : ""}`
    );

    void pollForUpgrade();
  }, [loading, user, pollForUpgrade]);

  const metadata = (user?.user_metadata ?? {}) as Record<string, string | undefined>;
  const email = profile?.email ?? user?.email ?? "";
  const fullName = profile?.full_name ?? metadata.full_name ?? metadata.name ?? "";
  const avatarUrl = profile?.avatar_url ?? metadata.avatar_url ?? metadata.picture ?? "";

  // Billing period comes from the same resolution that decided `isPro`, so the
  // badge and the date can never disagree.
  // "Renews on" while the subscription is live, "Access until" once cancelled.
  const periodEnd = entitlement.currentPeriodEnd
    ? formatDate(entitlement.currentPeriodEnd)
    : "";
  const renewing = entitlement.source === "subscription";
  const periodLabel = periodEnd
    ? `${renewing ? "Renews on" : "Access until"} ${periodEnd}`
    : "";

  const handleUpgrade = async () => {
    setUpgrading(true);
    const started = await startProCheckout({
      plan: "pro_monthly",
      fullName,
      // Already Pro: startProCheckout stops before create-subscription and we
      // just re-render this page with the fresh state.
      onAlreadyPro: () => void refreshEntitlement(),
    });
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
                    {isPro ? "Pro" : activating ? "Activating…" : "Free"}
                  </p>
                  <p style={{ fontSize: 12, color: "rgba(46,45,45,0.5)" }}>
                    {isPro
                      ? "Unlimited AI and grammar, cloud sync across devices."
                      : activating
                        ? "Your payment went through. Switching your plan over now."
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
              ) : activating ? (
                /* Payment succeeded, entitlement not visible yet. No upgrade
                   button here — offering one would invite a second charge. */
                <span
                  role="status"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 14px",
                    borderRadius: 8,
                    background: "rgba(124,58,237,0.08)",
                    border: "1px solid rgba(124,58,237,0.25)",
                    color: "#5b21b6",
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  <Loader2 className="animate-spin" style={{ width: 14, height: 14 }} />
                  Activating your Pro…
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
                  {upgrading ? "Starting checkout…" : `Upgrade to Pro — ${OFFER_LINE}`}
                </button>
              )}
            </div>

            {isPro && periodLabel && (
              <p
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  color: "rgba(46,45,45,0.55)",
                  marginTop: 14,
                }}
              >
                <CalendarClock style={{ width: 14, height: 14, flexShrink: 0 }} aria-hidden="true" />
                {periodLabel}
              </p>
            )}

            {!isPro && !activating && (
              <p style={{ fontSize: 11, color: "rgba(46,45,45,0.4)", marginTop: 12, lineHeight: 1.6 }}>
                New Pro users get the launch offer: {OFFER_LINE}. ₹49 today covers 2 months,
                then ₹49/month. Cancel anytime from Jusay app settings.
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
