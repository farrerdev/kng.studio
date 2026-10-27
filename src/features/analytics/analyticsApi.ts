import { supabase } from "../../lib/supabase";
import { LEGACY_SITE_VISIT_PRODUCT_ID, type StorefrontEventRow } from "./storefrontAnalytics";
import type { StorefrontStatsRange } from "./statsFilters";

export {
  LEGACY_SITE_VISIT_PRODUCT_ID,
  markAnalyticsOptOutDevice,
  type StorefrontEventRow,
  type StorefrontEventType,
} from "./storefrontAnalytics";

const STATS_PAGE_SIZE = 1000;
const STATS_MAX_PAGES = 50;

// PostgREST caps each response (1000 rows by default), so read the range page by page.
export async function fetchStorefrontStats(range: StorefrontStatsRange): Promise<StorefrontEventRow[]> {
  if (!supabase) return [];

  const rows: StorefrontEventRow[] = [];
  for (let page = 0; page < STATS_MAX_PAGES; page += 1) {
    const from = page * STATS_PAGE_SIZE;
    const result = await supabase
      .from("storefront_events")
      .select("event_type, product_id, pattern_id, size_id, created_at")
      .gte("created_at", range.from)
      .lt("created_at", range.to)
      .order("created_at", { ascending: false })
      .range(from, from + STATS_PAGE_SIZE - 1);

    if (result.error) throw result.error;
    const pageRows = (result.data ?? []) as StorefrontEventRow[];
    rows.push(...pageRows);
    if (pageRows.length < STATS_PAGE_SIZE) break;
  }

  return rows.map((event) =>
    event.event_type === "product_view" && event.product_id === LEGACY_SITE_VISIT_PRODUCT_ID
      ? { ...event, event_type: "site_visit", product_id: null }
      : event,
  );
}
