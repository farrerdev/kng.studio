import { shopConfig } from "./shop";

export type MessageChannel = "instagram" | "messenger";
/** The app whose built-in browser is showing the page, if any. */
export type InAppBrowser = "instagram" | "facebook" | "threads";

const INSTAGRAM_USERNAME = "kng.stu_";
const MESSENGER_PAGE_ID = "61584468240625";

const userAgent = () => (typeof navigator === "undefined" ? "" : navigator.userAgent);

/**
 * Instagram, Facebook and Threads open links in their own embedded browser. There the usual
 * ig.me / m.me links load as web pages instead of handing over to the app.
 */
export function detectInAppBrowser(ua = userAgent()): InAppBrowser | null {
  if (/Barcelona/i.test(ua)) return "threads";
  if (/Instagram/i.test(ua)) return "instagram";
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return "facebook";
  return null;
}

export const inAppBrowserLabel: Record<InAppBrowser, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  threads: "Threads",
};

const webUrl = (channel: MessageChannel) =>
  channel === "instagram" ? shopConfig.contacts.instagramMessage : shopConfig.contacts.messenger;

/** App link that works from inside an embedded browser, or null when the web link is fine. */
function appUrl(channel: MessageChannel, ua: string): string | null {
  if (!detectInAppBrowser(ua)) return null;
  const fallback = webUrl(channel);

  if (/Android/i.test(ua)) {
    const appPackage = channel === "instagram" ? "com.instagram.android" : "com.facebook.orca";
    return `intent://${fallback.replace(/^https:\/\//, "")}#Intent;scheme=https;package=${appPackage};S.browser_fallback_url=${encodeURIComponent(fallback)};end`;
  }
  if (/iPhone|iPad|iPod/i.test(ua)) {
    // Instagram publishes no scheme for a DM thread: the profile is one tap from "Nhắn tin".
    return channel === "instagram"
      ? `instagram://user?username=${INSTAGRAM_USERNAME}`
      : `fb-messenger://user-thread/${MESSENGER_PAGE_ID}`;
  }
  return null;
}

/** True when the message buttons need `openMessage` instead of a plain link. */
export const needsAppMessageLink = (ua = userAgent()) => appUrl("instagram", ua) !== null;

/** Open the shop's chat on the given channel, leaving an embedded browser when in one. */
export function openMessage(channel: MessageChannel) {
  const ua = userAgent();
  const fallback = webUrl(channel);
  const target = appUrl(channel, ua);

  if (!target) {
    window.open(fallback, "_blank", "noopener,noreferrer");
    return;
  }

  window.location.href = target;

  // Android's intent link carries its own fallback. On iOS a scheme for a missing app does
  // nothing, so fall back to the web link — except for Instagram inside Instagram, which is
  // certainly installed and may keep this page visible underneath.
  const isIos = !/Android/i.test(ua);
  const sameApp = channel === "instagram" && detectInAppBrowser(ua) === "instagram";
  if (isIos && !sameApp) {
    window.setTimeout(() => {
      if (document.visibilityState === "visible") window.location.href = fallback;
    }, 1500);
  }
}
