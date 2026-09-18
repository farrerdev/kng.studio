import { useState } from "react";
import { ChevronDown, Info, Instagram, Minus, Plus, Save, ShoppingBag, X } from "lucide-react";
import { sizeOptions } from "../../../data/mockCatalog";
import { MessengerIcon } from "../../../shared/icons/SocialIcons";
import { getSupabaseImageSrc } from "../../../shared/utils/image";
import { formatMoney } from "../../../shared/utils/money";
import type { Product, SizeId } from "../../../types/catalog";
import type { GalleryImage, ShareChannel } from "../storefrontTypes";
import { IMAGE_WIDTHS } from "../storefrontConstants";
import { formatSelectedSize } from "./cartUtils";
import type { CartItem } from "./cartTypes";

function formatCartSize(sizeId: SizeId) {
  const size = sizeOptions.find((option) => option.id === sizeId);
  if (!size) return formatSelectedSize(sizeId);
  return `${size.label} (${size.range.replace(/\s*-\s*/g, "-")})`;
}

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
  multiSetDiscount: number;
  orderTotal: number;
  isOrderImagePreparing: boolean;
  onClose: () => void;
  onCapture: () => void;
  onOpenMessage: (channel: ShareChannel) => void;
  onClear: () => void;
  onImageOpen: (image: GalleryImage) => void;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onRemove: (itemId: string) => void;
  onSelectionChange: (itemId: string, patternId: string, sizeId: SizeId) => void;
  products: Product[];
  shippingFee: number;
  unavailableItemIds: ReadonlySet<string>;
};

type CartSelectionDraft = {
  itemId: string;
  patternId: string | null;
  sizeId: SizeId;
};

