import { supabase, supabaseConfig } from "../../lib/supabase";
import { getSupabaseImageSrc } from "../../shared/utils/image";
import type { Product } from "../../types/catalog";

// Link previews (Messenger, Zalo, Facebook) read a pre-rendered 1200x630 image instead of
// resizing on demand. The file name is derived from the cover pattern, so api/product-preview.mjs
// can compute the same URL without a DB column, and a new cover always gets a fresh URL.
// Keep getProductPreviewImagePath in sync with the copy in api/product-preview.mjs.
export const PREVIEW_IMAGE_FOLDER = "previews";
const PREVIEW_WIDTH = 1200;
const PREVIEW_HEIGHT = 630;

function getPreviewKeyPart(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "cover";
}

export function getProductPreviewImagePath(product: Product) {
  const coverPattern = product.patterns[0];
  if (!coverPattern?.image.src.trim()) return null;
  const fileName = coverPattern.image.src.split("?")[0].split("/").pop()?.replace(/\.[^.]+$/, "") ?? "";
  return `${PREVIEW_IMAGE_FOLDER}/${getPreviewKeyPart(product.id)}/${getPreviewKeyPart(`${coverPattern.id}-${fileName}`)}.jpg`;
}

function loadPreviewSourceImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Không tải được ảnh set nổi bật để tạo ảnh preview."));
    image.src = getSupabaseImageSrc(src, PREVIEW_WIDTH, 85);
  });
}

export async function createProductPreviewBlob(src: string) {
  const image = await loadPreviewSourceImage(src);
  const canvas = document.createElement("canvas");
  canvas.width = PREVIEW_WIDTH;
  canvas.height = PREVIEW_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Trình duyệt không hỗ trợ tạo ảnh preview.");

  context.fillStyle = "#f2f2f2";
  context.fillRect(0, 0, PREVIEW_WIDTH, PREVIEW_HEIGHT);

  // Blurred cover fill behind the contained image; browsers without canvas filters keep the flat fill.
  if ("filter" in context) {
    const coverScale = Math.max(PREVIEW_WIDTH / image.width, PREVIEW_HEIGHT / image.height);
    context.save();
    context.filter = "blur(36px) saturate(1.05)";
    context.globalAlpha = 0.55;
    context.drawImage(
      image,
      (PREVIEW_WIDTH - image.width * coverScale) / 2,
      (PREVIEW_HEIGHT - image.height * coverScale) / 2,
      image.width * coverScale,
      image.height * coverScale,
    );
    context.restore();
  }

  const containScale = Math.min(PREVIEW_WIDTH / image.width, PREVIEW_HEIGHT / image.height);
  const drawWidth = image.width * containScale;
  const drawHeight = image.height * containScale;
  context.drawImage(image, (PREVIEW_WIDTH - drawWidth) / 2, (PREVIEW_HEIGHT - drawHeight) / 2, drawWidth, drawHeight);

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Không tạo được ảnh preview."))),
      "image/jpeg",
      0.86,
    ),
  );
}

async function listProductPreviewFiles(productId: string) {
  if (!supabase) return [];
  const folder = `${PREVIEW_IMAGE_FOLDER}/${getPreviewKeyPart(productId)}`;
  const result = await supabase.storage.from(supabaseConfig.storageBucket).list(folder, { limit: 100 });
  if (result.error) throw result.error;
  return (result.data ?? []).filter((file) => file.id).map((file) => `${folder}/${file.name}`);
}

/** Makes sure the product's preview image matches its current cover pattern and removes stale ones. */
export async function syncProductPreviewImage(product: Product) {
  if (!supabase) return;
  const expectedPath = getProductPreviewImagePath(product);
  const existingPaths = await listProductPreviewFiles(product.id);

  if (expectedPath && !existingPaths.includes(expectedPath)) {
    const blob = await createProductPreviewBlob(product.patterns[0].image.src);
    const uploadResult = await supabase.storage.from(supabaseConfig.storageBucket).upload(expectedPath, blob, {
      cacheControl: "31536000",
      contentType: "image/jpeg",
      upsert: true,
    });
    if (uploadResult.error) throw uploadResult.error;
  }

  const stalePaths = existingPaths.filter((path) => path !== expectedPath);
  if (stalePaths.length > 0) {
    await supabase.storage.from(supabaseConfig.storageBucket).remove(stalePaths);
  }
}

export async function removeProductPreviewImages(productId: string) {
  if (!supabase) return;
  const paths = await listProductPreviewFiles(productId);
  if (paths.length > 0) await supabase.storage.from(supabaseConfig.storageBucket).remove(paths);
}

/** Backfills previews for every product; failures are collected so one bad image doesn't stop the rest. */
export async function syncAllProductPreviewImages(products: Product[]) {
  let failedCount = 0;
  for (const product of products) {
    try {
      await syncProductPreviewImage(product);
    } catch (error) {
      failedCount += 1;
      console.warn(`Product preview sync failed for ${product.id}`, error);
    }
  }
  return { failedCount };
}
