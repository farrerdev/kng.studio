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

export function getProductPrice(product: Product, productTypes: ProductType[]) {
  return getProductType(product, productTypes)?.price ?? product.price;
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
