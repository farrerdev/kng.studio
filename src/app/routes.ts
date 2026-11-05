export function getStorefrontSlugFromPath() {
  if (typeof window === "undefined") return null;
  const path = decodeURIComponent(window.location.pathname).replace(/^\/+|\/+$/g, "");
  if (!path || path === "admin" || path.startsWith("admin/")) return null;
  return path.split("/")[0] || null;
}

export type AdminScreen = "catalog" | "stats" | "order";

// Admin tabs have their own URLs; any other /admin/<slug> is a product type inside "Sản phẩm".
export const ADMIN_SCREEN_PATHS: Record<AdminScreen, string> = {
  stats: "/admin",
  catalog: "/admin/san-pham",
  order: "/admin/tao-don",
};

const ADMIN_RESERVED_SEGMENTS = new Set(["san-pham", "tao-don"]);

function getAdminSegment() {
  if (typeof window === "undefined") return null;
  const path = decodeURIComponent(window.location.pathname).replace(/^\/+|\/+$/g, "");
  if (path === "admin" || !path.startsWith("admin/")) return null;
  return path.split("/")[1] || null;
}

export function getAdminProductTypeSlugFromPath() {
  const segment = getAdminSegment();
  return segment && !ADMIN_RESERVED_SEGMENTS.has(segment) ? segment : null;
}

export function getAdminScreenFromPath(): AdminScreen {
  const segment = getAdminSegment();
  if (!segment) return "stats";
  if (segment === "tao-don") return "order";
  return "catalog";
}
