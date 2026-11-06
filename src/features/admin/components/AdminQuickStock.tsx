import { Check, Filter, PackageSearch, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { sizeOptions } from "../../../data/mockCatalog";
import { getProductTitle } from "../../catalog/catalogUtils";
import { getSupabaseImageSrc } from "../../../shared/utils/image";
import type { Product, ProductType, SizeId } from "../../../types/catalog";

type AdminQuickStockProps = {
  products: Product[];
  productTypes: ProductType[];
  savingProductIds: ReadonlySet<string>;
  statusMessage: string;
  disabled: boolean;
  onToggleSize: (product: Product, patternId: string, sizeId: SizeId) => void;
  onToggleActive: (product: Product) => void;
};

type StockFilter = "all" | "missing" | "size-1" | "size-2" | "sold-out" | "hidden";

const STOCK_FILTERS: Array<{ id: StockFilter; label: string }> = [
  { id: "all", label: "Tất cả" },
  { id: "missing", label: "Đang thiếu size" },
  { id: "size-1", label: "Hết Size 1" },
  { id: "size-2", label: "Hết Size 2" },
  { id: "sold-out", label: "Hết sạch" },
  { id: "hidden", label: "Đang ẩn" },
];

function isProductSoldOut(product: Product) {
  return product.patterns.every((pattern) => pattern.availableSizes.length === 0);
}

// Which patterns of a product a quick filter keeps (product-level filters keep every pattern).
function matchesStockFilter(filter: StockFilter, product: Product, pattern: Product["patterns"][number]) {
  switch (filter) {
    case "missing":
      return pattern.availableSizes.length < sizeOptions.length;
    case "size-1":
      return !pattern.availableSizes.includes("1");
    case "size-2":
      return !pattern.availableSizes.includes("2");
    case "sold-out":
      return isProductSoldOut(product);
    case "hidden":
      return product.active === false;
    default:
      return true;
  }
}

function normalize(text: string) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
}

