// The shopping UI is the main store's own <Storefront> (../src), rendered here with the linen theme.
// Nothing about products, cart or checkout is re-implemented in the 3D app: the scene only decides
// what to open (navigation), the storefront does the rest. Any change to the shop is made once, in
// the main store, and shows up here too.
import "../../../src/styles.css";
import { ArrowLeft } from "lucide-react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { StorefrontCatalog } from "../../../src/features/catalog/useStorefrontCatalog";
import { ProductRail } from "../../../src/features/storefront/components/ProductRail";
import {
  Storefront,
  type StorefrontController,
  type StorefrontSceneHost,
  type StorefrontSceneState,
} from "../../../src/features/storefront/Storefront";
import type { PanelRail } from "../ui/Hud";
import type { StoreTarget } from "./types";

export type ShopHandlers = {
  onStateChange: (state: StorefrontSceneState) => void;
  onNotice: (message: string) => void;
};

export type ShopLayer = {
  open: (target: StoreTarget) => void;
  /** Renders the storefront's product rail (same cards as the shop) into a spot panel. */
  mountRail: (host: HTMLElement, rail: PanelRail) => () => void;
  readonly state: StorefrontSceneState;
  dispose: () => void;
};

export function mountShop(host: HTMLElement, catalog: StorefrontCatalog, handlers: ShopHandlers): ShopLayer {
  document.documentElement.dataset.theme = "linen";
  const controllerRef: StorefrontSceneHost["controllerRef"] = { current: null };
  let state: StorefrontSceneState = { pageOpen: false, anyOpen: false, cartQuantity: 0 };

  // Created once: the storefront keys its effects on this object.
  const scene: StorefrontSceneHost = {
    controllerRef,
    onStateChange: (next) => {
      state = next;
      handlers.onStateChange(next);
    },
    onNotice: handlers.onNotice,
    headerStart: (
      <button className="site-menu-button" type="button" aria-label="Về tiệm 3D" onClick={() => controllerRef.current?.closePage()}>
        <ArrowLeft size={20} aria-hidden="true" />
      </button>
    ),
  };

  const root = createRoot(host);
  root.render(
    <StrictMode>
      <Storefront catalog={catalog} scene={scene} />
    </StrictMode>,
  );

  return {
    open: (target) => {
      const controller: StorefrontController | null = controllerRef.current;
      if (!controller) return;
      switch (target.kind) {
        case "product":
          controller.openProduct(target.productId);
          break;
        case "home":
          controller.openHome(target.sectionId);
          break;
        case "cart":
          controller.openCart();
          break;
        case "menu":
          controller.openMenu();
          break;
      }
    },
    mountRail: (host, rail) => {
      const byId = new Map(catalog.products.map((product) => [product.id, product]));
      const products = rail.productIds.flatMap((id) => byId.get(id) ?? []);
      const railRoot = createRoot(host);
      railRoot.render(
        <StrictMode>
          <ProductRail
            title="Sản phẩm"
            className={rail.featured ? "shop-rail-featured" : undefined}
            cardVariant={rail.featured ? "overlay" : "default"}
            ranked={rail.featured}
            eager
            products={products}
            allProducts={catalog.products}
            productTypes={catalog.productTypes}
            onProductOpen={(product) => controllerRef.current?.openProduct(product.id)}
          />
        </StrictMode>,
      );
      // Deferred: unmounting a root while React is rendering (e.g. from a click inside it) warns.
      return () => queueMicrotask(() => railRoot.unmount());
    },
    get state() {
      return state;
    },
    dispose: () => root.unmount(),
  };
}
