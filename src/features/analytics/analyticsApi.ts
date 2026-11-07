import { supabase } from "../../lib/supabase";
import { LEGACY_SITE_VISIT_PRODUCT_ID, type StorefrontEventRow } from "./storefrontAnalytics";
import type { StorefrontStatsRange } from "./statsFilters";

export {
  LEGACY_SITE_VISIT_PRODUCT_ID,
  markAnalyticsOptOutDevice,
  type StorefrontEventRow,
  type StorefrontEventSource,
  type StorefrontEventType,
} from "./storefrontAnalytics";

const STATS_PAGE_SIZE = 1000;
const STATS_MAX_PAGES = 50;

// PostgREST caps each response (1000 rows by default), so read the range page by page.
export async function fetchStorefrontStats(range: StorefrontStatsRange): Promise<StorefrontEventRow[]> {
  if (!supabase) return [];

  const rows: StorefrontEventRow[] = [];
  // Older databases have no `source` column yet: then every row counts as the web store.
  let columns = "event_type, source, product_id, pattern_id, size_id, created_at";
  for (let page = 0; page < STATS_MAX_PAGES; page += 1) {
    const from = page * STATS_PAGE_SIZE;
    let result = await queryPage(columns, range, from);
    if (result.error && page === 0 && columns.includes("source")) {
      columns = "event_type, product_id, pattern_id, size_id, created_at";
      result = await queryPage(columns, range, from);
    }

    if (result.error) throw result.error;
    const pageRows = (result.data ?? []) as unknown as StorefrontEventRow[];
    rows.push(...pageRows);
    if (pageRows.length < STATS_PAGE_SIZE) break;
  }

  return rows.map((row) => {
    const event = { ...row, source: row.source ?? "web" };
    return event.event_type === "product_view" && event.product_id === LEGACY_SITE_VISIT_PRODUCT_ID
      ? { ...event, event_type: "site_visit", product_id: null }
      : event;
  });
}

function queryPage(columns: string, range: StorefrontStatsRange, from: number) {
  return supabase!
    .from("storefront_events")
    .select(columns)
    .gte("created_at", range.from)
    .lt("created_at", range.to)
    .order("created_at", { ascending: false })
    .range(from, from + STATS_PAGE_SIZE - 1);
}
