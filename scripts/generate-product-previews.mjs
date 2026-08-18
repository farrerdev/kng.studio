import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const SITE_URL = "https://kngstudio.vercel.app";
const DIST_DIR = "dist";
const INDEX_PATH = path.join(DIST_DIR, "index.html");
const STORAGE_BUCKET = "catalog-images";

loadLocalEnv();

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY ?? "";

if (!existsSync(INDEX_PATH)) {
  throw new Error("Missing dist/index.html. Run this script after vite build.");
}

const indexHtml = readFileSync(INDEX_PATH, "utf8");

if (!supabaseUrl || !supabaseAnonKey) {
  console.log("Product preview pages skipped: Supabase env is not configured.");
  process.exit(0);
}

const catalog = await fetchCatalog();
const productsWithPreview = catalog.products.filter((product) => product.patterns.length > 0);

productsWithPreview.forEach((product) => {
  const title = getProductTitle(product, catalog.productTypes);
  const price = getProductPrice(product, catalog.productTypes);
  const coverImage = getProductCoverImage(product, catalog.productTypes);
  const slug = getProductSlug(product, catalog.productTypes);
  const productUrl = `${SITE_URL}/${slug}`;
  const imageUrl = getPreviewImageUrl(coverImage.src);
  const description = `${title} - ${price}. Xem mẫu còn hàng, size và nhắn KNG.studio để chốt đơn.`;
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: title,
    image: imageUrl,
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

  const previewHtml = updateHtmlMeta(indexHtml, {
    title: `${title} | KNG.studio`,
    description,
    url: productUrl,
    image: imageUrl,
    imageAlt: coverImage.alt || title,
    schema: productSchema,
  });
  const outputDir = path.join(DIST_DIR, slug);
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(path.join(outputDir, "index.html"), previewHtml);
});

writeFileSync(path.join(DIST_DIR, "sitemap.xml"), createSitemap(productsWithPreview, catalog.productTypes));

console.log(`Generated ${productsWithPreview.length} product preview page(s).`);

async function fetchCatalog() {
  const [productTypeRows, productRows, patternRows] = await Promise.all([
    fetchSupabaseRows("product_types", "select=*&order=sort_order.asc"),
    fetchSupabaseRows("products", "select=*&active=eq.true&order=sort_order.asc"),
    fetchSupabaseRows("product_patterns", "select=*&order=sort_order.asc"),
  ]);

  const productTypes =
    productTypeRows.length > 0
      ? productTypeRows.map((productType) => mapProductTypeRow(productType, productRows))
      : deriveProductTypes(productRows);

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
        fit: product.fit,
        material: product.material,
        patterns: patternRows
          .filter((pattern) => pattern.product_id === product.id)
          .map((pattern) => ({
            id: pattern.id,
            name: pattern.name,
            image: {
              id: `${pattern.id}-image`,
              src: pattern.image_src,
              alt: pattern.image_alt,
            },
          })),
      };
    }),
  };
}

