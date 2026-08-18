import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronLeft,
  Link2,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import { sizeOptions } from "../../../data/mockCatalog";
import { getProductCoverImage, getProductPrice, getProductSlug, getProductTitle } from "../../catalog/catalogUtils";
import { IMAGE_WIDTHS } from "../../storefront/storefrontConstants";
import { formatPrice } from "../../../shared/utils/money";
import { copyTextToClipboard } from "../../../shared/utils/clipboard";
import { getSupabaseImageSrc } from "../../../shared/utils/image";
import type { Product, ProductImage, ProductPattern, ProductType, SizeId } from "../../../types/catalog";
import type { GalleryImage } from "../../storefront/storefrontTypes";
import { AdminImageActionField } from "./AdminImageActionField";

type AdminProductManagerProps = {
  adminMessage: string;
  adminProductTypeSlug: string | null;
  expandedProductId: string | null;
  hasProductDetailChanges: boolean;
  hasTypeDetailChanges: boolean;
  hiddenDraftProductId: string | null;
  hiddenDraftProductTypeId: string | null;
  isProductDetailClosing: boolean;
  isProductDetailVisible: boolean;
  isHomeSorting: boolean;
  isTypeDetailClosing: boolean;
  isTypeDetailVisible: boolean;
  isSavingDetail: boolean;
  productTypes: ProductType[];
  products: Product[];
  selectedAdminProductType: ProductType | null;
  selectedTypeProducts: Product[];
  onAddModelImages: (productId: string, urls: string[]) => void;
  onAddPatterns: (productId: string, urls: string[]) => void;
  onAddProduct: (productTypeId?: string) => void;
  onAddProductType: () => void;
  onBackFromProductDetail: () => void;
  onBackFromTypeDetail: () => void;
  onCloseProductType: () => void;
  onOpenProductType: (productType: ProductType) => void;
  onPreviewImage: (image: GalleryImage) => void;
  onRemoveModelImage: (productId: string, imageId: string) => void;
  onRemovePattern: (productId: string, patternId: string) => void;
  onRemoveProduct: (product: Product) => void;
  onRemoveProductType: (productTypeId: string) => void;
  onReorderModelImage: (productId: string, imageId: string, direction: -1 | 1) => void;
  onReorderProductType: (productTypeId: string, direction: -1 | 1) => void;
  onReorderProductWithinType: (productId: string, direction: -1 | 1) => void;
  onSelectProductFromHome: (productId: string) => void;
  onSaveProductDetail: () => void;
  onSaveTypeDetail: () => void;
  onSetPatternAsCover: (productId: string, patternId: string) => void;
  onTogglePatternSize: (productId: string, pattern: ProductPattern, sizeId: SizeId) => void;
  onUpdateModelImage: (productId: string, imageId: string, patch: Partial<ProductImage>) => void;
  onUpdatePattern: (productId: string, patternId: string, patch: Partial<ProductPattern>) => void;
  onUpdateProduct: (productId: string, patch: Partial<Product>) => void;
  onUpdateProductType: (productTypeId: string, patch: Partial<ProductType>) => void;
  onUploadImage: (file: File, folder: string, onUploaded: (url: string) => void) => void;
  onUploadImages: (files: File[], folder: string, onUploaded: (urls: string[]) => void) => void;
  productTypeCount: number;
};

