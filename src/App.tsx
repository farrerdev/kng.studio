import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  Eye,
  Facebook,
  Image,
  Instagram,
  MapPin,
  PackageCheck,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { type Dispatch, type SetStateAction, useEffect, useMemo, useState } from "react";
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

function getProductPrice(product: Product, productTypes: ProductType[]) {
  return getProductType(product, productTypes)?.price ?? product.price;
}

type GalleryImage = ProductImage & {
  caption: string;
};

function getVisibleProducts(selectedSize: SizeId, catalogProducts: Product[]) {
  return catalogProducts
    .map((product) => ({
      ...product,
      patterns: product.patterns.filter((pattern) => pattern.availableSizes.includes(selectedSize)),
    }))
    .filter((product) => product.patterns.length > 0);
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
  const [selectedSize, setSelectedSize] = useState<SizeId>("1");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [activeImage, setActiveImage] = useState<GalleryImage | null>(null);
  const isAdminRoute = typeof window !== "undefined" && window.location.pathname.startsWith("/admin");

  const visibleProducts = useMemo(
    () => getVisibleProducts(selectedSize, catalogProducts),
    [catalogProducts, selectedSize],
  );

  useEffect(() => {
    let isMounted = true;
    fetchCatalog()
      .then((catalog) => {
        if (!isMounted) return;
        setCatalogProductTypes(isSupabaseConfigured ? catalog.productTypes : fallbackCatalog.productTypes);
        setCatalogProducts(isSupabaseConfigured ? catalog.products : fallbackCatalog.products);
        setCurrentShopInfoImage(isSupabaseConfigured ? catalog.shopInfoImage : fallbackCatalog.shopInfoImage);
        setCatalogStatus(isSupabaseConfigured ? "Đã tải dữ liệu thật." : "Đang dùng mock data.");
      })
      .catch(() => {
        if (!isMounted) return;
        setCatalogProductTypes(isSupabaseConfigured ? [] : fallbackCatalog.productTypes);
        setCatalogProducts(isSupabaseConfigured ? [] : fallbackCatalog.products);
        setCurrentShopInfoImage(isSupabaseConfigured ? null : fallbackCatalog.shopInfoImage);
        setCatalogStatus(isSupabaseConfigured ? "Không tải được dữ liệu Supabase." : "Đang dùng mock data.");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const toggleProduct = (productId: string) => {
    setCollapsed((current) => ({
      ...current,
      [productId]: !current[productId],
    }));
  };

  if (isAdminRoute) {
    return (
      <AdminPage
        catalogStatus={catalogStatus}
        productTypes={catalogProductTypes}
        products={catalogProducts}
        shopInfoImage={currentShopInfoImage ?? fallbackCatalog.shopInfoImage}
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
            typeof updater === "function" ? updater(currentImage ?? fallbackCatalog.shopInfoImage) : updater,
          )
        }
      />
    );
  }

  return (
    <>
      <main className="page-shell">
        <header className="site-header">
          <div>
            <p className="header-kicker">{shopConfig.subtitle}</p>
            <h1>{shopConfig.brand}</h1>
          </div>
          <div className="location-pill">
            <MapPin size={16} aria-hidden="true" />
            <span>{shopConfig.location}</span>
          </div>
        </header>

        {currentShopInfoImage ? (
          <section className="shop-info" aria-label="Bảng giá và quy định chung">
            <h2>Bảng giá chung và quy định</h2>
            <button
              className="shop-info-card"
              type="button"
              onClick={() =>
                setActiveImage({
                  ...currentShopInfoImage,
                  caption: "Bảng giá chung & quy định đặt hàng",
                })
              }
            >
              <img loading="eager" src={currentShopInfoImage.src} alt={currentShopInfoImage.alt} />
            </button>
          </section>
        ) : null}

        <div className="catalog-layout">
          <aside className="catalog-sidebar" aria-label="Bộ lọc sản phẩm">
            <section className="size-panel">
              <div>
                <h2>Chọn size phù hợp để xem mẫu đang còn hàng</h2>
              </div>
            </section>

            <div className="size-options" role="radiogroup" aria-label="Chọn size">
              {sizeOptions.map((size) => (
                <button
                  className={selectedSize === size.id ? "size-option active" : "size-option"}
                  key={size.id}
                  type="button"
                  role="radio"
                  aria-checked={selectedSize === size.id}
                  onClick={() => setSelectedSize(size.id)}
                >
                  <span>{size.label}</span>
                  <strong>{size.range}</strong>
                </button>
              ))}
            </div>
          </aside>

          <section className="catalog-list" aria-label="Danh sách sản phẩm">
            <div className="list-heading">
              <div>
                <span className="eyebrow">Đang còn hàng</span>
                <h2>{visibleProducts.length} mẫu phù hợp</h2>
              </div>
              <p>
                Size {selectedSize} - {sizeOptions.find((size) => size.id === selectedSize)?.range}
              </p>
            </div>

            {visibleProducts.length > 0 ? (
              visibleProducts.map((product) => (
                <ProductCard
                  isCollapsed={Boolean(collapsed[product.id])}
                  key={product.id}
                  onImageOpen={setActiveImage}
                  onToggle={() => toggleProduct(product.id)}
                  product={product}
                  productTypes={catalogProductTypes}
                  selectedSize={selectedSize}
                />
              ))
            ) : (
              <section className="empty-state">
                <h3>Chưa có sản phẩm đang bán</h3>
                <p>Shop đang cập nhật catalog. Bạn có thể nhắn Instagram hoặc Facebook để hỏi mẫu mới nhất.</p>
              </section>
            )}
          </section>
        </div>
      </main>

      <ContactButtons />

      {activeImage ? (
        <button
          className="lightbox"
          type="button"
          aria-label="Đóng ảnh phóng to"
          onClick={() => setActiveImage(null)}
        >
          <span className="lightbox-close">
            <X size={22} aria-hidden="true" />
          </span>
          <img src={activeImage.src} alt={activeImage.alt} />
          <span className="lightbox-caption">{activeImage.caption}</span>
        </button>
      ) : null}
    </>
  );
}

type ProductCardProps = {
  product: Product;
  productTypes: ProductType[];
  selectedSize: SizeId;
  isCollapsed: boolean;
  onToggle: () => void;
  onImageOpen: (image: GalleryImage) => void;
};

function ProductCard({ product, productTypes, selectedSize, isCollapsed, onToggle, onImageOpen }: ProductCardProps) {
  const productTitle = getProductTitle(product, productTypes);

  return (
    <article className="product-card">
      <button className="product-summary" type="button" onClick={onToggle} aria-expanded={!isCollapsed}>
        <h3>{productTitle}</h3>
        <div className="summary-side">
          <span>{isCollapsed ? <ChevronDown size={22} /> : <ChevronUp size={22} />}</span>
        </div>
      </button>

      {!isCollapsed ? (
        <div className="product-detail">
          <section className="product-overview" aria-label={`Thông tin ${productTitle}`}>
            <span className="product-material">{product.material}</span>
            <p>{product.fit}</p>
            <strong>{formatPrice(getProductPrice(product, productTypes))}</strong>
          </section>

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
              <img loading="lazy" src={product.sizeChartImage.src} alt={product.sizeChartImage.alt} />
              <div className="size-chart-inline-text">
                <h4>Bảng size</h4>
                <span>Tap để xem lớn</span>
              </div>
            </button>
          </section>
        </div>
      ) : null}
    </article>
  );
}

function ContactButtons() {
  return (
    <div className="contact-buttons" aria-label="Nhắn tin đặt hàng">
      <a className="contact-button instagram" href={shopConfig.contacts.instagram} target="_blank" rel="noreferrer">
        <Instagram size={22} aria-hidden="true" />
        <span>Instagram</span>
      </a>
      <a className="contact-button facebook" href={shopConfig.contacts.facebook} target="_blank" rel="noreferrer">
        <Facebook size={22} aria-hidden="true" />
        <span>Facebook</span>
      </a>
    </div>
  );
}

type AdminPageProps = {
  catalogStatus: string;
  productTypes: ProductType[];
  products: Product[];
  shopInfoImage: ProductImage;
  onProductTypesChange: Dispatch<SetStateAction<ProductType[]>>;
  onProductsChange: Dispatch<SetStateAction<Product[]>>;
  onShopInfoImageChange: Dispatch<SetStateAction<ProductImage>>;
  onRefresh: () => Promise<void>;
};

const createId = (prefix: string) => `${prefix}-${Date.now().toString(36)}`;

const createImage = (id: string, src = "/images/shop-info.webp", alt = "Ảnh sản phẩm"): ProductImage => ({
  id,
  src,
  alt,
});

function AdminPage({
  catalogStatus,
  productTypes,
  products,
  shopInfoImage: adminShopInfoImage,
  onProductTypesChange,
  onProductsChange,
  onShopInfoImageChange,
  onRefresh,
}: AdminPageProps) {
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [isProductTypesExpanded, setIsProductTypesExpanded] = useState(false);
  const [expandedProductTypeId, setExpandedProductTypeId] = useState<string | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [adminMessage, setAdminMessage] = useState(catalogStatus);

  useEffect(() => {
    setAdminMessage(catalogStatus);
  }, [catalogStatus]);

  const expandedProduct = products.find((product) => product.id === expandedProductId) ?? null;
  const patternCount = products.reduce((total, product) => total + product.patterns.length, 0);
  const availablePatternCount = products.reduce(
    (total, product) => total + product.patterns.filter((pattern) => pattern.availableSizes.length > 0).length,
    0,
  );
  const defaultProductType = productTypes[0] ?? null;

  const toggleExpandProduct = (productId: string) => {
    setExpandedProductId((current) => (current === productId ? null : productId));
  };

  const toggleExpandProductType = (productTypeId: string) => {
    setExpandedProductTypeId((current) => (current === productTypeId ? null : productTypeId));
  };

  useEffect(() => {
    if (!supabase) {
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setIsSignedIn(Boolean(data.session));
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsSignedIn(Boolean(session));
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
    onProductTypesChange((currentTypes) => [
      ...currentTypes,
      {
        id,
        name: "Loại mới",
        price: "390.000đ",
      },
    ]);
    setIsProductTypesExpanded(true);
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
    onProductsChange((currentProducts) =>
      currentProducts.map((product) =>
        product.productTypeId === productTypeId
          ? { ...product, productTypeId: nextProductType.id, price: nextProductType.price }
          : product,
      ),
    );
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

  const addProduct = () => {
    const id = createId("product");
    const productType = defaultProductType ?? {
      id: createId("type"),
      name: "Loại mới",
      price: "390.000đ",
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
      patterns: [
        {
          id: createId("pattern"),
          name: "",
          accent: "#c8b69a",
          image: createImage(createId("pattern-image"), "/images/moc-hoa-nhi.webp", "Ảnh họa tiết mới"),
          availableSizes: ["1", "2"],
        },
      ],
      modelImages: [],
      sizeChartImage: createImage(createId("size-chart"), "/images/size-chart-moc.webp", "Ảnh bảng size"),
    };
    onProductsChange((currentProducts) => [...currentProducts, newProduct]);
    setExpandedProductId(id);
  };

  const addPattern = (productId: string) => {
    const newPattern: ProductPattern = {
      id: createId("pattern"),
      name: "",
      accent: "#c8b69a",
      image: createImage(createId("pattern-image"), "/images/moc-hoa-nhi.webp", "Ảnh họa tiết mới"),
      availableSizes: ["1", "2"],
    };
    onProductsChange((currentProducts) =>
      currentProducts.map((product) =>
        product.id === productId ? { ...product, patterns: [...product.patterns, newPattern] } : product,
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
    try {
      await saveCatalog({
        productTypes,
        products,
        shopInfoImage: adminShopInfoImage,
      });
      setAdminMessage(`Đã lưu lúc ${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}.`);
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : "Không lưu được catalog.");
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

      <p className="admin-status-text">{adminMessage}</p>

      <div className="admin-product-list-full">
        <section className="product-type-manager" aria-label="Quản lý loại sản phẩm">
          <button
            className={isProductTypesExpanded ? "admin-product-header active" : "admin-product-header"}
            type="button"
            onClick={() => setIsProductTypesExpanded((current) => !current)}
            aria-expanded={isProductTypesExpanded}
          >
            <div>
              <strong>Loại sản phẩm ({productTypes.length})</strong>
              <span>Quản lý loại và giá hiển thị cho từng sản phẩm</span>
            </div>
            <span className="admin-product-chevron">
              {isProductTypesExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </span>
          </button>

          {isProductTypesExpanded ? (
            <div className="product-type-section-body">
              <div className="product-type-list">
                {productTypes.map((productType) => {
                  const isTypeExpanded = expandedProductTypeId === productType.id;
                  return (
                    <article className="product-type-item" key={productType.id}>
                      <button
                        className={isTypeExpanded ? "product-type-header active" : "product-type-header"}
                        type="button"
                        onClick={() => toggleExpandProductType(productType.id)}
                        aria-expanded={isTypeExpanded}
                      >
                        <div>
                          <strong>{productType.name || "Chưa đặt tên"}</strong>
                          <span>{formatPrice(productType.price)}</span>
                        </div>
                        <span className="admin-product-chevron small">
                          {isTypeExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </span>
                      </button>

                      {isTypeExpanded ? (
                        <div className="product-type-row">
                          <label>
                            <span>Loại</span>
                            <input
                              value={productType.name}
                              onChange={(event) => updateProductType(productType.id, { name: event.target.value })}
                            />
                          </label>
                          <label>
                            <span>Giá</span>
                            <input
                              value={productType.price}
                              placeholder="Ví dụ: 390.000đ"
                              onChange={(event) =>
                                updateProductType(productType.id, { price: formatPrice(event.target.value) })
                              }
                            />
                          </label>
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

              <button className="admin-button small full-width" type="button" onClick={addProductType}>
                <Plus size={16} aria-hidden="true" />
                Thêm loại
              </button>
            </div>
          ) : null}
        </section>

        {products.map((product) => {
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
                          <label className="pattern-thumb-field" aria-label={`Upload ảnh ${pattern.name}`}>
                            <img src={pattern.image.src} alt={pattern.image.alt} />
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (!file) return;
                                uploadImage(file, `patterns/${product.id}`, (url) =>
                                  updatePattern(product.id, pattern.id, {
                                    image: { ...pattern.image, src: url },
                                  }),
                                );
                                event.target.value = "";
                              }}
                            />
                          </label>

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
                    <button className="admin-button small full-width" type="button" onClick={() => addPattern(product.id)}>
                      <Plus size={16} aria-hidden="true" />
                      Thêm phân loại
                    </button>
                  </div>

                  <div className="admin-card">
                    <h3>Ảnh mẫu mặc</h3>
                    <div className="admin-image-wrap">
                      {product.modelImages.map((image) => (
                        <div className="admin-image-wrap-item" key={image.id}>
                          <label className="pattern-thumb-field">
                            <img src={image.src} alt={image.alt} />
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (!file) return;
                                uploadImage(file, `models/${product.id}`, (url) =>
                                  updateModelImage(product.id, image.id, { src: url }),
                                );
                                event.target.value = "";
                              }}
                            />
                          </label>
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
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          uploadImage(file, `models/${product.id}`, (url) => addModelImage(product.id, url));
                          event.target.value = "";
                        }}
                      />
                    </label>
                  </div>

                  <div className="admin-card">
                    <div className="admin-card-header">
                      <h3>Bảng size sản phẩm</h3>
                      <label className="pattern-thumb-field" aria-label="Upload bảng size">
                        <img src={product.sizeChartImage.src} alt={product.sizeChartImage.alt} />
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (!file) return;
                            uploadImage(file, `size-charts/${product.id}`, (url) =>
                              updateProduct(product.id, {
                                sizeChartImage: { ...product.sizeChartImage, src: url },
                              }),
                            );
                            event.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}

        <button className="admin-button primary full-width" type="button" onClick={addProduct}>
          <Plus size={17} aria-hidden="true" />
          Thêm sản phẩm mới
        </button>

        <div className="admin-card" style={{ marginTop: "24px" }}>
          <div className="admin-card-header">
            <h3>Bảng giá & Quy định chung</h3>
            <label className="pattern-thumb-field" aria-label="Upload bảng giá chung">
              <img src={adminShopInfoImage.src} alt={adminShopInfoImage.alt} />
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  uploadImage(file, "shop-info", (url) =>
                    onShopInfoImageChange((image) => ({ ...image, src: url })),
                  );
                  event.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
      </div>
    </main>
  );
}

export default App;
