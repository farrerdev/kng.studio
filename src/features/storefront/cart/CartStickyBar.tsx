import { ShoppingBag } from "lucide-react";
import { formatMoney } from "../../../shared/utils/money";

type CartStickyBarProps = {
  availableQuantity: number;
  cartQuantity: number;
  orderTotal: number;
  onOpen: () => void;
};

const FREESHIP_QUANTITY = 2;

// Always-visible checkout entry once the cart has items, with a nudge toward the free-shipping threshold.
export function CartStickyBar({ availableQuantity, cartQuantity, orderTotal, onOpen }: CartStickyBarProps) {
  if (cartQuantity <= 0) return null;

  const remainingForFreeship = Math.max(0, FREESHIP_QUANTITY - availableQuantity);
  const hint =
    availableQuantity === 0
      ? "Sản phẩm trong giỏ đã hết hàng"
      : remainingForFreeship > 0
        ? `Thêm ${remainingForFreeship} bộ để được freeship`
        : "Freeship";

  return (
    <div className="shop-cart-bar" role="region" aria-label="Giỏ hàng">
      <div className="shop-cart-bar-inner">
        <div className="shop-cart-bar-summary">
          <strong>
            {availableQuantity} sản phẩm · {formatMoney(orderTotal)}
          </strong>
          <span className={remainingForFreeship === 0 && availableQuantity > 0 ? "done" : undefined}>{hint}</span>
          <span className="shop-cart-bar-progress" aria-hidden="true">
            <i style={{ width: `${Math.min(100, (availableQuantity / FREESHIP_QUANTITY) * 100)}%` }} />
          </span>
        </div>
        <button type="button" onClick={onOpen}>
          <ShoppingBag size={18} aria-hidden="true" />
          {availableQuantity > 0 ? "Chốt đơn" : "Xem giỏ"}
        </button>
      </div>
    </div>
  );
}