// One screen to keep stock current after each sale: every pattern with its size switches, saved instantly.
export function AdminQuickStock({
  products,
  productTypes,
  savingProductIds,
  statusMessage,
  disabled,
  onToggleSize,
  onToggleActive,
}: AdminQuickStockProps) {
  const [query, setQuery] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [typeFilter, setTypeFilter] = useState("");
  // Two icon buttons, each with its own small menu: product type ("filter") and size status.
  const [openMenu, setOpenMenu] = useState<"type" | "status" | null>(null);
  const toolsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!openMenu) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!toolsRef.current?.contains(event.target as Node)) setOpenMenu(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openMenu]);

  // Counts per quick filter (patterns for size filters, products for sold-out / hidden), within the chosen type.
  const filterCounts = useMemo(() => {
    const scoped = products.filter((product) => !typeFilter || product.productTypeId === typeFilter);
    const counts = {} as Record<StockFilter, number>;
    STOCK_FILTERS.forEach(({ id }) => {
      counts[id] =
        id === "sold-out"
          ? scoped.filter(isProductSoldOut).length
          : id === "hidden"
            ? scoped.filter((product) => product.active === false).length
            : scoped.reduce((total, product) => total + product.patterns.filter((pattern) => matchesStockFilter(id, product, pattern)).length, 0);
    });
    return counts;
  }, [products, typeFilter]);

  const groups = useMemo(() => {
    const needle = normalize(query.trim());
    return productTypes
      .filter((productType) => !typeFilter || productType.id === typeFilter)
      .map((productType) => ({
        productType,
        products: products
          .filter((product) => product.productTypeId === productType.id)
          .map((product) => {
            const title = getProductTitle(product, productTypes);
            const titleMatches = !needle || normalize(title).includes(needle);
            const patterns = product.patterns.filter((pattern) => {
              if (!matchesStockFilter(stockFilter, product, pattern)) return false;
              return titleMatches || normalize(pattern.name).includes(needle);
            });
            return { product, title, patterns };
          })
          .filter((entry) => entry.patterns.length > 0),
      }))
      .filter((group) => group.products.length > 0);
  }, [productTypes, products, query, stockFilter, typeFilter]);

  return (
    <section className="admin-quick-stock" aria-label="Tồn kho nhanh">
      <div className="admin-quick-stock-tools" ref={toolsRef}>
        <label className="admin-search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={query}
            placeholder="Tìm sản phẩm hoặc hoạ tiết"
            aria-label="Tìm sản phẩm hoặc hoạ tiết"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="admin-filter">
          <button
            type="button"
            className={typeFilter ? "admin-icon-filter active" : "admin-icon-filter"}
            aria-haspopup="menu"
            aria-expanded={openMenu === "type"}
            aria-label={typeFilter ? "Lọc loại sản phẩm (đang lọc)" : "Lọc loại sản phẩm"}
            title="Loại sản phẩm"
            onClick={() => setOpenMenu((menu) => (menu === "type" ? null : "type"))}
          >
            <Filter size={17} aria-hidden="true" />
          </button>
          {openMenu === "type" ? (
            <div className="admin-filter-panel" role="menu" aria-label="Loại sản phẩm">
              <p className="admin-filter-title">Loại sản phẩm</p>
              {[{ id: "", name: "Tất cả loại" }, ...productTypes.map((type) => ({ id: type.id, name: type.name || "Loại sản phẩm" }))].map((option) => (
                <button
                  key={option.id || "all"}
                  type="button"
                  role="menuitemradio"
                  aria-checked={typeFilter === option.id}
                  className={typeFilter === option.id ? "selected" : undefined}
                  onClick={() => {
                    setTypeFilter(option.id);
                    setOpenMenu(null);
                  }}
                >
                  <span className="admin-filter-check">{typeFilter === option.id ? <Check size={14} strokeWidth={2.5} /> : null}</span>
                  <span>{option.name}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <div className="admin-filter">
          <button
            type="button"
            className={stockFilter !== "all" ? "admin-icon-filter active" : "admin-icon-filter"}
            aria-haspopup="menu"
            aria-expanded={openMenu === "status"}
            aria-label={stockFilter !== "all" ? "Lọc tình trạng size (đang lọc)" : "Lọc tình trạng size"}
            title="Tình trạng size"
            onClick={() => setOpenMenu((menu) => (menu === "status" ? null : "status"))}
          >
            <PackageSearch size={17} aria-hidden="true" />
          </button>
          {openMenu === "status" ? (
            <div className="admin-filter-panel" role="menu" aria-label="Tình trạng size">
              <p className="admin-filter-title">Tình trạng size</p>
              {STOCK_FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={stockFilter === filter.id}
                  className={stockFilter === filter.id ? "selected" : undefined}
                  onClick={() => {
                    setStockFilter(filter.id);
                    setOpenMenu(null);
                  }}
                >
                  <span className="admin-filter-check">{stockFilter === filter.id ? <Check size={14} strokeWidth={2.5} /> : null}</span>
                  <span>{filter.label}</span>
                  <small>{filterCounts[filter.id]}</small>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <p className="admin-quick-stock-hint" aria-live="polite">
        {statusMessage && statusMessage.includes("·") ? `Đã lưu: ${statusMessage}` : "Bấm size để bật/tắt còn hàng. Thay đổi được lưu ngay."}
      </p>

      {groups.length === 0 ? <p className="admin-ranking-empty">Không có mẫu nào khớp.</p> : null}

      {groups.map(({ productType, products: entries }) => (
        <div className="admin-quick-stock-group" key={productType.id}>
          <h3>{productType.name || "Loại sản phẩm"}</h3>
          {entries.map(({ product, title, patterns }) => {
            const isSaving = savingProductIds.has(product.id);
            const isHidden = product.active === false;
            return (
              <article className={isHidden ? "admin-quick-stock-product hidden" : "admin-quick-stock-product"} key={product.id}>
                <header>
                  <strong>{title}</strong>
                  {isSaving ? <span className="admin-saving-dot">Đang lưu…</span> : null}
                  <button
                    type="button"
                    role="switch"
                    aria-checked={!isHidden}
                    aria-label={`Hiển thị ${title} trên cửa hàng`}
                    className={isHidden ? "admin-switch small" : "admin-switch small on"}
                    disabled={disabled || isSaving}
                    onClick={() => onToggleActive(product)}
                  >
                    <span />
                  </button>
                </header>
                <ul>
                  {patterns.map((pattern) => (
                    <li key={pattern.id}>
                      {pattern.image.src ? (
                        <img src={getSupabaseImageSrc(pattern.image.src, 96, 70)} alt="" loading="lazy" decoding="async" />
                      ) : (
                        <span className="admin-quick-stock-thumb" aria-hidden="true" />
                      )}
                      <span className="admin-quick-stock-name">{pattern.name || "Hoạ tiết"}</span>
                      <span className="admin-quick-stock-sizes">
                        {sizeOptions.map((size) => {
                          const isOn = pattern.availableSizes.includes(size.id);
                          return (
                            <button
                              key={size.id}
                              type="button"
                              aria-pressed={isOn}
                              aria-label={`${pattern.name} ${size.label}: ${isOn ? "còn hàng" : "hết hàng"}`}
                              className={isOn ? "on" : undefined}
                              disabled={disabled || isSaving}
                              onClick={() => onToggleSize(product, pattern.id, size.id)}
                            >
                              {size.label.replace("Size ", "S")}
                            </button>
                          );
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      ))}
    </section>
  );
}
