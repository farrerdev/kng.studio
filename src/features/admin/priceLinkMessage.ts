import { shopConfig } from "../../config/shop";
import { formatMoney, getPriceValue } from "../../shared/utils/money";
import type { Product, ProductType } from "../../types/catalog";
import { getProductPrice, getProductSlug, isProductInStock } from "../catalog/catalogUtils";
import { SHIPPING_FEE } from "../storefront/storefrontConstants";

function formatShortMoney(value: number) {
  return value % 1000 === 0 ? `${value / 1000}k` : formatMoney(value);
}

/** The reply pasted to a guest asking for the price: type name only, price, gift, shipping and the product link. */
export function createPriceLinkMessage(product: Product, productTypes: ProductType[]) {
  const productType = productTypes.find((type) => type.id === product.productTypeId);
  const typeName = productType?.name.trim().toLocaleLowerCase("vi") ?? "";
  // A hidden or sold-out product has no page to send.
  if (!typeName || product.active === false || !isProductInStock(product)) return "";
  const setName = /^(set|bộ)\s/.test(typeName) ? typeName : `set ${typeName}`;
  const price = formatShortMoney(getPriceValue(getProductPrice(product, productTypes)));
  return [
    `Dạ ${setName} giá ${price} bạn nhen, shop tặng kèm dây buộc tóc cùng màu, phí ship ${formatShortMoney(SHIPPING_FEE)} hoặc shop freeship cho đơn từ 2 bộ ạa`,
    "",
    "Shop gửi bạn link web để mình tiện xem các mẫu đang sẵn nhenn",
    `${shopConfig.sites.store}/${getProductSlug(product, productTypes)}`,
  ].join("\n");
}
