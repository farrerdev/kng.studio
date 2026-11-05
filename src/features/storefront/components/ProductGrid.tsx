import { useMemo, useState } from "react";
import { getProductCoverImage, getProductPrice, getProductTitle } from "../../catalog/catalogUtils";
import { preloadImage, SmoothImage } from "../../../shared/components/SmoothImage";
import { getSupabaseImageSrc, getSupabaseImageSrcSet } from "../../../shared/utils/image";
import { formatPrice } from "../../../shared/utils/money";
import type { Product, ProductType } from "../../../types/catalog";
import { IMAGE_WIDTHS } from "../storefrontConstants";
import { getProductHeroImage, PRODUCT_HERO_SIZES } from "./ProductDetail";
import { TypeFilterMenu } from "./TypeFilterMenu";

const MAX_SWATCHES = 4;
const PRIORITY_CARDS = 4;

type ProductGridProps = {
  allProducts: Product[];
  products: Product[];
  productTypes: ProductType[];
  onProductOpen: (product: Product) => void;
};

export function ProductGrid({ allProducts, products, productTypes, onProductOpen }: ProductGridProps) {
  const [activeTypeId, setActiveTypeId] = useState("");

  const typeFilters = useMemo(
    () =>
      productTypes
        .map((productType) => ({
          id: productType.id,
          name: productType.name || "Khác",
          count: products.filter((product) => product.productTypeId === productType.id).length,
        }))
        .filter((filter) => filter.count > 0),
    [productTypes, products],
  );

  const visibleProducts = activeTypeId
    ? products.filter((product) => product.productTypeId === activeTypeId)
    : products;

  const warmProduct = (product: Product) => {
    const hero = getProductHeroImage(product);
    if (hero) preloadImage(getSupabaseImageSrc(hero.src, IMAGE_WIDTHS.catalog, 80), getSupabaseImageSrcSet(hero.src, 80), PRODUCT_HERO_SIZES);
  };

  return (
    <section className="shop-catalog" id="products" aria-label="Sản phẩm">
      <div className="shop-catalog-head">
        <h2>Sản phẩm</h2>
        {typeFilters.length > 1 ? (
          <TypeFilterMenu
            options={[{ id: "", name: "Tất cả", count: products.length }, ...typeFilters]}
            value={activeTypeId}
            onChange={setActiveTypeId}
          />
        ) : (
          <span className="shop-catalog-count">{visibleProducts.length} mẫu</span>
        )}
      </div>

      {typeFilters.length > 1 ? (
        <div className="shop-filter-chips" role="group" aria-label="Lọc theo kiểu dáng">
          {[{ id: "", name: "Tất cả", count: products.length }, ...typeFilters].map((filter) => (
            <button
              type="button"
              key={filter.id || "all"}
              aria-pressed={activeTypeId === filter.id}
              className={activeTypeId === filter.id ? "active" : undefined}
              onClick={() => setActiveTypeId(filter.id)}
            >
              {filter.name}
              <span className="type-filter-count">{filter.count}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="shop-grid">
        {visibleProducts.map((product, index) => {
          const coverImage = getProductCoverImage(product, productTypes, allProducts);
          const productTitle = getProductTitle(product, productTypes);
          const extraSwatches = product.patterns.length - MAX_SWATCHES;
          return (
            <button
              className="shop-card"
              key={product.id}
              type="button"
              onClick={() => onProductOpen(product)}
              onPointerEnter={() => warmProduct(product)}
              onTouchStart={() => warmProduct(product)}
            >
              <span className="shop-card-media kng-media">
                <SmoothImage
                  src={getSupabaseImageSrc(coverImage.src, IMAGE_WIDTHS.catalog, 80)}
                  srcSet={getSupabaseImageSrcSet(coverImage.src, 80)}
                  sizes="(max-width: 760px) 50vw, (max-width: 1100px) 33vw, 300px"
                  alt={coverImage.alt}
                  priority={index < PRIORITY_CARDS}
                />
              </span>
              <span className="shop-card-body">
                <span className="shop-card-title">{productTitle}</span>
                <strong className="shop-card-price">{formatPrice(getProductPrice(product, productTypes))}</strong>
                {product.patterns.length > 0 ? (
                  <span className="shop-card-swatches" aria-label={`${product.patterns.length} họa tiết`}>
                    {product.patterns.slice(0, MAX_SWATCHES).map((pattern) => (
                      <img
                        key={pattern.id}
                        src={getSupabaseImageSrc(pattern.image.src, 96, 70)}
                        alt=""
                        loading="lazy"
                        decoding="async"
                      />
                    ))}
                    {extraSwatches > 0 ? <small>+{extraSwatches}</small> : null}
                  </span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function ProductGridSkeleton() {
  return (
    <section className="shop-catalog" aria-label="Đang tải sản phẩm" aria-busy="true">
      <div className="shop-catalog-head">
        <h2>Sản phẩm</h2>
      </div>
      <div className="shop-grid">
        {Array.from({ length: 8 }, (_, index) => (
          <span className="shop-card" key={index} aria-hidden="true">
            <span className="shop-card-media kng-media" />
            <span className="shop-card-body">
              <span className="shop-skeleton-line" />
              <span className="shop-skeleton-line short" />
            </span>
          </span>
        ))}
      </div>
    </section>
  );
}
