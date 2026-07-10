import { Instagram, Minus, Plus, Save, ShoppingBag, X } from "lucide-react";
import { MessengerIcon } from "../../../shared/icons/SocialIcons";
import { getSupabaseImageSrc } from "../../../shared/utils/image";
import { formatMoney } from "../../../shared/utils/money";
import type { ShareChannel } from "../storefrontTypes";
import { IMAGE_WIDTHS } from "../storefrontConstants";
import { formatSelectedSize } from "./cartUtils";
import type { CartItem } from "./cartTypes";

export function OrderImagePreview({
  imageUrl,
  onClose,
  onShare,
}: {
  imageUrl: string;
  onClose: () => void;
  onShare: () => void;
}) {
  return (
    <div className="order-preview-backdrop" role="dialog" aria-modal="true" aria-label="Ảnh đơn hàng" onClick={onClose}>
      <section className="order-preview-panel" onClick={(event) => event.stopPropagation()}>
        <button className="order-preview-close" type="button" aria-label="Đóng ảnh đơn hàng" onClick={onClose}>
          <X size={20} aria-hidden="true" />
        </button>
        <div>
          <span>Ảnh đơn hàng</span>
          <p>Kiểm tra ảnh đơn hàng, sau đó bấm lưu ảnh để lưu vào Ảnh. Nếu không hiện, nhấn giữ ảnh bên dưới để lưu.</p>
        </div>
        <button className="order-preview-share" type="button" onClick={onShare}>
          <Save size={17} aria-hidden="true" />
          Lưu ảnh
        </button>
        <img src={imageUrl} alt="Ảnh đơn hàng KNG.studio" />
      </section>
    </div>
  );
}

type CartOverlayProps = {
  cartItems: CartItem[];
  cartTotal: number;
  isClosing: boolean;
  isOpen: boolean;
  orderTotal: number;
  isOrderImagePreparing: boolean;
  onClose: () => void;
  onCapture: () => void;
  onOpenMessage: (channel: ShareChannel) => void;
  onOpenPolicy: () => void;
  onClear: () => void;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onRemove: (itemId: string) => void;
  shippingFee: number;
};

export function CartOverlay({
  cartItems,
  cartTotal,
  isClosing,
  isOpen,
  orderTotal,
  isOrderImagePreparing,
  onClose,
  onCapture,
  onOpenMessage,
  onOpenPolicy,
  onClear,
  onQuantityChange,
  onRemove,
  shippingFee,
}: CartOverlayProps) {
  if (!isOpen) return null;

  return (
    <div
      className={isClosing ? "cart-backdrop closing" : "cart-backdrop"}
      role="dialog"
      aria-modal="true"
      aria-label="Giỏ hàng"
      onClick={onClose}
    >
      <aside className={isClosing ? "cart-panel closing" : "cart-panel"} onClick={(event) => event.stopPropagation()}>
        <header className="cart-header">
          <div>
            <span>Giỏ hàng</span>
            <h2>{cartItems.length > 0 ? `${cartItems.length} mẫu đã chọn` : "Chưa có sản phẩm"}</h2>
          </div>
          <div className="cart-header-actions">
            {cartItems.length > 0 ? (
              <button className="cart-clear-button" type="button" onClick={onClear}>
                Xoá tất cả
              </button>
            ) : null}
            <button className="cart-close-button" type="button" aria-label="Đóng giỏ hàng" onClick={onClose}>
              <X size={21} aria-hidden="true" />
            </button>
          </div>
        </header>

        {cartItems.length > 0 ? (
          <div className="cart-scroll">
            <div className="cart-list">
              {cartItems.map((item) => (
                <article className="cart-row" key={item.id}>
                  <img
                    src={getSupabaseImageSrc(item.image.src, IMAGE_WIDTHS.cartThumb, 74)}
                    alt={item.image.alt}
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="cart-row-info">
                    <h3>{item.productName}</h3>
                    <p>{item.patternName} · {formatSelectedSize(item.sizeId)}</p>
                    <strong>{item.price}</strong>
                    <div className="cart-row-actions">
                      <div className="cart-quantity" aria-label={`Số lượng ${item.patternName}`}>
                        <button type="button" onClick={() => onQuantityChange(item.id, item.quantity - 1)} aria-label="Giảm số lượng">
                          <Minus size={14} aria-hidden="true" />
                        </button>
                        <span>{item.quantity}</span>
                        <button type="button" onClick={() => onQuantityChange(item.id, item.quantity + 1)} aria-label="Tăng số lượng">
                          <Plus size={14} aria-hidden="true" />
                        </button>
                      </div>
                      <button className="cart-remove" type="button" onClick={() => onRemove(item.id)}>
                        Xoá
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <footer className="cart-footer">
              <div className="cart-summary-row">
                <span>Tổng tạm tính</span>
                <strong>{formatMoney(cartTotal)}</strong>
              </div>
              <div className="cart-summary-row">
                <span>Phí ship</span>
                <strong className="shipping-fee">
                  {shippingFee === 0 ? <del>20.000đ</del> : null}
                  {formatMoney(shippingFee)}
                </strong>
              </div>
              <div className="cart-total">
                <span>Tổng thanh toán</span>
                <strong>{formatMoney(orderTotal)}</strong>
              </div>
              <section className="cart-policy-cta" aria-label="Quy định mua hàng">
                <div>
                  <span>Quy định mua hàng</span>
                  <p>Xem quà tặng, phí ship, thanh toán, đổi hàng và bảo quản trước khi chốt đơn.</p>
                </div>
                <button type="button" onClick={onOpenPolicy}>
                  Xem chi tiết
                </button>
              </section>
              <div className="checkout-flow">
                <h3>Quy trình chốt đơn</h3>
                <div className="checkout-step">
                  <span>Bước 1</span>
                  <p>Lưu ảnh đơn hàng về máy.</p>
                  <button
                    className="cart-capture-button"
                    type="button"
                    disabled={isOrderImagePreparing}
                    onClick={onCapture}
                  >
                    {isOrderImagePreparing ? "Đang chuẩn bị ảnh" : "Xem ảnh đơn hàng"}
                  </button>
                </div>
                <div className="checkout-step">
                  <span>Bước 2</span>
                  <p>Gửi ảnh cho shop để xác nhận và thanh toán.</p>
                  <div className="cart-share-actions">
                    <button type="button" onClick={() => onOpenMessage("instagram")}>
                      <Instagram size={18} aria-hidden="true" />
                      Gửi Instagram
                    </button>
                    <button type="button" onClick={() => onOpenMessage("messenger")}>
                      <MessengerIcon />
                      Gửi Messenger
                    </button>
                  </div>
                </div>
              </div>
            </footer>
          </div>
        ) : (
          <section className="cart-empty">
            <ShoppingBag size={34} aria-hidden="true" />
            <h3>Chưa có mẫu nào trong giỏ</h3>
            <p>Chọn hoạ tiết đang còn size rồi bấm dấu cộng để thêm vào giỏ.</p>
          </section>
        )}
      </aside>
    </div>
  );
}
