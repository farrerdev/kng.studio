import { supabase } from "../../lib/supabase";
import { LEGACY_SITE_VISIT_PRODUCT_ID, type StorefrontEventRow } from "./storefrontAnalytics";
import type { StorefrontStatsRange } from "./statsFilters";

export {
  LEGACY_SITE_VISIT_PRODUCT_ID,
  markAnalyticsOptOutDevice,
  type StorefrontEventRow,
  type StorefrontEventType,
} from "./storefrontAnalytics";

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
  return ((result.data ?? []) as StorefrontEventRow[]).map((event) =>
    event.event_type === "product_view" && event.product_id === LEGACY_SITE_VISIT_PRODUCT_ID
      ? { ...event, event_type: "site_visit", product_id: null }
      : event,
  );
}
