import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, ImageDown, Minus, Plus, Trash2 } from "lucide-react";
import { sizeOptions } from "../../../data/mockCatalog";
import { copyTextToClipboard } from "../../../shared/utils/clipboard";
import { getSupabaseImageSrc } from "../../../shared/utils/image";
import { formatMoney, formatPrice } from "../../../shared/utils/money";
import type { Product, ProductPattern, ProductType, SizeId } from "../../../types/catalog";
import { getProductPrice, getProductTitle } from "../../catalog/catalogUtils";
import { OrderImagePreview } from "../../storefront/cart/CartOverlay";
import type { CartItem } from "../../storefront/cart/cartTypes";
import {
  createCartItemId,
  formatSelectedSize,
  getCartQuantity,
  getCartTotal,
  getMultiSetDiscount,
  getOrderTotal,
  getShippingFee,
} from "../../storefront/cart/cartUtils";
import { createOrderFileName, createOrderImageBlob } from "../../storefront/cart/orderImage";
import { IMAGE_WIDTHS } from "../../storefront/storefrontConstants";
import { createOrderConfirmationMessage } from "../orderConfirmationMessage";

type AdminOrderCreatorProps = {
  orderItems: CartItem[];
  onOrderItemsChange: (updater: (items: CartItem[]) => CartItem[]) => void;
  products: Product[];
  productTypes: ProductType[];
};

type OrderImageState = {
  blob: Blob;
  fileName: string;
  url: string;
};