export function AdminProductManager({
  adminMessage,
  adminProductTypeSlug,
  expandedProductId,
  hasProductDetailChanges,
  hasTypeDetailChanges,
  hiddenDraftProductId,
  hiddenDraftProductTypeId,
  isProductDetailClosing,
  isProductDetailVisible,
  isHomeSorting,
  isTypeDetailClosing,
  isTypeDetailVisible,
  isSavingDetail,
  productTypes,
  products,
  selectedAdminProductType,
  selectedTypeProducts,
  onAddModelImages,
  onAddPatterns,
  onAddProduct,
  onAddProductType,
  onBackFromProductDetail,
  onBackFromTypeDetail,
  onCloseProductType,
  onOpenProductType,
  onPreviewImage,
  onRemoveModelImage,
  onRemovePattern,
  onRemoveProduct,
  onRemoveProductType,
  onReorderModelImage,
  onReorderProductType,
  onReorderProductWithinType,
  onSelectProductFromHome,
  onSaveProductDetail,
  onSaveTypeDetail,
  onSetPatternAsCover,
  onTogglePatternSize,
  onUpdateModelImage,
  onUpdatePattern,
  onUpdateProduct,
  onUpdateProductType,
  onUploadImage,
  onUploadImages,
  productTypeCount,
}: AdminProductManagerProps) {
  const selectedProduct = products.find((product) => product.id === expandedProductId) ?? null;

  return (
    <>
      <div className="admin-status-row">
        <p className="admin-status-text">{adminMessage}</p>
      </div>

      <div className="admin-product-list-full">
        <AdminProductTypeList
          productTypes={productTypes}
          products={products}
          hiddenDraftProductId={hiddenDraftProductId}
          hiddenDraftProductTypeId={hiddenDraftProductTypeId}
          isHomeSorting={isHomeSorting}
          onAddProduct={onAddProduct}
          onAddProductType={onAddProductType}
          onOpenProductType={onOpenProductType}
          onReorderProductType={onReorderProductType}
          onReorderProductWithinType={onReorderProductWithinType}
          onSelectProduct={onSelectProductFromHome}
        />
      </div>

      {isTypeDetailVisible && adminProductTypeSlug ? (
        <div className={`admin-detail-overlay type-detail${isTypeDetailClosing ? " closing" : ""}`} role="dialog" aria-modal="true">
          <div className="admin-detail-topbar">
            <button className="admin-button ghost" type="button" onClick={onBackFromTypeDetail}>
              <ChevronLeft size={17} aria-hidden="true" />
              Back
            </button>
            <button className="admin-button primary" type="button" disabled={isSavingDetail || !hasTypeDetailChanges} onClick={onSaveTypeDetail}>
              Lưu
            </button>
          </div>
          <div className="admin-detail-sheet">
            {selectedAdminProductType ? (
              <AdminProductTypeDetail
                productType={selectedAdminProductType}
                productTypeCount={productTypeCount}
                products={selectedTypeProducts}
                onPreviewImage={onPreviewImage}
                onRemoveProductType={onRemoveProductType}
                onUpdateProductType={onUpdateProductType}
                onUploadImage={onUploadImage}
              />
            ) : (
              <section className="admin-empty compact">
                <h2>Không tìm thấy loại sản phẩm</h2>
                <p>Loại sản phẩm này có thể đã đổi tên hoặc đã bị xóa.</p>
                <button className="admin-button ghost" type="button" onClick={onCloseProductType}>
                  <ChevronLeft size={17} aria-hidden="true" />
                  Về danh sách loại
                </button>
              </section>
            )}
          </div>
        </div>
      ) : isTypeDetailClosing ? (
        <div className="admin-detail-overlay type-detail closing" aria-hidden="true" />
      ) : null}

      {isProductDetailVisible && selectedProduct ? (
        <div className={`admin-detail-overlay product-detail-overlay${isProductDetailClosing ? " closing" : ""}`} role="dialog" aria-modal="true">
          <div className="admin-detail-topbar">
            <button className="admin-button ghost" type="button" onClick={onBackFromProductDetail}>
              <ChevronLeft size={17} aria-hidden="true" />
              Back
            </button>
            <button className="admin-button primary" type="button" disabled={isSavingDetail || !hasProductDetailChanges} onClick={onSaveProductDetail}>
              Lưu
            </button>
          </div>
          <div className="admin-detail-sheet">
            <AdminProductDetail
              product={selectedProduct}
              productTypes={productTypes}
              onAddModelImages={onAddModelImages}
              onAddPatterns={onAddPatterns}
              onPreviewImage={onPreviewImage}
              onRemoveModelImage={onRemoveModelImage}
              onRemovePattern={onRemovePattern}
              onRemoveProduct={onRemoveProduct}
              onReorderModelImage={onReorderModelImage}
              onSetPatternAsCover={onSetPatternAsCover}
              onTogglePatternSize={onTogglePatternSize}
              onUpdateModelImage={onUpdateModelImage}
              onUpdatePattern={onUpdatePattern}
              onUpdateProduct={onUpdateProduct}
              onUploadImage={onUploadImage}
              onUploadImages={onUploadImages}
            />
          </div>
        </div>
      ) : isProductDetailClosing ? (
        <div className="admin-detail-overlay product-detail-overlay closing" aria-hidden="true" />
      ) : null}
    </>
  );
}

