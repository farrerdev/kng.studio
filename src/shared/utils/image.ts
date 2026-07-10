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
