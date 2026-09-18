import { sizeOptions } from "../../../data/mockCatalog";
import { getPriceValue } from "../../../shared/utils/money";
import type { Product, SizeId } from "../../../types/catalog";
import { MULTI_SET_DISCOUNT, SHIPPING_FEE } from "../storefrontConstants";
import type { CartItem } from "./cartTypes";

export function createCartItemId(productId: string, patternId: string, sizeId: SizeId) {
  return `${productId}__${patternId}__${sizeId}`;
}

export function formatSelectedSize(sizeId: SizeId) {
  return sizeOptions.find((size) => size.id === sizeId)?.label ?? `Size ${sizeId}`;
}

export function isCartItemAvailable(item: CartItem, products: Product[]) {
  const product = products.find((candidate) => candidate.id === item.productId);
  const pattern = product?.patterns.find((candidate) => candidate.id === item.patternId);
  return pattern?.availableSizes.includes(item.sizeId) ?? false;
}

export function getCartTotal(cartItems: CartItem[]) {
  return cartItems.reduce((total, item) => total + getPriceValue(item.price) * item.quantity, 0);
}

export function getCartQuantity(cartItems: CartItem[]) {
  return cartItems.reduce((total, item) => total + item.quantity, 0);
}

export function getShippingFee(cartItems: CartItem[]) {
  if (cartItems.length === 0) return 0;
  return getCartQuantity(cartItems) >= 2 ? 0 : SHIPPING_FEE;
}

export function getMultiSetDiscount(cartItems: CartItem[]) {
  return Math.max(0, getCartQuantity(cartItems) - 2) * MULTI_SET_DISCOUNT;
}

export function getOrderTotal(cartItems: CartItem[]) {
  return getCartTotal(cartItems) + getShippingFee(cartItems) - getMultiSetDiscount(cartItems);
}
