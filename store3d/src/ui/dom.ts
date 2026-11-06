// Minimal DOM helpers. All catalog text goes through textContent (never innerHTML) so product
// names from the database can't inject markup.

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function button(className: string, label: string, onClick: () => void, ariaLabel?: string): HTMLButtonElement {
  const node = el("button", className, label);
  node.type = "button";
  if (ariaLabel) node.setAttribute("aria-label", ariaLabel);
  node.addEventListener("click", onClick);
  return node;
}

export function iconButton(className: string, iconName: IconName, ariaLabel: string, onClick: () => void): HTMLButtonElement {
  const node = el("button", className);
  node.type = "button";
  node.setAttribute("aria-label", ariaLabel);
  node.append(icon(iconName));
  node.addEventListener("click", onClick);
  return node;
}

export function lazyImage(src: string, alt: string, eager = false): HTMLImageElement {
  const image = el("img");
  image.alt = alt;
  image.decoding = "async";
  image.loading = eager ? "eager" : "lazy";
  const reveal = () => image.closest(".media")?.classList.add("is-loaded");
  image.addEventListener("load", reveal, { once: true });
  image.addEventListener("error", reveal, { once: true });
  if (src) image.src = src;
  else queueMicrotask(reveal);
  return image;
}

const ICON_PATHS = {
  x: "M18 6 6 18M6 6l12 12",
  menu: "M4 7h16M4 12h16M4 17h16",
  pin: "M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10Zm0-8a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  sound: "M4 9v6h4l5 4V5L8 9H4Zm12.5 0a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11",
  mute: "M4 9v6h4l5 4V5L8 9H4Zm12 1 5 5m0-5-5 5",
  bag: "M5 8h14l-1.2 12H6.2L5 8Zm4 0V7a3 3 0 0 1 6 0v1",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  ruler: "M3 15 15 3l6 6L9 21l-6-6Zm4 0 2 2m1-5 2 2m1-5 2 2",
  truck: "M3 6h11v10H3zM14 10h4l3 3v3h-7zM7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm10 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z",
  gift: "M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7S10 3 8 4s0 3 4 3Zm0 0s2-4 4-3 0 3-4 3Z",
  info: "M12 8h.01M11 12h1v5h1M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
  download: "M12 4v11m-5-5 5 5 5-5M5 20h14",
  instagram: "M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Zm5 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm5.5-1.5h.01",
  messenger: "M12 3C7 3 3 6.7 3 11.3c0 2.6 1.3 4.9 3.3 6.4V21l3-1.7c.9.3 1.8.4 2.7.4 5 0 9-3.7 9-8.4S17 3 12 3Zm-3.5 10.5 2.6-2.8 2.2 1.8 2.9-3-2.6 2.8-2.2-1.8-2.9 3Z",
} as const;

export type IconName = keyof typeof ICON_PATHS;

export function icon(name: IconName, size = 18): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.7");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(ns, "path");
  path.setAttribute("d", ICON_PATHS[name]);
  svg.append(path);
  return svg;
}
