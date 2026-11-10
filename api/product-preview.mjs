// Fallback for product links that have no static page yet (a product added since the last build):
// the build writes dist/<slug>/index.html for every active product, and Vercel serves those first.
import {
  buildProductPreviewMeta,
  fetchPreviewCatalog,
  getProductSlug,
  renderProductPreviewHtml,
} from "../lib/productPreview.mjs";

const BASE_HTML_TIMEOUT_MS = 4000;

// Warm function instances reuse the storefront shell instead of fetching it on every request.
let cachedBaseHtml = null;

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const slug = requestUrl.searchParams.get("slug")?.trim() ?? "";

  let baseHtml;
  try {
    baseHtml = await getBaseHtml(requestUrl.origin);
  } catch (error) {
    console.error("Product preview could not load storefront HTML", error);
    return Response.redirect(new URL("/", requestUrl.origin), 302);
  }

  if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    return htmlResponse(baseHtml, { cacheable: false });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY ?? "";
  if (!supabaseUrl || !supabaseAnonKey) {
    return htmlResponse(baseHtml, { cacheable: false });
  }

  try {
    const catalog = await fetchPreviewCatalog(supabaseUrl, supabaseAnonKey);
    const product = catalog.products.find(
      (currentProduct) => getProductSlug(currentProduct, catalog.productTypes) === slug,
    );
    if (!product) return htmlResponse(baseHtml, { cacheable: false });

    const meta = await buildProductPreviewMeta(supabaseUrl, product, catalog.productTypes);
    return htmlResponse(renderProductPreviewHtml(baseHtml, meta), { cacheable: true });
  } catch (error) {
    console.error("Dynamic product preview failed", error);
    return htmlResponse(baseHtml, { cacheable: false });
  }
}

async function getBaseHtml(origin) {
  if (cachedBaseHtml) return cachedBaseHtml;
  const response = await fetch(`${origin}/`, {
    headers: {
      accept: "text/html",
      "user-agent": "KNG.studio product preview renderer",
    },
    signal: AbortSignal.timeout(BASE_HTML_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Failed to load storefront HTML: ${response.status} ${response.statusText}`);
  }
  cachedBaseHtml = await response.text();
  return cachedBaseHtml;
}

// Product pages stay fresh for 5 minutes and are served stale for up to a day while Vercel
// revalidates in the background, so crawlers almost never wait on Supabase. Fallback pages are
// not cached so a temporary failure doesn't stick.
function htmlResponse(html, { cacheable }) {
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
      "cdn-cache-control": cacheable ? "public, s-maxage=300, stale-while-revalidate=86400" : "no-store",
      "x-robots-tag": "index, follow",
    },
  });
}
