import { ChevronLeft, Gift, Minus, Plus, Ruler, Truck } from "lucide-react";
import { useRef, useState } from "react";
import { sizeOptions } from "../../../data/mockCatalog";
import { trackStorefrontEvent } from "../../analytics/storefrontAnalytics";
import { getProductPrice, getProductTitle } from "../../catalog/catalogUtils";
import { createCartDraft, formatSelectedSize } from "../cart/cartUtils";
import type { CartDraft } from "../cart/cartTypes";
import { IMAGE_WIDTHS } from "../storefrontConstants";
import type { GalleryImage } from "../storefrontTypes";
import { getSupabaseImageSrc, getSupabaseImageSrcSet } from "../../../shared/utils/image";
import { formatPrice } from "../../../shared/utils/money";
import type { Product, ProductImage, ProductType, SizeId } from "../../../types/catalog";
import { PolicyAccordion } from "./PolicySections";
import { ShopeeProductLink } from "./ShopeeProductLink";
import { SmoothImage } from "../../../shared/components/SmoothImage";

export const PRODUCT_HERO_SIZES = "(max-width: 960px) 100vw, 640px";

// Model photos sell the fit; fall back to pattern photos when a product has none.
export function getProductHeroImage(product: Product): ProductImage | undefined {
  return product.modelImages[0] ?? product.patterns[0]?.image;
}

type ProductDetailProps = {
  product: Product;
  productTypes: ProductType[];
  selectedSize: SizeId;
  sizeChartImage: ProductImage;
  sizeChartCaption: string;
  onBack: () => void;
  onSizeChange: (sizeId: SizeId) => void;
  onImageOpen: (image: GalleryImage) => void;
  onAddToCart: (item: CartDraft) => void;
  onQuantityChange: (itemId: string, quantity: number) => void;
  getCartItemQuantity: (itemId: string) => number;
};

