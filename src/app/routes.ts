export function getStorefrontSlugFromPath() {
  if (typeof window === "undefined") return null;
  const path = decodeURIComponent(window.location.pathname).replace(/^\/+|\/+$/g, "");
  if (!path || path === "admin" || path.startsWith("admin/")) return null;
  return path.split("/")[0] || null;
}

export function getAdminProductTypeSlugFromPath() {
  if (typeof window === "undefined") return null;
  const path = decodeURIComponent(window.location.pathname).replace(/^\/+|\/+$/g, "");
  if (path === "admin" || !path.startsWith("admin/")) return null;
  return path.split("/")[1] || null;
}