const COPIED_FEEDBACK_MS = 1600;

function getStorefrontProductUrl(typeProducts: Product[], productTypes: ProductType[]) {
  const storefrontProduct = typeProducts.find((product) => product.patterns.length > 0);
  if (!storefrontProduct || typeof window === "undefined") return "";
  return `${window.location.origin}/${getProductSlug(storefrontProduct, productTypes)}`;
}

function CopyProductLinkButton({ label, url }: { label: string; url: string }) {
  const [isCopied, setIsCopied] = useState(false);
  const resetTimeoutRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (resetTimeoutRef.current !== null) window.clearTimeout(resetTimeoutRef.current);
    },
    [],
  );

  const handleCopy = async () => {
    if (!url) return;
    const copied = await copyTextToClipboard(url);
    if (!copied) return;
    setIsCopied(true);
    if (resetTimeoutRef.current !== null) window.clearTimeout(resetTimeoutRef.current);
    resetTimeoutRef.current = window.setTimeout(() => {
      setIsCopied(false);
      resetTimeoutRef.current = null;
    }, COPIED_FEEDBACK_MS);
  };

  return (
    <button
      className={`icon-button product-type-copy-link${isCopied ? " copied" : ""}`}
      type="button"
      disabled={!url}
      title={url ? `Copy link: ${url}` : "Chưa có sản phẩm hiển thị để copy link"}
      aria-label={isCopied ? `Đã copy link ${label}` : `Copy link ${label}`}
      onClick={(event) => {
        event.stopPropagation();
        void handleCopy();
      }}
    >
      {isCopied ? <Check size={15} aria-hidden="true" /> : <Link2 size={15} aria-hidden="true" />}
    </button>
  );
}

