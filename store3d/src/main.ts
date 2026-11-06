import "./ui/hud.css";
import type { CatalogData } from "../../src/features/catalog/catalogRows";
import { fetchStorefrontCatalog, readCachedCatalog } from "../../src/features/catalog/storefrontCatalog";
import { toStorefrontCatalog } from "../../src/features/catalog/useStorefrontCatalog";
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
  const [data, { StoreApp }, { mountShop }] = await Promise.all([
    loadCatalog(),
    import("./app/StoreApp"),
    import("./shop/mountShop"),
  ]);
  const catalog = toSceneCatalog(data);
  progress(0.55, "Đang xếp đồ lên kệ…");

  // Navigation is the scene's (HUD buttons, spots); what opens is the main store's storefront.
  let cartCount: number | null = null;
  const sounds = new SoundBoard();
  const hud = new Hud(hudRoot, {
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
  progress(0.8, "Sắp tới cửa tiệm…");
  await app.warmUp();
  progress(1);
  app.start();
  app.playIntro(() => hud.showHelpIfNew());
  if (import.meta.env.DEV) Object.assign(window, { __store3d: app });
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
