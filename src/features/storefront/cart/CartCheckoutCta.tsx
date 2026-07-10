import { ShoppingBag } from "lucide-react";

type CartCheckoutCtaProps = {
  cartQuantity: number;
  onClick: () => void;
  compact?: boolean;
};

export function CartCheckoutCta({ cartQuantity, onClick, compact = false }: CartCheckoutCtaProps) {
  if (cartQuantity <= 0) {
    return null;
  }

  return (
    <section className={compact ? "cart-checkout-cta compact" : "cart-checkout-cta"} aria-label="Đi tới giỏ hàng">
      <div>
        <span>{cartQuantity} sản phẩm trong giỏ hàng</span>
      </div>
      <button type="button" onClick={onClick}>
        <ShoppingBag size={18} aria-hidden="true" />
        Chốt đơn ngay
      </button>
    </section>
  );
}
