/** Where the scene can send the guest in the storefront layer. */
export type StoreTarget =
  | { kind: "product"; productId: string }
  | { kind: "home"; sectionId?: string }
  | { kind: "cart" }
  | { kind: "menu" };
