export function getSupabaseImageSrc(src: string, width: number, quality = 78, height = width, resize = "contain") {
  if (!src.includes("/storage/v1/object/public/")) return src;

  try {
    const url = new URL(src, window.location.origin);
    url.pathname = url.pathname.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
    url.searchParams.set("width", String(width));
    url.searchParams.set("height", String(height));
    url.searchParams.set("resize", resize);
    url.searchParams.set("quality", String(quality));
    return url.toString();
  } catch {
    return src;
  }
}

const RESPONSIVE_IMAGE_WIDTHS = [400, 640, 900, 1200];

// Lets the browser pick the smallest variant that fits the element's `sizes`; phones fetch ~400-640px
// instead of the 1200px version. Non-Supabase images have no variants, so they get no srcset.
export function getSupabaseImageSrcSet(src: string, quality = 78) {
  if (!src.includes("/storage/v1/object/public/")) return undefined;
  return RESPONSIVE_IMAGE_WIDTHS.map((width) => `${getSupabaseImageSrc(src, width, quality)} ${width}w`).join(", ");
}
