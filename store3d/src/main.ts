import "./ui/hud.css";
import { loadFonts } from "./config/fonts";
import type { CatalogData } from "../../src/features/catalog/catalogRows";
import { fetchStorefrontCatalog, readCachedCatalog } from "../../src/features/catalog/storefrontCatalog";
import { toStorefrontCatalog } from "../../src/features/catalog/useStorefrontCatalog";
import { setAnalyticsSource } from "../../src/features/analytics/storefrontAnalytics";
import { toSceneCatalog } from "./data/sceneCatalog";
import { buildFaq } from "./shop/faq";
import { SoundBoard } from "./audio/SoundBoard";
import { Hud } from "./ui/Hud";

const loader = document.getElementById("boot-loader");
const progressBar = document.getElementById("boot-progress");
const statusText = document.getElementById("boot-text");

function progress(value: number, text?: string): void {
  if (progressBar) progressBar.style.width = `${Math.round(value * 100)}%`;
  if (text && statusText) statusText.textContent = text;
}

function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Same catalog source as the storefront; falls back to the visitor's cached copy when offline. */
async function loadCatalog(): Promise<CatalogData | null> {
  try {
    return await fetchStorefrontCatalog();
  } catch (error) {
    console.warn("[store3d] catalog unavailable", error);
    return readCachedCatalog();
  }
}

const EVENING_KEY = "kng3d.evening";

function isDarkOutside(): boolean {
  const hour = new Date().getHours();
  return hour >= 18 || hour < 6;
}

// Storage can throw (private mode, blocked); the toggle still works for this visit.
function readEveningSetting(): boolean | null {
  try {
    const value = window.localStorage.getItem(EVENING_KEY);
    return value === null ? null : value === "1";
  } catch {
    return null;
  }
}

function writeEveningSetting(on: boolean): void {
  try {
    window.localStorage.setItem(EVENING_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

// Stats from here are tagged "3d" (the admin dashboard can split web and 3D).
setAnalyticsSource("3d");

async function boot(): Promise<void> {
  const stage = document.getElementById("stage");
  const hudRoot = document.getElementById("hud");
  const overlays = document.getElementById("overlays");
  if (!stage || !hudRoot || !overlays) return;
  if (!hasWebGL()) {
    progress(1, "Trình duyệt này chưa hỗ trợ 3D. Mời bạn ghé kngstudio.shop nhé.");
    return;
  }

  progress(0.1);
  // Catalog, the 3D engine and the storefront UI download in parallel; the chunks are only fetched here.
  // Signs and tags are drawn on canvases once, so the font must be ready first.
  const [data, { StoreApp }, { mountShop }] = await Promise.all([
    loadCatalog(),
    import("./app/StoreApp"),
    import("./shop/mountShop"),
    loadFonts(),
  ]);
  const catalog = toSceneCatalog(data);
  progress(0.55, "Đang xếp đồ lên kệ…");

  // Navigation is the scene's (HUD buttons, spots); what opens is the main store's storefront.
  let cartCount: number | null = null;
  const sounds = new SoundBoard();
  // Evening look by default after dark (local time); the guest's own choice is remembered.
  let evening = readEveningSetting() ?? isDarkOutside();
  const hud = new Hud(hudRoot, {
    evening,
    toggleEvening: () => {
      evening = !evening;
      writeEveningSetting(evening);
      app.setEvening(evening);
      return evening;
    },
    soundEnabled: sounds.enabled,
    toggleSound: () => {
      sounds.setEnabled(!sounds.enabled);
      return sounds.enabled;
    },
    openMenu: () => shop.open({ kind: "menu" }),
    openCart: () => shop.open({ kind: "cart" }),
    mountRail: (host, rail) => shop.mountRail(host, rail),
  });
  const shop = mountShop(overlays, toStorefrontCatalog(data ?? { productTypes: [], products: [], shopInfoImage: null }, data ? "ready" : "error"), {
    onStateChange: ({ cartQuantity }) => {
      if (cartCount !== null && cartQuantity > cartCount) hud.bumpCart();
      cartCount = cartQuantity;
      hud.setCartCount(cartQuantity);
    },
    onNotice: (message) => hud.toast(message),
  });

  const app = new StoreApp(stage, hud, catalog, {
    open: (target) => shop.open(target),
    get isOpen() {
      return shop.state.anyOpen;
    },
    get coversScene() {
      return shop.state.pageOpen;
    },
  }, buildFaq((data?.products ?? []).map((product) => product.material)), sounds);
  app.setEvening(evening, true);
  progress(0.8, "Sắp tới cửa tiệm…");
  await app.warmUp();
  progress(1);
  app.start();
  if (import.meta.env.DEV) Object.assign(window, { __store3d: app, __sounds: sounds });
  // The welcome card's "Bắt đầu mua sắm" is the guest's first tap, which is what lets the music
  // start (browsers block sound until then).
  // "?p=<product id>" from the web store's "Xem trong tiệm 3D": go to that shelf after the welcome.
  const params = new URLSearchParams(window.location.search);
  const wantedProduct = params.get("p");
  if (wantedProduct) {
    params.delete("p");
    const query = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  }
  app.playIntro(() => hud.showWelcome(wantedProduct ? () => app.showProduct(wantedProduct) : undefined));
  loader?.classList.add("is-done");
  window.setTimeout(() => loader?.remove(), 600);
  if (catalog.status === "unavailable") hud.toast("Chưa tải được sản phẩm, đang hiển thị kệ trống");

  import.meta.hot?.dispose(() => {
    app.dispose();
    shop.dispose();
    hudRoot.replaceChildren();
    overlays.replaceChildren();
  });
}

boot().catch((error: unknown) => {
  console.error("[store3d] failed to start", error);
  progress(1, "Có lỗi khi mở cửa tiệm. Tải lại trang giúp mình nhé.");
});
