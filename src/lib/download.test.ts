import { describe, expect, it, beforeEach } from "vitest";
import {
  DOWNLOAD_URL,
  hasPendingDownload,
  rememberDownloadIntent,
  resumePendingDownload,
  startDownload,
  takeDownloadIntent,
} from "@/lib/download";

/** Records the URLs handed to the browser, without actually navigating. */
const recorder = () => {
  const urls: string[] = [];
  return { urls, open: (url: string) => void urls.push(url) };
};

describe("DOWNLOAD_URL", () => {
  it("points at the installer bundled in the site's public/ folder", () => {
    expect(DOWNLOAD_URL).toBe("/Jusay-Setup-1.0.0.exe");
  });

  it("is a root-relative .exe path (served same-origin, no query needed)", () => {
    const url = new URL(DOWNLOAD_URL, "https://jusay.in");
    expect(url.pathname).toBe("/Jusay-Setup-1.0.0.exe");
    expect(url.pathname.endsWith(".exe")).toBe(true);
    expect(url.search).toBe("");
  });
});

describe("download intent", () => {
  beforeEach(() => sessionStorage.clear());

  it("is empty when nothing was remembered", () => {
    expect(hasPendingDownload()).toBe(false);
    expect(takeDownloadIntent()).toBeNull();
  });

  it("round-trips once and then clears", () => {
    rememberDownloadIntent();
    expect(hasPendingDownload()).toBe(true);
    expect(takeDownloadIntent()).toBe("windows");
    expect(takeDownloadIntent()).toBeNull();
    expect(hasPendingDownload()).toBe(false);
  });

  it("ignores unexpected stored values", () => {
    sessionStorage.setItem("jusay:resume-download", "linux");
    expect(hasPendingDownload()).toBe(false);
    expect(takeDownloadIntent()).toBeNull();
  });

  it("does not collide with the checkout intent key", () => {
    rememberDownloadIntent();
    expect(sessionStorage.getItem("jusay:resume-checkout")).toBeNull();
    expect(sessionStorage.getItem("jusay:resume-download")).toBe("windows");
  });
});

describe("startDownload", () => {
  it("hands the canonical URL to the browser", () => {
    const { urls, open } = recorder();
    expect(startDownload(open)).toBe(DOWNLOAD_URL);
    expect(urls).toEqual([DOWNLOAD_URL]);
  });
});

describe("resumePendingDownload", () => {
  beforeEach(() => sessionStorage.clear());

  // The full gate: click Download signed out → intent stored → after auth the
  // download fires exactly once and the intent is gone.
  it("completes the round trip an anonymous Download click starts", () => {
    const { urls, open } = recorder();

    // 1. Signed-out click stores the intent instead of downloading.
    rememberDownloadIntent();
    expect(urls).toHaveLength(0);
    expect(hasPendingDownload()).toBe(true);

    // 2. Auth completes → the download resumes.
    expect(resumePendingDownload({ open, notify: false })).toBe(true);
    expect(urls).toEqual([DOWNLOAD_URL]);

    // 3. A reload of the callback must not download again.
    expect(resumePendingDownload({ open, notify: false })).toBe(false);
    expect(urls).toEqual([DOWNLOAD_URL]);
    expect(hasPendingDownload()).toBe(false);
  });

  it("is a no-op for users who signed in without asking to download", () => {
    const { urls, open } = recorder();
    expect(resumePendingDownload({ open, notify: false })).toBe(false);
    expect(urls).toHaveLength(0);
  });
});
