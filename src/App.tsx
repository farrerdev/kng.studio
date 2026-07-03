import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  Menu,
  Image,
  Instagram,
  PackageCheck,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { type Dispatch, type SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import { shopConfig } from "./config/shop";
import { sizeOptions } from "./data/mockCatalog";
import { supabase } from "./lib/supabase";
import {
  fallbackCatalog,
  fetchCatalog,
  isSupabaseConfigured,
  saveCatalog,
  uploadCatalogImage,
} from "./services/catalogApi";
import type { Product, ProductImage, ProductPattern, ProductType, SizeId } from "./types/catalog";

function formatPrice(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return raw;
  const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return formatted + "đ";
}

function getProductType(product: Product, productTypes: ProductType[]) {
  return productTypes.find((productType) => productType.id === product.productTypeId) ?? null;
}

function getProductTitle(product: Product, productTypes: ProductType[]) {
  const productType = getProductType(product, productTypes);
  const typeName = productType?.name.trim() || "Loại sản phẩm";
  const productName = product.name.trim();
  return productName ? `${typeName} - ${productName}` : typeName;
}

function getProductDisplayName(product: Product) {
  return product.name.trim() || "Mẫu";
}

function getProductPrice(product: Product, productTypes: ProductType[]) {
  return getProductType(product, productTypes)?.price ?? product.price;
}

function getProductTypeCoverImage(productType: ProductType, products: Product[]): ProductImage {
  if (productType.coverImage.src.trim()) {
    return productType.coverImage;
  }

  const firstPatternImage = products.find((product) => product.productTypeId === productType.id)?.patterns[0]?.image;
  return (
    firstPatternImage ?? {
      id: `${productType.id}-cover-fallback`,
      src: "/images/shop-info.webp",
      alt: `Ảnh bìa ${productType.name || "loại sản phẩm"}`,
    }
  );
}

function getProductCoverImage(product: Product, productTypes: ProductType[], products: Product[]): ProductImage {
  const firstPatternImage = product.patterns[0]?.image;
  if (firstPatternImage) return firstPatternImage;

  const productType = getProductType(product, productTypes);
  if (productType) return getProductTypeCoverImage(productType, products);

  return {
    id: `${product.id}-cover-fallback`,
    src: "/images/shop-info.webp",
    alt: `Ảnh bìa ${product.name || "sản phẩm"}`,
  };
}

function getProductTypeSizeChartImage(productType: ProductType, products: Product[]): ProductImage {
  if (productType.sizeChartImage.src.trim()) {
    return productType.sizeChartImage;
  }

  const firstSizeChart = products.find((product) => product.productTypeId === productType.id)?.sizeChartImage;
  return (
    firstSizeChart ?? {
      id: `${productType.id}-size-chart-fallback`,
      src: "/images/size-chart-moc.webp",
      alt: `Bảng size ${productType.name || "loại sản phẩm"}`,
    }
  );
}

function slugify(value: string) {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "san-pham";
}

function getProductTypeSlug(productType: ProductType) {
  return slugify(productType.name || productType.id);
}

function getProductSlug(product: Product, productTypes: ProductType[]) {
  return slugify(getProductTitle(product, productTypes) || product.id);
}

function getStorefrontSlugFromPath() {
  if (typeof window === "undefined") return null;
  const path = decodeURIComponent(window.location.pathname).replace(/^\/+|\/+$/g, "");
  if (!path || path === "admin" || path.startsWith("admin/")) return null;
  return path.split("/")[0] || null;
}

function getAdminProductTypeSlugFromPath() {
  if (typeof window === "undefined") return null;
  const path = decodeURIComponent(window.location.pathname).replace(/^\/+|\/+$/g, "");
  if (path === "admin" || !path.startsWith("admin/")) return null;
  return path.split("/")[1] || null;
}

function moveItem<T>(items: T[], fromIndex: number, direction: -1 | 1) {
  const toIndex = fromIndex + direction;
  if (toIndex < 0 || toIndex >= items.length) return items;

  const nextItems = [...items];
  const [item] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, item);
  return nextItems;
}

type GalleryImage = ProductImage & {
  caption: string;
};

type AdminImageActionFieldProps = {
  image: ProductImage;
  caption: string;
  ariaLabel: string;
  className?: string;
  onPreview: (image: GalleryImage) => void;
  onFileSelected: (file: File) => void;
};

function AdminImageActionField({
  image,
  caption,
  ariaLabel,
  className,
  onPreview,
  onFileSelected,
}: AdminImageActionFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasImage = image.src.trim().length > 0;

  const rootClassName = className ? `pattern-thumb-field ${className}` : "pattern-thumb-field";

  return (
    <div className={hasImage ? rootClassName : `${rootClassName} empty`}>
      <button
        className="thumb-image-button"
        type="button"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        onClick={() => {
          if (!hasImage) {
            inputRef.current?.click();
            return;
          }
          setIsOpen((current) => !current);
        }}
      >
        {hasImage ? (
          <img src={image.src} alt={image.alt} />
        ) : (
          <span className="thumb-empty-state">
            <Plus size={16} aria-hidden="true" />
          </span>
        )}
      </button>
      {hasImage && isOpen ? (
        <div className="thumb-action-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              onPreview({ ...image, caption });
            }}
          >
            Xem ảnh
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              inputRef.current?.click();
            }}
          >
            Upload ảnh mới
          </button>
        </div>
      ) : null}
      <input
        ref={inputRef}
        className="thumb-file-input"
        type="file"
        accept="image/*"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          onFileSelected(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}

type LoadingPanelProps = {
  variant?: "client" | "admin";
};

function LoadingPanel({ variant = "client" }: LoadingPanelProps) {
  return (
    <section className={`loading-panel ${variant}`} aria-label="Đang tải" aria-live="polite" aria-busy="true">
      <span className="loading-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    </section>
  );
}

function MessengerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 2C6.48 2 2 6.15 2 11.25c0 2.9 1.45 5.49 3.72 7.18V22l3.39-1.86c.92.25 1.89.39 2.89.39 5.52 0 10-4.15 10-9.28S17.52 2 12 2Zm1.03 12.53-2.55-2.7-4.96 2.7 5.43-5.76 2.59 2.7 4.93-2.7-5.44 5.76Z"
      />
    </svg>
  );
}

function getVisibleProducts(selectedSize: SizeId, catalogProducts: Product[]) {
  return catalogProducts
    .map((product) => ({
      ...product,
      patterns: product.patterns.filter((pattern) => pattern.availableSizes.includes(selectedSize)),
    }))
    .filter((product) => product.patterns.length > 0);
}

function getProductGalleryImages(product: Product, productTypes: ProductType[]): GalleryImage[] {
  const productTitle = getProductTitle(product, productTypes);
  return [
    ...product.patterns.map((pattern) => ({
      ...pattern.image,
      caption: `${productTitle} - ${pattern.name}`,
    })),
    ...product.modelImages.map((image, index) => ({
      ...image,
      caption: `${productTitle} - ảnh mẫu ${index + 1}`,
    })),
  ];
}

