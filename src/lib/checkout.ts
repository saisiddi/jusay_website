import { toast } from "sonner";
import { getSession, supabaseUrl } from "@/lib/supabase";

/** Only monthly Pro is offered from the website today. */
export type PlanType = "pro_monthly" | "pro_annual";

/** Response contract of the `create-subscription` edge function. */
interface CreateSubscriptionResponse {
  success: boolean;
  /**
   * True when this is a first-time Pro user, who gets the 1+1 offer: ₹49 charged
   * today covers 60 days of Pro, next ₹49 on day 61.
   */
  bonusMonth?: boolean;
  subscriptionId?: string;
  keyId?: string;
  error?: string;
}

/** Where to send the user back to after a sign-in triggered by checkout. */
const RESUME_KEY = "jusay:resume-checkout";

/**
 * Guards against a second subscription being created by an impatient double
 * click while the first edge-function call is still in flight.
 */
let inFlight = false;

export interface CheckoutParams {
  subscriptionId: string;
  keyId: string;
  email: string;
  name: string;
  plan: PlanType;
  /** Show the 1+1 offer copy on the checkout page (pay ₹49 now, get 2 months). */
  bonusMonth?: boolean;
}

/**
 * Builds the URL of the static Razorpay checkout page (public/checkout/index.html).
 * Origin-relative so it works on any deployment (Vercel preview, prod, localhost).
 * Exported for tests.
 */
export const buildCheckoutUrl = (origin: string, params: CheckoutParams): string => {
  const query = new URLSearchParams({
    subscription_id: params.subscriptionId,
    key_id: params.keyId,
    email: params.email,
    name: params.name,
    plan: params.plan,
  });
  if (params.bonusMonth) query.set("bonusMonth", "1");
  return `${origin.replace(/\/$/, "")}/checkout/?${query.toString()}`;
};

/** Fallback display name when the profile has no full name. */
const displayNameFor = (email: string, fullName?: string | null): string => {
  const trimmed = (fullName ?? "").trim();
  if (trimmed) return trimmed;
  return email.includes("@") ? email.split("@")[0] : email;
};

/** Remember that the user wanted to upgrade, so /login can resume after OAuth. */
export const rememberCheckoutIntent = (plan: PlanType = "pro_monthly") => {
  try {
    sessionStorage.setItem(RESUME_KEY, plan);
  } catch {
    /* storage disabled — the user simply lands on /account instead */
  }
};

/** Reads and clears a pending upgrade intent. */
export const takeCheckoutIntent = (): PlanType | null => {
  try {
    const value = sessionStorage.getItem(RESUME_KEY);
    if (value) sessionStorage.removeItem(RESUME_KEY);
    return value === "pro_monthly" || value === "pro_annual" ? value : null;
  } catch {
    return null;
  }
};

export interface StartProCheckoutOptions {
  plan?: PlanType;
  /** Full name to prefill on the Razorpay page, usually profile.full_name. */
  fullName?: string | null;
  /** Called when the user must sign in first (defaults to a hard redirect to /login). */
  onNeedsAuth?: () => void;
}

/**
 * The single entry point for starting a Pro upgrade from the website.
 *
 * Signed out  → remembers the intent and sends the user to /login.
 * Signed in   → creates the Razorpay subscription through the edge function and
 *               redirects to the existing static checkout page.
 *
 * Resolves to false when the flow did not reach checkout, so callers can reset
 * their own loading state.
 */
export const startProCheckout = async (
  options: StartProCheckoutOptions = {}
): Promise<boolean> => {
  if (inFlight) return false;
  const plan = options.plan ?? "pro_monthly";

  const session = await getSession();
  if (!session?.access_token) {
    rememberCheckoutIntent(plan);
    toast.info("Sign in to continue", {
      description: "You need a JUSAY account before upgrading to Pro.",
    });
    if (options.onNeedsAuth) options.onNeedsAuth();
    else window.location.assign("/login");
    return false;
  }

  inFlight = true;
  const toastId = toast.loading("Setting up your Pro subscription…");

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/create-subscription`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ planType: plan }),
    });

    let data: CreateSubscriptionResponse | null = null;
    try {
      data = (await response.json()) as CreateSubscriptionResponse;
    } catch {
      data = null;
    }

    if (!response.ok || !data?.success || !data.subscriptionId || !data.keyId) {
      const message =
        data?.error ??
        (response.status === 401
          ? "Your session expired. Please sign in again."
          : `Could not start checkout (error ${response.status}).`);
      toast.error("Upgrade failed", { id: toastId, description: message });
      return false;
    }

    const email = session.user?.email ?? "";
    const checkoutUrl = buildCheckoutUrl(window.location.origin, {
      subscriptionId: data.subscriptionId,
      keyId: data.keyId,
      email,
      name: displayNameFor(email, options.fullName),
      plan,
      bonusMonth: Boolean(data.bonusMonth),
    });

    toast.success("Redirecting to secure checkout…", { id: toastId });
    window.location.assign(checkoutUrl);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error";
    toast.error("Upgrade failed", {
      id: toastId,
      description: `${message}. Please try again in a moment.`,
    });
    return false;
  } finally {
    inFlight = false;
  }
};
