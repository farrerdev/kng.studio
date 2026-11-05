import { useMemo, useState } from "react";
import type { Product, ProductType } from "../../../types/catalog";
import { ShopProductCard } from "./ShopProductCard";
import { TypeFilterMenu } from "./TypeFilterMenu";

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
        {visibleProducts.map((product, index) => (
          <ShopProductCard
            key={product.id}
            product={product}
            allProducts={allProducts}
            productTypes={productTypes}
            onOpen={onProductOpen}
            imageSizes="(max-width: 760px) 50vw, (max-width: 1100px) 33vw, 300px"
            priority={index < PRIORITY_CARDS}
          />
        ))}
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
