import { supabase } from "../../lib/supabase";
import type { SizeId } from "../../types/catalog";
import type { StorefrontStatsRange } from "./statsFilters";

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
const LOCALHOST_NAMES = new Set(["localhost", "127.0.0.1", "::1"]);

function isBrowserLocalhost() {
  if (typeof window === "undefined") return false;
  return LOCALHOST_NAMES.has(window.location.hostname);
}

function isAnalyticsOptedOutDevice() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(ANALYTICS_OPT_OUT_STORAGE_KEY) === "1";
}

export function markAnalyticsOptOutDevice() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ANALYTICS_OPT_OUT_STORAGE_KEY, "1");
}

export async function trackStorefrontEvent(event: StorefrontEventInput): Promise<void> {
  if (!supabase) return;
  if (isBrowserLocalhost() || isAnalyticsOptedOutDevice()) return;

  try {
    await supabase.from("storefront_events").insert({
      event_type: event.eventType,
      product_id: event.productId ?? null,
      pattern_id: event.patternId ?? null,
      size_id: event.sizeId ?? null,
    });
  } catch {
    // Analytics should never block storefront actions.
  }
}

export async function fetchStorefrontStats(range: StorefrontStatsRange): Promise<StorefrontEventRow[]> {
  if (!supabase) return [];

  const result = await supabase
    .from("storefront_events")
    .select("event_type, product_id, pattern_id, size_id, created_at")
    .gte("created_at", range.from)
    .lt("created_at", range.to)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (result.error) throw result.error;
  return (result.data ?? []) as StorefrontEventRow[];
}
