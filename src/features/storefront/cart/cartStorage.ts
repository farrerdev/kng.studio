import { CART_STORAGE_KEY } from "../storefrontConstants";
import type { CartItem } from "./cartTypes";

export function loadStoredCartItems(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const rawCart = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!rawCart) return [];
    const parsedCart = JSON.parse(rawCart);
    if (!Array.isArray(parsedCart)) return [];
    return parsedCart.filter(
      (item): item is CartItem =>
        typeof item?.id === "string" &&
        typeof item?.productId === "string" &&
        typeof item?.patternId === "string" &&
        (item?.sizeId === "1" || item?.sizeId === "2") &&
        typeof item?.quantity === "number" &&
        item.quantity > 0 &&
        typeof item?.productName === "string" &&
        typeof item?.patternName === "string" &&
        typeof item?.price === "string" &&
        typeof item?.image?.src === "string" &&
        typeof item?.image?.alt === "string",
    );
  } catch {
    return [];
  }
}