async function saveOrderImageFile(file: File) {
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }

  const objectUrl = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = file.name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export function AdminOrderCreator({ orderItems, onOrderItemsChange, products, productTypes }: AdminOrderCreatorProps) {
  const [selectedSizeId, setSelectedSizeId] = useState<SizeId>("1");
  const [selectedProductId, setSelectedProductId] = useState<string>(() => products[0]?.id ?? "");
  const [orderImage, setOrderImage] = useState<OrderImageState | null>(null);
  const [isOrderImagePreparing, setIsOrderImagePreparing] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const messageRef = useRef<HTMLTextAreaElement>(null);

  const productGroups = useMemo(
    () =>
      productTypes
        .map((productType) => ({
          productType,
          products: products.filter((product) => product.productTypeId === productType.id && product.patterns.length > 0),
        }))
        .filter((group) => group.products.length > 0),
    [productTypes, products],
  );
  const selectedProduct = products.find((product) => product.id === selectedProductId) ?? productGroups[0]?.products[0] ?? null;
  const selectedPatterns = selectedProduct?.patterns.filter((pattern) => pattern.availableSizes.includes(selectedSizeId)) ?? [];

  const orderQuantity = getCartQuantity(orderItems);
  const shippingFee = getShippingFee(orderItems);
  const multiSetDiscount = getMultiSetDiscount(orderItems);
  const orderMessage = createOrderConfirmationMessage(orderItems);

  useEffect(() => {
    setCopyState("idle");
  }, [orderMessage]);

  useEffect(
    () => () => {
      if (orderImage) URL.revokeObjectURL(orderImage.url);
    },
    [orderImage],
  );

  const addPattern = (product: Product, pattern: ProductPattern) => {
    const itemId = createCartItemId(product.id, pattern.id, selectedSizeId);
    onOrderItemsChange((items) => {
      if (items.some((item) => item.id === itemId)) {
        return items.map((item) => (item.id === itemId ? { ...item, quantity: item.quantity + 1 } : item));
      }
      return [
        ...items,
        {
          id: itemId,
          productId: product.id,
          patternId: pattern.id,
          sizeId: selectedSizeId,
          quantity: 1,
          productName: getProductTitle(product, productTypes),
          patternName: pattern.name,
          price: formatPrice(getProductPrice(product, productTypes)),
          image: pattern.image,
        },
      ];
    });
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    onOrderItemsChange((items) =>
      quantity <= 0
        ? items.filter((item) => item.id !== itemId)
        : items.map((item) => (item.id === itemId ? { ...item, quantity } : item)),
    );
  };

  const clearOrder = () => {
    if (orderItems.length > 0 && !window.confirm("Xoá toàn bộ đơn đang tạo?")) return;
    onOrderItemsChange(() => []);
  };

  const createOrderImage = async () => {
    if (orderItems.length === 0) return;
    setIsOrderImagePreparing(true);
    try {
      const createdAt = new Date();
      const blob = await createOrderImageBlob(orderItems, createdAt);
      if (!blob) return;
      setOrderImage({ blob, fileName: createOrderFileName(createdAt), url: URL.createObjectURL(blob) });
    } finally {
      setIsOrderImagePreparing(false);
    }
  };

  const copyOrderMessage = async () => {
    const copied = await copyTextToClipboard(orderMessage);
    setCopyState(copied ? "copied" : "failed");
    if (!copied) messageRef.current?.select();
  };

  return (
    <section className="admin-order">
      <div className="admin-card admin-order-picker">
        <h3>Chọn mẫu</h3>
        <div className="admin-order-sizes" role="group" aria-label="Chọn size">
          {sizeOptions.map((size) => (
            <button
              key={size.id}
              className={`admin-button ${selectedSizeId === size.id ? "primary" : "ghost"}`}
              type="button"
              aria-pressed={selectedSizeId === size.id}
              onClick={() => setSelectedSizeId(size.id)}
            >
              {size.label}
              <small>{size.range}</small>
            </button>
          ))}
        </div>
        <label className="admin-order-product-select">
          <span>Sản phẩm</span>
          <select value={selectedProduct?.id ?? ""} onChange={(event) => setSelectedProductId(event.target.value)}>
            {productGroups.map(({ productType, products: groupProducts }) => (
              <optgroup key={productType.id} label={productType.name || "Loại sản phẩm"}>
                {groupProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {getProductTitle(product, productTypes)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        {selectedProduct && selectedPatterns.length > 0 ? (
          <div className="admin-order-patterns">
            {selectedPatterns.map((pattern) => {
              const quantity =
                orderItems.find((item) => item.id === createCartItemId(selectedProduct.id, pattern.id, selectedSizeId))?.quantity ?? 0;
              return (
                <button
                  key={pattern.id}
                  className={`admin-order-pattern ${quantity > 0 ? "selected" : ""}`}
                  type="button"
                  onClick={() => addPattern(selectedProduct, pattern)}
                  aria-label={`Thêm ${pattern.name} ${formatSelectedSize(selectedSizeId)}`}
                >
                  <img
                    src={getSupabaseImageSrc(pattern.image.src, IMAGE_WIDTHS.adminThumb, 72)}
                    alt={pattern.image.alt}
                    loading="lazy"
                    decoding="async"
                  />
                  <span>{pattern.name}</span>
                  {quantity > 0 ? <strong>x{quantity}</strong> : null}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="admin-order-empty">Sản phẩm này chưa có hoạ tiết còn {formatSelectedSize(selectedSizeId)}.</p>
        )}
      </div>

      <div className="admin-card admin-order-summary">
        <div className="admin-order-summary-header">
          <h3>Đơn hàng · {orderQuantity} bộ</h3>
          {orderItems.length > 0 ? (
            <button className="admin-button small danger" type="button" onClick={clearOrder}>
              <Trash2 size={15} aria-hidden="true" />
              Xoá đơn
            </button>
          ) : null}
        </div>
        {orderItems.length === 0 ? (
          <p className="admin-order-empty">Bấm vào hoạ tiết bên trên để thêm vào đơn.</p>
        ) : (
          <>
            <ul className="admin-order-items">
              {orderItems.map((item) => (
                <li key={item.id}>
                  <img src={getSupabaseImageSrc(item.image.src, IMAGE_WIDTHS.adminThumb, 72)} alt={item.image.alt} decoding="async" />
                  <div>
                    <strong>{item.productName}</strong>
                    <span>
                      {item.patternName} · {formatSelectedSize(item.sizeId)}
                    </span>
                    <span>{item.price}</span>
                  </div>
                  <div className="admin-order-quantity">
                    <button
                      className="icon-button"
                      type="button"
                      aria-label="Giảm số lượng"
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    >
                      <Minus size={15} aria-hidden="true" />
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      className="icon-button"
                      type="button"
                      aria-label="Tăng số lượng"
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    >
                      <Plus size={15} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <dl className="admin-order-totals">
              <div>
                <dt>Tạm tính</dt>
                <dd>{formatMoney(getCartTotal(orderItems))}</dd>
              </div>
              <div>
                <dt>Phí vận chuyển</dt>
                <dd>{formatMoney(shippingFee)}</dd>
              </div>
              <div>
                <dt>Giảm giá</dt>
                <dd>{multiSetDiscount > 0 ? `-${formatMoney(multiSetDiscount)}` : formatMoney(0)}</dd>
              </div>
              <div className="total">
                <dt>Tổng</dt>
                <dd>{formatMoney(getOrderTotal(orderItems))}</dd>
              </div>
            </dl>
            <button className="admin-button primary" type="button" disabled={isOrderImagePreparing} onClick={createOrderImage}>
              <ImageDown size={17} aria-hidden="true" />
              {isOrderImagePreparing ? "Đang tạo ảnh..." : "Tạo ảnh đơn"}
            </button>
          </>
        )}
      </div>

      {orderMessage ? (
        <div className="admin-card admin-order-message">
          <h3>Tin nhắn gửi khách</h3>
          <textarea ref={messageRef} value={orderMessage} readOnly rows={7} onFocus={(event) => event.currentTarget.select()} />
          <button className="admin-button primary" type="button" onClick={copyOrderMessage}>
            {copyState === "copied" ? <Check size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />}
            {copyState === "copied" ? "Đã copy" : "Copy tin nhắn"}
          </button>
          {copyState === "failed" ? (
            <p className="admin-order-empty" role="status">
              Không copy tự động được, tin nhắn đã được bôi đen, hãy copy thủ công.
            </p>
          ) : null}
        </div>
      ) : null}

      {orderImage ? (
        <OrderImagePreview
          imageUrl={orderImage.url}
          onClose={() => setOrderImage(null)}
          onShare={() => void saveOrderImageFile(new File([orderImage.blob], orderImage.fileName, { type: "image/png" }))}
        />
      ) : null}
    </section>
  );
}