export function ProductDetail({
  product,
  productTypes,
  selectedSize,
  sizeChartImage,
  sizeChartCaption,
  onBack,
  onSizeChange,
  onImageOpen,
  onAddToCart,
  onQuantityChange,
  getCartItemQuantity,
}: ProductDetailProps) {
  const productTitle = getProductTitle(product, productTypes);
  const productPrice = formatPrice(getProductPrice(product, productTypes));
  const galleryTrackRef = useRef<HTMLDivElement | null>(null);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const galleryImages: GalleryImage[] =
    product.modelImages.length > 0
      ? product.modelImages.map((image, index) => ({ ...image, caption: `${productTitle} - ảnh mẫu ${index + 1}` }))
      : product.patterns.map((pattern) => ({ ...pattern.image, caption: `${productTitle} - ${pattern.name}` }));

  const patternsBySize = sizeOptions.map((size) => ({
    size,
    count: product.patterns.filter((pattern) => pattern.availableSizes.includes(size.id)).length,
  }));
  // Same as production: only patterns that still have the selected size are shown.
  const availablePatterns = product.patterns.filter((pattern) => pattern.availableSizes.includes(selectedSize));

  const syncGalleryIndex = () => {
    const track = galleryTrackRef.current;
    if (!track || track.clientWidth === 0) return;
    setGalleryIndex(Math.round(track.scrollLeft / track.clientWidth));
  };

  return (
    <section className="shop-product" aria-label={`Sản phẩm ${productTitle}`}>
      <div className="shop-product-topbar">
        <button className="shop-back" type="button" onClick={onBack}>
          <ChevronLeft size={18} aria-hidden="true" />
          Tất cả sản phẩm
        </button>
        <ShopeeProductLink url={product.shopeeUrl} />
      </div>

      <div className="shop-product-layout">
        <div className="shop-gallery">
          <div className="shop-gallery-track" ref={galleryTrackRef} onScroll={syncGalleryIndex}>
            {galleryImages.map((image, index) => (
              <button className="shop-gallery-item kng-media" key={`${image.id}-${index}`} type="button" onClick={() => onImageOpen(image)}>
                <SmoothImage
                  src={getSupabaseImageSrc(image.src, IMAGE_WIDTHS.catalog, 80)}
                  srcSet={getSupabaseImageSrcSet(image.src, 80)}
                  sizes={index === 0 ? PRODUCT_HERO_SIZES : "(max-width: 960px) 100vw, 320px"}
                  alt={image.alt}
                  priority={index === 0}
                />
              </button>
            ))}
          </div>
          {galleryImages.length > 1 ? (
            <span className="shop-gallery-counter" aria-hidden="true">
              {galleryIndex + 1}/{galleryImages.length}
            </span>
          ) : null}
        </div>

        <div className="shop-buybox">
          <header className="shop-buybox-head">
            <h2>{productTitle}</h2>
            <strong>{productPrice}</strong>
            {product.material.trim() || product.fit.trim() ? (
              <p>{[product.material.trim(), product.fit.trim()].filter(Boolean).join(" · ")}</p>
            ) : null}
          </header>


          <ul className="shop-perks">
            <li>
              <Truck size={16} aria-hidden="true" />
              Freeship từ 2 bộ
            </li>
            <li>
              <Gift size={16} aria-hidden="true" />
              Tặng scrunchies cùng họa tiết
            </li>
          </ul>

          <section className="shop-step" aria-label="Chọn size">
            <div className="shop-step-head">
              <h3>
                <span>1</span>Chọn size
              </h3>
              <button
                className="shop-size-chart-link"
                type="button"
                onClick={() => onImageOpen({ ...sizeChartImage, caption: sizeChartCaption })}
              >
                <Ruler size={15} aria-hidden="true" />
                Bảng size
              </button>
            </div>
            <div className="shop-size-options" role="radiogroup" aria-label="Chọn size">
              {patternsBySize.map(({ size, count }) => {
                const isSelected = size.id === selectedSize;
                return (
                  <button
                    key={size.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    className={[isSelected ? "active" : "", count === 0 ? "empty" : ""].join(" ").trim() || undefined}
                    onClick={() => onSizeChange(size.id)}
                  >
                    <strong>{size.label}</strong>
                    <span>{size.range}</span>
                    <small>{count > 0 ? `${count} mẫu còn hàng` : "Tạm hết"}</small>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="shop-step" aria-label="Chọn họa tiết">
            <div className="shop-step-head">
              <h3>
                <span>2</span>Chọn họa tiết
              </h3>
              <small>
                {availablePatterns.length} mẫu còn {formatSelectedSize(selectedSize).toLowerCase()}
              </small>
            </div>
            {availablePatterns.length === 0 ? (
              <p className="shop-patterns-empty">
                Size này tạm hết hàng. Bạn chọn size khác hoặc nhắn Instagram/Messenger để shop kiểm tra mẫu mới nhất.
              </p>
            ) : null}
            <div className="shop-patterns">
              {availablePatterns.map((pattern) => {
                const cartItem = createCartDraft(product, pattern, selectedSize, productTypes);
                const quantity = getCartItemQuantity(cartItem.id);
                return (
                  <article
                    className={quantity > 0 ? "shop-pattern in-cart" : "shop-pattern"}
                    key={pattern.id}
                  >
                    <div className="shop-pattern-media kng-media">
                      <button
                        className="shop-pattern-image"
                        type="button"
                        aria-label={`Xem ảnh lớn ${pattern.name}`}
                        onClick={() => {
                          void trackStorefrontEvent({
                            eventType: "pattern_view",
                            productId: product.id,
                            patternId: pattern.id,
                            sizeId: selectedSize,
                          });
                          onImageOpen({
                            ...pattern.image,
                            caption: `${productTitle} - ${pattern.name} · ${formatSelectedSize(selectedSize)}`,
                            cartItem,
                          });
                        }}
                      >
                        <SmoothImage
                          src={getSupabaseImageSrc(pattern.image.src, IMAGE_WIDTHS.catalog, 80)}
                          srcSet={getSupabaseImageSrcSet(pattern.image.src, 80)}
                          sizes="(max-width: 760px) 50vw, 200px"
                          alt={pattern.image.alt}
                        />
                      </button>
                      {quantity > 0 ? (
                        <div className="shop-stepper" aria-label={`Số lượng ${pattern.name} trong giỏ`}>
                          <button type="button" aria-label={`Bớt 1 ${pattern.name}`} onClick={() => onQuantityChange(cartItem.id, quantity - 1)}>
                            <Minus size={14} aria-hidden="true" />
                          </button>
                          <span>{quantity}</span>
                          <button type="button" aria-label={`Thêm 1 ${pattern.name}`} onClick={() => onAddToCart(cartItem)}>
                            <Plus size={14} aria-hidden="true" />
                          </button>
                        </div>
                      ) : (
                        <button
                          className="shop-add"
                          type="button"
                          aria-label={`Thêm ${pattern.name} ${formatSelectedSize(selectedSize)} vào giỏ`}
                          onClick={() => onAddToCart(cartItem)}
                        >
                          <Plus size={18} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                    <span className="shop-pattern-name">{pattern.name}</span>
                  </article>
                );
              })}
            </div>
          </section>

          <PolicyAccordion />
        </div>
      </div>
    </section>
  );
}
