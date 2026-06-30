import { products as mockProducts } from "../data/mockCatalog";
import { shopInfoImage } from "../data/shopInfo";
import { isSupabaseConfigured, supabase, supabaseConfig } from "../lib/supabase";
import type { Product, ProductImage, ProductPattern, SizeId } from "../types/catalog";

export type CatalogData = {
  products: Product[];
  shopInfoImage: ProductImage;
};

type ProductRow = {
  id: string;
  name: string;
  price: string;
  fit: string;
  material: string;
  size_chart_image_src: string;
  size_chart_image_alt: string;
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

export const fallbackCatalog: CatalogData = {
  products: mockProducts,
  shopInfoImage,
};

export async function fetchCatalog(): Promise<CatalogData> {
  if (!supabase) {
    return fallbackCatalog;
  }

  const [productsResult, patternsResult, imagesResult, shopInfoResult] = await Promise.all([
    supabase.from("products").select("*").eq("active", true).order("sort_order"),
    supabase.from("product_patterns").select("*").order("sort_order"),
    supabase.from("product_images").select("*").order("sort_order"),
    supabase.from("shop_info").select("*").eq("id", "main").maybeSingle(),
  ]);

  if (productsResult.error) throw productsResult.error;
  if (patternsResult.error) throw patternsResult.error;
  if (imagesResult.error) throw imagesResult.error;
  if (shopInfoResult.error) throw shopInfoResult.error;

  const productRows = (productsResult.data ?? []) as ProductRow[];
  const patternRows = (patternsResult.data ?? []) as PatternRow[];
  const imageRows = (imagesResult.data ?? []) as ProductImageRow[];
  const shopInfoRow = shopInfoResult.data as ShopInfoRow | null;

  return {
    products: productRows.map((product) => ({
      id: product.id,
      name: product.name,
      price: product.price,
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
        })),
      sizeChartImage: {
        id: `${product.id}-size-chart`,
        src: product.size_chart_image_src,
        alt: product.size_chart_image_alt,
      },
    })),
    shopInfoImage: shopInfoRow
      ? {
          id: shopInfoRow.id,
          src: shopInfoRow.image_src,
          alt: shopInfoRow.image_alt,
        }
      : shopInfoImage,
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

export async function saveCatalog(catalog: CatalogData) {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  const productRows = catalog.products.map((product, index) => ({
    id: product.id,
    name: product.name,
    price: product.price,
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

  const upsertProducts = await supabase.from("products").upsert(productRows);
  if (upsertProducts.error) throw upsertProducts.error;

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

export { isSupabaseConfigured };
