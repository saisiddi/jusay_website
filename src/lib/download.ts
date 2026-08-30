import { toast } from "sonner";
import { getSession } from "@/lib/supabase";

/**
 * Canonical Windows installer URL.
 *
 * Served as a static asset from the site's own `public/` folder, so it ships
 * with each deploy. If you move the binary back to object storage, swap this
 * for the full URL.
 */
export const DOWNLOAD_URL = "/Jusay-Setup-1.0.0.exe";

/** Only one build is shipped today, but the intent is stored as a target. */
export type DownloadTarget = "windows";

/** sessionStorage key, mirroring the `jusay:resume-checkout` intent pattern. */
const RESUME_KEY = "jusay:resume-download";

const isTarget = (value: string | null): value is DownloadTarget => value === "windows";

/**
 * Remember that the visitor asked for the installer, so /login (or the OAuth
 * callback) can finish the job once they have a session.
 */
export const rememberDownloadIntent = (target: DownloadTarget = "windows") => {
  try {
    sessionStorage.setItem(RESUME_KEY, target);
  } catch {
    /* storage disabled — the user simply clicks Download again once signed in */
  }
};

/** Reads and clears a pending download intent. */
export const takeDownloadIntent = (): DownloadTarget | null => {
  try {
    const value = sessionStorage.getItem(RESUME_KEY);
    if (value !== null) sessionStorage.removeItem(RESUME_KEY);
    return isTarget(value) ? value : null;
  } catch {
    return null;
  }
};

/** Non-destructive peek, for UI that wants to say "download will start". */
export const hasPendingDownload = (): boolean => {
  try {
    return isTarget(sessionStorage.getItem(RESUME_KEY));
  } catch {
    return false;
  }
};

/** How the URL is handed to the browser. Swappable so tests stay side-effect free. */
export type OpenUrl = (url: string) => void;

/**
 * Default trigger: a throwaway anchor click. Preferred over
 * `window.location.assign` because it leaves the current page (and its React
 * state) untouched while the browser takes over the file transfer.
 */
const openViaAnchor: OpenUrl = (url) => {
  if (typeof document === "undefined") {
    if (typeof window !== "undefined") window.location.assign(url);
    return;
  }
  const link = document.createElement("a");
  link.href = url;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/** Starts the installer download right now, no auth check. Returns the URL used. */
export const startDownload = (open: OpenUrl = openViaAnchor): string => {
  open(DOWNLOAD_URL);
  return DOWNLOAD_URL;
};

export interface RequestDownloadOptions {
  /** Called when the user must sign in first (defaults to a redirect to /login). */
  onNeedsAuth?: () => void;
  /** Override the browser hand-off (tests). */
  open?: OpenUrl;
  /** Set false to stay quiet, e.g. when resuming right after sign-in. */
  notify?: boolean;
}

/**
 * The single entry point behind every Download button on the site.
 *
 * Signed out → remembers the intent and sends the user to /login.
 * Signed in  → starts the download immediately.
 *
 * Resolves to true only when the download actually started.
 */
export const requestDownload = async (
  options: RequestDownloadOptions = {}
): Promise<boolean> => {
  const notify = options.notify ?? true;
  const session = await getSession();

  if (!session?.access_token) {
    rememberDownloadIntent();
    if (notify) {
      toast.info("Sign in to download", {
        description: "Your download starts automatically once you're signed in.",
      });
    }
    if (options.onNeedsAuth) options.onNeedsAuth();
    else if (typeof window !== "undefined") window.location.assign("/login");
    return false;
  }

  startDownload(options.open);
  if (notify) {
    toast.success("Your download is starting…", {
      description: "Jusay Setup 1.0.0 for Windows.",
    });
  }
  return true;
};

/**
 * Finishes a download the visitor asked for before signing in. Safe to call on
 * every auth success — a no-op when nothing is pending.
 */
export const resumePendingDownload = (options: RequestDownloadOptions = {}): boolean => {
  if (!takeDownloadIntent()) return false;
  startDownload(options.open);
  if (options.notify ?? true) {
    toast.success("Your download is starting…", {
      description: "Jusay Setup 1.0.0 for Windows.",
    });
  }
  return true;
};
