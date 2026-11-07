import { isSupabaseConfigured, supabaseConfig } from "../../lib/supabaseConfig";
import type { SizeId } from "../../types/catalog";

// Storefront-side tracking over plain REST so the storefront bundle doesn't need supabase-js.
export type StorefrontEventType =
  | "site_visit"
  | "product_view"
  | "pattern_view"
  | "add_to_cart"
  | "order_image_created"
  | "message_click";

export type StorefrontEventInput = {
  eventType: StorefrontEventType;
  productId?: string | null;
  patternId?: string | null;
  sizeId?: SizeId | null;
};

/** Where the event happened: the web store or the 3D walk-in shop (3d.kngstudio.shop). */
export type StorefrontEventSource = "web" | "3d";

export type StorefrontEventRow = {
  event_type: StorefrontEventType;
  source: StorefrontEventSource;
  product_id: string | null;
  pattern_id: string | null;
  size_id: SizeId | null;
  created_at: string;
};

const ANALYTICS_OPT_OUT_STORAGE_KEY = "kng_analytics_opt_out";
/** Same flag as a cookie on kngstudio.shop, so an admin device is skipped on the 3D subdomain too. */
const ANALYTICS_OPT_OUT_COOKIE = "kng_analytics_opt_out";
const SHOP_DOMAIN = "kngstudio.shop";
const OPT_OUT_COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

let eventSource: StorefrontEventSource = "web";
/** Set by the 3D shop at start-up; everything else is the web store. */
export function setAnalyticsSource(source: StorefrontEventSource) {
  eventSource = source;
}
/** Until the `source` column exists (see supabase/migrations), events are sent without it. */
let sourceColumnMissing = false;
export const LEGACY_SITE_VISIT_PRODUCT_ID = "__site_visit";
const LOCALHOST_NAMES = new Set(["localhost", "127.0.0.1", "::1"]);

function isBrowserLocalhost() {
  if (typeof window === "undefined") return false;
  return LOCALHOST_NAMES.has(window.location.hostname);
}

// Private-network hosts (phone testing against the dev machine, e.g. 192.168.x.x:5173) and *.local names.
function isPrivateNetworkHost() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  if (host.endsWith(".local")) return true;
  const octets = host.split(".").map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet))) return false;
  const [first, second] = octets;
  return first === 10 || (first === 192 && second === 168) || (first === 172 && second >= 16 && second <= 31);
}

// Never count our own testing: dev server builds, localhost, and private-network devices.
function isTestEnvironment() {
  return import.meta.env.DEV || isBrowserLocalhost() || isPrivateNetworkHost();
}

function hasOptOutCookie() {
  try {
    return document.cookie.split("; ").includes(`${ANALYTICS_OPT_OUT_COOKIE}=1`);
  } catch {
    return false;
  }
}

function writeOptOutCookie() {
  try {
    const host = window.location.hostname;
    const domain = host === SHOP_DOMAIN || host.endsWith(`.${SHOP_DOMAIN}`) ? `; Domain=${SHOP_DOMAIN}` : "";
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${ANALYTICS_OPT_OUT_COOKIE}=1; Path=/; Max-Age=${OPT_OUT_COOKIE_MAX_AGE}; SameSite=Lax${domain}${secure}`;
  } catch {
    // Cookies blocked: the per-site flag below still works.
  }
}

function isAnalyticsOptedOutDevice() {
  if (typeof window === "undefined") return false;
  if (hasOptOutCookie()) return true;
  try {
    if (window.localStorage.getItem(ANALYTICS_OPT_OUT_STORAGE_KEY) !== "1") return false;
    // Devices flagged before the cookie existed: share the flag with the 3D shop from now on.
    writeOptOutCookie();
    return true;
  } catch {
    return false;
  }
}

export function markAnalyticsOptOutDevice() {
  if (typeof window === "undefined") return;
  writeOptOutCookie();
  try {
    window.localStorage.setItem(ANALYTICS_OPT_OUT_STORAGE_KEY, "1");
  } catch {
    // Storage can be unavailable in private modes; session checks still prevent admin tracking.
  }
}

// supabase-js keeps the admin session under sb-<project-ref>-auth-token in localStorage.
function hasAdminSessionOnDevice() {
  try {
    const projectRef = new URL(supabaseConfig.url).hostname.split(".")[0];
    if (!window.localStorage.getItem(`sb-${projectRef}-auth-token`)) return false;
    markAnalyticsOptOutDevice();
    return true;
  } catch {
    return false;
  }
}

async function insertStorefrontEvent(row: Record<string, unknown>) {
  if (!sourceColumnMissing) {
    const response = await postStorefrontEvent({ ...row, source: eventSource });
    if (response.ok) return true;
    // PostgREST names the unknown column when `source` isn't there yet: remember and send the plain row.
    const detail = response.status === 400 ? await response.text().catch(() => "") : "";
    if (!detail.includes("source")) return false;
    sourceColumnMissing = true;
  }
  return (await postStorefrontEvent(row)).ok;
}

async function postStorefrontEvent(row: Record<string, unknown>) {
  const response = await fetch(`${supabaseConfig.url}/rest/v1/storefront_events`, {
    method: "POST",
    headers: {
      apikey: supabaseConfig.anonKey,
      authorization: `Bearer ${supabaseConfig.anonKey}`,
      "content-type": "application/json",
      prefer: "return=minimal",
    },
    body: JSON.stringify(row),
    keepalive: true,
  });
  return response;
}

export async function trackStorefrontEvent(event: StorefrontEventInput): Promise<void> {
  if (!isSupabaseConfigured) return;
  if (isTestEnvironment() || isAnalyticsOptedOutDevice() || hasAdminSessionOnDevice()) return;

  try {
    const inserted = await insertStorefrontEvent({
      event_type: event.eventType,
      product_id: event.productId ?? null,
      pattern_id: event.patternId ?? null,
      size_id: event.sizeId ?? null,
    });
    if (inserted) return;

    if (event.eventType === "site_visit") {
      await insertStorefrontEvent({
        event_type: "product_view",
        product_id: LEGACY_SITE_VISIT_PRODUCT_ID,
        pattern_id: null,
        size_id: null,
      });
    }
  } catch {
    // Analytics should never block storefront actions.
  }
}