export function CartOverlay({
  cartItems,
  cartTotal,
  isClosing,
  isOpen,
  multiSetDiscount,
  orderTotal,
  isOrderImagePreparing,
  onClose,
  onCapture,
  onOpenMessage,
  onClear,
  onImageOpen,
  onQuantityChange,
  onRemove,
  onSelectionChange,
  products,
  shippingFee,
  unavailableItemIds,
}: CartOverlayProps) {
  const [isShippingTipOpen, setIsShippingTipOpen] = useState(false);
  const [isDiscountTipOpen, setIsDiscountTipOpen] = useState(false);
  const [selectionDraft, setSelectionDraft] = useState<CartSelectionDraft | null>(null);
  const [sizeLockMessage, setSizeLockMessage] = useState("");
  if (!isOpen) return null;
  const unavailableItemCount = cartItems.filter((item) => unavailableItemIds.has(item.id)).length;
  const cartQuantity = cartItems.reduce(
    (total, item) => total + (unavailableItemIds.has(item.id) ? 0 : item.quantity),
    0,
  );
  const editingItem = selectionDraft
    ? cartItems.find((item) => item.id === selectionDraft.itemId) ?? null
    : null;
  const editingProduct = editingItem
    ? products.find((product) => product.id === editingItem.productId) ?? null
    : null;
  const editingPattern = selectionDraft
    ? editingProduct?.patterns.find((pattern) => pattern.id === selectionDraft.patternId) ?? null
    : null;
  const canConfirmSelection = Boolean(
    selectionDraft && editingPattern?.availableSizes.includes(selectionDraft.sizeId),
  );
  const availablePatternsForSize = selectionDraft
    ? editingProduct?.patterns.filter((pattern) => pattern.availableSizes.includes(selectionDraft.sizeId)) ?? []
    : [];
  const closeShippingTip = () => {
    if (isShippingTipOpen) {
      setIsShippingTipOpen(false);
    }
  };
  const closeDiscountTip = () => {
    if (isDiscountTipOpen) {
      setIsDiscountTipOpen(false);
    }
  };
  const closeSummaryTips = () => {
    closeShippingTip();
    closeDiscountTip();
  };
  const openSelectionSheet = (item: CartItem) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    const currentPattern = product?.patterns.find((pattern) => pattern.id === item.patternId);
    setSizeLockMessage("");
    setSelectionDraft({
      itemId: item.id,
      patternId: currentPattern?.availableSizes.includes(item.sizeId) ? currentPattern.id : null,
      sizeId: item.sizeId,
    });
  };

  return (
    <div
      className={isClosing ? "cart-backdrop closing" : "cart-backdrop"}
      role="dialog"
      aria-modal="true"
      aria-label="Giỏ hàng"
      onClick={() => {
        closeSummaryTips();
        setSelectionDraft(null);
        onClose();
      }}
    >
      <aside
        className={isClosing ? "cart-panel closing" : "cart-panel"}
        onClick={(event) => {
          event.stopPropagation();
          closeSummaryTips();
        }}
      >
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
            <button
              className="cart-close-button"
              type="button"
              aria-label="Đóng giỏ hàng"
              onClick={() => {
                setSelectionDraft(null);
                onClose();
              }}
            >
              <X size={21} aria-hidden="true" />
            </button>
          </div>
        </header>

        {cartItems.length > 0 ? (
          <div className="cart-scroll">
            <div className="cart-list">
              {cartItems.map((item) => {
                const isUnavailable = unavailableItemIds.has(item.id);
                return (
                  <article className={isUnavailable ? "cart-row unavailable" : "cart-row"} key={item.id}>
                    <button
                      className="cart-image-button"
                      type="button"
                      aria-label={`Xem ảnh lớn ${item.patternName}`}
                      onClick={() =>
                        onImageOpen({
                          ...item.image,
                          caption: `${item.productName} - ${item.patternName} · ${formatCartSize(item.sizeId)}`,
                        })
                      }
                    >
                      <img
                        src={getSupabaseImageSrc(item.image.src, IMAGE_WIDTHS.cartThumb, 74)}
                        alt={item.image.alt}
                        loading="lazy"
                        decoding="async"
                      />
                    </button>
                    <div className="cart-row-info">
                      <h3>{item.productName}</h3>
                      <button
                        className="cart-variant-trigger"
                        type="button"
                        aria-label={`Đổi họa tiết và size của ${item.productName}`}
                        onClick={() => openSelectionSheet(item)}
                      >
                        <span>{item.patternName} · {formatCartSize(item.sizeId)}</span>
                        <ChevronDown size={15} aria-hidden="true" />
                      </button>
                      {isUnavailable ? <span className="cart-stock-status">Hết hàng · Không tính vào thanh toán</span> : null}
                      <strong className={isUnavailable ? "cart-item-price unavailable" : "cart-item-price"}>
                        {isUnavailable ? <del>{item.price}</del> : item.price}
                      </strong>
                      <div className="cart-row-actions">
                        <div className="cart-quantity" aria-label={`Số lượng ${item.patternName}`}>
                          <button type="button" onClick={() => onQuantityChange(item.id, item.quantity - 1)} aria-label="Giảm số lượng">
                            <Minus size={14} aria-hidden="true" />
                          </button>
                          <span>{item.quantity}</span>
                          <button
                            type="button"
                            disabled={isUnavailable}
                            onClick={() => onQuantityChange(item.id, item.quantity + 1)}
                            aria-label={isUnavailable ? "Sản phẩm đã hết hàng" : "Tăng số lượng"}
                          >
                            <Plus size={14} aria-hidden="true" />
                          </button>
                        </div>
                        <button className="cart-remove" type="button" onClick={() => onRemove(item.id)}>
                          Xoá
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
              {cartQuantity > 0 ? (
                <div className="cart-gift-row">
                  <p>
                    <span>[Quà tặng]</span> Dây buộc tóc scrunchies cùng hoạ tiết{" "}
                    <strong aria-label={`${cartQuantity} quà tặng`}>x{cartQuantity}</strong>
                  </p>
                </div>
              ) : null}
            </div>

            <footer className="cart-footer">
              {unavailableItemCount > 0 ? (
                <p className="cart-unavailable-note">
                  {unavailableItemCount} mẫu đã hết hàng và không được tính vào thanh toán.
                </p>
              ) : null}
              <div className="cart-summary-row">
                <span>Tổng tạm tính</span>
                <strong>{formatMoney(cartTotal)}</strong>
              </div>
              <div className="cart-summary-row">
                <span className="cart-shipping-label">
                  Phí vận chuyển
                  <span className="cart-summary-info">
                    <button
                      type="button"
                      aria-label="Thông tin miễn phí vận chuyển"
                      aria-expanded={isShippingTipOpen}
                      onClick={(event) => {
                        event.stopPropagation();
                        closeDiscountTip();
                        setIsShippingTipOpen((current) => !current);
                      }}
                    >
                      <Info size={13} aria-hidden="true" />
                    </button>
                    {isShippingTipOpen ? (
                      <small role="tooltip">Miễn phí vận chuyển từ 2 bộ</small>
                    ) : null}
                  </span>
                </span>
                <strong className="shipping-fee">
                  {shippingFee === 0 ? <del>20.000đ</del> : null}
                  {formatMoney(shippingFee)}
                </strong>
              </div>
              {cartQuantity === 1 ? (
                <p className="cart-freeship-note">Thêm ít nhất 1 sản phẩm để được miễn phí vận chuyển</p>
              ) : null}
              <div className="cart-summary-row">
                <span className="cart-shipping-label">
                  Giảm giá
                  <span className="cart-summary-info">
                    <button
                      type="button"
                      aria-label="Thông tin giảm giá khi mua nhiều bộ"
                      aria-expanded={isDiscountTipOpen}
                      onClick={(event) => {
                        event.stopPropagation();
                        closeShippingTip();
                        setIsDiscountTipOpen((current) => !current);
                      }}
                    >
                      <Info size={13} aria-hidden="true" />
                    </button>
                    {isDiscountTipOpen ? (
                      <small role="tooltip">Giảm 10.000đ cho mỗi bộ từ bộ thứ 3</small>
                    ) : null}
                  </span>
                </span>
                <strong className={multiSetDiscount > 0 ? "cart-discount active" : "cart-discount"}>
                  {multiSetDiscount > 0 ? `-${formatMoney(multiSetDiscount)}` : formatMoney(0)}
                </strong>
              </div>
              <div className="cart-total">
                <span>Tổng thanh toán</span>
                <strong>{formatMoney(orderTotal)}</strong>
              </div>
              <div className="checkout-flow">
                <h3>Quy trình chốt đơn</h3>
                <div className="checkout-step">
                  <span>Bước 1</span>
                  <p>Lưu ảnh đơn hàng về máy.</p>
                  <button
                    className="cart-capture-button"
                    type="button"
                    disabled={isOrderImagePreparing || cartQuantity === 0}
                    onClick={onCapture}
                  >
                    {isOrderImagePreparing
                      ? "Đang chuẩn bị ảnh"
                      : cartQuantity === 0
                        ? "Không có sản phẩm còn hàng"
                        : "Xem ảnh đơn hàng"}
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

      {selectionDraft && editingItem ? (
        <div
          className="cart-variant-backdrop"
          onClick={(event) => {
            event.stopPropagation();
            setSelectionDraft(null);
          }}
        >
          <section
            className="cart-variant-sheet"
            role="dialog"
            aria-label={`Chọn họa tiết và size cho ${editingItem.productName}`}
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="cart-variant-sheet-close"
              type="button"
              aria-label="Đóng chọn phân loại"
              onClick={() => setSelectionDraft(null)}
            >
              <X size={20} aria-hidden="true" />
            </button>

            <div className="cart-variant-summary">
              <button
                className="cart-variant-preview"
                type="button"
                aria-label={`Xem ảnh lớn ${editingPattern?.name || editingItem.patternName}`}
                onClick={() =>
                  onImageOpen({
                    ...(editingPattern?.image ?? editingItem.image),
                    caption: `${editingItem.productName} - ${editingPattern?.name || editingItem.patternName} · ${formatCartSize(selectionDraft.sizeId)}`,
                  })
                }
              >
                <img
                  src={getSupabaseImageSrc(
                    (editingPattern?.image ?? editingItem.image).src,
                    IMAGE_WIDTHS.catalog,
                    80,
                  )}
                  alt={(editingPattern?.image ?? editingItem.image).alt}
                />
              </button>
              <div>
                <h3>{editingItem.productName}</h3>
                <strong>{editingItem.price}</strong>
                <p>{editingPattern?.name || "Chưa chọn họa tiết"} · {formatCartSize(selectionDraft.sizeId)}</p>
              </div>
            </div>

            <div className="cart-variant-sheet-scroll">
              <section className="cart-variant-section" aria-label="Chọn size">
                <h4>Size</h4>
                <div className="cart-size-options">
                  {sizeOptions.map((size) => {
                    const isSelected = size.id === selectionDraft.sizeId;
                    const hasAvailablePattern = editingProduct?.patterns.some((pattern) =>
                      pattern.availableSizes.includes(size.id),
                    ) ?? false;
                    const isLockedByPattern = Boolean(
                      editingPattern
                      && hasAvailablePattern
                      && !editingPattern.availableSizes.includes(size.id),
                    );
                    return (
                      <button
                        className={isSelected
                          ? "cart-size-option selected"
                          : isLockedByPattern
                            ? "cart-size-option locked"
                            : "cart-size-option"}
                        type="button"
                        disabled={!hasAvailablePattern}
                        aria-disabled={!hasAvailablePattern || isLockedByPattern}
                        aria-pressed={isSelected}
                        key={size.id}
                        onClick={() => {
                          if (isLockedByPattern) {
                            setSizeLockMessage(
                              `Bỏ chọn họa tiết “${editingPattern?.name || "đang chọn"}” trước để chọn ${size.label}.`,
                            );
                            return;
                          }
                          setSizeLockMessage("");
                          setSelectionDraft({ ...selectionDraft, sizeId: size.id });
                        }}
                      >
                        <span>{formatCartSize(size.id)}</span>
                      </button>
                    );
                  })}
                </div>
                {sizeLockMessage ? (
                  <p className="cart-size-lock-tip" role="status">
                    <Info size={14} aria-hidden="true" />
                    {sizeLockMessage}
                  </p>
                ) : null}
              </section>

              <section className="cart-variant-section" aria-label="Chọn họa tiết">
                <h4>Họa tiết còn {formatSelectedSize(selectionDraft.sizeId)}</h4>
                {availablePatternsForSize.length > 0 ? (
                  <div className="cart-pattern-options">
                    {availablePatternsForSize.map((pattern) => {
                      const isSelected = pattern.id === selectionDraft.patternId;
                      return (
                        <button
                          className={isSelected ? "cart-pattern-option selected" : "cart-pattern-option"}
                          type="button"
                          aria-pressed={isSelected}
                          key={pattern.id}
                          onClick={() => {
                            setSizeLockMessage("");
                            setSelectionDraft({
                              ...selectionDraft,
                              patternId: isSelected ? null : pattern.id,
                            });
                          }}
                        >
                          <img
                            src={getSupabaseImageSrc(pattern.image.src, IMAGE_WIDTHS.cartThumb, 72)}
                            alt={pattern.image.alt}
                            loading="lazy"
                            decoding="async"
                          />
                          <span>{pattern.name || "Họa tiết"}</span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="cart-variant-empty">Size này hiện chưa có họa tiết còn hàng.</p>
                )}
              </section>
            </div>

            <div className="cart-variant-sheet-footer">
              <button
                type="button"
                disabled={!canConfirmSelection}
                onClick={() => {
                  if (!selectionDraft.patternId) return;
                  onSelectionChange(
                    editingItem.id,
                    selectionDraft.patternId,
                    selectionDraft.sizeId,
                  );
                  setSelectionDraft(null);
                }}
              >
                Xác nhận
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
