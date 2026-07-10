import type { Product, ProductType, SizeId } from "../../types/catalog";
import { getProductPrice, getProductTitle } from "../catalog/catalogUtils";
import { formatPrice } from "../../shared/utils/money";
import { createCartItemId, formatSelectedSize } from "./cart/cartUtils";
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
  const price = formatPrice(getProductPrice(product, productTypes));

  return [
    ...product.patterns.map((pattern) => ({
      ...pattern.image,
      caption: `${productTitle} - ${pattern.name} · ${formatSelectedSize(selectedSize)}`,
      cartItem: {
        id: createCartItemId(product.id, pattern.id, selectedSize),
        productId: product.id,
        patternId: pattern.id,
        sizeId: selectedSize,
        productName: productTitle,
        patternName: pattern.name,
        price,
        image: pattern.image,
      },
    })),
    ...product.modelImages.map((image, index) => ({
      ...image,
      caption: `${productTitle} - ảnh mẫu & chi tiết ${index + 1}`,
    })),
  ];
}
