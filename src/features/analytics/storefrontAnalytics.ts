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

export type StorefrontEventRow = {
  event_type: StorefrontEventType;
  product_id: string | null;
  pattern_id: string | null;
  size_id: SizeId | null;
  created_at: string;
};

const ANALYTICS_OPT_OUT_STORAGE_KEY = "kng_analytics_opt_out";
export const LEGACY_SITE_VISIT_PRODUCT_ID = "__site_visit";
const LOCALHOST_NAMES = new Set(["localhost", "127.0.0.1", "::1"]);

function isBrowserLocalhost() {
  if (typeof window === "undefined") return false;
  return LOCALHOST_NAMES.has(window.location.hostname);
}

function isAnalyticsOptedOutDevice() {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(ANALYTICS_OPT_OUT_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markAnalyticsOptOutDevice() {
  if (typeof window === "undefined") return;
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
  return response.ok;
}

export async function trackStorefrontEvent(event: StorefrontEventInput): Promise<void> {
  if (!isSupabaseConfigured) return;
  if (isBrowserLocalhost() || isAnalyticsOptedOutDevice() || hasAdminSessionOnDevice()) return;

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
