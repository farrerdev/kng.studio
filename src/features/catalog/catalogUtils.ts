import { formatMoney, getPriceValue } from "../../shared/utils/money";
import type { Product, ProductImage, ProductType } from "../../types/catalog";

export function getProductType(product: Product, productTypes: ProductType[]) {
  return productTypes.find((productType) => productType.id === product.productTypeId) ?? null;
}

export function getProductTitle(product: Product, productTypes: ProductType[]) {
  const productType = getProductType(product, productTypes);
  const typeName = productType?.name.trim() || "Loại sản phẩm";
  const productName = product.name.trim();
  return productName ? `${typeName} - ${productName}` : typeName;
}

export function getProductDisplayName(product: Product) {
  return product.name.trim() || "Mẫu";
}

/** The product type's price, before this product's own discount. */
export function getProductListPrice(product: Product, productTypes: ProductType[]) {
  return getProductType(product, productTypes)?.price ?? product.price;
}

/** This product's own discount in đồng, never more than its list price. */
export function getProductDiscount(product: Product, productTypes: ProductType[]) {
  const listValue = getPriceValue(getProductListPrice(product, productTypes));
  return Math.min(Math.max(0, product.discount ?? 0), listValue);
}

/** What the guest pays for one set: the list price minus this product's discount. */
export function getProductPrice(product: Product, productTypes: ProductType[]) {
  const listPrice = getProductListPrice(product, productTypes);
  const discount = getProductDiscount(product, productTypes);
  return discount > 0 ? formatMoney(getPriceValue(listPrice) - discount) : listPrice;
}

export function getAvailablePatternCount(product: Product) {
  return product.patterns.filter((pattern) => pattern.availableSizes.length > 0).length;
}

export function isProductInStock(product: Product) {
  return getAvailablePatternCount(product) > 0;
}

/** Products the storefront lists: visible and in stock, ordered by product type then catalog order. */
export function getStorefrontProducts(productTypes: ProductType[], products: Product[]) {
  const typeOrder = new Map(productTypes.map((productType, index) => [productType.id, index]));
  return products
    .map((product, index) => ({ product, index }))
    .filter(({ product }) => product.active !== false && isProductInStock(product))
    .sort((left, right) => {
      const leftTypeOrder = typeOrder.get(left.product.productTypeId) ?? Number.MAX_SAFE_INTEGER;
      const rightTypeOrder = typeOrder.get(right.product.productTypeId) ?? Number.MAX_SAFE_INTEGER;
      return leftTypeOrder === rightTypeOrder ? left.index - right.index : leftTypeOrder - rightTypeOrder;
    })
    .map(({ product }) => product);
}

export function getProductCoverImage(product: Product, productTypes: ProductType[], _products: Product[]): ProductImage {
  const firstPatternImage = product.patterns[0]?.image;
  if (firstPatternImage) return firstPatternImage;

  return {
    id: `${product.id}-cover-fallback`,
    src: "/images/shop-info.webp",
    alt: `Ảnh bìa ${getProductTitle(product, productTypes)}`,
  };
}

export function getProductTypeSizeChartImage(productType: ProductType, products: Product[]): ProductImage {
  if (productType.sizeChartImage.src.trim()) {
    return productType.sizeChartImage;
  }

  const firstSizeChart = products.find((product) => product.productTypeId === productType.id)?.sizeChartImage;
  return (
    firstSizeChart ?? {
      id: `${productType.id}-size-chart-fallback`,
      src: "/images/size-chart-moc.webp",
      alt: `Bảng size ${productType.name || "loại sản phẩm"}`,
    }
  );
}

export function slugify(value: string) {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "san-pham";
}

export function getProductTypeSlug(productType: ProductType) {
  return slugify(productType.name || productType.id);
}

export function getProductSlug(product: Product, productTypes: ProductType[]) {
  return slugify(getProductTitle(product, productTypes) || product.id);
}
