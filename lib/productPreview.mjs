// Link-preview tags (title, price, cover image) for product pages. Shared by the build, which bakes
// one static page per product, by the fallback function for products newer than the last build, and
// by the rebuild check that runs after an admin save.
import { createHash } from "node:crypto";

export const SITE_URL = "https://kngstudio.shop";

const PREVIEW_IMAGE_FOLDER = "previews";
const STORAGE_BUCKET = "catalog-images";
const SUPABASE_TIMEOUT_MS = 4000;
const PREVIEW_CHECK_TIMEOUT_MS = 1500;

/** Everything a product page's preview tags are made of. */
export async function buildProductPreviewMeta(supabaseUrl, product, productTypes) {
  const slug = getProductSlug(product, productTypes);
  const title = getProductTitle(product, productTypes);
  const price = getProductPrice(product, productTypes);
  const coverPattern = product.patterns[0];
  const image = await getPreviewImage(supabaseUrl, product, coverPattern);
  const productUrl = `${SITE_URL}/${slug}`;
  const description = `${title} - ${price}. Xem mẫu còn hàng, size và nhắn KNG.studio để chốt đơn.`;
  const schema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: title,
    image: image.url,
    description,
    brand: {
      "@type": "Brand",
      name: "KNG.studio",
    },
    offers: {
      "@type": "Offer",
      priceCurrency: "VND",
      price: getNumericPrice(price),
      availability: "https://schema.org/InStock",
      url: productUrl,
    },
  };

  return {
    title: `${title} | KNG.studio`,
    description,
    url: productUrl,
    image,
    imageAlt: coverPattern?.image.alt || title,
    schema,
  };
}

/** Preview tags of every active product, keyed by slug (the first product wins a shared slug). */
export async function buildPreviewEntries(supabaseUrl, catalog) {
  const entries = new Map();
  const metas = await Promise.all(
    catalog.products.map((product) => buildProductPreviewMeta(supabaseUrl, product, catalog.productTypes)),
  );
  catalog.products.forEach((product, index) => {
    const slug = getProductSlug(product, catalog.productTypes);
    if (!entries.has(slug)) entries.set(slug, metas[index]);
  });
  return Array.from(entries, ([slug, meta]) => ({ slug, meta })).sort((left, right) => left.slug.localeCompare(right.slug));
}

/** Changes exactly when some product's preview tags (or the set of product pages) change. */
export function getPreviewSignature(entries) {
  return createHash("sha256").update(JSON.stringify(entries)).digest("hex");
}

// One PostgREST request with embedded types and patterns instead of three separate table reads.
export async function fetchPreviewCatalog(supabaseUrl, supabaseAnonKey) {
  const productRows = await fetchSupabaseRows(
    supabaseUrl,
    supabaseAnonKey,
    "products",
    [
      // `*` rather than a column list so `discount` is optional until its migration is applied.
      "select=*,product_types(id,name,price),product_patterns(id,image_src,image_alt,sort_order)",
      "active=eq.true",
      "order=sort_order.asc",
      "product_patterns.order=sort_order.asc",
    ].join("&"),
  );

  const embeddedProductTypes = new Map();
  productRows.forEach((product) => {
    if (product.product_types) embeddedProductTypes.set(product.product_types.id, product.product_types);
  });
  const productTypes =
    embeddedProductTypes.size > 0 ? Array.from(embeddedProductTypes.values()) : deriveProductTypes(productRows);

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
        discount: Number(product.discount) || 0,
        patterns: (product.product_patterns ?? []).map((pattern) => ({
          id: pattern.id,
          image: {
            src: pattern.image_src,
            alt: pattern.image_alt,
          },
        })),
      };
    }),
  };
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

// Keep in sync with getProductPreviewImagePath in src/features/catalog/productPreviewImage.ts.
function getPreviewKeyPart(value) {
  return value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "cover";
}

function getProductPreviewImagePath(product, coverPattern) {
  if (!coverPattern?.image.src?.trim()) return null;
  const fileName = coverPattern.image.src.split("?")[0].split("/").pop()?.replace(/\.[^.]+$/, "") ?? "";
  return `${PREVIEW_IMAGE_FOLDER}/${getPreviewKeyPart(product.id)}/${getPreviewKeyPart(`${coverPattern.id}-${fileName}`)}.jpg`;
}

// Prefer the pre-rendered 1200x630 file the admin uploads; fall back to the raw cover so a missing
// file never leaves the card without an image.
async function getPreviewImage(supabaseUrl, product, coverPattern) {
  const previewPath = getProductPreviewImagePath(product, coverPattern);
  if (previewPath) {
    const previewUrl = `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKET}/${previewPath}`;
    try {
      const response = await fetch(previewUrl, {
        method: "HEAD",
        signal: AbortSignal.timeout(PREVIEW_CHECK_TIMEOUT_MS),
      });
      if (response.ok) return { url: previewUrl, width: 1200, height: 630 };
    } catch {
      // Fall through to the cover image.
    }
  }

  const coverUrl = new URL(coverPattern?.image.src || "/images/shop-info.webp", SITE_URL);
  if (coverUrl.pathname.includes("/storage/v1/object/public/")) {
    coverUrl.pathname = coverUrl.pathname.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
    coverUrl.searchParams.set("width", "1200");
    coverUrl.searchParams.set("height", "1200");
    coverUrl.searchParams.set("resize", "contain");
    coverUrl.searchParams.set("quality", "80");
  }
  return { url: coverUrl.toString() };
}

