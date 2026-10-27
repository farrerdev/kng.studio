// CDN-cached catalog for the storefront. Visitors get a copy from Vercel's edge in ~100ms instead of
// waiting on five Supabase reads; Supabase is only hit when the cache revalidates in the background.
// The row shape matches CatalogRows in src/features/catalog/catalogRows.ts.
const STORAGE_BUCKET = "catalog-images";
const SUPABASE_TIMEOUT_MS = 5000;

export async function GET() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY ?? "";
  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse({ error: "Supabase is not configured." }, { status: 503, cacheable: false });
  }

  try {
    const read = (table, query) => fetchSupabaseRows(supabaseUrl, supabaseAnonKey, table, query);
    const [productTypes, products, patterns, images, shopInfoRows] = await Promise.all([
      read("product_types", "select=*&order=sort_order.asc"),
      read("products", "select=*&active=eq.true&order=sort_order.asc"),
      read("product_patterns", "select=*&order=sort_order.asc"),
      read("product_images", "select=*&order=sort_order.asc"),
      read("shop_info", "select=*&id=eq.main"),
    ]);
    const storageModelImages =
      images.length === 0 ? await fetchStorageModelImages(supabaseUrl, supabaseAnonKey, products) : {};

    return jsonResponse(
      { productTypes, products, patterns, images, shopInfo: shopInfoRows[0] ?? null, storageModelImages },
      { status: 200, cacheable: true },
    );
  } catch (error) {
    console.error("Catalog API failed", error);
    return jsonResponse({ error: "Catalog unavailable." }, { status: 502, cacheable: false });
  }
}

async function fetchSupabaseRows(supabaseUrl, supabaseAnonKey, table, query) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: supabaseAnonKey,
      authorization: `Bearer ${supabaseAnonKey}`,
    },
    signal: AbortSignal.timeout(SUPABASE_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${table}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

// Legacy fallback mirrored from fetchStorageModelImages in src/features/catalog/catalogApi.ts.
async function fetchStorageModelImages(supabaseUrl, supabaseAnonKey, products) {
  const entries = await Promise.all(
    products.map(async (product) => {
      try {
        const response = await fetch(`${supabaseUrl}/storage/v1/object/list/${STORAGE_BUCKET}`, {
          method: "POST",
          headers: {
            apikey: supabaseAnonKey,
            authorization: `Bearer ${supabaseAnonKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            prefix: `models/${product.id}`,
            limit: 100,
            sortBy: { column: "created_at", order: "asc" },
          }),
          signal: AbortSignal.timeout(SUPABASE_TIMEOUT_MS),
        });
        if (!response.ok) return [product.id, []];
        const files = await response.json();
        const images = files
          .filter((file) => file.name && !file.name.startsWith("."))
          .map((file, index) => ({
            id: `storage-${product.id}-${file.id ?? file.name}`,
            src: `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKET}/models/${product.id}/${file.name}`,
            alt: `Ảnh mẫu & chi tiết sản phẩm ${index + 1}`,
          }));
        return [product.id, images];
      } catch {
        return [product.id, []];
      }
    }),
  );
  return Object.fromEntries(entries.filter(([, images]) => images.length > 0));
}

// Fresh for a minute, then served stale for up to a day while Vercel refetches in the background,
// so admin edits show up on the storefront within about a minute.
function jsonResponse(body, { status, cacheable }) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
      "cdn-cache-control": cacheable ? "public, s-maxage=60, stale-while-revalidate=86400" : "no-store",
    },
  });
}
