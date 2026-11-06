import type { SizeId } from "../../../types/catalog";
import type { CartItem } from "./cartTypes";

// The cart lives in localStorage, which is per origin, so kngstudio.shop and the 3D shop
// (3d.kngstudio.shop) would each keep their own. A small cookie on the parent domain carries the
// cart lines (ids + quantity only) between them; names, prices and images are rebuilt from the
// catalog. The newest write wins.
//
// On localhost/LAN IPs the cookie is host-only, which still spans ports (cookies ignore ports), so
// the main dev server (:5173) and the 3D dev server (:5180) share a cart too.

export type SharedCartLine = { productId: string; patternId: string; sizeId: SizeId; quantity: number };
export type SharedCart = { updatedAt: number; lines: SharedCartLine[] };

const COOKIE_NAME = "kng_cart";
const FORMAT_VERSION = "1";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
/** Browsers cap a cookie around 4 KB; past this the cart just stays per-site. */
const MAX_COOKIE_BYTES = 3800;
const SHOP_DOMAIN = "kngstudio.shop";

export function toSharedLines(items: Pick<CartItem, "productId" | "patternId" | "sizeId" | "quantity">[]): SharedCartLine[] {
  return items.map(({ productId, patternId, sizeId, quantity }) => ({ productId, patternId, sizeId, quantity }));
}

/** Stable text form, also used to tell whether two carts hold the same lines. */
export function serializeLines(lines: SharedCartLine[]): string {
  return lines.map((line) => `${line.productId}:${line.patternId}:${line.sizeId}:${line.quantity}`).join(",");
}

function parseLines(text: string): SharedCartLine[] {
  if (!text) return [];
  return text.split(",").flatMap((entry) => {
    const [productId, patternId, sizeId, rawQuantity] = entry.split(":");
    const quantity = Number(rawQuantity);
    if (!productId || !patternId || (sizeId !== "1" && sizeId !== "2") || !Number.isInteger(quantity) || quantity <= 0) return [];
    return [{ productId, patternId, sizeId, quantity }];
  });
}

function cookieDomainAttribute(): string {
  const host = window.location.hostname;
  return host === SHOP_DOMAIN || host.endsWith(`.${SHOP_DOMAIN}`) ? `; Domain=${SHOP_DOMAIN}` : "";
}

export function readSharedCart(): SharedCart | null {
  if (typeof document === "undefined") return null;
  try {
    const raw = document.cookie
      .split("; ")
      .find((part) => part.startsWith(`${COOKIE_NAME}=`))
      ?.slice(COOKIE_NAME.length + 1);
    if (!raw) return null;
    const [version, stamp, lines = ""] = decodeURIComponent(raw).split("|");
    const updatedAt = Number(stamp);
    if (version !== FORMAT_VERSION || !Number.isFinite(updatedAt)) return null;
    return { updatedAt, lines: parseLines(lines) };
  } catch {
    return null;
  }
}

export function writeSharedCart(cart: SharedCart): void {
  if (typeof document === "undefined") return;
  const value = encodeURIComponent(`${FORMAT_VERSION}|${cart.updatedAt}|${serializeLines(cart.lines)}`);
  if (value.length > MAX_COOKIE_BYTES) return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE_NAME}=${value}; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${cookieDomainAttribute()}${secure}`;
}
