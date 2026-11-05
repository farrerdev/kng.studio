import { getProductPrice } from "../catalog/catalogUtils";
import { getPriceValue } from "../../shared/utils/money";
import type { Product, ProductType, SizeId } from "../../types/catalog";

const SIMILAR_PRICE_RANGE = 30000;

type RecommendationInput = {
  current: Product;
  products: Product[];
  productTypes: ProductType[];
  selectedSize: SizeId;
  cartProductIds: ReadonlySet<string>;
  /** Interaction score per product id; higher = more viewed / added to cart recently. */
  popularity?: Record<string, number>;
};

const MAX_POPULARITY_POINTS = 3;

// Orders every other product (none are dropped) for the detail page with simple, explainable signals:
// buyable in the shopper's size > same style family > recent interactions / not in cart > similar price.
// Ties keep the catalog order the shop set in admin.
export function getRecommendedProducts({
  current,
  products,
  productTypes,
  selectedSize,
  cartProductIds,
  popularity = {},
}: RecommendationInput) {
  const maxPopularity = Math.max(0, ...products.map((product) => popularity[product.id] ?? 0));
  const currentPrice = getPriceValue(getProductPrice(current, productTypes));

  return products
    .filter((product) => product.id !== current.id)
    .map((product, index) => {
      const fitsSize = product.patterns.some((pattern) => pattern.availableSizes.includes(selectedSize));
      const sameType = product.productTypeId === current.productTypeId;
      const inCart = cartProductIds.has(product.id);
      const priceGap = Math.abs(getPriceValue(getProductPrice(product, productTypes)) - currentPrice);
      // Popularity is scaled to 0–3 points: it reorders products within a group (e.g. among the
      // same style) and can lift a hot item past a merely similar-priced one, but never above size fit.
      const popularityPoints =
        maxPopularity > 0 ? ((popularity[product.id] ?? 0) / maxPopularity) * MAX_POPULARITY_POINTS : 0;
      const score =
        (fitsSize ? 8 : 0) +
        (sameType ? 4 : 0) +
        (inCart ? 0 : 2) +
        (priceGap <= SIMILAR_PRICE_RANGE ? 1 : 0) +
        popularityPoints;
      return { product, index, score };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ product }) => product);
}
