import { readFileSync } from "node:fs";

const styles = readFileSync("src/styles.css", "utf8");
const app = readFileSync("src/App.tsx", "utf8");

function selectorBlock(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = styles.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`, "m"));
  return match?.[1] ?? "";
}

function requireRule(selector, rule, message) {
  const block = selectorBlock(selector);
  if (!block.includes(rule)) {
    throw new Error(`${message}: expected ${selector} to include "${rule}".`);
  }
}

function requireSource(source, text, message) {
  if (!source.includes(text)) {
    throw new Error(`${message}: missing "${text}".`);
  }
}

requireRule(".storefront", "padding: 0;", "Home footer spacing guard");
requireRule(".storefront-footer", "margin: 0;", "Footer should sit directly after policy section");
requireRule(".storefront .product-type-showcase.has-cart-cta", "padding-bottom: 0;", "Home checkout CTA spacing guard");
requireRule(
  ".storefront .product-type-showcase.has-cart-cta + .storefront-policy",
  "margin-top: 0;",
  "Policy section should not drift away from checkout CTA",
);
requireRule(
  ".storefront .product-type-showcase.has-cart-cta .cart-checkout-cta",
  "border-bottom: 1px solid var(--store-line);",
  "Home checkout CTA needs a bottom divider",
);
requireRule(".cart-checkout-cta", "padding: 16px 0;", "Checkout CTA vertical padding should stay balanced");
requireRule(".cart-checkout-cta.compact", "border-top: 0;", "Detail checkout CTA should not duplicate card divider");
requireRule(".product-policy-cta", "padding: 16px 0;", "Product policy CTA vertical padding should stay balanced");
requireRule(".storefront .product-policy-cta", "margin-top: -18px;", "Product policy CTA should cancel detail grid gap above");
requireRule(".storefront .product-policy-cta", "margin-bottom: -18px;", "Product policy CTA should cancel detail grid gap below");
requireSource(app, "product-type-showcase has-cart-cta", "Home needs cart CTA state class");

console.log("Layout guard checks passed.");
