import { isSupabaseConfigured } from "../../lib/supabaseConfig";
import { fallbackCatalog, mapCatalogRows, type CatalogData, type CatalogRows } from "./catalogRows";

const CATALOG_CACHE_KEY = "kng.studio.catalog.v1";
const CATALOG_API_TIMEOUT_MS = 6000;

type CachedCatalog = {
  savedAt: number;
  catalog: CatalogData;
};

/** Last catalog this visitor saw, so repeat visits render instantly while a fresh copy loads. */
export function readCachedCatalog(): CatalogData | null {
  if (typeof window === "undefined") return null;
  try {
    const rawCache = window.localStorage.getItem(CATALOG_CACHE_KEY);
    if (!rawCache) return null;
    const cache = JSON.parse(rawCache) as CachedCatalog;
    if (!Array.isArray(cache?.catalog?.products) || !Array.isArray(cache.catalog.productTypes)) return null;
    return cache.catalog;
  } catch {
    return null;
  }
}

function writeCachedCatalog(catalog: CatalogData) {
  try {
    window.localStorage.setItem(CATALOG_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), catalog } satisfies CachedCatalog));
  } catch {
    // Storage full or blocked: the next visit just loads from the network.
  }
}

async function fetchCatalogFromCdn() {
  const response = await fetch("/api/catalog", { signal: AbortSignal.timeout(CATALOG_API_TIMEOUT_MS) });
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.includes("application/json")) {
    throw new Error(`Catalog API unavailable: ${response.status}`);
  }
  return mapCatalogRows((await response.json()) as CatalogRows);
}

/**
 * Storefront catalog: served by the CDN-cached /api/catalog. Falls back to reading Supabase
 * directly (lazy-loaded, also the path in `vite dev` where the API route doesn't exist).
 */
export async function fetchStorefrontCatalog(): Promise<CatalogData> {
  if (!isSupabaseConfigured) return fallbackCatalog;

  let catalog: CatalogData;
  try {
    catalog = await fetchCatalogFromCdn();
  } catch {
    const { fetchCatalog } = await import("./catalogApi");
    catalog = await fetchCatalog();
  }
  writeCachedCatalog(catalog);
  return catalog;
}