function App() {
  const [catalogProductTypes, setCatalogProductTypes] = useState<ProductType[]>(
    isSupabaseConfigured ? [] : fallbackCatalog.productTypes,
  );
  const [catalogProducts, setCatalogProducts] = useState<Product[]>(
    isSupabaseConfigured ? [] : fallbackCatalog.products,
  );
  const [currentShopInfoImage, setCurrentShopInfoImage] = useState<ProductImage | null>(
    isSupabaseConfigured ? null : fallbackCatalog.shopInfoImage,
  );
  const [catalogStatus, setCatalogStatus] = useState("Đang tải catalog...");
  const [catalogLoadState, setCatalogLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [selectedSize, setSelectedSize] = useState<SizeId>("1");
  const [activeImage, setActiveImage] = useState<GalleryImage | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedProductSlug, setSelectedProductSlug] = useState<string | null>(() => getStorefrontSlugFromPath());
  const isAdminRoute = typeof window !== "undefined" && window.location.pathname.startsWith("/admin");

  const storefrontProducts = useMemo(() => {
    const typeOrder = new Map(catalogProductTypes.map((productType, index) => [productType.id, index]));
    return catalogProducts
      .map((product, index) => ({ product, index }))
      .filter(({ product }) => product.patterns.length > 0)
      .sort((left, right) => {
        const leftTypeOrder = typeOrder.get(left.product.productTypeId) ?? Number.MAX_SAFE_INTEGER;
        const rightTypeOrder = typeOrder.get(right.product.productTypeId) ?? Number.MAX_SAFE_INTEGER;
        return leftTypeOrder === rightTypeOrder ? left.index - right.index : leftTypeOrder - rightTypeOrder;
      })
      .map(({ product }) => product);
  }, [catalogProductTypes, catalogProducts]);
  const productTypeGroups = useMemo(
    () =>
      catalogProductTypes
        .map((productType) => ({
          productType,
          products: storefrontProducts.filter((product) => product.productTypeId === productType.id),
        }))
        .filter((group) => group.products.length > 0),
    [catalogProductTypes, storefrontProducts],
  );
  const selectedProduct = useMemo(
    () =>
      selectedProductSlug
        ? storefrontProducts.find((product) => getProductSlug(product, catalogProductTypes) === selectedProductSlug) ?? null
        : null,
    [catalogProductTypes, selectedProductSlug, storefrontProducts],
  );
  const selectedProductType = useMemo(
    () => (selectedProduct ? getProductType(selectedProduct, catalogProductTypes) : null),
    [catalogProductTypes, selectedProduct],
  );
  const visibleProduct = useMemo(
    () => (selectedProduct ? getVisibleProducts(selectedSize, [selectedProduct])[0] ?? null : null),
    [selectedProduct, selectedSize],
  );
  const galleryImages = useMemo(() => {
    const shopImages: GalleryImage[] = currentShopInfoImage && !selectedProduct
      ? [
          {
            ...currentShopInfoImage,
            caption: "Bảng giá chung & quy định đặt hàng",
          },
        ]
      : [];
    const typeSizeChart = selectedProductType
      ? [
          {
            ...getProductTypeSizeChartImage(selectedProductType, catalogProducts),
            caption: `${selectedProductType.name || "Loại sản phẩm"} - bảng size`,
          },
        ]
      : [];
    return [...shopImages, ...typeSizeChart, ...(visibleProduct ? getProductGalleryImages(visibleProduct, catalogProductTypes) : [])];
  }, [catalogProductTypes, catalogProducts, currentShopInfoImage, selectedProduct, selectedProductType, visibleProduct]);
  const activeImageIndex = useMemo(() => {
    if (!activeImage) return -1;
    return galleryImages.findIndex(
      (image) =>
        (image.id === activeImage.id && image.src === activeImage.src) ||
        (image.src === activeImage.src && image.caption === activeImage.caption),
    );
  }, [activeImage, galleryImages]);
  const canNavigateLightbox = galleryImages.length > 1 && activeImageIndex >= 0;
  const openGalleryImage = (offset: -1 | 1) => {
    if (!canNavigateLightbox) return;
    const nextIndex = (activeImageIndex + offset + galleryImages.length) % galleryImages.length;
    setActiveImage(galleryImages[nextIndex]);
  };
  const openProduct = (product: Product) => {
    const hasSelectedSize = product.patterns.some((pattern) => pattern.availableSizes.includes(selectedSize));
    if (!hasSelectedSize) {
      const nextSize = product.patterns.flatMap((pattern) => pattern.availableSizes)[0];
      if (nextSize) setSelectedSize(nextSize);
    }

    const slug = getProductSlug(product, catalogProductTypes);
    setSelectedProductSlug(slug);
    window.history.pushState(null, "", `/${slug}`);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const closeProduct = () => {
    setSelectedProductSlug(null);
    window.history.pushState(null, "", "/");
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const goHomeSection = (sectionId?: string) => {
    setIsSidebarOpen(false);
    if (selectedProduct) {
      setSelectedProductSlug(null);
      window.history.pushState(null, "", "/");
      window.requestAnimationFrame(() => {
        if (sectionId) {
          document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      return;
    }
    if (sectionId) {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    document.title = isAdminRoute ? "KNG.studio Admin" : "KNG.studio | Muslin homewear";
  }, [isAdminRoute]);

  useEffect(() => {
    const syncProductTypeFromRoute = () => {
      setSelectedProductSlug(getStorefrontSlugFromPath());
    };

    window.addEventListener("popstate", syncProductTypeFromRoute);
    return () => window.removeEventListener("popstate", syncProductTypeFromRoute);
  }, []);

  useEffect(() => {
    if (!selectedProduct) return;
    if (selectedProduct.patterns.some((pattern) => pattern.availableSizes.includes(selectedSize))) return;
    const nextSize = selectedProduct.patterns.flatMap((pattern) => pattern.availableSizes)[0];
    if (nextSize) setSelectedSize(nextSize);
  }, [selectedProduct, selectedSize]);

  useEffect(() => {
    if (!activeImage) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveImage(null);
      }
      if (event.key === "ArrowLeft") {
        openGalleryImage(-1);
      }
      if (event.key === "ArrowRight") {
        openGalleryImage(1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeImage, activeImageIndex, canNavigateLightbox, galleryImages]);

  useEffect(() => {
    let isMounted = true;
    fetchCatalog()
      .then((catalog) => {
        if (!isMounted) return;
        setCatalogProductTypes(isSupabaseConfigured ? catalog.productTypes : fallbackCatalog.productTypes);
        setCatalogProducts(isSupabaseConfigured ? catalog.products : fallbackCatalog.products);
        setCurrentShopInfoImage(isSupabaseConfigured ? catalog.shopInfoImage : fallbackCatalog.shopInfoImage);
        setCatalogStatus(isSupabaseConfigured ? "Đã tải dữ liệu thật." : "Đang dùng mock data.");
        setCatalogLoadState("ready");
      })
      .catch(() => {
        if (!isMounted) return;
        setCatalogProductTypes(isSupabaseConfigured ? [] : fallbackCatalog.productTypes);
        setCatalogProducts(isSupabaseConfigured ? [] : fallbackCatalog.products);
        setCurrentShopInfoImage(isSupabaseConfigured ? null : fallbackCatalog.shopInfoImage);
        setCatalogStatus(isSupabaseConfigured ? "Không tải được dữ liệu Supabase." : "Đang dùng mock data.");
        setCatalogLoadState(isSupabaseConfigured ? "error" : "ready");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const emptyShopInfoImage: ProductImage = {
    id: "shop-info-empty",
    src: "",
    alt: "Bảng giá & Quy định chung",
  };

  if (isAdminRoute) {
    return (
      <AdminPage
        catalogStatus={catalogStatus}
        isCatalogLoading={catalogLoadState === "loading"}
        productTypes={catalogProductTypes}
        products={catalogProducts}
        shopInfoImage={currentShopInfoImage ?? emptyShopInfoImage}
        onProductTypesChange={setCatalogProductTypes}
        onProductsChange={setCatalogProducts}
        onRefresh={async () => {
          const catalog = await fetchCatalog();
          setCatalogProductTypes(isSupabaseConfigured ? catalog.productTypes : fallbackCatalog.productTypes);
          setCatalogProducts(isSupabaseConfigured ? catalog.products : fallbackCatalog.products);
          setCurrentShopInfoImage(isSupabaseConfigured ? catalog.shopInfoImage : fallbackCatalog.shopInfoImage);
        }}
        onShopInfoImageChange={(updater) =>
          setCurrentShopInfoImage((currentImage) =>
            typeof updater === "function" ? updater(currentImage ?? emptyShopInfoImage) : updater,
          )
        }
      />
    );
  }

  return (
    <>
      <main className="page-shell storefront">
        <header className="site-header">
          <button
            className="site-menu-button"
            type="button"
            aria-label="Mở menu"
            aria-expanded={isSidebarOpen}
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu size={20} aria-hidden="true" />
          </button>
          <h1>{shopConfig.brand}</h1>
        </header>

        <section className="shipping-promo" aria-label="Ưu đãi vận chuyển">
          <span>Miễn phí vận chuyển đơn từ 2 bộ</span>
        </section>

        {catalogLoadState === "loading" ? <LoadingPanel /> : null}

        {catalogLoadState !== "loading" && !selectedProduct ? (
          <>
            <section className="product-type-showcase" id="products" aria-label="Sản phẩm">
              <div className="section-title">
                <h2>Sản phẩm</h2>
                <span>{storefrontProducts.length} mẫu</span>
              </div>
              <div className="storefront-product-grid">
                {storefrontProducts.map((product) => {
                  const coverImage = getProductCoverImage(product, catalogProductTypes, catalogProducts);
                  const productTitle = getProductTitle(product, catalogProductTypes);
                  return (
                    <button
                      className="storefront-product-card"
                      key={product.id}
                      type="button"
                      onClick={() => openProduct(product)}
                    >
                      <img src={coverImage.src} alt={coverImage.alt} loading="lazy" />
                      <span className="storefront-product-info">
                        <span>{productTitle}</span>
                        <strong>{formatPrice(getProductPrice(product, catalogProductTypes))}</strong>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="storefront-policy" id="policy" aria-label="Quy định đặt hàng">
              <article id="gift">
                <h3>Quà tặng</h3>
                <p>Shop tặng dây buộc tóc scrunchies cùng họa tiết cho mỗi set.</p>
              </article>
              <article id="shipping">
                <h3>Phí ship</h3>
                <p>Phí ship 20k. Freeship cho đơn từ 2 bộ.</p>
              </article>
              <article id="payment">
                <h3>Thanh toán</h3>
                <p>Thanh toán trước.</p>
              </article>
              <article id="returns">
                <h3>Đổi trả</h3>
                <p>Shop hỗ trợ trả hàng trong trường hợp sai sản phẩm hoặc sản phẩm lỗi.</p>
              </article>
            </section>
          </>
        ) : null}

        {catalogLoadState !== "loading" && selectedProduct && selectedProductType ? (
        <section className="product-type-screen" aria-label={`Sản phẩm ${getProductTitle(selectedProduct, catalogProductTypes)}`}>
          <button className="back-button" type="button" onClick={closeProduct}>
            <ChevronLeft size={18} aria-hidden="true" />
            Sản phẩm
          </button>
          <header className="product-type-screen-header">
            <h2>{getProductTitle(selectedProduct, catalogProductTypes)}</h2>
            <strong>{formatPrice(getProductPrice(selectedProduct, catalogProductTypes))}</strong>
          </header>
          <div className="catalog-layout">
          <section className="catalog-list" aria-label="Danh sách sản phẩm">
            {visibleProduct ? (
              <ProductCard
                key={visibleProduct.id}
                onImageOpen={setActiveImage}
                product={visibleProduct}
                productTypes={catalogProductTypes}
                selectedSize={selectedSize}
                onSizeChange={setSelectedSize}
                sizeChartCaption={`${selectedProductType.name || "Loại sản phẩm"} - bảng size`}
                sizeChartImage={getProductTypeSizeChartImage(selectedProductType, catalogProducts)}
                compact
              />
            ) : (
              <section className="empty-state">
                <h3>Size này tạm hết hàng</h3>
                <p>Bạn có thể chọn size khác hoặc nhắn Instagram/Messenger để shop kiểm tra mẫu mới nhất.</p>
              </section>
            )}
          </section>
        </div>
        </section>
        ) : null}
      </main>

      <div className={isSidebarOpen ? "storefront-sidebar-backdrop open" : "storefront-sidebar-backdrop"} onClick={() => setIsSidebarOpen(false)} />
      <aside className={isSidebarOpen ? "storefront-sidebar open" : "storefront-sidebar"} aria-label="Menu điều hướng" aria-hidden={!isSidebarOpen}>
        <div className="storefront-sidebar-header">
          <strong>{shopConfig.brand}</strong>
          <button type="button" aria-label="Đóng menu" onClick={() => setIsSidebarOpen(false)}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <nav className="storefront-sidebar-nav">
          <button type="button" onClick={() => goHomeSection()}>Trang chủ</button>
          <details className="sidebar-products-group">
            <summary>
              <span>Sản phẩm</span>
              <ChevronDown size={16} aria-hidden="true" />
            </summary>
            <button className="sidebar-all-products" type="button" onClick={() => goHomeSection("products")}>Tất cả sản phẩm</button>
            {productTypeGroups.map(({ productType, products }) =>
              products.length > 1 ? (
                <details className="sidebar-product-type" key={productType.id}>
                  <summary>
                    <span>{productType.name || "Loại sản phẩm"}</span>
                    <ChevronDown size={15} aria-hidden="true" />
                  </summary>
                  {products.map((product) => (
                    <button type="button" key={product.id} onClick={() => { setIsSidebarOpen(false); openProduct(product); }}>
                      {product.name.trim() || getProductTitle(product, catalogProductTypes)}
                    </button>
                  ))}
                </details>
              ) : (
                <button className="sidebar-product-type-link" type="button" key={productType.id} onClick={() => { setIsSidebarOpen(false); openProduct(products[0]); }}>
                  {getProductTitle(products[0], catalogProductTypes)}
                </button>
              ),
            )}
          </details>
          <button type="button" onClick={() => goHomeSection("gift")}>Quà tặng</button>
          <button type="button" onClick={() => goHomeSection("shipping")}>Phí ship</button>
          <button type="button" onClick={() => goHomeSection("payment")}>Thanh toán</button>
          <button type="button" onClick={() => goHomeSection("returns")}>Đổi trả</button>
        </nav>
      </aside>

      <ContactButtons />

      {activeImage ? (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Ảnh phóng to"
          onClick={() => setActiveImage(null)}
        >
          <button className="lightbox-close" type="button" aria-label="Đóng ảnh" onClick={() => setActiveImage(null)}>
            <X size={22} aria-hidden="true" />
          </button>
          {canNavigateLightbox ? (
            <button
              className="lightbox-nav previous"
              type="button"
              aria-label="Xem ảnh trước"
              onClick={(event) => {
                event.stopPropagation();
                openGalleryImage(-1);
              }}
            >
              <ChevronLeft size={26} aria-hidden="true" />
            </button>
          ) : null}
          <div className="lightbox-media" onClick={(event) => event.stopPropagation()}>
            <img src={activeImage.src} alt={activeImage.alt} />
            <span className="lightbox-caption">{activeImage.caption}</span>
          </div>
          {canNavigateLightbox ? (
            <button
              className="lightbox-nav next"
              type="button"
              aria-label="Xem ảnh sau"
              onClick={(event) => {
                event.stopPropagation();
                openGalleryImage(1);
              }}
            >
              <ChevronRight size={26} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

type ProductCardProps = {
  product: Product;
  productTypes: ProductType[];
  selectedSize: SizeId;
  onImageOpen: (image: GalleryImage) => void;
  onSizeChange?: (sizeId: SizeId) => void;
  sizeChartCaption?: string;
  sizeChartImage?: ProductImage;
  compact?: boolean;
};

function ProductCard({
  product,
  productTypes,
  selectedSize,
  onImageOpen,
  onSizeChange,
  sizeChartCaption,
  sizeChartImage,
  compact = false,
}: ProductCardProps) {
  const productTitle = getProductTitle(product, productTypes);

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
                <img loading="lazy" src={sizeChartImage.src} alt={sizeChartImage.alt} />
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
            <div className="pattern-grid">
              {product.patterns.map((pattern) => (
                <button
                  className="image-tile"
                  key={pattern.id}
                  type="button"
                  onClick={() =>
                    onImageOpen({
                      ...pattern.image,
                      caption: `${productTitle} - ${pattern.name}`,
                    })
                  }
                >
                  <img loading="lazy" src={pattern.image.src} alt={pattern.image.alt} />
                  <span>
                    {pattern.name}
                  </span>
                </button>
              ))}
            </div>
          </section>

          {product.modelImages.length > 0 ? (
          <section aria-label={`Ảnh mẫu mặc ${productTitle}`}>
            <div className="section-title">
              <h4>Ảnh mẫu mặc</h4>
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
                      caption: `${productTitle} - ảnh mẫu ${index + 1}`,
                    })
                  }
                >
                  <img loading="lazy" src={image.src} alt={image.alt} />
                </button>
              ))}
            </div>
          </section>
          ) : null}

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
                <img loading="lazy" src={product.sizeChartImage.src} alt={product.sizeChartImage.alt} />
              </button>
            </section>
          ) : null}
      </div>
    </article>
  );
}

function ContactButtons() {
  return (
    <div className="contact-buttons" aria-label="Nhắn tin đặt hàng">
      <a
        className="contact-button instagram"
        href={shopConfig.contacts.instagram}
        target="_blank"
        rel="noreferrer"
        aria-label="Nhắn tin KNG.studio qua Instagram"
      >
        <Instagram size={22} aria-hidden="true" />
        <span>Instagram</span>
      </a>
      <a
        className="contact-button messenger"
        href={shopConfig.contacts.messenger}
        target="_blank"
        rel="noreferrer"
        aria-label="Nhắn tin KNG.studio qua Messenger"
      >
        <MessengerIcon />
        <span>Messenger</span>
      </a>
    </div>
  );
}

type AdminPageProps = {
  catalogStatus: string;
  isCatalogLoading: boolean;
  productTypes: ProductType[];
  products: Product[];
  shopInfoImage: ProductImage;
  onProductTypesChange: Dispatch<SetStateAction<ProductType[]>>;
  onProductsChange: Dispatch<SetStateAction<Product[]>>;
  onShopInfoImageChange: Dispatch<SetStateAction<ProductImage>>;
  onRefresh: () => Promise<void>;
};

const createId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const createImage = (id: string, src = "", alt = "Ảnh sản phẩm"): ProductImage => ({
  id,
  src,
  alt,
});

type AdminSaveState = {
  status: "idle" | "saving" | "success" | "error";
  message: string;
};

function AdminPage({
  catalogStatus,
  isCatalogLoading,
  productTypes,
  products,
  shopInfoImage: adminShopInfoImage,
  onProductTypesChange,
  onProductsChange,
  onShopInfoImageChange,
  onRefresh,
}: AdminPageProps) {
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [expandedProductTypeId, setExpandedProductTypeId] = useState<string | null>(null);
  const [selectedAdminProductTypeId, setSelectedAdminProductTypeId] = useState<string | null>(null);
  const [adminProductTypeSlug, setAdminProductTypeSlug] = useState<string | null>(() => getAdminProductTypeSlugFromPath());
  const [showStats, setShowStats] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(Boolean(supabase));
  const [isBusy, setIsBusy] = useState(false);
  const [adminMessage, setAdminMessage] = useState(catalogStatus);
  const [saveState, setSaveState] = useState<AdminSaveState>({ status: "idle", message: "" });
  const [previewImage, setPreviewImage] = useState<GalleryImage | null>(null);

  useEffect(() => {
    setAdminMessage(catalogStatus);
  }, [catalogStatus]);

  const patternCount = products.reduce((total, product) => total + product.patterns.length, 0);
  const availablePatternCount = products.reduce(
    (total, product) => total + product.patterns.filter((pattern) => pattern.availableSizes.length > 0).length,
    0,
  );
  const defaultProductType = productTypes[0] ?? null;
  const selectedAdminProductType =
    productTypes.find((productType) => productType.id === selectedAdminProductTypeId) ?? null;
  const selectedTypeProducts = selectedAdminProductType
    ? products.filter((product) => product.productTypeId === selectedAdminProductType.id)
    : [];

  const toggleExpandProduct = (productId: string) => {
    setExpandedProductId((current) => (current === productId ? null : productId));
  };

  const toggleExpandProductType = (productTypeId: string) => {
    setExpandedProductTypeId((current) => (current === productTypeId ? null : productTypeId));
  };

  const openAdminProductType = (productType: ProductType) => {
    const slug = getProductTypeSlug(productType);
    setSelectedAdminProductTypeId(productType.id);
    setAdminProductTypeSlug(slug);
    window.history.pushState(null, "", `/admin/${slug}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeAdminProductType = () => {
    setSelectedAdminProductTypeId(null);
    setAdminProductTypeSlug(null);
    setExpandedProductId(null);
    window.history.pushState(null, "", "/admin");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    if (!adminProductTypeSlug) {
      setSelectedAdminProductTypeId(null);
      return;
    }
    const productType = productTypes.find((currentProductType) => getProductTypeSlug(currentProductType) === adminProductTypeSlug);
    if (productType) {
      setSelectedAdminProductTypeId(productType.id);
      return;
    }
    setSelectedAdminProductTypeId(null);
  }, [adminProductTypeSlug, productTypes]);

  useEffect(() => {
    if (!selectedAdminProductTypeId) return;
    if (productTypes.some((productType) => productType.id === selectedAdminProductTypeId)) return;
    setSelectedAdminProductTypeId(null);
  }, [productTypes, selectedAdminProductTypeId]);

  useEffect(() => {
    const syncAdminRoute = () => {
      setAdminProductTypeSlug(getAdminProductTypeSlugFromPath());
    };

    window.addEventListener("popstate", syncAdminRoute);
    return () => window.removeEventListener("popstate", syncAdminRoute);
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    supabase.auth
      .getSession()
      .then(({ data }) => {
        setIsSignedIn(Boolean(data.session));
      })
      .finally(() => setIsAuthLoading(false));

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsSignedIn(Boolean(session));
      setIsAuthLoading(false);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const updateProduct = (productId: string, patch: Partial<Product>) => {
    onProductsChange((currentProducts) =>
      currentProducts.map((product) => (product.id === productId ? { ...product, ...patch } : product)),
    );
  };

  const addProductType = () => {
    const id = createId("type");
    const productType = {
      id,
      name: "",
      price: "",
      coverImage: createImage(createId("type-cover"), "", "Ảnh bìa loại sản phẩm"),
      sizeChartImage: createImage(createId("type-size-chart"), "", "Bảng size loại sản phẩm"),
    };
    onProductTypesChange((currentTypes) => [
      ...currentTypes,
      productType,
    ]);
    setExpandedProductTypeId(id);
  };

  const updateProductType = (productTypeId: string, patch: Partial<ProductType>) => {
    onProductTypesChange((currentTypes) =>
      currentTypes.map((productType) =>
        productType.id === productTypeId ? { ...productType, ...patch } : productType,
      ),
    );
  };

  const removeProductType = (productTypeId: string) => {
    if (productTypes.length <= 1) return;
    const nextProductType = productTypes.find((productType) => productType.id !== productTypeId);
    if (!nextProductType) return;

    onProductTypesChange((currentTypes) => currentTypes.filter((productType) => productType.id !== productTypeId));
    setExpandedProductTypeId((current) => (current === productTypeId ? null : current));
    setSelectedAdminProductTypeId((current) => (current === productTypeId ? null : current));
    onProductsChange((currentProducts) =>
      currentProducts.map((product) =>
        product.productTypeId === productTypeId
          ? { ...product, productTypeId: nextProductType.id, price: nextProductType.price }
          : product,
      ),
    );
  };

  const reorderProductType = (productTypeId: string, direction: -1 | 1) => {
    onProductTypesChange((currentTypes) => {
      const index = currentTypes.findIndex((productType) => productType.id === productTypeId);
      return index === -1 ? currentTypes : moveItem(currentTypes, index, direction);
    });
  };

  const reorderProduct = (productId: string, direction: -1 | 1) => {
    onProductsChange((currentProducts) => {
      const index = currentProducts.findIndex((product) => product.id === productId);
      return index === -1 ? currentProducts : moveItem(currentProducts, index, direction);
    });
  };

  const reorderProductWithinType = (productId: string, direction: -1 | 1) => {
    onProductsChange((currentProducts) => {
      const product = currentProducts.find((currentProduct) => currentProduct.id === productId);
      if (!product) return currentProducts;

      const typeProducts = currentProducts.filter((currentProduct) => currentProduct.productTypeId === product.productTypeId);
      const typeIndex = typeProducts.findIndex((currentProduct) => currentProduct.id === productId);
      const targetTypeProduct = typeProducts[typeIndex + direction];
      if (!targetTypeProduct) return currentProducts;

      const index = currentProducts.findIndex((currentProduct) => currentProduct.id === productId);
      const targetIndex = currentProducts.findIndex((currentProduct) => currentProduct.id === targetTypeProduct.id);
      if (index === -1 || targetIndex === -1) return currentProducts;

      const nextProducts = [...currentProducts];
      const [movedProduct] = nextProducts.splice(index, 1);
      nextProducts.splice(targetIndex, 0, movedProduct);
      return nextProducts;
    });
  };

  const updatePattern = (productId: string, patternId: string, patch: Partial<ProductPattern>) => {
    onProductsChange((currentProducts) =>
      currentProducts.map((product) =>
        product.id === productId
          ? {
              ...product,
              patterns: product.patterns.map((pattern) =>
                pattern.id === patternId ? { ...pattern, ...patch } : pattern,
              ),
            }
          : product,
      ),
    );
  };

  const updateModelImage = (productId: string, imageId: string, patch: Partial<ProductImage>) => {
    onProductsChange((currentProducts) =>
      currentProducts.map((product) =>
        product.id === productId
          ? {
              ...product,
              modelImages: product.modelImages.map((image) =>
                image.id === imageId ? { ...image, ...patch } : image,
              ),
            }
          : product,
      ),
    );
  };

  const togglePatternSize = (productId: string, pattern: ProductPattern, sizeId: SizeId) => {
    const availableSizes = pattern.availableSizes.includes(sizeId)
      ? pattern.availableSizes.filter((currentSize) => currentSize !== sizeId)
      : [...pattern.availableSizes, sizeId];
    updatePattern(productId, pattern.id, { availableSizes });
  };

  const addProduct = (productTypeId = selectedAdminProductType?.id ?? defaultProductType?.id) => {
    const id = createId("product");
    const productType =
      productTypes.find((currentProductType) => currentProductType.id === productTypeId) ??
      defaultProductType ?? {
      id: createId("type"),
      name: "",
      price: "",
      coverImage: createImage(createId("type-cover"), "", "Ảnh bìa loại sản phẩm"),
      sizeChartImage: createImage(createId("type-size-chart"), "", "Bảng size loại sản phẩm"),
    };

    if (!defaultProductType) {
      onProductTypesChange((currentTypes) => [...currentTypes, productType]);
    }

    const newProduct: Product = {
      id,
      productTypeId: productType.id,
      name: "",
      price: productType.price,
      fit: "",
      material: "Xô muslin 2 lớp",
      patterns: [],
      modelImages: [],
      sizeChartImage: createImage(createId("size-chart"), "", "Ảnh bảng size"),
    };
    onProductsChange((currentProducts) => [...currentProducts, newProduct]);
    setSelectedAdminProductTypeId(productType.id);
    setExpandedProductId(id);
  };

  const addPatterns = (productId: string, urls: string[]) => {
    const newPatterns: ProductPattern[] = urls.map((url) => ({
      id: createId("pattern"),
      name: "",
      accent: "#c8b69a",
      image: createImage(createId("pattern-image"), url, "Họa tiết"),
      availableSizes: ["1", "2"],
    }));

    onProductsChange((currentProducts) =>
      currentProducts.map((product) =>
        product.id === productId ? { ...product, patterns: [...product.patterns, ...newPatterns] } : product,
      ),
    );
  };

  const removePattern = (productId: string, patternId: string) => {
    onProductsChange((currentProducts) =>
      currentProducts.map((product) =>
        product.id === productId
          ? { ...product, patterns: product.patterns.filter((pattern) => pattern.id !== patternId) }
          : product,
      ),
    );
  };

  const addModelImage = (productId: string, src: string) => {
    const newImage = createImage(createId("model-image"), src, "Ảnh mẫu mặc");
    onProductsChange((currentProducts) =>
      currentProducts.map((product) =>
        product.id === productId ? { ...product, modelImages: [...product.modelImages, newImage] } : product,
      ),
    );
  };

  const addModelImages = (productId: string, urls: string[]) => {
    const newImages = urls.map((url) => createImage(createId("model-image"), url, "Ảnh mẫu mặc"));
    onProductsChange((currentProducts) =>
      currentProducts.map((product) =>
        product.id === productId ? { ...product, modelImages: [...product.modelImages, ...newImages] } : product,
      ),
    );
  };

  const removeProduct = (product: Product) => {
    const productTitle = getProductTitle(product, productTypes);
    const confirmed = window.confirm(`Xóa sản phẩm "${productTitle}"? Sau khi bấm Lưu Supabase, sản phẩm này sẽ bị xóa khỏi database.`);
    if (!confirmed) return;

    onProductsChange((currentProducts) => currentProducts.filter((currentProduct) => currentProduct.id !== product.id));
    setExpandedProductId((current) => (current === product.id ? null : current));
  };

  const removeModelImage = (productId: string, imageId: string) => {
    onProductsChange((currentProducts) =>
      currentProducts.map((product) =>
        product.id === productId
          ? { ...product, modelImages: product.modelImages.filter((image) => image.id !== imageId) }
          : product,
      ),
    );
  };

  const signIn = async () => {
    if (!supabase) return;
    setIsBusy(true);
    setAdminMessage("Đang đăng nhập...");
    const { error } = await supabase.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword,
    });
    setIsBusy(false);
    setAdminMessage(error ? error.message : "Đã đăng nhập.");
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setAdminMessage("Đã đăng xuất.");
  };

  const saveToSupabase = async () => {
    setIsBusy(true);
    setAdminMessage("Đang lưu lên Supabase...");
    setSaveState({ status: "saving", message: "Đang lưu lên Supabase..." });
    try {
      await saveCatalog({
        productTypes,
        products,
        shopInfoImage: adminShopInfoImage,
      });
      const message = `Đã lưu lúc ${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}.`;
      setAdminMessage(message);
      setSaveState({ status: "success", message });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không lưu được catalog.";
      setAdminMessage(message);
      setSaveState({ status: "error", message });
    } finally {
      setIsBusy(false);
    }
  };

  const refreshFromSupabase = async () => {
    setIsBusy(true);
    setAdminMessage("Đang tải lại dữ liệu...");
    try {
      await onRefresh();
      setAdminMessage("Đã tải lại dữ liệu từ Supabase.");
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : "Không tải lại được dữ liệu.");
    } finally {
      setIsBusy(false);
    }
  };

  const uploadImage = async (file: File, folder: string, onUploaded: (url: string) => void) => {
    setIsBusy(true);
    setAdminMessage("Đang upload ảnh...");
    try {
      const publicUrl = await uploadCatalogImage(file, folder);
      onUploaded(publicUrl);
      setAdminMessage("Upload ảnh xong, bấm Lưu Supabase để ghi dữ liệu.");
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : "Không upload được ảnh.");
    } finally {
      setIsBusy(false);
    }
  };

  const uploadImages = async (files: File[], folder: string, onUploaded: (urls: string[]) => void) => {
    if (files.length === 0) return;

    setIsBusy(true);
    setAdminMessage(`Đang upload ${files.length} ảnh...`);
    try {
      const publicUrls: string[] = [];
      for (const file of files) {
        publicUrls.push(await uploadCatalogImage(file, folder));
      }
      onUploaded(publicUrls);
      setAdminMessage("Upload ảnh xong, bấm Lưu Supabase để ghi dữ liệu.");
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : "Không upload được ảnh.");
    } finally {
      setIsBusy(false);
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <main className="admin-shell">
        <section className="admin-empty">
          <h2>Chưa cấu hình Supabase</h2>
          <p>Thêm `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`, chạy SQL trong `supabase/schema.sql`, rồi mở lại `/admin`.</p>
          <a className="admin-link" href="/">
            <Eye size={17} aria-hidden="true" />
            Xem mock site
          </a>
        </section>
      </main>
    );
  }

  if (isAuthLoading || isCatalogLoading) {
    return (
      <main className="admin-shell">
        <LoadingPanel variant="admin" />
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main className="admin-shell">
        <section className="admin-login">
          <div>
            <span className="eyebrow">Supabase admin</span>
            <h1>Đăng nhập KNG.studio</h1>
            <p>Dùng email/password đã tạo trong Supabase Auth.</p>
          </div>
          <label>
            <span>Email</span>
            <input value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} type="email" />
          </label>
          <label>
            <span>Password</span>
            <input
              value={adminPassword}
              onChange={(event) => setAdminPassword(event.target.value)}
              type="password"
            />
          </label>
          <button className="admin-button primary" type="button" disabled={isBusy} onClick={signIn}>
            <Save size={17} aria-hidden="true" />
            Đăng nhập
          </button>
          <p>{adminMessage}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <div>
          <span className="eyebrow">Supabase admin</span>
          <h1>KNG.studio</h1>
        </div>
        <div className="admin-actions">
          <button
            className={showStats ? "icon-button active" : "icon-button"}
            type="button"
            onClick={() => setShowStats((s) => !s)}
            aria-label="Tổng quan"
          >
            <BarChart3 size={17} aria-hidden="true" />
          </button>
          <a className="admin-link" href="/">
            <Eye size={17} aria-hidden="true" />
            Xem site
          </a>
          <button className="admin-button ghost" type="button" disabled={isBusy} onClick={refreshFromSupabase}>
            <RotateCcw size={17} aria-hidden="true" />
            Reload DB
          </button>
          <button className="admin-button ghost" type="button" disabled={isBusy} onClick={signOut}>
            Đăng xuất
          </button>
          <button className="admin-button primary" type="button" disabled={isBusy} onClick={saveToSupabase}>
            <Save size={17} aria-hidden="true" />
            Lưu Supabase
          </button>
        </div>
      </header>

      {showStats ? (
        <section className="admin-stats" aria-label="Tổng quan catalog">
          <div>
            <PackageCheck size={20} aria-hidden="true" />
            <span>Sản phẩm</span>
            <strong>{products.length}</strong>
          </div>
          <div>
            <BarChart3 size={20} aria-hidden="true" />
            <span>Loại</span>
            <strong>{productTypes.length}</strong>
          </div>
          <div>
            <Image size={20} aria-hidden="true" />
            <span>Họa tiết</span>
            <strong>{patternCount}</strong>
          </div>
          <div>
            <PackageCheck size={20} aria-hidden="true" />
            <span>Đang còn</span>
            <strong>{availablePatternCount}</strong>
          </div>
        </section>
      ) : null}

      <div className="admin-status-row">
        {adminProductTypeSlug ? (
          <button className="admin-button ghost" type="button" onClick={closeAdminProductType}>
            <ChevronLeft size={17} aria-hidden="true" />
            Danh sách loại
          </button>
        ) : null}
        <p className="admin-status-text">{adminMessage}</p>
      </div>

      <div className="admin-product-list-full">
        {!adminProductTypeSlug ? (
          <>
            <section className="admin-panel-heading flat">
              <div>
                <h2>Loại sản phẩm ({productTypes.length})</h2>
                <p>Tap vào row để mở detail, tap mũi tên để sửa loại</p>
              </div>
            </section>

            <div className="product-type-list standalone">
              {productTypes.map((productType, index) => {
                const isTypeExpanded = expandedProductTypeId === productType.id;
                return (
                  <article className="product-type-item" key={productType.id}>
                    <div className="product-type-header">
                      <button className="product-type-open-button" type="button" onClick={() => openAdminProductType(productType)}>
                        <span>
                          <strong>{productType.name || "Chưa đặt tên"}</strong>
                          <em>{formatPrice(productType.price)}</em>
                        </span>
                        <small>{products.filter((product) => product.productTypeId === productType.id).length} sản phẩm</small>
                      </button>
                      <button
                        className="admin-product-chevron small"
                        type="button"
                        onClick={() => toggleExpandProductType(productType.id)}
                        aria-label={`Sửa ${productType.name || "loại sản phẩm"}`}
                        aria-expanded={isTypeExpanded}
                      >
                        {isTypeExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                    </div>

                    {isTypeExpanded ? (
                      <div className="product-type-row">
                        <AdminImageActionField
                          ariaLabel={`Mở tùy chọn ảnh bìa ${productType.name || "loại sản phẩm"}`}
                          caption={`Ảnh bìa ${productType.name || "loại sản phẩm"}`}
                          className="product-type-cover-field"
                          image={productType.coverImage}
                          onPreview={setPreviewImage}
                          onFileSelected={(file) =>
                            uploadImage(file, `product-types/${productType.id}`, (url) =>
                              updateProductType(productType.id, {
                                coverImage: {
                                  ...productType.coverImage,
                                  src: url,
                                  alt: productType.coverImage.alt || `Ảnh bìa ${productType.name}`,
                                },
                              }),
                            )
                          }
                        />
                        <AdminImageActionField
                          ariaLabel={`Mở tùy chọn bảng size ${productType.name || "loại sản phẩm"}`}
                          caption={`Bảng size ${productType.name || "loại sản phẩm"}`}
                          className="product-type-size-field"
                          image={productType.sizeChartImage}
                          onPreview={setPreviewImage}
                          onFileSelected={(file) =>
                            uploadImage(file, `product-types/${productType.id}/size-charts`, (url) =>
                              updateProductType(productType.id, {
                                sizeChartImage: {
                                  ...productType.sizeChartImage,
                                  src: url,
                                  alt: productType.sizeChartImage.alt || `Bảng size ${productType.name}`,
                                },
                              }),
                            )
                          }
                        />
                        <label className="product-type-name-field">
                          <span>Loại</span>
                          <input value={productType.name} onChange={(event) => updateProductType(productType.id, { name: event.target.value })} />
                        </label>
                        <label className="product-type-price-field">
                          <span>Giá</span>
                          <input
                            value={productType.price}
                            placeholder="Ví dụ: 390.000đ"
                            onChange={(event) => updateProductType(productType.id, { price: formatPrice(event.target.value) })}
                          />
                        </label>
                        <div className="reorder-controls" aria-label="Sắp xếp loại sản phẩm">
                          <button
                            className="icon-button"
                            type="button"
                            disabled={index === 0}
                            onClick={() => reorderProductType(productType.id, -1)}
                            aria-label={`Đưa ${productType.name || "loại sản phẩm"} lên`}
                          >
                            <ArrowUp size={15} aria-hidden="true" />
                          </button>
                          <button
                            className="icon-button"
                            type="button"
                            disabled={index === productTypes.length - 1}
                            onClick={() => reorderProductType(productType.id, 1)}
                            aria-label={`Đưa ${productType.name || "loại sản phẩm"} xuống`}
                          >
                            <ArrowDown size={15} aria-hidden="true" />
                          </button>
                        </div>
                        <button
                          className="icon-button danger"
                          type="button"
                          disabled={productTypes.length <= 1}
                          onClick={() => removeProductType(productType.id)}
                          aria-label={`Xóa loại ${productType.name}`}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>

            <button className="admin-button primary full-width" type="button" onClick={addProductType}>
              <Plus size={16} aria-hidden="true" />
              Thêm loại
            </button>
          </>
        ) : selectedAdminProductType ? (
          <section className="product-type-detail-panel" aria-label={`Sản phẩm ${selectedAdminProductType.name}`}>
            <div className="admin-panel-heading">
              <div>
                <h2>{selectedAdminProductType.name || "Chưa đặt tên"}</h2>
                <p>
                  {formatPrice(selectedAdminProductType.price)} · {selectedTypeProducts.length} sản phẩm
                </p>
              </div>
            </div>

            {selectedTypeProducts.map((product, productIndex) => {
          const isExpanded = expandedProductId === product.id;
          const productTitle = getProductTitle(product, productTypes);
          return (
            <article className="admin-product-item" key={product.id}>
              <button
                className={isExpanded ? "admin-product-header active" : "admin-product-header"}
                type="button"
                onClick={() => toggleExpandProduct(product.id)}
              >
                <div>
                  <strong>{productTitle}</strong>
                  <span>
                    {formatPrice(getProductPrice(product, productTypes))} · {product.patterns.length} họa tiết
                  </span>
                </div>
                <span className="admin-product-chevron">
                  {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </span>
              </button>

              {isExpanded ? (
                <div className="admin-product-body">
                  <div className="admin-danger-row">
                    <div className="reorder-controls" aria-label="Sắp xếp sản phẩm">
	                      <button
	                        className="admin-button small"
	                        type="button"
	                        disabled={productIndex === 0}
	                        onClick={() => reorderProductWithinType(product.id, -1)}
	                      >
                        <ArrowUp size={15} aria-hidden="true" />
                        Lên
                      </button>
	                      <button
	                        className="admin-button small"
	                        type="button"
	                        disabled={productIndex === selectedTypeProducts.length - 1}
	                        onClick={() => reorderProductWithinType(product.id, 1)}
                      >
                        <ArrowDown size={15} aria-hidden="true" />
                        Xuống
                      </button>
                    </div>
                    <button className="admin-button danger" type="button" onClick={() => removeProduct(product)}>
                      <Trash2 size={16} aria-hidden="true" />
                      Xóa sản phẩm
                    </button>
                  </div>

                  <div className="admin-card">
                    <h3>Thông tin sản phẩm</h3>
                    <div className="admin-form-grid">
                      <label>
                        <span>Loại sản phẩm</span>
                        <select
                          value={product.productTypeId}
                          onChange={(event) => {
                            const productType = productTypes.find((type) => type.id === event.target.value);
                            updateProduct(product.id, {
                              productTypeId: event.target.value,
                              price: productType?.price ?? product.price,
                            });
                          }}
                        >
                          {productTypes.map((productType) => (
                            <option value={productType.id} key={productType.id}>
                              {productType.name} - {formatPrice(productType.price)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Tên sản phẩm</span>
                        <input
                          value={product.name}
                          placeholder="Có thể để trống"
                          onChange={(event) => updateProduct(product.id, { name: event.target.value })}
                        />
                      </label>
                      <label>
                        <span>Chất liệu</span>
                        <input
                          value={product.material}
                          onChange={(event) => updateProduct(product.id, { material: event.target.value })}
                        />
                      </label>
                      <label className="full-row">
                        <span>Mô tả form dáng</span>
                        <textarea
                          value={product.fit}
                          onChange={(event) => updateProduct(product.id, { fit: event.target.value })}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="admin-card">
                    <h3>Họa tiết &amp; tồn size</h3>
                    <div className="pattern-row-list">
                      {product.patterns.map((pattern) => (
                        <article className="pattern-row" key={pattern.id}>
                          <AdminImageActionField
                            ariaLabel={`Mở tùy chọn ảnh ${pattern.name || "họa tiết"}`}
                            caption={pattern.name || "Họa tiết"}
                            image={pattern.image}
                            onPreview={setPreviewImage}
                            onFileSelected={(file) =>
                              uploadImage(file, `patterns/${product.id}`, (url) =>
                                updatePattern(product.id, pattern.id, {
                                  image: { ...pattern.image, src: url },
                                }),
                              )
                            }
                          />

                          <div className="pattern-row-main">
                            <div className="pattern-name-field">
                              <input
                                aria-label="Tên phân loại"
                                value={pattern.name}
                                placeholder="Nhập tên phân loại"
                                onChange={(event) =>
                                  updatePattern(product.id, pattern.id, { name: event.target.value })
                                }
                              />
                              <ChevronDown size={18} aria-hidden="true" />
                            </div>

                            <div className="pattern-size-switches" aria-label={`Tồn size ${pattern.name}`}>
                              {sizeOptions.map((size) => (
                                <button
                                  className={pattern.availableSizes.includes(size.id) ? "size-switch active" : "size-switch"}
                                  key={size.id}
                                  type="button"
                                  aria-pressed={pattern.availableSizes.includes(size.id)}
                                  onClick={() => togglePatternSize(product.id, pattern, size.id)}
                                >
                                  {size.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <button
                            className="icon-button danger pattern-delete"
                            type="button"
                            aria-label={`Xóa ${pattern.name}`}
                            onClick={() => removePattern(product.id, pattern.id)}
                          >
                            <Trash2 size={16} aria-hidden="true" />
                          </button>
                        </article>
                      ))}
                    </div>
                    <label className="admin-button small full-width file-button">
                      <Plus size={16} aria-hidden="true" />
                      Thêm phân loại (chọn nhiều ảnh)
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(event) => {
                          const files = Array.from(event.target.files ?? []);
                          if (files.length === 0) return;
                          uploadImages(files, `patterns/${product.id}`, (urls) => addPatterns(product.id, urls));
                          event.target.value = "";
                        }}
                      />
                    </label>
                  </div>

                  <div className="admin-card">
                    <h3>Ảnh mẫu mặc</h3>
                    <div className="admin-image-wrap">
                      {product.modelImages.map((image) => (
                        <div className="admin-image-wrap-item" key={image.id}>
                          <AdminImageActionField
                            ariaLabel="Mở tùy chọn ảnh mẫu mặc"
                            caption="Ảnh mẫu mặc"
                            image={image}
                            onPreview={setPreviewImage}
                            onFileSelected={(file) =>
                              uploadImage(file, `models/${product.id}`, (url) =>
                                updateModelImage(product.id, image.id, { src: url }),
                              )
                            }
                          />
                          <button
                            className="icon-button danger pattern-delete"
                            type="button"
                            onClick={() => removeModelImage(product.id, image.id)}
                            aria-label="Xóa ảnh mẫu mặc"
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <label className="admin-button small full-width file-button">
                      <Plus size={16} aria-hidden="true" />
                      Thêm ảnh mẫu mặc
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(event) => {
                          const files = Array.from(event.target.files ?? []);
                          if (files.length === 0) return;
                          uploadImages(files, `models/${product.id}`, (urls) => addModelImages(product.id, urls));
                          event.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}

            {selectedTypeProducts.length === 0 ? (
              <section className="admin-empty compact">
                <h2>Chưa có sản phẩm trong loại này</h2>
                <p>Thêm sản phẩm mới để bắt đầu nhập họa tiết và ảnh mẫu mặc.</p>
              </section>
            ) : null}

            <button
              className="admin-button primary full-width"
              type="button"
              onClick={() => addProduct(selectedAdminProductType.id)}
            >
              <Plus size={17} aria-hidden="true" />
              Thêm sản phẩm mới
            </button>
          </section>
        ) : (
          <section className="admin-empty compact">
            <h2>Không tìm thấy loại sản phẩm</h2>
            <p>Loại sản phẩm này có thể đã đổi tên hoặc đã bị xóa.</p>
            <button className="admin-button ghost" type="button" onClick={closeAdminProductType}>
              <ChevronLeft size={17} aria-hidden="true" />
              Về danh sách loại
            </button>
          </section>
        )}

        {!adminProductTypeSlug ? (
          <div className="admin-card" style={{ marginTop: "16px" }}>
            <div className="admin-card-header">
              <h3>Bảng giá & Quy định chung</h3>
              <AdminImageActionField
                ariaLabel="Mở tùy chọn bảng giá chung"
                caption="Bảng giá & Quy định chung"
                image={adminShopInfoImage}
                onPreview={setPreviewImage}
                onFileSelected={(file) =>
                  uploadImage(file, "shop-info", (url) =>
                    onShopInfoImageChange((image) => ({ ...image, src: url })),
                  )
                }
              />
            </div>
          </div>
        ) : null}

        {saveState.status !== "idle" ? (
          <div
            className={`admin-save-overlay ${saveState.status}`}
            role="status"
            aria-live="polite"
            aria-busy={saveState.status === "saving"}
          >
            <div>
              {saveState.status === "saving" ? (
                <span className="loading-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              ) : null}
              <strong>{saveState.status === "success" ? "Lưu thành công" : saveState.status === "error" ? "Lưu thất bại" : saveState.message}</strong>
              {saveState.status !== "saving" ? <span>{saveState.message}</span> : null}
              {saveState.status !== "saving" ? (
                <button className="admin-button primary" type="button" onClick={() => setSaveState({ status: "idle", message: "" })}>
                  Đóng
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {previewImage ? (
          <button
            className="lightbox"
            type="button"
            aria-label="Đóng ảnh phóng to"
            onClick={() => setPreviewImage(null)}
          >
            <span className="lightbox-close">
              <X size={22} aria-hidden="true" />
            </span>
            <img src={previewImage.src} alt={previewImage.alt} />
            <span className="lightbox-caption">{previewImage.caption}</span>
          </button>
        ) : null}
      </div>
    </main>
  );
}

export default App;