async function fetchSupabaseRows(table, query) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, {
    headers: {
      apikey: supabaseAnonKey,
      authorization: `Bearer ${supabaseAnonKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${table}: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

function loadLocalEnv() {
  [".env.local", ".env"].forEach((fileName) => {
    if (!existsSync(fileName)) return;

    readFileSync(fileName, "utf8")
      .split(/\r?\n/)
      .forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) return;
        const separatorIndex = trimmed.indexOf("=");
        if (separatorIndex === -1) return;
        const key = trimmed.slice(0, separatorIndex).trim();
        const rawValue = trimmed.slice(separatorIndex + 1).trim();
        if (process.env[key]) return;
        process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
      });
  });
}

function updateHtmlMeta(html, meta) {
  let nextHtml = html;
  nextHtml = replaceTag(nextHtml, /<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(meta.title)}</title>`);
  nextHtml = replaceMeta(nextHtml, "name", "description", meta.description);
  nextHtml = replaceLink(nextHtml, "canonical", meta.url);
  nextHtml = replaceMeta(nextHtml, "property", "og:type", "product");
  nextHtml = replaceMeta(nextHtml, "property", "og:title", meta.title);
  nextHtml = replaceMeta(nextHtml, "property", "og:description", meta.description);
  nextHtml = replaceMeta(nextHtml, "property", "og:url", meta.url);
  nextHtml = replaceMeta(nextHtml, "property", "og:image", meta.image);
  nextHtml = ensureMeta(nextHtml, "property", "og:image:alt", meta.imageAlt);
  nextHtml = ensureMeta(nextHtml, "property", "og:image:width", "1200");
  nextHtml = ensureMeta(nextHtml, "property", "og:image:height", "630");
  nextHtml = replaceMeta(nextHtml, "name", "twitter:card", "summary_large_image");
  nextHtml = replaceMeta(nextHtml, "name", "twitter:title", meta.title);
  nextHtml = replaceMeta(nextHtml, "name", "twitter:description", meta.description);
  nextHtml = replaceMeta(nextHtml, "name", "twitter:image", meta.image);
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
  const localePattern = /(<meta\s+[^>]*property="og:locale"[^>]*>)/m;
  if (localePattern.test(html)) {
    return html.replace(
      localePattern,
      `<meta ${attribute}="${key}" content="${escapeHtml(content)}" />\n    $1`,
    );
  }
  return html.replace(
    /(<meta\s+[^>]*property="og:image"[^>]*>)/m,
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
    throw new Error(`Missing expected HTML tag while generating product previews: ${pattern}`);
  }
  return html.replace(pattern, replacement);
}

function getProductTitle(product, productTypes) {
  const productType = productTypes.find((type) => type.id === product.productTypeId);
  const typeName = productType?.name.trim() || "Loại sản phẩm";
  const productName = product.name.trim();
  return productName ? `${typeName} - ${productName}` : typeName;
}

function getProductPrice(product, productTypes) {
  return productTypes.find((type) => type.id === product.productTypeId)?.price ?? product.price;
}

function getProductCoverImage(product, productTypes) {
  return (
    product.patterns[0]?.image ?? {
      id: `${product.id}-cover-fallback`,
      src: `${SITE_URL}/images/shop-info.webp`,
      alt: `Ảnh bìa ${getProductTitle(product, productTypes)}`,
    }
  );
}

function getPreviewImageUrl(src) {
  const imageUrl = new URL(src || "/favicon-192.png", SITE_URL);
  if (imageUrl.pathname.includes("/storage/v1/object/public/")) {
    imageUrl.pathname = imageUrl.pathname.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
    imageUrl.searchParams.set("width", "1200");
    imageUrl.searchParams.set("height", "630");
    imageUrl.searchParams.set("resize", "contain");
    imageUrl.searchParams.set("quality", "82");
  }
  return imageUrl.toString();
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

function getProductSlug(product, productTypes) {
  return slugify(getProductTitle(product, productTypes) || product.id);
}

function mapProductTypeRow(productType, products) {
  const firstProduct = products.find((product) => product.product_type_id === productType.id);
  return {
    id: productType.id,
    name: productType.name,
    price: productType.price,
    sizeChartImage: {
      id: `${productType.id}-size-chart`,
      src: productType.size_chart_image_src || firstProduct?.size_chart_image_src || "",
      alt: productType.size_chart_image_alt || firstProduct?.size_chart_image_alt || `Bảng size ${productType.name}`,
    },
  };
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
      productTypes.set(id, {
        id,
        name: legacyTitle.typeName,
        price: product.price,
      });
    }
  });
  return Array.from(productTypes.values());
}

function getNumericPrice(price) {
  const numericPrice = Number(String(price).replace(/[^\d]/g, ""));
  return Number.isFinite(numericPrice) ? numericPrice : undefined;
}

function createSitemap(products, productTypes) {
  const today = new Date().toISOString().slice(0, 10);
  const urls = [
    {
      loc: `${SITE_URL}/`,
      changefreq: "daily",
      priority: "1.0",
    },
    ...products.map((product) => ({
      loc: `${SITE_URL}/${getProductSlug(product, productTypes)}`,
      changefreq: "daily",
      priority: "0.9",
    })),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) => `  <url>
    <loc>${escapeXml(url.loc)}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`,
  )
  .join("\n")}
</urlset>
`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeXml(value) {
  return escapeHtml(value).replace(/'/g, "&apos;");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeScriptJson(value) {
  return JSON.stringify(value, null, 2).replace(/</g, "\\u003c");
}
