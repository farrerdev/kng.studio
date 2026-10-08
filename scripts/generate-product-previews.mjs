import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const SITE_URL = "https://kngstudio.shop";
const DIST_DIR = "dist";

loadLocalEnv();

const supabaseUrl = process.env.VITE_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY ?? "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.log("Dynamic product preview sitemap skipped: Supabase env is not configured.");
  process.exit(0);
}

const catalog = await fetchCatalog();
const productsWithPreview = catalog.products.filter((product) => product.patterns.length > 0);

writeFileSync(path.join(DIST_DIR, "sitemap.xml"), createSitemap(productsWithPreview, catalog.productTypes));

console.log(`Generated sitemap for ${productsWithPreview.length} dynamic product preview route(s).`);

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

function getProductTitle(product, productTypes) {
  const productType = productTypes.find((type) => type.id === product.productTypeId);
  const typeName = productType?.name.trim() || "Loại sản phẩm";
  const productName = product.name.trim();
  return productName ? `${typeName} - ${productName}` : typeName;
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
