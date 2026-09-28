const shopeeHosts = new Set(["shopee.vn", "www.shopee.vn", "s.shopee.vn", "shp.ee"]);

export function getShopeeUrl(value?: string): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    return url.protocol === "https:" && shopeeHosts.has(url.hostname) &&
      !url.username && !url.password && !url.port && url.pathname !== "/"
      ? url.href
      : null;
  } catch {
    return null;
  }
}
