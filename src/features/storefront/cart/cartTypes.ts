import type { ProductImage, SizeId } from "../../../types/catalog";

export type CartItem = {
  id: string;
  productId: string;
  patternId: string;
  sizeId: SizeId;
  quantity: number;
  productName: string;
  patternName: string;
  price: string;
  /** Price before the product's own discount; only set while the product is discounted. */
  listPrice?: string;
  image: ProductImage;
};

export type CartDraft = Omit<CartItem, "quantity">;
