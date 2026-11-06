import { sizeOptions } from "../../../data/mockCatalog";
import { formatPrice, getPriceValue } from "../../../shared/utils/money";
import type { Product, ProductPattern, ProductType, SizeId } from "../../../types/catalog";
import { getProductPrice, getProductTitle } from "../../catalog/catalogUtils";
import { MULTI_SET_DISCOUNT, SHIPPING_FEE } from "../storefrontConstants";
import type { CartDraft, CartItem } from "./cartTypes";

export function createCartItemId(productId: string, patternId: string, sizeId: SizeId) {
  return `${productId}__${patternId}__${sizeId}`;
}

/** Cart line for one pattern in one size; the same fields wherever the guest adds it. */
export function createCartDraft(product: Product, pattern: ProductPattern, sizeId: SizeId, productTypes: ProductType[]): CartDraft {
  return {
    id: createCartItemId(product.id, pattern.id, sizeId),
    productId: product.id,
    patternId: pattern.id,
    sizeId,
    productName: getProductTitle(product, productTypes),
    patternName: pattern.name,
    price: formatPrice(getProductPrice(product, productTypes)),
    image: pattern.image,
  };
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
