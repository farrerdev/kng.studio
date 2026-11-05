import { getProductCoverImage, getProductPrice, getProductTitle } from "../../catalog/catalogUtils";
import { preloadImage, SmoothImage } from "../../../shared/components/SmoothImage";
import { getSupabaseImageSrc, getSupabaseImageSrcSet } from "../../../shared/utils/image";
import { formatPrice } from "../../../shared/utils/money";
import type { Product, ProductType } from "../../../types/catalog";
import { IMAGE_WIDTHS } from "../storefrontConstants";
import { getProductHeroImage, PRODUCT_HERO_SIZES } from "./ProductDetail";

const MAX_SWATCHES = 4;

type ShopProductCardProps = {
  product: Product;
  allProducts: Product[];
  productTypes: ProductType[];
  onOpen: (product: Product) => void;
  /** Responsive `sizes` for the cover image; grid and rails lay cards out differently. */
  imageSizes: string;
  priority?: boolean;
  /** 1-based position badge for ranked lists. */
  rank?: number;
  /** "overlay" puts name + price on the photo (featured rails); "default" is the grid card. */
  variant?: "default" | "overlay";
};

function warmProduct(product: Product) {
  const hero = getProductHeroImage(product);
  if (hero) {
    preloadImage(getSupabaseImageSrc(hero.src, IMAGE_WIDTHS.catalog, 80), getSupabaseImageSrcSet(hero.src, 80), PRODUCT_HERO_SIZES);
  }
}

// The one product card used everywhere on the storefront (grid, popular rail, suggestions).
export function ShopProductCard({
  product,
  allProducts,
  productTypes,
  onOpen,
  imageSizes,
  priority = false,
  rank,
  variant = "default",
}: ShopProductCardProps) {
  const coverImage = getProductCoverImage(product, productTypes, allProducts);
  const productTitle = getProductTitle(product, productTypes);
  const extraSwatches = product.patterns.length - MAX_SWATCHES;

  const price = formatPrice(getProductPrice(product, productTypes));

  if (variant === "overlay") {
    return (
      <button
        className="shop-card shop-card-overlay"
        type="button"
        onClick={() => onOpen(product)}
        onPointerEnter={() => warmProduct(product)}
        onTouchStart={() => warmProduct(product)}
      >
        <span className="shop-card-media kng-media">
          <SmoothImage
            src={getSupabaseImageSrc(coverImage.src, IMAGE_WIDTHS.catalog, 80)}
            srcSet={getSupabaseImageSrcSet(coverImage.src, 80)}
            sizes={imageSizes}
            alt={coverImage.alt}
            priority={priority}
          />
          {rank ? (
            <span className="shop-card-top" aria-label={`Top ${rank}`}>
              #{rank}
            </span>
          ) : null}
          <span className="shop-card-caption">
            <span className="shop-card-title">{productTitle}</span>
            <strong className="shop-card-price">{price}</strong>
          </span>
        </span>
      </button>
    );
  }

  return (
    <button
      className="shop-card"
      type="button"
      onClick={() => onOpen(product)}
      onPointerEnter={() => warmProduct(product)}
      onTouchStart={() => warmProduct(product)}
    >
      <span className="shop-card-media kng-media">
        <SmoothImage
          src={getSupabaseImageSrc(coverImage.src, IMAGE_WIDTHS.catalog, 80)}
          srcSet={getSupabaseImageSrcSet(coverImage.src, 80)}
          sizes={imageSizes}
          alt={coverImage.alt}
          priority={priority}
        />
        {rank ? (
          <span className="shop-card-rank" aria-label={`Top ${rank}`}>
            {rank}
          </span>
        ) : null}
      </span>
      <span className="shop-card-body">
        <span className="shop-card-title">{productTitle}</span>
        <strong className="shop-card-price">{price}</strong>
        {product.patterns.length > 0 ? (
          <span className="shop-card-swatches" aria-label={`${product.patterns.length} họa tiết`}>
            {product.patterns.slice(0, MAX_SWATCHES).map((pattern) => (
              <img key={pattern.id} src={getSupabaseImageSrc(pattern.image.src, 96, 70)} alt="" loading="lazy" decoding="async" />
            ))}
            {extraSwatches > 0 ? <small>+{extraSwatches}</small> : null}
          </span>
        ) : null}
      </span>
    </button>
  );
}
