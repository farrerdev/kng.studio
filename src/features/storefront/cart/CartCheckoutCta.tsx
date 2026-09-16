import { ShoppingBag } from "lucide-react";

type CartCheckoutCtaProps = {
  availableQuantity: number;
  cartQuantity: number;
  onClick: () => void;
  compact?: boolean;
};

export function CartCheckoutCta({ availableQuantity, cartQuantity, onClick, compact = false }: CartCheckoutCtaProps) {
  if (cartQuantity <= 0) {
    return null;
  }

  const unavailableQuantity = cartQuantity - availableQuantity;

  return (
    <section className={compact ? "cart-checkout-cta compact" : "cart-checkout-cta"} aria-label="Đi tới giỏ hàng">
      <div>
        <span>
          {availableQuantity > 0 ? `${availableQuantity} sản phẩm còn hàng` : `${unavailableQuantity} sản phẩm đã hết hàng`}
          {availableQuantity > 0 && unavailableQuantity > 0 ? ` · ${unavailableQuantity} đã hết hàng` : ""}
        </span>
      </div>
      <button type="button" onClick={onClick}>
        <ShoppingBag size={18} aria-hidden="true" />
        {availableQuantity > 0 ? "Chốt đơn ngay" : "Kiểm tra giỏ hàng"}
      </button>
    </section>
  );
}
