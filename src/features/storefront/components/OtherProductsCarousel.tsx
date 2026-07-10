import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef } from "react";
import {
  getProductCoverImage,
  getProductPrice,
  getProductTitle,
} from "../../catalog/catalogUtils";
import { getSupabaseImageSrc } from "../../../shared/utils/image";
import { formatPrice } from "../../../shared/utils/money";
import type { Product, ProductType } from "../../../types/catalog";
import { IMAGE_WIDTHS } from "../storefrontConstants";

type OtherProductsCarouselProps = {
  allProducts: Product[];
  currentProductId: string;
  products: Product[];
  productTypes: ProductType[];
  onProductOpen: (product: Product) => void;
};

export function OtherProductsCarousel({
  allProducts,
  currentProductId,
  products,
  productTypes,
  onProductOpen,
}: OtherProductsCarouselProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const otherProducts = products.filter((product) => product.id !== currentProductId);

  if (otherProducts.length === 0) return null;

  const scrollProducts = (direction: -1 | 1) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({
      left: direction * Math.max(180, track.clientWidth * 0.86),
      behavior: "smooth",
    });
  };

  return (
    <section className="other-products" aria-label="Các sản phẩm khác">
      <div className="other-products-header">
        <h2>Các sản phẩm khác</h2>
        <div className="other-products-controls" aria-label="Điều hướng sản phẩm khác">
          <button type="button" aria-label="Xem sản phẩm trước" onClick={() => scrollProducts(-1)}>
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button type="button" aria-label="Xem sản phẩm sau" onClick={() => scrollProducts(1)}>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="other-products-track" ref={trackRef}>
        {otherProducts.map((product) => {
          const coverImage = getProductCoverImage(product, productTypes, allProducts);
          const productTitle = getProductTitle(product, productTypes);
          return (
            <button
              className="storefront-product-card"
              key={product.id}
              type="button"
              onClick={() => onProductOpen(product)}
            >
              <img
                src={getSupabaseImageSrc(coverImage.src, IMAGE_WIDTHS.catalog, 80)}
                sizes="(max-width: 760px) 42vw, 180px"
                alt={coverImage.alt}
                loading="lazy"
                decoding="async"
              />
              <span className="storefront-product-info">
                <span>{productTitle}</span>
                <strong>{formatPrice(getProductPrice(product, productTypes))}</strong>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
