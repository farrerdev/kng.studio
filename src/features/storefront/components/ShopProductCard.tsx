import { getProductCoverImage, getProductDiscount, getProductListPrice, getProductPrice, getProductTitle } from "../../catalog/catalogUtils";
import { preloadImage, SmoothImage } from "../../../shared/components/SmoothImage";
import { getSupabaseImageSrc, getSupabaseImageSrcSet } from "../../../shared/utils/image";
import { formatPrice } from "../../../shared/utils/money";
import { DiscountBadge, DiscountMark } from "./DiscountMark";
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
  // Cards only show patterns still in stock (any size); sold-out patterns stay on the product for cart checks.
  const inStockPatterns = product.patterns.filter((pattern) => pattern.availableSizes.length > 0);
  const coverImage = getProductCoverImage({ ...product, patterns: inStockPatterns }, productTypes, allProducts);
  const productTitle = getProductTitle(product, productTypes);
  const extraSwatches = inStockPatterns.length - MAX_SWATCHES;

  const price = formatPrice(getProductPrice(product, productTypes));
  const listPrice = getProductDiscount(product, productTypes) > 0 ? formatPrice(getProductListPrice(product, productTypes)) : null;
  const priceLabel = (
    <strong className="shop-card-price">
      {price}
      <DiscountMark price={price} listPrice={listPrice} label={false} />
    </strong>
  );

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
          <DiscountBadge price={price} listPrice={listPrice} />
          {rank ? (
            <span className="shop-card-top" aria-label={`Top ${rank}`}>
              #{rank}
            </span>
          ) : null}
          <span className="shop-card-caption">
            <span className="shop-card-title">{productTitle}</span>
            {priceLabel}
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
        <DiscountBadge price={price} listPrice={listPrice} />
        {rank ? (
          <span className="shop-card-rank" aria-label={`Top ${rank}`}>
            {rank}
          </span>
        ) : null}
      </span>
      <span className="shop-card-body">
        <span className="shop-card-title">{productTitle}</span>
        {priceLabel}
        {inStockPatterns.length > 0 ? (
          <span className="shop-card-swatches" aria-label={`${inStockPatterns.length} họa tiết`}>
            {inStockPatterns.slice(0, MAX_SWATCHES).map((pattern) => (
              <img key={pattern.id} src={getSupabaseImageSrc(pattern.image.src, 96, 70)} alt="" loading="lazy" decoding="async" />
            ))}
            {extraSwatches > 0 ? <small>+{extraSwatches}</small> : null}
          </span>
        ) : null}
      </span>
    </button>
  );
}
