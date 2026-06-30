import {
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
import type { Product, ProductImage, ProductPattern, SizeId } from "./types/catalog";

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
  const [catalogProducts, setCatalogProducts] = useState<Product[]>(fallbackCatalog.products);
  const [currentShopInfoImage, setCurrentShopInfoImage] = useState<ProductImage>(fallbackCatalog.shopInfoImage);
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
        setCatalogProducts(catalog.products.length ? catalog.products : fallbackCatalog.products);
        setCurrentShopInfoImage(catalog.shopInfoImage);
        setCatalogStatus(isSupabaseConfigured ? "Đã tải dữ liệu thật." : "Đang dùng mock data.");
      })
      .catch(() => {
        if (!isMounted) return;
        setCatalogProducts(fallbackCatalog.products);
        setCurrentShopInfoImage(fallbackCatalog.shopInfoImage);
        setCatalogStatus("Không tải được dữ liệu, đang dùng mock.");
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
        products={catalogProducts}
        shopInfoImage={currentShopInfoImage}
        onProductsChange={setCatalogProducts}
        onRefresh={async () => {
          const catalog = await fetchCatalog();
          setCatalogProducts(catalog.products.length ? catalog.products : fallbackCatalog.products);
          setCurrentShopInfoImage(catalog.shopInfoImage);
        }}
        onShopInfoImageChange={setCurrentShopInfoImage}
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

        <div className="catalog-layout">
          <aside className="catalog-sidebar" aria-label="Bộ lọc sản phẩm">
            <section className="size-panel" aria-labelledby="size-heading">
              <div>
                <h2 id="size-heading">Chọn size còn hàng</h2>
                <p>Catalog mock để khách xem form, họa tiết còn hàng và bảng size trước khi chốt đơn.</p>
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

            {visibleProducts.map((product) => (
              <ProductCard
                isCollapsed={Boolean(collapsed[product.id])}
                key={product.id}
                onImageOpen={setActiveImage}
                onToggle={() => toggleProduct(product.id)}
                product={product}
                selectedSize={selectedSize}
              />
            ))}
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
  selectedSize: SizeId;
  isCollapsed: boolean;
  onToggle: () => void;
  onImageOpen: (image: GalleryImage) => void;
};

function ProductCard({ product, selectedSize, isCollapsed, onToggle, onImageOpen }: ProductCardProps) {
  return (
    <article className="product-card">
      <button className="product-summary" type="button" onClick={onToggle} aria-expanded={!isCollapsed}>
        <h3>{product.name}</h3>
        <div className="summary-side">
          <span>{isCollapsed ? <ChevronDown size={22} /> : <ChevronUp size={22} />}</span>
        </div>
      </button>

      {!isCollapsed ? (
        <div className="product-detail">
          <section className="product-overview" aria-label={`Thông tin ${product.name}`}>
            <span className="product-material">{product.material}</span>
            <p>{product.fit}</p>
            <strong>{product.price}</strong>
          </section>

          <section aria-label={`Họa tiết còn hàng của ${product.name}`}>
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
                      caption: `${product.name} - ${pattern.name}`,
                    })
                  }
                >
                  <img loading="lazy" src={pattern.image.src} alt={pattern.image.alt} />
                  <span>
                    <i style={{ background: pattern.accent }} aria-hidden="true" />
                    {pattern.name}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section aria-label={`Ảnh mẫu mặc ${product.name}`}>
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
                      caption: `${product.name} - ảnh mẫu ${index + 1}`,
                    })
                  }
                >
                  <img loading="lazy" src={image.src} alt={image.alt} />
                </button>
              ))}
            </div>
          </section>

          <section aria-label={`Bảng size ${product.name}`}>
            <div className="section-title">
              <h4>Bảng size</h4>
              <span>Ảnh admin thêm</span>
            </div>
            <button
              className="size-chart-image"
              type="button"
              onClick={() =>
                onImageOpen({
                  ...product.sizeChartImage,
                  caption: `${product.name} - bảng size`,
                })
              }
            >
              <img loading="lazy" src={product.sizeChartImage.src} alt={product.sizeChartImage.alt} />
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
  products: Product[];
  shopInfoImage: ProductImage;
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
  products,
  shopInfoImage: adminShopInfoImage,
  onProductsChange,
  onShopInfoImageChange,
  onRefresh,
}: AdminPageProps) {
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id ?? "");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [adminMessage, setAdminMessage] = useState(catalogStatus);

  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? products[0];
  const patternCount = products.reduce((total, product) => total + product.patterns.length, 0);
  const availablePatternCount = products.reduce(
    (total, product) => total + product.patterns.filter((pattern) => pattern.availableSizes.length > 0).length,
    0,
  );

  useEffect(() => {
    if (!selectedProduct && products[0]) {
      setSelectedProductId(products[0].id);
    }
  }, [products, selectedProduct]);

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
    const newProduct: Product = {
      id,
      name: "Mẫu mới",
      price: "390.000đ",
      fit: "Mô tả form dáng ngắn.",
      material: "Muslin cotton",
      patterns: [
        {
          id: createId("pattern"),
          name: "Họa tiết mới",
          accent: "#c8b69a",
          image: createImage(createId("pattern-image"), "/images/moc-hoa-nhi.webp", "Ảnh họa tiết mới"),
          availableSizes: ["1"],
        },
      ],
      modelImages: [createImage(createId("model-image"), "/images/moc-model-1.webp", "Ảnh mẫu mặc")],
      sizeChartImage: createImage(createId("size-chart"), "/images/size-chart-moc.webp", "Ảnh bảng size"),
    };
    onProductsChange((currentProducts) => [...currentProducts, newProduct]);
    setSelectedProductId(id);
  };

  const addPattern = (productId: string) => {
    const newPattern: ProductPattern = {
      id: createId("pattern"),
      name: "Họa tiết mới",
      accent: "#c8b69a",
      image: createImage(createId("pattern-image"), "/images/moc-hoa-nhi.webp", "Ảnh họa tiết mới"),
      availableSizes: ["1"],
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

  const addModelImage = (productId: string) => {
    const newImage = createImage(createId("model-image"), "/images/moc-model-1.webp", "Ảnh mẫu mặc");
    onProductsChange((currentProducts) =>
      currentProducts.map((product) =>
        product.id === productId ? { ...product, modelImages: [...product.modelImages, newImage] } : product,
      ),
    );
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

      <section className="admin-stats" aria-label="Tổng quan catalog">
        <div>
          <PackageCheck size={20} aria-hidden="true" />
          <span>Sản phẩm</span>
          <strong>{products.length}</strong>
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

      <div className="admin-layout">
        <aside className="admin-product-nav" aria-label="Danh sách sản phẩm admin">
          <div className="admin-panel-heading">
            <h2>Sản phẩm</h2>
            <button className="icon-button" type="button" onClick={addProduct} aria-label="Thêm sản phẩm">
              <Plus size={18} aria-hidden="true" />
            </button>
          </div>
          <div className="admin-product-list">
            {products.map((product) => (
              <button
                className={selectedProduct?.id === product.id ? "admin-product-tab active" : "admin-product-tab"}
                key={product.id}
                type="button"
                onClick={() => setSelectedProductId(product.id)}
              >
                <strong>{product.name}</strong>
                <span>
                  {product.price} · {product.patterns.length} họa tiết
                </span>
              </button>
            ))}
          </div>

          <section className="admin-mini-panel" aria-label="Ảnh bảng giá chung">
            <h3>Bảng giá chung</h3>
            <label>
              <span>URL ảnh</span>
              <input
                value={adminShopInfoImage.src}
                onChange={(event) => onShopInfoImageChange((image) => ({ ...image, src: event.target.value }))}
              />
            </label>
            <label>
              <span>Upload ảnh</span>
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
            <img src={adminShopInfoImage.src} alt={adminShopInfoImage.alt} />
          </section>
        </aside>

        {selectedProduct ? (
          <section className="admin-editor" aria-label="Chỉnh sản phẩm">
            <div className="admin-editor-head">
              <div>
                <span className="eyebrow">Đang chỉnh</span>
                <h2>{selectedProduct.name}</h2>
              </div>
              <p>{adminMessage}</p>
            </div>

            <div className="admin-card">
              <h3>Thông tin sản phẩm</h3>
              <div className="admin-form-grid">
                <label>
                  <span>Tên mẫu</span>
                  <input
                    value={selectedProduct.name}
                    onChange={(event) => updateProduct(selectedProduct.id, { name: event.target.value })}
                  />
                </label>
                <label>
                  <span>Giá</span>
                  <input
                    value={selectedProduct.price}
                    onChange={(event) => updateProduct(selectedProduct.id, { price: event.target.value })}
                  />
                </label>
                <label>
                  <span>Chất liệu</span>
                  <input
                    value={selectedProduct.material}
                    onChange={(event) => updateProduct(selectedProduct.id, { material: event.target.value })}
                  />
                </label>
                <label className="full-row">
                  <span>Mô tả form dáng</span>
                  <textarea
                    value={selectedProduct.fit}
                    onChange={(event) => updateProduct(selectedProduct.id, { fit: event.target.value })}
                  />
                </label>
              </div>
            </div>

            <div className="admin-card">
              <div className="admin-panel-heading">
                <h3>Họa tiết & tồn size</h3>
                <button className="admin-button small" type="button" onClick={() => addPattern(selectedProduct.id)}>
                  <Plus size={16} aria-hidden="true" />
                  Thêm họa tiết
                </button>
              </div>
              <div className="pattern-editor-grid">
                {selectedProduct.patterns.map((pattern) => (
                  <article className="pattern-editor-card" key={pattern.id}>
                    <img src={pattern.image.src} alt={pattern.image.alt} />
                    <div className="admin-form-grid single">
                      <label>
                        <span>Tên họa tiết</span>
                        <input
                          value={pattern.name}
                          onChange={(event) =>
                            updatePattern(selectedProduct.id, pattern.id, { name: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        <span>Ảnh họa tiết</span>
                        <input
                          value={pattern.image.src}
                          onChange={(event) =>
                            updatePattern(selectedProduct.id, pattern.id, {
                              image: { ...pattern.image, src: event.target.value },
                            })
                          }
                        />
                      </label>
                      <label>
                        <span>Upload ảnh</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (!file) return;
                            uploadImage(file, `patterns/${selectedProduct.id}`, (url) =>
                              updatePattern(selectedProduct.id, pattern.id, {
                                image: { ...pattern.image, src: url },
                              }),
                            );
                            event.target.value = "";
                          }}
                        />
                      </label>
                      <label>
                        <span>Màu nhấn</span>
                        <input
                          type="color"
                          value={pattern.accent}
                          onChange={(event) =>
                            updatePattern(selectedProduct.id, pattern.id, { accent: event.target.value })
                          }
                        />
                      </label>
                    </div>
                    <div className="admin-size-checks" aria-label={`Tồn size ${pattern.name}`}>
                      {sizeOptions.map((size) => (
                        <label key={size.id}>
                          <input
                            type="checkbox"
                            checked={pattern.availableSizes.includes(size.id)}
                            onChange={() => togglePatternSize(selectedProduct.id, pattern, size.id)}
                          />
                          <span>{size.label}</span>
                        </label>
                      ))}
                    </div>
                    <button
                      className="admin-button danger"
                      type="button"
                      onClick={() => removePattern(selectedProduct.id, pattern.id)}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                      Xóa họa tiết
                    </button>
                  </article>
                ))}
              </div>
            </div>

            <div className="admin-card">
              <div className="admin-panel-heading">
                <h3>Ảnh mẫu mặc</h3>
                <button className="admin-button small" type="button" onClick={() => addModelImage(selectedProduct.id)}>
                  <Plus size={16} aria-hidden="true" />
                  Thêm ảnh
                </button>
              </div>
              <div className="admin-image-list">
                {selectedProduct.modelImages.map((image) => (
                  <div className="admin-image-row" key={image.id}>
                    <img src={image.src} alt={image.alt} />
                    <label>
                      <span>URL ảnh</span>
                      <input
                        value={image.src}
                        onChange={(event) =>
                          updateModelImage(selectedProduct.id, image.id, { src: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      <span>Upload ảnh</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          uploadImage(file, `models/${selectedProduct.id}`, (url) =>
                            updateModelImage(selectedProduct.id, image.id, { src: url }),
                          );
                          event.target.value = "";
                        }}
                      />
                    </label>
                    <button
                      className="icon-button danger"
                      type="button"
                      onClick={() => removeModelImage(selectedProduct.id, image.id)}
                      aria-label="Xóa ảnh mẫu mặc"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="admin-card">
              <h3>Bảng size dạng ảnh</h3>
              <div className="admin-image-row wide">
                <img src={selectedProduct.sizeChartImage.src} alt={selectedProduct.sizeChartImage.alt} />
                <label>
                  <span>URL ảnh bảng size</span>
                  <input
                    value={selectedProduct.sizeChartImage.src}
                    onChange={(event) =>
                      updateProduct(selectedProduct.id, {
                        sizeChartImage: { ...selectedProduct.sizeChartImage, src: event.target.value },
                      })
                    }
                  />
                </label>
                <label>
                  <span>Upload ảnh bảng size</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      uploadImage(file, `size-charts/${selectedProduct.id}`, (url) =>
                        updateProduct(selectedProduct.id, {
                          sizeChartImage: { ...selectedProduct.sizeChartImage, src: url },
                        }),
                      );
                      event.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>
          </section>
        ) : (
          <section className="admin-empty">
            <h2>Chưa có sản phẩm</h2>
            <button className="admin-button primary" type="button" onClick={addProduct}>
              <Plus size={17} aria-hidden="true" />
              Tạo sản phẩm đầu tiên
            </button>
          </section>
        )}
      </div>
    </main>
  );
}

export default App;
