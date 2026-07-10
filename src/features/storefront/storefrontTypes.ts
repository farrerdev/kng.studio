import type { ProductImage } from "../../types/catalog";
import type { CartDraft } from "./cart/cartTypes";

export type GalleryImage = ProductImage & {
  caption: string;
  cartItem?: CartDraft;
};

export type ShareChannel = "instagram" | "messenger";
