import { useEffect, useState } from "react";
import { isSupabaseConfigured } from "../../lib/supabaseConfig";
import type { Product, ProductImage, ProductType } from "../../types/catalog";
import { fallbackCatalog, type CatalogData } from "./catalogRows";
import { fetchStorefrontCatalog, readCachedCatalog } from "./storefrontCatalog";

export type CatalogLoadState = "loading" | "ready" | "error";

/** What the storefront renders from: the public catalog plus how far it got loading. */
export type StorefrontCatalog = {
  productTypes: ProductType[];
  products: Product[];
  popularity: Record<string, number>;
  shopInfoImage: ProductImage | null;
  loadState: CatalogLoadState;
};

export function toStorefrontCatalog(catalog: CatalogData, loadState: CatalogLoadState = "ready"): StorefrontCatalog {
  return {
    productTypes: catalog.productTypes,
    products: catalog.products,
    popularity: catalog.popularity ?? {},
    shopInfoImage: catalog.shopInfoImage,
    loadState,
  };
}

const EMPTY_CATALOG: StorefrontCatalog = { productTypes: [], products: [], popularity: {}, shopInfoImage: null, loadState: "loading" };

/**
 * Storefront catalog: paints the visitor's last-seen catalog immediately, then swaps in a fresh copy.
 * Without Supabase config it serves the bundled mock catalog.
 */
export function useStorefrontCatalog(): StorefrontCatalog {
  const [catalog, setCatalog] = useState<StorefrontCatalog>(() => {
    if (!isSupabaseConfigured) return toStorefrontCatalog(fallbackCatalog);
    const cached = readCachedCatalog();
    return cached ? toStorefrontCatalog(cached) : EMPTY_CATALOG;
  });

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    let isMounted = true;
    fetchStorefrontCatalog()
      .then((fresh) => {
        if (isMounted) setCatalog(toStorefrontCatalog(fresh));
      })
      .catch(() => {
        // Keep showing the cached catalog if there is one; otherwise report the failure.
        if (isMounted) setCatalog((current) => (current.loadState === "ready" ? current : { ...EMPTY_CATALOG, loadState: "error" }));
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return catalog;
}
