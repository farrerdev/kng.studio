import { ChevronDown, ChevronUp, Facebook, Instagram, MapPin, X } from "lucide-react";
import { useMemo, useState } from "react";
import { shopConfig } from "./config/shop";
import { products, sizeOptions } from "./data/mockCatalog";
import { shopInfoImage } from "./data/shopInfo";
import type { Product, ProductImage, SizeId } from "./types/catalog";

type GalleryImage = ProductImage & {
  caption: string;
};

function getVisibleProducts(selectedSize: SizeId) {
  return products
    .map((product) => ({
      ...product,
      patterns: product.patterns.filter((pattern) => pattern.availableSizes.includes(selectedSize)),
    }))
    .filter((product) => product.patterns.length > 0);
}

function App() {
  const [selectedSize, setSelectedSize] = useState<SizeId>("1");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [activeImage, setActiveImage] = useState<GalleryImage | null>(null);

  const visibleProducts = useMemo(() => getVisibleProducts(selectedSize), [selectedSize]);

  const toggleProduct = (productId: string) => {
    setCollapsed((current) => ({
      ...current,
      [productId]: !current[productId],
    }));
  };

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
                ...shopInfoImage,
                caption: "Bảng giá chung & quy định đặt hàng",
              })
            }
          >
            <img loading="eager" src={shopInfoImage.src} alt={shopInfoImage.alt} />
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

export default App;
