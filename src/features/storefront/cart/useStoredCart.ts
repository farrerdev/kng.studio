import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from "react";
import { formatPrice } from "../../../shared/utils/money";
import type { Product, ProductType } from "../../../types/catalog";
import { getProductPrice } from "../../catalog/catalogUtils";
import { CART_STORAGE_KEY } from "../storefrontConstants";
import { loadStoredCartItems } from "./cartStorage";
import type { CartItem } from "./cartTypes";
import { createCartDraft, createCartItemId, getCartListPrice } from "./cartUtils";
import { readSharedCart, serializeLines, type SharedCartLine, toSharedLines, writeSharedCart } from "./sharedCart";

const UPDATED_AT_KEY = "kng.studio.cart.updatedAt";

type CatalogInput = {
  products: Product[];
  productTypes: ProductType[];
  /** Lines whose product isn't in a ready catalog are dropped; while loading they wait. */
  catalogReady: boolean;
};

type Hydrated = { items: CartItem[]; pending: SharedCartLine[] };

function readLocalStamp(): number {
  try {
    return Number(window.localStorage.getItem(UPDATED_AT_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeLocal(items: CartItem[], stamp?: number): void {
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    if (stamp !== undefined) window.localStorage.setItem(UPDATED_AT_KEY, String(stamp));
  } catch {
    // Storage full or blocked: the cart still works for this visit.
  }
}

/** Full cart items for shared lines: reuse what this site already knows, else rebuild from the catalog. */
function hydrate(lines: SharedCartLine[], known: CartItem[], { products, productTypes, catalogReady }: CatalogInput): Hydrated {
  const items: CartItem[] = [];
  const pending: SharedCartLine[] = [];
  for (const line of lines) {
    const id = createCartItemId(line.productId, line.patternId, line.sizeId);
    const existing = known.find((item) => item.id === id);
    if (existing) {
      items.push({ ...existing, quantity: line.quantity });
      continue;
    }
    const product = products.find((candidate) => candidate.id === line.productId);
    const pattern = product?.patterns.find((candidate) => candidate.id === line.patternId);
    if (product && pattern) items.push({ ...createCartDraft(product, pattern, line.sizeId, productTypes), quantity: line.quantity });
    else if (!catalogReady) pending.push(line);
  }
  return { items, pending };
}

/**
 * Cart items persisted in localStorage and shared across kngstudio.shop subdomains (see
 * sharedCart.ts). Same state shape as a plain `useState<CartItem[]>`.
 */
export function useStoredCart(catalog: CatalogInput): [CartItem[], Dispatch<SetStateAction<CartItem[]>>] {
  const catalogRef = useRef(catalog);
  useEffect(() => {
    catalogRef.current = catalog;
  });

  const [initial] = useState(() => {
    const local = loadStoredCartItems();
    const localStamp = readLocalStamp();
    const shared = readSharedCart();
    if (!shared || shared.updatedAt <= localStamp) {
      // Local is newest; an empty `syncedText` makes the first persist publish it to the cookie.
      return { items: local, pending: [] as SharedCartLine[], stamp: localStamp, syncedText: shared ? serializeLines(shared.lines) : "" };
    }
    const { items, pending } = hydrate(shared.lines, local, catalog);
    return { items, pending, stamp: shared.updatedAt, syncedText: serializeLines(shared.lines) };
  });
  const [cartItems, setCartItems] = useState<CartItem[]>(initial.items);
  const pendingRef = useRef(initial.pending);
  /** What the cookie holds as far as this page knows. */
  const syncedRef = useRef({ stamp: initial.stamp, text: initial.syncedText });

  // Persist every change; publish to the shared cookie when the lines actually changed.
  useEffect(() => {
    const lines = [...toSharedLines(cartItems), ...pendingRef.current];
    const text = serializeLines(lines);
    if (text === syncedRef.current.text) {
      writeLocal(cartItems);
      return;
    }
    const stamp = Date.now();
    syncedRef.current = { stamp, text };
    writeLocal(cartItems, stamp);
    writeSharedCart({ updatedAt: stamp, lines });
  }, [cartItems]);

  // Lines added on the other site for products this page's catalog didn't have yet.
  const { products, productTypes, catalogReady } = catalog;
  useEffect(() => {
    if (!pendingRef.current.length) return;
    const { items, pending } = hydrate(pendingRef.current, [], { products, productTypes, catalogReady });
    if (pending.length === pendingRef.current.length) return;
    pendingRef.current = pending;
    setCartItems((current) => [...current, ...items]);
  }, [catalogReady, productTypes, products]);

  // Stored lines keep the price they were added at; follow the catalog when a price or discount changes.
  useEffect(() => {
    if (!catalogReady) return;
    setCartItems((current) => {
      let changed = false;
      const next = current.map((item) => {
        const product = products.find((candidate) => candidate.id === item.productId);
        if (!product) return item;
        const price = formatPrice(getProductPrice(product, productTypes));
        const listPrice = getCartListPrice(product, productTypes);
        if (price === item.price && listPrice === item.listPrice) return item;
        changed = true;
        return { ...item, price, listPrice };
      });
      return changed ? next : current;
    });
  }, [catalogReady, productTypes, products]);

  // Coming back to this tab: pick up changes made on the other site (or another tab) meanwhile.
  useEffect(() => {
    const pull = () => {
      if (document.visibilityState === "hidden") return;
      const shared = readSharedCart();
      if (!shared || shared.updatedAt <= syncedRef.current.stamp) return;
      syncedRef.current = { stamp: shared.updatedAt, text: serializeLines(shared.lines) };
      try {
        window.localStorage.setItem(UPDATED_AT_KEY, String(shared.updatedAt));
      } catch {
        /* ignore */
      }
      setCartItems((current) => {
        const { items, pending } = hydrate(shared.lines, current, catalogRef.current);
        pendingRef.current = pending;
        return items;
      });
    };
    window.addEventListener("focus", pull);
    document.addEventListener("visibilitychange", pull);
    return () => {
      window.removeEventListener("focus", pull);
      document.removeEventListener("visibilitychange", pull);
    };
  }, []);

  return [cartItems, setCartItems];
}