export function renderProductPreviewHtml(html, meta) {
  let nextHtml = html;
  nextHtml = replaceTag(nextHtml, /<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(meta.title)}</title>`);
  nextHtml = replaceMeta(nextHtml, "name", "description", meta.description);
  nextHtml = replaceLink(nextHtml, "canonical", meta.url);
  nextHtml = replaceMeta(nextHtml, "property", "og:type", "product");
  nextHtml = replaceMeta(nextHtml, "property", "og:title", meta.title);
  nextHtml = replaceMeta(nextHtml, "property", "og:description", meta.description);
  nextHtml = replaceMeta(nextHtml, "property", "og:url", meta.url);
  nextHtml = replaceMeta(nextHtml, "property", "og:image", meta.image.url);
  nextHtml = ensureMeta(nextHtml, "property", "og:image:alt", meta.imageAlt);
  if (meta.image.width && meta.image.height) {
    nextHtml = ensureMeta(nextHtml, "property", "og:image:width", String(meta.image.width));
    nextHtml = ensureMeta(nextHtml, "property", "og:image:height", String(meta.image.height));
  }
  nextHtml = replaceMeta(nextHtml, "name", "twitter:card", "summary_large_image");
  nextHtml = replaceMeta(nextHtml, "name", "twitter:title", meta.title);
  nextHtml = replaceMeta(nextHtml, "name", "twitter:description", meta.description);
  nextHtml = replaceMeta(nextHtml, "name", "twitter:image", meta.image.url);
  nextHtml = ensureMeta(nextHtml, "name", "twitter:image:alt", meta.imageAlt);
  return nextHtml.replace(
    /<script type="application\/ld\+json">[\s\S]*?<\/script>/,
    `<script type="application/ld+json">\n      ${escapeScriptJson(meta.schema)}\n    </script>`,
  );
}

function replaceMeta(html, attribute, key, content) {
  return replaceTag(
    html,
    new RegExp(`<meta\\s+[^>]*${attribute}="${escapeRegExp(key)}"[^>]*>`, "m"),
    `<meta ${attribute}="${key}" content="${escapeHtml(content)}" />`,
  );
}

function ensureMeta(html, attribute, key, content) {
  const tagPattern = new RegExp(`<meta\\s+[^>]*${attribute}="${escapeRegExp(key)}"[^>]*>`, "m");
  if (tagPattern.test(html)) return replaceMeta(html, attribute, key, content);
  return html.replace(
    /(<meta\s+[^>]*property="og:locale"[^>]*>)/m,
    `<meta ${attribute}="${key}" content="${escapeHtml(content)}" />\n    $1`,
  );
}

function replaceLink(html, rel, href) {
  return replaceTag(
    html,
    new RegExp(`<link\\s+[^>]*rel="${escapeRegExp(rel)}"[^>]*>`, "m"),
    `<link rel="${rel}" href="${escapeHtml(href)}" />`,
  );
}

function replaceTag(html, pattern, replacement) {
  if (!pattern.test(html)) {
    throw new Error(`Missing expected HTML tag while rendering product preview: ${pattern}`);
  }
  return html.replace(pattern, replacement);
}

function getProductTitle(product, productTypes) {
  const productType = productTypes.find((type) => type.id === product.productTypeId);
  const typeName = productType?.name?.trim() || "Loại sản phẩm";
  const productName = product.name.trim();
  return productName ? `${typeName} - ${productName}` : typeName;
}

// Mirrors getProductPrice in src/features/catalog/catalogUtils.ts: list price minus the product's own discount.
function getProductPrice(product, productTypes) {
  const listPrice = productTypes.find((type) => type.id === product.productTypeId)?.price ?? product.price;
  const listValue = getNumericPrice(listPrice) ?? 0;
  const discount = Math.min(Math.max(0, product.discount ?? 0), listValue);
  if (discount <= 0) return listPrice;
  return `${String(listValue - discount).replace(/\B(?=(\d{3})+(?!\d))/g, ".")}đ`;
}

export function getProductSlug(product, productTypes) {
  return slugify(getProductTitle(product, productTypes) || product.id);
}

function slugify(value) {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "san-pham";
}

function createProductTypeId(name, price) {
  const normalized = `${name}-${price}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `type-${normalized || "default"}`.slice(0, 64);
}

function splitLegacyTitle(name) {
  const [typeName, ...nameParts] = name.split(" - ");
  return {
    typeName: nameParts.length > 0 ? typeName.trim() || "Loại sản phẩm" : name.trim() || "Loại sản phẩm",
    productName: nameParts.length > 0 ? nameParts.join(" - ").trim() : name,
  };
}

function deriveProductTypes(products) {
  const productTypes = new Map();
  products.forEach((product) => {
    const legacyTitle = splitLegacyTitle(product.name);
    const id = createProductTypeId(legacyTitle.typeName, product.price);
    if (!productTypes.has(id)) {
      productTypes.set(id, { id, name: legacyTitle.typeName, price: product.price });
    }
  });
  return Array.from(productTypes.values());
}

function getNumericPrice(price) {
  const numericPrice = Number(String(price).replace(/[^\d]/g, ""));
  return Number.isFinite(numericPrice) ? numericPrice : undefined;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeScriptJson(value) {
  return JSON.stringify(value, null, 2).replace(/</g, "\\u003c");
}
