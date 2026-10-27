import { formatMoney } from "../../shared/utils/money";
import type { CartItem } from "../storefront/cart/cartTypes";
import { getCartQuantity, getOrderTotal } from "../storefront/cart/cartUtils";

function formatShortMoney(value: number) {
  return value % 1000 === 0 ? `${value / 1000}k` : formatMoney(value);
}

export function createOrderConfirmationMessage(orderItems: CartItem[]) {
  if (orderItems.length === 0) return "";
  const total = formatShortMoney(getOrderTotal(orderItems));
  const gift = getCartQuantity(orderItems) >= 2 ? "dây buộc tóc cho mỗi set và freeship" : "dây buộc tóc";
  return [
    `Dạ shop xác nhận đơn cho mình ạ, tổng của mình là ${total} bạn nhen, shop tặng kèm ${gift} ạ`,
    "",
    "Bạn cho shop xin Tên người nhận, sđt và địa chỉ lun nhé ạ",
  ].join("\n");
}
