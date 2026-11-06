import { readFileSync } from "node:fs";

const styles = [
  readFileSync("src/styles.css", "utf8"),
  readFileSync("src/styles/kng.css", "utf8"),
  readFileSync("src/styles/storefront.css", "utf8"),
].join("\n");
const app = [
  readFileSync("src/App.tsx", "utf8"),
  readFileSync("src/app/KngApp.tsx", "utf8"),
  readFileSync("src/features/storefront/Storefront.tsx", "utf8"),
].join("\n");

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
requireRule(".storefront.has-cart-bar", "padding-bottom:", "Sticky cart bar must not cover the last content");
requireRule(".contact-buttons.raised", "bottom:", "Chat bubbles must sit above the sticky cart bar");
requireSource(app, "has-cart-bar", "Storefront needs cart bar state class");
requireSource(app, "<CartStickyBar", "Storefront needs the sticky cart bar");

console.log("Layout guard checks passed.");
