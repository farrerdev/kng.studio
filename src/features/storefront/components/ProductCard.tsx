import { Plus } from "lucide-react";
import { sizeOptions } from "../../../data/mockCatalog";
import { trackStorefrontEvent } from "../../analytics/analyticsApi";
import { getProductPrice, getProductTitle } from "../../catalog/catalogUtils";
import { createCartItemId, formatSelectedSize } from "../cart/cartUtils";
import type { CartDraft } from "../cart/cartTypes";
import { IMAGE_WIDTHS } from "../storefrontConstants";
import type { GalleryImage } from "../storefrontTypes";
import { getSupabaseImageSrc } from "../../../shared/utils/image";
import { formatPrice } from "../../../shared/utils/money";
import type { Product, ProductImage, ProductType, SizeId } from "../../../types/catalog";

type ProductCardProps = {
  product: Product;
  productTypes: ProductType[];
  selectedSize: SizeId;
  onImageOpen: (image: GalleryImage) => void;
  onAddToCart: (item: CartDraft) => void;
  getCartItemQuantity: (itemId: string) => number;
  onOpenPolicy: () => void;
  onSizeChange?: (sizeId: SizeId) => void;
  sizeChartCaption?: string;
  sizeChartImage?: ProductImage;
  compact?: boolean;
};

export function ProductCard({
  product,
  productTypes,
  selectedSize,
  onImageOpen,
  onAddToCart,
  getCartItemQuantity,
  onOpenPolicy,
  onSizeChange,
  sizeChartCaption,
  sizeChartImage,
  compact = false,
}: ProductCardProps) {
  const productTitle = getProductTitle(product, productTypes);
  const productPrice = formatPrice(getProductPrice(product, productTypes));

  return (
    <article className="product-card">
      <div className="product-detail">
          <section className="product-overview" aria-label={`Thông tin ${productTitle}`}>
            {product.material.trim() ? <span className="product-material">{product.material}</span> : null}
            {product.fit.trim() ? <p>{product.fit}</p> : null}
            {!compact ? <strong>{formatPrice(getProductPrice(product, productTypes))}</strong> : null}
          </section>

          {compact && sizeChartImage ? (
            <section className="product-size-controls" aria-label={`Bảng size và chọn size ${productTitle}`}>
              <button
                className="size-chart-inline type-size-chart"
                type="button"
                onClick={() =>
                  onImageOpen({
                    ...sizeChartImage,
                    caption: sizeChartCaption ?? `${productTitle} - bảng size`,
                  })
                }
              >
                <div className="size-chart-inline-text">
                  <h4>Bảng size chi tiết</h4>
                  <span>Tap để xem lớn</span>
                </div>
                <img
                  loading="lazy"
                  decoding="async"
                  src={getSupabaseImageSrc(sizeChartImage.src, IMAGE_WIDTHS.sizeChartPreview, 82)}
                  alt={sizeChartImage.alt}
                />
              </button>
              <h3 className="size-selector-title">Chọn size để xem mẫu</h3>
              <div className="size-options" role="radiogroup" aria-label="Chọn size">
                {sizeOptions.map((size) => (
                  <button
                    className={selectedSize === size.id ? "size-option active" : "size-option"}
                    key={size.id}
                    type="button"
                    role="radio"
                    aria-checked={selectedSize === size.id}
                    onClick={() => onSizeChange?.(size.id)}
                  >
                    <span>{size.label}</span>
                    <strong>{size.range}</strong>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section aria-label={`Họa tiết còn hàng của ${productTitle}`}>
            <div className="section-title">
              <h4>Họa tiết còn size {selectedSize}</h4>
              <span>{product.patterns.length} mẫu</span>
            </div>
            {product.patterns.length > 0 ? (
              <div className="pattern-grid">
                {product.patterns.map((pattern) => {
                  const cartItem: CartDraft = {
                    id: createCartItemId(product.id, pattern.id, selectedSize),
                    productId: product.id,
                    patternId: pattern.id,
                    sizeId: selectedSize,
                    productName: productTitle,
                    patternName: pattern.name,
                    price: productPrice,
                    image: pattern.image,
                  };
                  const cartQuantity = getCartItemQuantity(cartItem.id);
                  return (
                    <article className={cartQuantity > 0 ? "image-tile in-cart" : "image-tile"} key={pattern.id}>
                      <button
                        className="image-tile-preview"
                        type="button"
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
                        <img
                          loading="lazy"
                          decoding="async"
                          src={getSupabaseImageSrc(pattern.image.src, IMAGE_WIDTHS.catalog, 80)}
                          sizes="(max-width: 760px) 50vw, 50vw"
                          alt={pattern.image.alt}
                        />
                        <span>{pattern.name}</span>
                      </button>
                      <button
                        className={cartQuantity > 0 ? "pattern-add-button active" : "pattern-add-button"}
                        type="button"
                        aria-label={`Thêm ${pattern.name} size ${selectedSize} vào giỏ`}
                        onClick={() => onAddToCart(cartItem)}
                      >
                        <Plus size={18} aria-hidden="true" />
                        {cartQuantity > 0 ? <span>{cartQuantity}</span> : null}
                      </button>
                      {cartQuantity > 0 ? <span className="pattern-cart-status">Đã thêm vào giỏ hàng</span> : null}
                    </article>
                  );
                })}
              </div>
            ) : (
              <section className="empty-state product-empty-state">
                <h3>Size này tạm hết hàng</h3>
                <p>Bạn có thể chọn size khác hoặc nhắn Instagram/Messenger để shop kiểm tra mẫu mới nhất.</p>
              </section>
            )}
          </section>

          {product.modelImages.length > 0 ? (
          <section aria-label={`Ảnh mẫu & chi tiết sản phẩm ${productTitle}`}>
            <div className="section-title">
              <h4>Ảnh mẫu &amp; chi tiết sản phẩm</h4>
              <span>Tap để xem lớn</span>
            </div>
            <div className="model-grid">
              {product.modelImages.map((image, index) => (
                <button
                  className="model-tile"
                  key={image.id}
                  type="button"
                  onClick={() =>
                    onImageOpen({
                      ...image,
                      caption: `${productTitle} - ảnh mẫu & chi tiết ${index + 1}`,
                    })
                  }
                >
                  <img
                    loading="lazy"
                    decoding="async"
                    src={getSupabaseImageSrc(image.src, IMAGE_WIDTHS.catalog, 80)}
                    sizes="(max-width: 760px) 33vw, 33vw"
                    alt={image.alt}
                  />
                </button>
              ))}
            </div>
          </section>
          ) : null}

          <section className="product-policy-cta" aria-label="Quy định mua hàng">
            <button className="product-policy-button" type="button" onClick={onOpenPolicy}>
              Xem quy định mua hàng
            </button>
          </section>

          {!compact ? (
            <section aria-label={`Bảng size ${productTitle}`}>
              <button
                className="size-chart-inline"
                type="button"
                onClick={() =>
                  onImageOpen({
                    ...product.sizeChartImage,
                    caption: `${productTitle} - bảng size`,
                  })
                }
              >
                <div className="size-chart-inline-text">
                  <h4>Bảng size chi tiết</h4>
                  <span>Tap để xem lớn</span>
                </div>
                <img
                  loading="lazy"
                  decoding="async"
                  src={getSupabaseImageSrc(product.sizeChartImage.src, IMAGE_WIDTHS.sizeChartPreview, 82)}
                  alt={product.sizeChartImage.alt}
                />
              </button>
            </section>
          ) : null}
      </div>
    </article>
  );
}
