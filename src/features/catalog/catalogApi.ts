import { products as mockProducts, productTypes as mockProductTypes } from "../../data/mockCatalog";
import { shopInfoImage } from "../../data/shopInfo";
import { isSupabaseConfigured, supabase, supabaseConfig } from "../../lib/supabase";
import type { Product, ProductImage, ProductPattern, ProductType, SizeId } from "../../types/catalog";
import { getShopeeUrl } from "./shopeeUrl";

export type CatalogData = {
  productTypes: ProductType[];
  products: Product[];
  shopInfoImage: ProductImage | null;
};

type ProductRow = {
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

type ProductTypeRow = {
  id: string;
  name: string;
  price: string;
  cover_image_src?: string | null;
  cover_image_alt?: string | null;
  size_chart_image_src?: string | null;
  size_chart_image_alt?: string | null;
  sort_order: number;
};

type PatternRow = {
  id: string;
  product_id: string;
  name: string;
  accent: string;
  image_src: string;
  image_alt: string;
  available_sizes: SizeId[];
  sort_order: number;
};

type ProductImageRow = {
  id: string;
  product_id: string;
  src: string;
  alt: string;
  sort_order: number;
};

type ShopInfoRow = {
  id: string;
  image_src: string;
  image_alt: string;
};

export const fallbackCatalog = {
  productTypes: mockProductTypes,
  products: mockProducts,
  shopInfoImage,
};

export async function fetchCatalog(): Promise<CatalogData> {
  if (!supabase) {
    return fallbackCatalog;
  }

  const [productTypesResult, productsResult, patternsResult, imagesResult, shopInfoResult] = await Promise.all([
    supabase.from("product_types").select("*").order("sort_order"),
    supabase.from("products").select("*").eq("active", true).order("sort_order"),
    supabase.from("product_patterns").select("*").order("sort_order"),
    supabase.from("product_images").select("*").order("sort_order"),
    supabase.from("shop_info").select("*").eq("id", "main").maybeSingle(),
  ]);

  if (productTypesResult.error) throw productTypesResult.error;
  if (productsResult.error) throw productsResult.error;
  if (patternsResult.error) throw patternsResult.error;
  if (imagesResult.error) throw imagesResult.error;
  if (shopInfoResult.error) throw shopInfoResult.error;

  const productTypeRows = (productTypesResult.data ?? []) as ProductTypeRow[];
  const productRows = (productsResult.data ?? []) as ProductRow[];
  const patternRows = (patternsResult.data ?? []) as PatternRow[];
  const imageRows = (imagesResult.data ?? []) as ProductImageRow[];
  const shopInfoRow = shopInfoResult.data as ShopInfoRow | null;
  const productTypes =
    productTypeRows.length > 0
      ? productTypeRows.map((productType) => fillProductTypeFallbacks(mapProductTypeRow(productType), productRows))
      : deriveProductTypes(productRows);
  const storageModelImages =
    imageRows.length === 0
      ? await fetchStorageModelImages(productRows.map((product) => product.id))
      : new Map<string, ProductImage[]>();

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
          .concat(storageModelImages.get(product.id) ?? []),
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

async function fetchStorageModelImages(productIds: string[]) {
  const storageModelImages = new Map<string, ProductImage[]>();
  if (!supabase || productIds.length === 0) return storageModelImages;
  const client = supabase;

  await Promise.all(
    productIds.map(async (productId) => {
      const result = await client.storage
        .from(supabaseConfig.storageBucket)
        .list(`models/${productId}`, { limit: 100, sortBy: { column: "created_at", order: "asc" } });

      if (result.error) return;

      const images = (result.data ?? [])
        .filter((file) => file.name && !file.name.startsWith("."))
        .map((file, index) => {
          const path = `models/${productId}/${file.name}`;
          const publicUrl = client.storage.from(supabaseConfig.storageBucket).getPublicUrl(path);
          return {
            id: `storage-${productId}-${file.id ?? file.name}`,
            src: publicUrl.data.publicUrl,
            alt: `Ảnh mẫu & chi tiết sản phẩm ${index + 1}`,
          };
        });

      if (images.length > 0) {
        storageModelImages.set(productId, images);
      }
    }),
  );

  return storageModelImages;
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

export async function patchCatalogProductType({
  productType,
  baselineProductType,
  sortOrder,
  baselineSortOrder,
}: {
  productType: ProductType;
  baselineProductType?: ProductType;
  sortOrder: number;
  baselineSortOrder?: number;
}) {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const patch: Record<string, unknown> = {};
  const setField = (key: string, current: unknown, baseline: unknown) => {
    if (!baselineProductType || current !== baseline) patch[key] = current;
  };
  setField("name", productType.name, baselineProductType?.name);
  setField("price", productType.price, baselineProductType?.price);
  setField("cover_image_src", productType.coverImage.src, baselineProductType?.coverImage.src);
  setField("cover_image_alt", productType.coverImage.alt, baselineProductType?.coverImage.alt);
  setField("size_chart_image_src", productType.sizeChartImage.src, baselineProductType?.sizeChartImage.src);
  setField("size_chart_image_alt", productType.sizeChartImage.alt, baselineProductType?.sizeChartImage.alt);
  setField("sort_order", sortOrder, baselineSortOrder);

  const result = await supabase.rpc("patch_catalog_product_type", {
    p_product_type_id: productType.id,
    p_patch: patch,
  });
  if (result.error) throw result.error;
}

export async function patchCatalogSortOrder({
  productTypes,
  products,
  baselineProductTypes,
  baselineProducts,
}: {
  productTypes: ProductType[];
  products: Product[];
  baselineProductTypes: ProductType[];
  baselineProducts: Product[];
}) {
  if (!supabase) throw new Error("Supabase is not configured.");

  const baselineTypeOrder = new Map(baselineProductTypes.map((item, index) => [item.id, index]));
  const baselineProductOrder = new Map(baselineProducts.map((item, index) => [item.id, index]));
  const typeOrders = productTypes.flatMap((item, index) =>
    baselineTypeOrder.get(item.id) !== index ? [{ id: item.id, sort_order: index }] : [],
  );
  const productOrders = products.flatMap((item, index) =>
    baselineProductOrder.get(item.id) !== index ? [{ id: item.id, sort_order: index }] : [],
  );

  const result = await supabase.rpc("patch_catalog_sort_order", {
    p_product_type_orders: typeOrders,
    p_product_orders: productOrders,
  });
  if (result.error) throw result.error;
}

export async function deleteCatalogProduct(productId: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const result = await supabase.rpc("delete_catalog_product", { p_product_id: productId });
  if (result.error) throw result.error;
}

export async function deleteCatalogProductType(productTypeId: string, replacementProductTypeId: string) {
  if (!supabase) throw new Error("Supabase is not configured.");
  const result = await supabase.rpc("delete_catalog_product_type", {
    p_product_type_id: productTypeId,
    p_replacement_product_type_id: replacementProductTypeId,
  });
  if (result.error) throw result.error;
}

export async function patchCatalogProduct({
  product,
  baselineProduct,
  productType,
  sortOrder,
  baselineSortOrder,
}: {
  product: Product;
  baselineProduct?: Product;
  productType: ProductType;
  sortOrder: number;
  baselineSortOrder?: number;
}) {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  if (product.shopeeUrl?.trim() && !getShopeeUrl(product.shopeeUrl)) {
    throw new Error(`Link Shopee của sản phẩm ${product.name || product.id} không hợp lệ. Hãy nhập link HTTPS của sản phẩm trên Shopee.`);
  }

  const currentShopeeUrl = getShopeeUrl(product.shopeeUrl) ?? "";
  const baselineShopeeUrl = getShopeeUrl(baselineProduct?.shopeeUrl) ?? "";
  const currentPrice = productType.price || product.price;
  const productPatch: Record<string, unknown> = {};
  const setProductField = (key: string, current: unknown, baseline: unknown) => {
    if (!baselineProduct || current !== baseline) productPatch[key] = current;
  };

  setProductField("product_type_id", product.productTypeId, baselineProduct?.productTypeId);
  setProductField("name", product.name, baselineProduct?.name);
  setProductField("price", currentPrice, baselineProduct?.price);
  setProductField("fit", product.fit, baselineProduct?.fit);
  setProductField("material", product.material, baselineProduct?.material);
  setProductField("shopee_url", currentShopeeUrl, baselineShopeeUrl);
  setProductField("size_chart_image_src", product.sizeChartImage.src, baselineProduct?.sizeChartImage.src);
  setProductField("size_chart_image_alt", product.sizeChartImage.alt, baselineProduct?.sizeChartImage.alt);
  setProductField("sort_order", sortOrder, baselineSortOrder);
  if (!baselineProduct) productPatch.active = true;

  const baselinePatterns = new Map(baselineProduct?.patterns.map((pattern, index) => [pattern.id, { pattern, index }]) ?? []);
  const patternChanges = product.patterns.flatMap((pattern, index) => {
    const baseline = baselinePatterns.get(pattern.id);
    const changes: Record<string, unknown> = {};
    const setField = (key: string, current: unknown, previous: unknown) => {
      if (!baseline || JSON.stringify(current) !== JSON.stringify(previous)) changes[key] = current;
    };
    setField("name", pattern.name, baseline?.pattern.name);
    setField("accent", pattern.accent, baseline?.pattern.accent);
    setField("image_src", pattern.image.src, baseline?.pattern.image.src);
    setField("image_alt", pattern.image.alt, baseline?.pattern.image.alt);
    setField("available_sizes", pattern.availableSizes, baseline?.pattern.availableSizes);
    setField("sort_order", index, baseline?.index);
    return Object.keys(changes).length > 0 ? [{ id: pattern.id, changes }] : [];
  });
  const patternIds = new Set(product.patterns.map((pattern) => pattern.id));
  const deletedPatternIds = baselineProduct?.patterns.filter((pattern) => !patternIds.has(pattern.id)).map((pattern) => pattern.id) ?? [];

  const baselineImages = new Map(baselineProduct?.modelImages.map((image, index) => [image.id, { image, index }]) ?? []);
  const imageChanges = product.modelImages.flatMap((image, index) => {
    const baseline = baselineImages.get(image.id);
    const changes: Record<string, unknown> = {};
    if (!baseline || image.src !== baseline.image.src) changes.src = image.src;
    if (!baseline || image.alt !== baseline.image.alt) changes.alt = image.alt;
    if (!baseline || index !== baseline.index) changes.sort_order = index;
    return Object.keys(changes).length > 0 ? [{ id: image.id, changes }] : [];
  });
  const imageIds = new Set(product.modelImages.map((image) => image.id));
  const deletedImageIds = baselineProduct?.modelImages.filter((image) => !imageIds.has(image.id)).map((image) => image.id) ?? [];

  const result = await supabase.rpc("patch_catalog_product", {
    p_product_id: product.id,
    p_product_patch: productPatch,
    p_pattern_changes: patternChanges,
    p_pattern_ids_to_delete: deletedPatternIds,
    p_image_changes: imageChanges,
    p_image_ids_to_delete: deletedImageIds,
  });

  if (result.error) throw result.error;
}

export async function uploadCatalogImage(file: File, folder: string): Promise<string> {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const extension = file.name.split(".").pop() || "webp";
  const path = `${folder}/${crypto.randomUUID()}.${extension}`;
  const uploadResult = await supabase.storage.from(supabaseConfig.storageBucket).upload(path, file, {
    cacheControl: "31536000",
    upsert: false,
  });

  if (uploadResult.error) throw uploadResult.error;

  const publicUrl = supabase.storage.from(supabaseConfig.storageBucket).getPublicUrl(path);
  return publicUrl.data.publicUrl;
}

export { isSupabaseConfigured };
