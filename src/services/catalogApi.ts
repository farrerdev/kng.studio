import { products as mockProducts, productTypes as mockProductTypes } from "../data/mockCatalog";
import { shopInfoImage } from "../data/shopInfo";
import { isSupabaseConfigured, supabase, supabaseConfig } from "../lib/supabase";
import type { Product, ProductImage, ProductPattern, ProductType, SizeId } from "../types/catalog";

export type CatalogData = {
  productTypes: ProductType[];
  products: Product[];
  shopInfoImage: ProductImage | null;
};

export type StorefrontEventType =
  | "product_view"
  | "pattern_view"
  | "add_to_cart"
  | "order_image_created"
  | "message_click";

export type StorefrontEventInput = {
  eventType: StorefrontEventType;
  productId?: string | null;
  patternId?: string | null;
  sizeId?: SizeId | null;
};

export type StorefrontEventRow = {
  event_type: StorefrontEventType;
  product_id: string | null;
  pattern_id: string | null;
  size_id: SizeId | null;
  created_at: string;
};

type ProductRow = {
  id: string;
  product_type_id?: string | null;
  name: string;
  price: string;
  fit: string;
  material: string;
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

  if (productsResult.error) throw productsResult.error;
  if (patternsResult.error) throw patternsResult.error;
  if (imagesResult.error) throw imagesResult.error;
  if (shopInfoResult.error) throw shopInfoResult.error;

  const productTypeRows = productTypesResult.error ? [] : ((productTypesResult.data ?? []) as ProductTypeRow[]);
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

function formatPostgrestInList(values: string[]) {
  return `(${values.map((value) => `"${value.replace(/"/g, '\\"')}"`).join(",")})`;
}

export async function saveCatalog(catalog: {
  productTypes: ProductType[];
  products: Product[];
  shopInfoImage: ProductImage;
}) {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const productTypeRows = catalog.productTypes.map((productType, index) => ({
    id: productType.id,
    name: productType.name,
    price: productType.price,
    cover_image_src: "",
    cover_image_alt: "",
    size_chart_image_src: productType.sizeChartImage.src,
    size_chart_image_alt: productType.sizeChartImage.alt,
    sort_order: index,
  }));

  const productRows = catalog.products.map((product, index) => ({
    id: product.id,
    product_type_id: product.productTypeId,
    name: product.name,
    price: catalog.productTypes.find((productType) => productType.id === product.productTypeId)?.price ?? product.price,
    fit: product.fit,
    material: product.material,
    size_chart_image_src: product.sizeChartImage.src,
    size_chart_image_alt: product.sizeChartImage.alt,
    sort_order: index,
    active: true,
  }));

  const patternRows = catalog.products.flatMap((product) =>
    product.patterns.map((pattern, index) => ({
      id: pattern.id,
      product_id: product.id,
      name: pattern.name,
      accent: pattern.accent,
      image_src: pattern.image.src,
      image_alt: pattern.image.alt,
      available_sizes: pattern.availableSizes,
      sort_order: index,
    })),
  );

  const imageRows = catalog.products.flatMap((product) =>
    product.modelImages.map((image, index) => ({
      id: image.id,
      product_id: product.id,
      src: image.src,
      alt: image.alt,
      sort_order: index,
    })),
  );

  const productIds = catalog.products.map((product) => product.id);
  const productTypeIds = catalog.productTypes.map((productType) => productType.id);

  if (productTypeRows.length > 0) {
    const upsertProductTypes = await supabase.from("product_types").upsert(productTypeRows);
    if (upsertProductTypes.error) throw upsertProductTypes.error;
  }

  const upsertProducts = await supabase.from("products").upsert(productRows);
  if (upsertProducts.error) throw upsertProducts.error;

  if (productIds.length > 0) {
    const deleteRemovedProducts = await supabase.from("products").delete().not("id", "in", formatPostgrestInList(productIds));
    if (deleteRemovedProducts.error) throw deleteRemovedProducts.error;
  } else {
    const deleteAllProducts = await supabase.from("products").delete().neq("id", "");
    if (deleteAllProducts.error) throw deleteAllProducts.error;
  }

  if (productIds.length > 0) {
    const deletePatterns = await supabase.from("product_patterns").delete().in("product_id", productIds);
    if (deletePatterns.error) throw deletePatterns.error;

    const deleteImages = await supabase.from("product_images").delete().in("product_id", productIds);
    if (deleteImages.error) throw deleteImages.error;
  }

  if (patternRows.length > 0) {
    const upsertPatterns = await supabase.from("product_patterns").upsert(patternRows);
    if (upsertPatterns.error) throw upsertPatterns.error;
  }

  if (imageRows.length > 0) {
    const upsertImages = await supabase.from("product_images").upsert(imageRows);
    if (upsertImages.error) throw upsertImages.error;
  }

  if (productTypeIds.length > 0) {
    const deleteProductTypes = await supabase
      .from("product_types")
      .delete()
      .not("id", "in", formatPostgrestInList(productTypeIds));
    if (deleteProductTypes.error) throw deleteProductTypes.error;
  }

  const upsertShopInfo = await supabase.from("shop_info").upsert({
    id: "main",
    image_src: catalog.shopInfoImage.src,
    image_alt: catalog.shopInfoImage.alt,
  });
  if (upsertShopInfo.error) throw upsertShopInfo.error;
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

export async function trackStorefrontEvent(event: StorefrontEventInput): Promise<void> {
  if (!supabase) return;

  try {
    await supabase.from("storefront_events").insert({
      event_type: event.eventType,
      product_id: event.productId ?? null,
      pattern_id: event.patternId ?? null,
      size_id: event.sizeId ?? null,
    });
  } catch {
    // Analytics should never block storefront actions.
  }
}

export async function fetchStorefrontStats(days: 7 | 30): Promise<StorefrontEventRow[]> {
  if (!supabase) return [];

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const result = await supabase
    .from("storefront_events")
    .select("event_type, product_id, pattern_id, size_id, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (result.error) throw result.error;
  return (result.data ?? []) as StorefrontEventRow[];
}

export { isSupabaseConfigured };
