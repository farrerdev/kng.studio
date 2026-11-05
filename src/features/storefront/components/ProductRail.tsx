import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Product, ProductType } from "../../../types/catalog";
import { ShopProductCard } from "./ShopProductCard";

type ProductRailProps = {
  title: string;
  subtitle?: string;
  products: Product[];
  allProducts: Product[];
  productTypes: ProductType[];
  onProductOpen: (product: Product) => void;
  /** Number the cards 1, 2, 3… (ranked lists). */
  ranked?: boolean;
  cardVariant?: "default" | "overlay";
  /** Load the first cards eagerly when the rail is near the top of the page. */
  eager?: boolean;
  className?: string;
};

// Card widths match the grid columns (2 / 3 / 4 per row) so a rail lines up with the grid below it.
const RAIL_IMAGE_SIZES = "(max-width: 760px) 52vw, (max-width: 1100px) 33vw, 300px";

export function ProductRail({
  title,
  subtitle,
  products,
  allProducts,
  productTypes,
  onProductOpen,
  ranked = false,
  cardVariant = "default",
  eager = false,
  className,
}: ProductRailProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [edges, setEdges] = useState({ atStart: true, atEnd: false });

  const syncEdges = () => {
    const track = trackRef.current;
    if (!track) return;
    setEdges({
      atStart: track.scrollLeft <= 4,
      atEnd: track.scrollLeft + track.clientWidth >= track.scrollWidth - 4,
    });
  };

  useEffect(() => {
    syncEdges();
    window.addEventListener("resize", syncEdges);
    return () => window.removeEventListener("resize", syncEdges);
  }, [products.length]);

  if (products.length === 0) return null;

  const scrollByPage = (direction: -1 | 1) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: direction * track.clientWidth, behavior: "smooth" });
  };

  const isScrollable = !(edges.atStart && edges.atEnd);

  return (
    <section className={className ? `shop-rail ${className}` : "shop-rail"} aria-label={title}>
      <div className="shop-section-head">
        <div className="shop-section-title">
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {isScrollable ? (
          <div className="shop-rail-controls">
            <button type="button" aria-label="Xem sản phẩm trước" disabled={edges.atStart} onClick={() => scrollByPage(-1)}>
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <button type="button" aria-label="Xem sản phẩm sau" disabled={edges.atEnd} onClick={() => scrollByPage(1)}>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>
      <div className="shop-rail-track" ref={trackRef} onScroll={syncEdges}>
        {products.map((product, index) => (
          <ShopProductCard
            key={product.id}
            product={product}
            allProducts={allProducts}
            productTypes={productTypes}
            onOpen={onProductOpen}
            imageSizes={RAIL_IMAGE_SIZES}
            priority={eager && index < 2}
            rank={ranked ? index + 1 : undefined}
            variant={cardVariant}
          />
        ))}
      </div>
    </section>
  );
}
