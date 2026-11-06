// Catalog as the 3D scene needs it: shelves, fabric textures and spot copy. Everything about
// buying (sizes, gallery, cart) lives in the embedded storefront, so it is not modelled here.

export type StorePattern = {
  id: string;
  name: string;
};

export type StoreProduct = {
  id: string;
  categoryId: string;
  categoryName: string;
  /** "Tay dài quần dài - Cổ sen", same title rule as the main storefront. */
  title: string;
  /** Model name only ("Cổ sen"), or the category name when the model has no name. */
  shortName: string;
  price: string;
  /** Patterns with at least one size in stock, in shop order. */
  inStockPatterns: StorePattern[];
  popularity: number;
};

export type StoreCategory = {
  id: string;
  name: string;
  price: string;
  products: StoreProduct[];
};

export type StoreCatalog = {
  categories: StoreCategory[];
  /** Products the storefront lists (at least one pattern in stock), in storefront order. */
  products: StoreProduct[];
  /** Most interacted-with products over the last 30 days, best first. */
  popular: StoreProduct[];
  status: "live" | "unavailable";
};
