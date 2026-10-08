const SITE_URL = "https://kngstudio.shop";

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const slug = requestUrl.searchParams.get("slug")?.trim() ?? "";
  const baseHtml = await fetchBaseHtml(requestUrl.origin);

  if (!slug || !/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    return htmlResponse(baseHtml);
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL ?? "";
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY ?? "";
  if (!supabaseUrl || !supabaseAnonKey) {
    return htmlResponse(baseHtml);
  }

  try {
    const catalog = await fetchCatalog(supabaseUrl, supabaseAnonKey);
    const product = catalog.products.find(
      (currentProduct) => getProductSlug(currentProduct, catalog.productTypes) === slug,
    );
    if (!product) return htmlResponse(baseHtml);

    const title = getProductTitle(product, catalog.productTypes);
    const price = getProductPrice(product, catalog.productTypes);
    const coverImage = product.patterns[0]?.image ?? {
      src: `${SITE_URL}/images/shop-info.webp`,
      alt: `Ảnh bìa ${title}`,
    };
    const productUrl = `${SITE_URL}/${slug}`;
    const imageUrl = getPreviewImageUrl(coverImage.src);
    const description = `${title} - ${price}. Xem mẫu còn hàng, size và nhắn KNG.studio để chốt đơn.`;
    const schema = {
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

    return htmlResponse(
      updateHtmlMeta(baseHtml, {
        title: `${title} | KNG.studio`,
        description,
        url: productUrl,
        image: imageUrl,
        imageAlt: coverImage.alt || title,
        schema,
      }),
    );
  } catch (error) {
    console.error("Dynamic product preview failed", error);
    return htmlResponse(baseHtml);
  }
}

async function fetchBaseHtml(origin) {
  const response = await fetch(`${origin}/`, {
    headers: {
      accept: "text/html",
      "user-agent": "KNG.studio product preview renderer",
    },
  });
  if (!response.ok) {
    throw new Error(`Failed to load storefront HTML: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

async function fetchCatalog(supabaseUrl, supabaseAnonKey) {
  const [productTypeRows, productRows, patternRows] = await Promise.all([
    fetchSupabaseRows(supabaseUrl, supabaseAnonKey, "product_types", "select=id,name,price&order=sort_order.asc"),
    fetchSupabaseRows(
      supabaseUrl,
      supabaseAnonKey,
      "products",
      "select=id,product_type_id,name,price&active=eq.true&order=sort_order.asc",
    ),
    fetchSupabaseRows(
      supabaseUrl,
      supabaseAnonKey,
      "product_patterns",
      "select=id,product_id,image_src,image_alt&order=sort_order.asc",
    ),
  ]);

  const productTypes = productTypeRows.length > 0 ? productTypeRows : deriveProductTypes(productRows);
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
        patterns: patternRows
          .filter((pattern) => pattern.product_id === product.id)
          .map((pattern) => ({
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
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${table}: ${response.status} ${response.statusText}`);
  }
  return response.json();
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

function getProductPrice(product, productTypes) {
  return productTypes.find((type) => type.id === product.productTypeId)?.price ?? product.price;
}

function getProductSlug(product, productTypes) {
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

function getPreviewImageUrl(src) {
  const imageUrl = new URL(src || "/images/shop-info.webp", SITE_URL);
  if (imageUrl.pathname.includes("/storage/v1/object/public/")) {
    imageUrl.pathname = imageUrl.pathname.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/");
    imageUrl.searchParams.set("width", "1200");
    imageUrl.searchParams.set("height", "630");
    imageUrl.searchParams.set("resize", "contain");
    imageUrl.searchParams.set("quality", "82");
  }
  return imageUrl.toString();
}

function getNumericPrice(price) {
  const numericPrice = Number(String(price).replace(/[^\d]/g, ""));
  return Number.isFinite(numericPrice) ? numericPrice : undefined;
}

function htmlResponse(html) {
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=0, must-revalidate",
      "cdn-cache-control": "public, s-maxage=30, stale-while-revalidate=60",
      "x-robots-tag": "index, follow",
    },
  });
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