function AdminProductTypeList({
  hiddenDraftProductId,
  hiddenDraftProductTypeId,
  isHomeSorting,
  productTypes,
  products,
  onAddProduct,
  onAddProductType,
  onOpenProductType,
  onReorderProductType,
  onReorderProductWithinType,
  onSelectProduct,
}: Pick<
  AdminProductManagerProps,
  | "hiddenDraftProductId"
  | "hiddenDraftProductTypeId"
  | "isHomeSorting"
  | "productTypes"
  | "products"
  | "onAddProduct"
  | "onAddProductType"
  | "onOpenProductType"
  | "onReorderProductType"
  | "onReorderProductWithinType"
> & {
  onSelectProduct: (productId: string) => void;
}) {
  const visibleProductTypes = productTypes.filter((productType) => productType.id !== hiddenDraftProductTypeId);

  return (
    <>
      <section className="admin-panel-heading flat">
        <div>
          <h2>Loại sản phẩm ({visibleProductTypes.length})</h2>
          <p>Tap loại để sửa thông tin loại. Tap sản phẩm để sửa chi tiết.</p>
        </div>
      </section>

      <div className="admin-product-type-sections">
        {visibleProductTypes.map((productType, index) => {
          const typeProducts = products.filter(
            (product) => product.productTypeId === productType.id && product.id !== hiddenDraftProductId,
          );
          return (
            <section className="admin-product-type-section" key={productType.id}>
              <div className="product-type-header">
                <button
                  className="product-type-open-button"
                  type="button"
                  disabled={isHomeSorting}
                  onClick={() => onOpenProductType(productType)}
                >
                  <span>
                    <strong>{productType.name || "Chưa đặt tên"}</strong>
                    <span className="product-type-meta">
                      <em>{formatPrice(productType.price)}</em>
                      <small>{typeProducts.length} sản phẩm</small>
                    </span>
                  </span>
                </button>
                {!isHomeSorting ? (
                  <CopyProductLinkButton
                    label={productType.name || "loại sản phẩm"}
                    url={getStorefrontProductUrl(typeProducts, productTypes)}
                  />
                ) : null}
                {isHomeSorting ? (
                  <div className="reorder-controls" aria-label="Sắp xếp loại sản phẩm">
                    <button
                      className="icon-button"
                      type="button"
                      disabled={index === 0}
                      onClick={() => onReorderProductType(productType.id, -1)}
                      aria-label={`Đưa ${productType.name || "loại sản phẩm"} lên`}
                    >
                      <ArrowUp size={15} aria-hidden="true" />
                    </button>
                    <button
                      className="icon-button"
                      type="button"
                      disabled={index === visibleProductTypes.length - 1}
                      onClick={() => onReorderProductType(productType.id, 1)}
                      aria-label={`Đưa ${productType.name || "loại sản phẩm"} xuống`}
                    >
                      <ArrowDown size={15} aria-hidden="true" />
                    </button>
                  </div>
                ) : null}
              </div>

              {typeProducts.length > 0 ? (
                <div className="admin-product-master-list compact">
                  {typeProducts.map((product, productIndex) => {
                    const coverImage = getProductCoverImage(product, productTypes, products);
                    const coverSrc = coverImage.src.trim();
                    return (
                      <div className="admin-product-master-card compact" key={product.id}>
                        <button type="button" disabled={isHomeSorting} onClick={() => onSelectProduct(product.id)}>
                          {coverSrc ? (
                            <img
                              className="admin-product-master-thumb"
                              src={getSupabaseImageSrc(coverSrc, IMAGE_WIDTHS.adminThumb, 72, IMAGE_WIDTHS.adminThumb, "cover")}
                              alt={coverImage.alt || getProductTitle(product, productTypes)}
                              loading="lazy"
                            />
                          ) : (
                            <span className="admin-product-master-thumb empty">Ảnh</span>
                          )}
                          <span>
                            <strong>{getProductTitle(product, productTypes)}</strong>
                            <em>
                              {formatPrice(getProductPrice(product, productTypes))} · {product.patterns.length} họa tiết
                            </em>
                          </span>
                        </button>
                        {isHomeSorting ? (
                          <div className="reorder-controls" aria-label="Sắp xếp sản phẩm">
                            <button
                              className="icon-button"
                              type="button"
                              disabled={productIndex === 0}
                              onClick={() => onReorderProductWithinType(product.id, -1)}
                              aria-label="Đưa sản phẩm lên"
                            >
                              <ArrowUp size={13} aria-hidden="true" />
                            </button>
                            <button
                              className="icon-button"
                              type="button"
                              disabled={productIndex === typeProducts.length - 1}
                              onClick={() => onReorderProductWithinType(product.id, 1)}
                              aria-label="Đưa sản phẩm xuống"
                            >
                              <ArrowDown size={13} aria-hidden="true" />
                            </button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="admin-type-empty-text">Chưa có sản phẩm trong loại này.</p>
              )}
              {!isHomeSorting ? (
                <button className="admin-button small full-width admin-add-product-button" type="button" onClick={() => onAddProduct(productType.id)}>
                  <Plus size={16} aria-hidden="true" />
                  Thêm sản phẩm
                </button>
              ) : null}
            </section>
          );
        })}
      </div>

      {!isHomeSorting ? (
        <button className="admin-button primary full-width" type="button" onClick={onAddProductType}>
          <Plus size={16} aria-hidden="true" />
          Thêm loại
        </button>
      ) : null}
    </>
  );
}

function AdminProductTypeDetail({
  productType,
  productTypeCount,
  products,
  onPreviewImage,
  onRemoveProductType,
  onUpdateProductType,
  onUploadImage,
}: {
  productType: ProductType;
  productTypeCount: number;
  products: Product[];
  onPreviewImage: (image: GalleryImage) => void;
  onRemoveProductType: (productTypeId: string) => void;
  onUpdateProductType: (productTypeId: string, patch: Partial<ProductType>) => void;
  onUploadImage: (file: File, folder: string, onUploaded: (url: string) => void) => void;
}) {
  return (
    <section className="product-type-detail-panel" aria-label={`Sản phẩm ${productType.name}`}>
      <section className="admin-product-type-section detail-preview">
        <div className="product-type-header">
          <div className="product-type-open-button static">
            <span>
              <strong>{productType.name || "Chưa đặt tên"}</strong>
              <span className="product-type-meta">
                <em>{formatPrice(productType.price)}</em>
                <small>{products.length} sản phẩm</small>
              </span>
            </span>
          </div>
        </div>
      </section>

      <section className="admin-card">
        <div className="product-type-row detail">
          <div className="product-type-image-field product-type-size-field">
            <span>Bảng size</span>
            <AdminImageActionField
              ariaLabel={`Mở tùy chọn bảng size ${productType.name || "loại sản phẩm"}`}
              caption={`Bảng size ${productType.name || "loại sản phẩm"}`}
              image={productType.sizeChartImage}
              onPreview={onPreviewImage}
              onFileSelected={(file) =>
                onUploadImage(file, `product-types/${productType.id}/size-charts`, (url) =>
                  onUpdateProductType(productType.id, {
                    sizeChartImage: {
                      ...productType.sizeChartImage,
                      src: url,
                      alt: productType.sizeChartImage.alt || `Bảng size ${productType.name}`,
                    },
                  }),
                )
              }
            />
          </div>
          <label className="product-type-name-field">
            <span>Loại</span>
            <input value={productType.name} onChange={(event) => onUpdateProductType(productType.id, { name: event.target.value })} />
          </label>
          <label className="product-type-price-field">
            <span>Giá</span>
            <input
              value={productType.price}
              placeholder="Ví dụ: 390.000đ"
              onChange={(event) => onUpdateProductType(productType.id, { price: formatPrice(event.target.value) })}
            />
          </label>
        </div>
        <div className="admin-detail-delete-row">
          <button
            className="admin-button danger"
            type="button"
            disabled={productTypeCount <= 1}
            onClick={() => onRemoveProductType(productType.id)}
          >
            <Trash2 size={16} aria-hidden="true" />
            Xóa loại
          </button>
        </div>
      </section>

    </section>
  );
}

function AdminProductDetail({
  product,
  productTypes,
  onAddModelImages,
  onAddPatterns,
  onPreviewImage,
  onRemoveModelImage,
  onRemovePattern,
  onRemoveProduct,
  onReorderModelImage,
  onSetPatternAsCover,
  onTogglePatternSize,
  onUpdateModelImage,
  onUpdatePattern,
  onUpdateProduct,
  onUploadImage,
  onUploadImages,
}: {
  product: Product;
  productTypes: ProductType[];
  onAddModelImages: (productId: string, urls: string[]) => void;
  onAddPatterns: (productId: string, urls: string[]) => void;
  onPreviewImage: (image: GalleryImage) => void;
  onRemoveModelImage: (productId: string, imageId: string) => void;
  onRemovePattern: (productId: string, patternId: string) => void;
  onRemoveProduct: (product: Product) => void;
  onReorderModelImage: (productId: string, imageId: string, direction: -1 | 1) => void;
  onSetPatternAsCover: (productId: string, patternId: string) => void;
  onTogglePatternSize: (productId: string, pattern: ProductPattern, sizeId: SizeId) => void;
  onUpdateModelImage: (productId: string, imageId: string, patch: Partial<ProductImage>) => void;
  onUpdatePattern: (productId: string, patternId: string, patch: Partial<ProductPattern>) => void;
  onUpdateProduct: (productId: string, patch: Partial<Product>) => void;
  onUploadImage: (file: File, folder: string, onUploaded: (url: string) => void) => void;
  onUploadImages: (files: File[], folder: string, onUploaded: (urls: string[]) => void) => void;
}) {
  return (
    <section className="admin-product-detail-screen" aria-label={`Sửa ${getProductTitle(product, productTypes)}`}>
      <div className="admin-panel-heading">
        <div>
          <h2>{getProductTitle(product, productTypes)}</h2>
          <p>
            {formatPrice(getProductPrice(product, productTypes))} · {product.patterns.length} họa tiết · {product.modelImages.length} ảnh mẫu
          </p>
        </div>
      </div>

      <section className="admin-card">
        <h3>Thông tin</h3>
        <div className="admin-form-grid">
          <label>
            <span>Loại sản phẩm</span>
            <select
              value={product.productTypeId}
              onChange={(event) => {
                const productType = productTypes.find((type) => type.id === event.target.value);
                onUpdateProduct(product.id, {
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
              onChange={(event) => onUpdateProduct(product.id, { name: event.target.value })}
            />
          </label>
          <label>
            <span>Chất liệu</span>
            <input value={product.material} onChange={(event) => onUpdateProduct(product.id, { material: event.target.value })} />
          </label>
          <label className="full-row">
            <span>Mô tả form dáng</span>
            <textarea value={product.fit} onChange={(event) => onUpdateProduct(product.id, { fit: event.target.value })} />
          </label>
        </div>
        <div className="admin-detail-delete-row">
          <button className="admin-button danger" type="button" onClick={() => onRemoveProduct(product)}>
            <Trash2 size={16} aria-hidden="true" />
            Xóa sản phẩm
          </button>
        </div>
      </section>

      <AdminPatternEditor
        product={product}
        onAddPatterns={onAddPatterns}
        onPreviewImage={onPreviewImage}
        onRemovePattern={onRemovePattern}
        onSetPatternAsCover={onSetPatternAsCover}
        onTogglePatternSize={onTogglePatternSize}
        onUpdatePattern={onUpdatePattern}
        onUploadImage={onUploadImage}
        onUploadImages={onUploadImages}
      />

      <AdminModelImageEditor
        product={product}
        onAddModelImages={onAddModelImages}
        onPreviewImage={onPreviewImage}
        onRemoveModelImage={onRemoveModelImage}
        onReorderModelImage={onReorderModelImage}
        onUpdateModelImage={onUpdateModelImage}
        onUploadImage={onUploadImage}
        onUploadImages={onUploadImages}
      />

    </section>
  );
}

function AdminPatternEditor({
  product,
  onAddPatterns,
  onPreviewImage,
  onRemovePattern,
  onSetPatternAsCover,
  onTogglePatternSize,
  onUpdatePattern,
  onUploadImage,
  onUploadImages,
}: {
  product: Product;
  onAddPatterns: (productId: string, urls: string[]) => void;
  onPreviewImage: (image: GalleryImage) => void;
  onRemovePattern: (productId: string, patternId: string) => void;
  onSetPatternAsCover: (productId: string, patternId: string) => void;
  onTogglePatternSize: (productId: string, pattern: ProductPattern, sizeId: SizeId) => void;
  onUpdatePattern: (productId: string, patternId: string, patch: Partial<ProductPattern>) => void;
  onUploadImage: (file: File, folder: string, onUploaded: (url: string) => void) => void;
  onUploadImages: (files: File[], folder: string, onUploaded: (urls: string[]) => void) => void;
}) {
  return (
    <section className="admin-card">
      <h3>Họa tiết &amp; size</h3>
      {product.patterns.length > 0 ? (
        <div className="pattern-row-list">
          {product.patterns.map((pattern, patternIndex) => (
            <article className="pattern-row" key={pattern.id}>
              <AdminImageActionField
                ariaLabel={`Mở tùy chọn ảnh ${pattern.name || "họa tiết"}`}
                caption={pattern.name || "Họa tiết"}
                image={pattern.image}
                onPreview={onPreviewImage}
                onFileSelected={(file) =>
                  onUploadImage(file, `patterns/${product.id}`, (url) =>
                    onUpdatePattern(product.id, pattern.id, {
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
                    onChange={(event) => onUpdatePattern(product.id, pattern.id, { name: event.target.value })}
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
                      onClick={() => onTogglePatternSize(product.id, pattern, size.id)}
                    >
                      {size.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pattern-actions">
                <button
                  className={patternIndex === 0 ? "icon-button active cover-pattern-button" : "icon-button cover-pattern-button"}
                  type="button"
                  aria-label={`${patternIndex === 0 ? "Đang là" : "Đặt làm"} ảnh bìa ${pattern.name || "họa tiết"}`}
                  aria-pressed={patternIndex === 0}
                  onClick={() => onSetPatternAsCover(product.id, pattern.id)}
                  title={patternIndex === 0 ? "Ảnh bìa" : "Đặt làm ảnh bìa"}
                >
                  <Star size={15} aria-hidden="true" fill={patternIndex === 0 ? "currentColor" : "none"} />
                </button>
                <button
                  className="icon-button danger pattern-delete"
                  type="button"
                  aria-label={`Xóa ${pattern.name}`}
                  onClick={() => onRemovePattern(product.id, pattern.id)}
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}
      <label className="admin-button small full-width file-button">
        <Plus size={16} aria-hidden="true" />
        Thêm họa tiết (chọn nhiều ảnh)
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            if (files.length === 0) return;
            onUploadImages(files, `patterns/${product.id}`, (urls) => onAddPatterns(product.id, urls));
            event.target.value = "";
          }}
        />
      </label>
    </section>
  );
}

function AdminModelImageEditor({
  product,
  onAddModelImages,
  onPreviewImage,
  onRemoveModelImage,
  onReorderModelImage,
  onUpdateModelImage,
  onUploadImage,
  onUploadImages,
}: {
  product: Product;
  onAddModelImages: (productId: string, urls: string[]) => void;
  onPreviewImage: (image: GalleryImage) => void;
  onRemoveModelImage: (productId: string, imageId: string) => void;
  onReorderModelImage: (productId: string, imageId: string, direction: -1 | 1) => void;
  onUpdateModelImage: (productId: string, imageId: string, patch: Partial<ProductImage>) => void;
  onUploadImage: (file: File, folder: string, onUploaded: (url: string) => void) => void;
  onUploadImages: (files: File[], folder: string, onUploaded: (urls: string[]) => void) => void;
}) {
  return (
    <section className="admin-card">
      <h3>Ảnh mẫu &amp; chi tiết</h3>
      {product.modelImages.length > 0 ? (
        <div className="admin-image-wrap">
          {product.modelImages.map((image, imageIndex) => (
            <div className="admin-image-wrap-item" key={image.id}>
              <AdminImageActionField
                ariaLabel="Mở tùy chọn ảnh mẫu & chi tiết sản phẩm"
                caption="Ảnh mẫu & chi tiết sản phẩm"
                image={image}
                onPreview={onPreviewImage}
                onFileSelected={(file) =>
                  onUploadImage(file, `models/${product.id}`, (url) => onUpdateModelImage(product.id, image.id, { src: url }))
                }
              />
              <div className="model-image-actions" aria-label="Sắp xếp ảnh mẫu & chi tiết sản phẩm">
                <button
                  className="icon-button"
                  type="button"
                  disabled={imageIndex === 0}
                  onClick={() => onReorderModelImage(product.id, image.id, -1)}
                  aria-label="Đưa ảnh lên trước"
                >
                  <ArrowUp size={13} aria-hidden="true" />
                </button>
                <button
                  className="icon-button"
                  type="button"
                  disabled={imageIndex === product.modelImages.length - 1}
                  onClick={() => onReorderModelImage(product.id, image.id, 1)}
                  aria-label="Đưa ảnh xuống sau"
                >
                  <ArrowDown size={13} aria-hidden="true" />
                </button>
                <button
                  className="icon-button danger model-delete"
                  type="button"
                  onClick={() => onRemoveModelImage(product.id, image.id)}
                  aria-label="Xóa ảnh mẫu & chi tiết sản phẩm"
                >
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
      <label className="admin-button small full-width file-button">
        <Plus size={16} aria-hidden="true" />
        Thêm ảnh mẫu & chi tiết
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            if (files.length === 0) return;
            onUploadImages(files, `models/${product.id}`, (urls) => onAddModelImages(product.id, urls));
            event.target.value = "";
          }}
        />
      </label>
    </section>
  );
}
