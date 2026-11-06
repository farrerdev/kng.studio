import type { CatalogData } from "../../../src/features/catalog/catalogRows";
import { getProductPrice, getProductTitle, getProductType, getStorefrontProducts } from "../../../src/features/catalog/catalogUtils";
import { getPopularProducts } from "../../../src/features/storefront/productRecommendations";
import { formatPrice } from "../../../src/shared/utils/money";
import type { StoreCatalog, StoreCategory, StoreProduct } from "./types";

/** Podium slots. */
const POPULAR_SLOTS = 5;


/**
 * What the scene shows, derived from the storefront's own catalog with the storefront's own rules
 * (which products are listed, their order, titles, prices and the "Đang được yêu thích" ranking),
 * so shelves always match the shop.
 */
export function toSceneCatalog(data: CatalogData | null): StoreCatalog {
  if (!data) return { categories: [], products: [], popular: [], status: "unavailable" };

  const listed = getStorefrontProducts(data.productTypes, data.products);
  const byId = new Map<string, StoreProduct>();
  const categories = new Map<string, StoreCategory>();

  for (const product of listed) {
    const type = getProductType(product, data.productTypes);
    const categoryName = type?.name.trim() || "Loại sản phẩm";
    const price = formatPrice(getProductPrice(product, data.productTypes));
    const sceneProduct: StoreProduct = {
      id: product.id,
      categoryId: product.productTypeId,
      categoryName,
      title: getProductTitle(product, data.productTypes),
      shortName: product.name.trim() || categoryName,
      price,
      inStockPatterns: product.patterns
        .filter((pattern) => pattern.availableSizes.length > 0)
        .map((pattern) => ({
          id: pattern.id,
          name: pattern.name.trim() || "Họa tiết",
        })),
      popularity: data.popularity?.[product.id] ?? 0,
    };
    byId.set(product.id, sceneProduct);
    const category = categories.get(product.productTypeId) ?? { id: product.productTypeId, name: categoryName, price, products: [] };
    category.products.push(sceneProduct);
    categories.set(product.productTypeId, category);
  }

  const popularListed = getPopularProducts(listed, data.popularity);

  return {
    categories: [...categories.values()],
    products: [...byId.values()],
    popular: popularListed
      .slice(0, POPULAR_SLOTS)
      .map((product) => byId.get(product.id)!)
      .filter(Boolean),
    status: "live",
  };
}
