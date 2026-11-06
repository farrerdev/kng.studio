import type { Product, ProductType, SizeId } from "../../types/catalog";
import { getProductTitle } from "../catalog/catalogUtils";
import { createCartDraft, formatSelectedSize } from "./cart/cartUtils";
import type { GalleryImage } from "./storefrontTypes";

export function getVisibleProducts(selectedSize: SizeId, catalogProducts: Product[]) {
  return catalogProducts.map((product) => ({
    ...product,
    patterns: product.patterns.filter((pattern) => pattern.availableSizes.includes(selectedSize)),
  }));
}

export function getProductGalleryImages(
  product: Product,
  productTypes: ProductType[],
  selectedSize: SizeId,
): GalleryImage[] {
  const productTitle = getProductTitle(product, productTypes);

  return [
    ...product.patterns.map((pattern) => ({
      ...pattern.image,
      caption: `${productTitle} - ${pattern.name} · ${formatSelectedSize(selectedSize)}`,
      cartItem: createCartDraft(product, pattern, selectedSize, productTypes),
    })),
    ...product.modelImages.map((image, index) => ({
      ...image,
      caption: `${productTitle} - ảnh mẫu & chi tiết ${index + 1}`,
    })),
  ];
}
