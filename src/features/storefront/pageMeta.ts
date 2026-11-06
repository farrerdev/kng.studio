import {
  getProductCoverImage,
  getProductPrice,
  getProductSlug,
  getProductTitle,
} from "../catalog/catalogUtils";
import { getSupabaseImageSrc } from "../../shared/utils/image";
import { formatPrice } from "../../shared/utils/money";
import type { Product, ProductType } from "../../types/catalog";

// Document title, description, Open Graph and canonical tags for the storefront page.

const SITE_URL = "https://kngstudio.shop";
const DEFAULT_PAGE_TITLE = "KNG.studio | Muslin homewear";
const DEFAULT_PAGE_DESCRIPTION = "Đồ ngủ muslin - ở nhà cũng xinh ✨. Xem mẫu còn hàng, bảng size, giá và đặt hàng ngay. KNG.studio - Đà Nẵng";
const DEFAULT_PAGE_IMAGE = `${SITE_URL}/favicon-192.png`;

function createProductPageMeta(product: Product, productTypes: ProductType[], products: Product[]) {
  const productTitle = getProductTitle(product, productTypes);
  const productPrice = formatPrice(getProductPrice(product, productTypes));
  const productSlug = getProductSlug(product, productTypes);
  const coverImage = getProductCoverImage(product, productTypes, products);

  return {
    title: `${productTitle} | KNG.studio`,
    description: `${productTitle} - ${productPrice}. Xem mẫu còn hàng, size và nhắn KNG.studio để chốt đơn.`,
    url: `${SITE_URL}/${productSlug}`,
    image: getAbsolutePreviewImageSrc(coverImage.src),
    imageAlt: coverImage.alt || productTitle,
    type: "product",
    twitterCard: "summary_large_image",
  };
}

function getAbsolutePreviewImageSrc(src: string) {
  try {
    return new URL(getSupabaseImageSrc(src || DEFAULT_PAGE_IMAGE, 1200, 82, 630, "contain"), window.location.origin).toString();
  } catch {
    return DEFAULT_PAGE_IMAGE;
  }
}

function updateMetaTag(attribute: "name" | "property", key: string, content: string) {
  const selector = `meta[${attribute}="${key}"]`;
  let metaTag = document.querySelector<HTMLMetaElement>(selector);
  if (!metaTag) {
    metaTag = document.createElement("meta");
    metaTag.setAttribute(attribute, key);
    document.head.appendChild(metaTag);
  }
  metaTag.content = content;
}

function updateCanonical(href: string) {
  let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonical.href = href;
}

export function applyStorefrontPageMeta(product: Product | null, productTypes: ProductType[], products: Product[]) {
  const pageMeta = product
    ? createProductPageMeta(product, productTypes, products)
    : {
        title: DEFAULT_PAGE_TITLE,
        description: DEFAULT_PAGE_DESCRIPTION,
        url: `${SITE_URL}/`,
        image: DEFAULT_PAGE_IMAGE,
        imageAlt: "KNG.studio",
        type: "website",
        twitterCard: "summary",
      };

  document.title = pageMeta.title;
  updateMetaTag("name", "description", pageMeta.description);
  updateMetaTag("property", "og:type", pageMeta.type);
  updateMetaTag("property", "og:title", pageMeta.title);
  updateMetaTag("property", "og:description", pageMeta.description);
  updateMetaTag("property", "og:url", pageMeta.url);
  updateMetaTag("property", "og:image", pageMeta.image);
  updateMetaTag("property", "og:image:alt", pageMeta.imageAlt);
  updateMetaTag("name", "twitter:card", pageMeta.twitterCard);
  updateMetaTag("name", "twitter:title", pageMeta.title);
  updateMetaTag("name", "twitter:description", pageMeta.description);
  updateMetaTag("name", "twitter:image", pageMeta.image);
  updateMetaTag("name", "twitter:image:alt", pageMeta.imageAlt);
  updateCanonical(pageMeta.url);
}
