import { products as mockProducts, productTypes as mockProductTypes } from "../../data/mockCatalog";
import { shopInfoImage } from "../../data/shopInfo";
import type { Product, ProductImage, ProductPattern, ProductType, SizeId } from "../../types/catalog";

// Raw Supabase rows and their mapping to the app's catalog shape. Kept free of supabase-js so the
// storefront can map rows served by /api/catalog without bundling the client.
export type CatalogData = {
  productTypes: ProductType[];
  products: Product[];
  shopInfoImage: ProductImage | null;
};

export type ProductRow = {
  id: string;
  product_type_id?: string | null;
  name: string;
  price: string;
  fit: string;
  material: string;
  shopee_url?: string | null;
  size_chart_image_src: string;
  size_chart_image_alt: string;
  sort_order: number;
};

export type ProductTypeRow = {
  id: string;
  name: string;
  price: string;
  cover_image_src?: string | null;
  cover_image_alt?: string | null;
  size_chart_image_src?: string | null;
  size_chart_image_alt?: string | null;
  sort_order: number;
};

export type PatternRow = {
  id: string;
  product_id: string;
  name: string;
  accent: string;
  image_src: string;
  image_alt: string;
  available_sizes: SizeId[];
  sort_order: number;
};

export type ProductImageRow = {
  id: string;
  product_id: string;
  src: string;
  alt: string;
  sort_order: number;
};

export type ShopInfoRow = {
  id: string;
  image_src: string;
  image_alt: string;
};

export type CatalogRows = {
  productTypes: ProductTypeRow[];
  products: ProductRow[];
  patterns: PatternRow[];
  images: ProductImageRow[];
  shopInfo: ShopInfoRow | null;
  /** Legacy model images listed from Storage, used only when product_images is empty. */
  storageModelImages?: Record<string, ProductImage[]>;
};

export const fallbackCatalog = {
  productTypes: mockProductTypes,
  products: mockProducts,
  shopInfoImage,
};

export function mapCatalogRows(rows: CatalogRows): CatalogData {
  const productTypeRows = rows.productTypes;
  const productRows = rows.products;
  const patternRows = rows.patterns;
  const imageRows = rows.images;
  const shopInfoRow = rows.shopInfo;
  const productTypes =
    productTypeRows.length > 0
      ? productTypeRows.map((productType) => fillProductTypeFallbacks(mapProductTypeRow(productType), productRows))
      : deriveProductTypes(productRows);
  return {
    productTypes,
    products: productRows.map((product) => {
      const legacyTitle = splitLegacyTitle(product.name);
      const productTypeId = product.product_type_id ?? createProductTypeId(legacyTitle.typeName, product.price);
      const productType = productTypes.find((type) => type.id === productTypeId);

      return {
        id: product.id,
        productTypeId,
        name: product.product_type_id ? product.name : legacyTitle.productName,
        price: productType?.price ?? product.price,
        fit: product.fit,
        material: product.material,
        shopeeUrl: product.shopee_url ?? "",
        patterns: patternRows
          .filter((pattern) => pattern.product_id === product.id)
          .map(mapPatternRow),
        modelImages: imageRows
          .filter((image) => image.product_id === product.id)
          .map((image) => ({
            id: image.id,
            src: image.src,
            alt: image.alt,
          }))
          .concat(rows.storageModelImages?.[product.id] ?? []),
        sizeChartImage: {
          id: `${product.id}-size-chart`,
          src: product.size_chart_image_src,
          alt: product.size_chart_image_alt,
        },
      };
    }),
    shopInfoImage: shopInfoRow?.image_src
      ? {
          id: shopInfoRow.id,
          src: shopInfoRow.image_src,
          alt: shopInfoRow.image_alt,
        }
      : null,
  };
}


function mapProductTypeRow(productType: ProductTypeRow): ProductType {
  return {
    id: productType.id,
    name: productType.name,
    price: productType.price,
    coverImage: {
      id: `${productType.id}-cover`,
      src: productType.cover_image_src ?? "",
      alt: productType.cover_image_alt ?? `Ảnh bìa ${productType.name}`,
    },
    sizeChartImage: {
      id: `${productType.id}-size-chart`,
      src: productType.size_chart_image_src ?? "",
      alt: productType.size_chart_image_alt ?? `Bảng size ${productType.name}`,
    },
  };
}

function fillProductTypeFallbacks(productType: ProductType, products: ProductRow[]): ProductType {
  if (productType.sizeChartImage.src.trim()) return productType;

  const firstProduct = products.find((product) => product.product_type_id === productType.id);
  return {
    ...productType,
    sizeChartImage: {
      ...productType.sizeChartImage,
      src: firstProduct?.size_chart_image_src ?? "",
      alt: firstProduct?.size_chart_image_alt || productType.sizeChartImage.alt,
    },
  };
}

function mapPatternRow(pattern: PatternRow): ProductPattern {
  return {
    id: pattern.id,
    name: pattern.name,
    accent: pattern.accent,
    image: {
      id: `${pattern.id}-image`,
      src: pattern.image_src,
      alt: pattern.image_alt,
    },
    availableSizes: pattern.available_sizes ?? [],
  };
}

function createProductTypeId(name: string, price: string) {
  const normalized = `${name}-${price}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `type-${normalized || "default"}`.slice(0, 64);
}

function splitLegacyTitle(name: string) {
  const [typeName, ...nameParts] = name.split(" - ");
  return {
    typeName: nameParts.length > 0 ? typeName.trim() || "Loại sản phẩm" : name.trim() || "Loại sản phẩm",
    productName: nameParts.length > 0 ? nameParts.join(" - ").trim() : name,
  };
}

function deriveProductTypes(products: ProductRow[]): ProductType[] {
  const productTypes = new Map<string, ProductType>();
  products.forEach((product) => {
    const legacyTitle = splitLegacyTitle(product.name);
    const id = createProductTypeId(legacyTitle.typeName, product.price);
    if (!productTypes.has(id)) {
      productTypes.set(id, {
        id,
        name: legacyTitle.typeName,
        price: product.price,
        coverImage: {
          id: `${id}-cover`,
          src: "",
          alt: `Ảnh bìa ${legacyTitle.typeName}`,
        },
        sizeChartImage: {
          id: `${id}-size-chart`,
          src: product.size_chart_image_src,
          alt: product.size_chart_image_alt || `Bảng size ${legacyTitle.typeName}`,
        },
      });
    }
  });
  return Array.from(productTypes.values());
}

