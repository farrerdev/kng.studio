import { ArrowRight, Box, ChevronDown, ChevronLeft, ChevronRight, Menu, ShoppingBag, X } from "lucide-react";
import { type MutableRefObject, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { getStorefrontSlugFromPath } from "../../app/routes";
import { shopConfig } from "../../config/shop";
import { trackStorefrontEvent } from "../analytics/storefrontAnalytics";
import {
  getProductSlug,
  getProductTitle,
  getProductType,
  getProductTypeSizeChartImage,
  getStorefrontProducts,
} from "../catalog/catalogUtils";
import type { StorefrontCatalog } from "../catalog/useStorefrontCatalog";
import { CartOverlay, OrderImagePreview } from "./cart/CartOverlay";
import { CartStickyBar } from "./cart/CartStickyBar";
import type { CartDraft } from "./cart/cartTypes";
import {
  createCartItemId,
  getCartQuantity,
  getCartTotal,
  getMultiSetDiscount,
  getOrderTotal,
  getShippingFee,
  isCartItemAvailable,
} from "./cart/cartUtils";
import { createOrderFileName, createOrderImageBlob } from "./cart/orderImage";
import { useStoredCart } from "./cart/useStoredCart";
import { PolicyModal, PolicySections } from "./components/PolicySections";
import { ProductDetail } from "./components/ProductDetail";
import { ProductGrid, ProductGridSkeleton } from "./components/ProductGrid";
import { ProductRail } from "./components/ProductRail";
import { ContactButtons, StorefrontFooter } from "./components/StorefrontChrome";
import { applyStorefrontPageMeta } from "./pageMeta";
import { getPopularProducts, getRecommendedProducts } from "./productRecommendations";
import { IMAGE_WIDTHS } from "./storefrontConstants";
import { getProductGalleryImages, getVisibleProducts } from "./storefrontGallery";
import type { GalleryImage, ShareChannel } from "./storefrontTypes";
import { getSupabaseImageSrc, getSupabaseImageSrcSet } from "../../shared/utils/image";
import type { Product, SizeId } from "../../types/catalog";

/** Commands a host (the 3D shop) uses to drive the storefront instead of URLs. */
export type StorefrontController = {
  openProduct: (productId: string) => void;
  /** Opens the product list page, optionally scrolled to a home section (e.g. "shipping"). */
  openHome: (sectionId?: string) => void;
  openCart: () => void;
  openMenu: () => void;
  /** Hides the product list / product page and returns to the scene. */
  closePage: () => void;
};

export type StorefrontSceneState = {
  /** The product list / product page is showing (it covers the whole screen). */
  pageOpen: boolean;
  /** Anything of the storefront is on screen (page, cart, menu, lightbox, modals). */
  anyOpen: boolean;
  cartQuantity: number;
};

/**
 * Hosting the storefront inside the 3D shop: no URLs or page meta, the host navigates through
 * `controllerRef`, and the page is an overlay the guest closes to go back to the scene.
 */
export type StorefrontSceneHost = {
  controllerRef: MutableRefObject<StorefrontController | null>;
  onStateChange: (state: StorefrontSceneState) => void;
  /** Cart prompts that would otherwise show in the (hidden) page header. */
  onNotice?: (message: string) => void;
  /** Rendered at the start of the page header, e.g. a "back to the shop" button. */
  headerStart?: ReactNode;
};

type StorefrontProps = {
  catalog: StorefrontCatalog;
  /** Omit for the regular website (URL routing, page meta, window scrolling). */
  scene?: StorefrontSceneHost;
};

/** The whole shopping experience: product list, product page, cart, checkout, menu and lightbox. */
export function Storefront({ catalog, scene }: StorefrontProps) {
  const {
    productTypes: catalogProductTypes,
    products: catalogProducts,
    popularity: catalogPopularity,
    shopInfoImage: currentShopInfoImage,
    loadState: catalogLoadState,
  } = catalog;
  const isScene = Boolean(scene);
  const [selectedSize, setSelectedSize] = useState<SizeId>("1");
  const [activeImage, setActiveImage] = useState<GalleryImage | null>(null);
  const [cartItems, setCartItems] = useStoredCart({
    products: catalogProducts,
    productTypes: catalogProductTypes,
    catalogReady: catalogLoadState === "ready",
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCartClosing, setIsCartClosing] = useState(false);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [cartToast, setCartToast] = useState("");
  const [cartToastKey, setCartToastKey] = useState(0);
  const hasShownStoredCartPrompt = useRef(cartItems.length === 0);
  const [orderImageBlob, setOrderImageBlob] = useState<Blob | null>(null);
  const [orderImageFileName, setOrderImageFileName] = useState("");
  const [isOrderImagePreparing, setIsOrderImagePreparing] = useState(false);
  const [orderImagePreviewUrl, setOrderImagePreviewUrl] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedProductSlug, setSelectedProductSlug] = useState<string | null>(() => (isScene ? null : getStorefrontSlugFromPath()));
  /** Scene only: the page overlay is showing. The website page is always showing. */
  const [isPageOpen, setIsPageOpen] = useState(!isScene);
  const pageRef = useRef<HTMLElement | null>(null);
  const pendingSceneSectionRef = useRef<string | null>(null);
  const [sceneScrollRequest, setSceneScrollRequest] = useState(0);
  const homeScrollYRef = useRef(0);
  const shouldRestoreHomeScrollRef = useRef(false);
  const cartCloseTimeoutRef = useRef<number | null>(null);
  const trackedProductViewRef = useRef<string | null>(null);
  const trackedSiteVisitRef = useRef(false);

  // The website scrolls the window; in the 3D shop the page overlay scrolls itself.
  const getScrollTop = () => (isScene ? pageRef.current?.scrollTop ?? 0 : window.scrollY);
  const scrollPageTo = (top: number, behavior: ScrollBehavior = "auto") => {
    if (isScene) pageRef.current?.scrollTo({ top, behavior });
    else window.scrollTo({ top, behavior });
  };

  const storefrontProducts = useMemo(
    () => getStorefrontProducts(catalogProductTypes, catalogProducts),
    [catalogProductTypes, catalogProducts],
  );
  const productTypeGroups = useMemo(
    () =>
      catalogProductTypes
        .map((productType) => ({
          productType,
          products: storefrontProducts.filter((product) => product.productTypeId === productType.id),
        }))
        .filter((group) => group.products.length > 0),
    [catalogProductTypes, storefrontProducts],
  );
  const selectedProduct = useMemo(
    () =>
      selectedProductSlug
        ? storefrontProducts.find((product) => getProductSlug(product, catalogProductTypes) === selectedProductSlug) ?? null
        : null,
    [catalogProductTypes, selectedProductSlug, storefrontProducts],
  );
  const popularProducts = useMemo(
    () => getPopularProducts(storefrontProducts, catalogPopularity),
    [catalogPopularity, storefrontProducts],
  );
  const recommendedProducts = useMemo(
    () =>
      selectedProduct
        ? getRecommendedProducts({
            current: selectedProduct,
            products: storefrontProducts,
            productTypes: catalogProductTypes,
            selectedSize,
            cartProductIds: new Set(cartItems.map((item) => item.productId)),
            popularity: catalogPopularity,
          })
        : [],
    [cartItems, catalogPopularity, catalogProductTypes, selectedProduct, selectedSize, storefrontProducts],
  );
  const selectedProductType = useMemo(
    () => (selectedProduct ? getProductType(selectedProduct, catalogProductTypes) : null),
    [catalogProductTypes, selectedProduct],
  );
  const visibleProduct = useMemo(
    () => (selectedProduct ? getVisibleProducts(selectedSize, [selectedProduct])[0] ?? null : null),
    [selectedProduct, selectedSize],
  );
  const galleryImages = useMemo(() => {
    const shopImages: GalleryImage[] = currentShopInfoImage && !selectedProduct
      ? [
          {
            ...currentShopInfoImage,
            caption: "Bảng giá chung & quy định đặt hàng",
          },
        ]
      : [];
    const typeSizeChart = selectedProductType
      ? [
          {
            ...getProductTypeSizeChartImage(selectedProductType, catalogProducts),
            caption: `${selectedProductType.name || "Loại sản phẩm"} - bảng size`,
          },
        ]
      : [];
    return [...shopImages, ...typeSizeChart, ...(visibleProduct ? getProductGalleryImages(visibleProduct, catalogProductTypes, selectedSize) : [])];
  }, [catalogProductTypes, catalogProducts, currentShopInfoImage, selectedProduct, selectedProductType, selectedSize, visibleProduct]);
  const activeImageIndex = useMemo(() => {
    if (!activeImage) return -1;
    return galleryImages.findIndex(
      (image) =>
        (image.id === activeImage.id && image.src === activeImage.src) ||
        (image.src === activeImage.src && image.caption === activeImage.caption),
    );
  }, [activeImage, galleryImages]);
  const canNavigateLightbox = galleryImages.length > 1 && activeImageIndex >= 0;
  const unavailableCartItemIds = useMemo(() => {
    if (catalogLoadState !== "ready") return new Set<string>();
    return new Set(
      cartItems.filter((item) => !isCartItemAvailable(item, catalogProducts)).map((item) => item.id),
    );
  }, [cartItems, catalogLoadState, catalogProducts]);
  const checkoutCartItems = useMemo(
    () => cartItems.filter((item) => !unavailableCartItemIds.has(item.id)),
    [cartItems, unavailableCartItemIds],
  );
  const cartQuantity = useMemo(() => getCartQuantity(cartItems), [cartItems]);
  const checkoutCartQuantity = useMemo(() => getCartQuantity(checkoutCartItems), [checkoutCartItems]);
  const cartTotal = useMemo(() => getCartTotal(checkoutCartItems), [checkoutCartItems]);
  const shippingFee = useMemo(() => getShippingFee(checkoutCartItems), [checkoutCartItems]);
  const multiSetDiscount = useMemo(() => getMultiSetDiscount(checkoutCartItems), [checkoutCartItems]);
  const orderTotal = useMemo(() => getOrderTotal(checkoutCartItems), [checkoutCartItems]);
  const cartQuantityById = useMemo(
    () => new Map(cartItems.map((item) => [item.id, item.quantity])),
    [cartItems],
  );
  const activeImageCartQuantity = activeImage?.cartItem ? cartQuantityById.get(activeImage.cartItem.id) ?? 0 : 0;
  const openGalleryImage = (offset: -1 | 1) => {
    if (!canNavigateLightbox) return;
    const nextIndex = (activeImageIndex + offset + galleryImages.length) % galleryImages.length;
    setActiveImage(galleryImages[nextIndex]);
  };
  const openCart = () => {
    if (cartCloseTimeoutRef.current) {
      window.clearTimeout(cartCloseTimeoutRef.current);
      cartCloseTimeoutRef.current = null;
    }
    setIsCartClosing(false);
    setIsCartOpen(true);
  };
  const showCartTooltip = (message: string) => {
    setCartToast(message);
    setCartToastKey((currentKey) => currentKey + 1);
  };
  const closeCart = () => {
    if (!isCartOpen || isCartClosing) return;
    setIsCartClosing(true);
    cartCloseTimeoutRef.current = window.setTimeout(() => {
      setIsCartOpen(false);
      setIsCartClosing(false);
      cartCloseTimeoutRef.current = null;
    }, 240);
  };
  const openProduct = (product: Product) => {
    if (!selectedProduct) {
      homeScrollYRef.current = getScrollTop();
    }
    const slug = getProductSlug(product, catalogProductTypes);
    setSelectedProductSlug(slug);
    setIsPageOpen(true);
    if (!isScene) window.history.pushState(null, "", `/${slug}`);
    scrollPageTo(0);
  };
  const restoreHomeScroll = () => {
    window.requestAnimationFrame(() => {
      scrollPageTo(homeScrollYRef.current);
    });
  };
  const closeProduct = () => {
    setSelectedProductSlug(null);
    if (!isScene) window.history.pushState(null, "", "/");
    restoreHomeScroll();
  };
  const goHeaderHome = () => {
    setIsSidebarOpen(false);
    if (selectedProduct) {
      closeProduct();
      return;
    }
    scrollPageTo(0, "smooth");
  };
  const scrollToHomeSection = (sectionId?: string) => {
    if (sectionId) {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    scrollPageTo(0, "smooth");
  };
  const goHomeSection = (sectionId?: string) => {
    setIsSidebarOpen(false);
    if (isScene) {
      // The scene page may be hidden or showing a product: scroll once the list has rendered.
      pendingSceneSectionRef.current = sectionId ?? "";
      setIsPageOpen(true);
      setSelectedProductSlug(null);
      setSceneScrollRequest((request) => request + 1);
      return;
    }
    if (selectedProduct) {
      setSelectedProductSlug(null);
      window.history.pushState(null, "", "/");
      window.requestAnimationFrame(() => scrollToHomeSection(sectionId));
      return;
    }
    scrollToHomeSection(sectionId);
  };

  const addToCart = (item: CartDraft) => {
    setCartItems((currentItems) => {
      const existingItem = currentItems.find((currentItem) => currentItem.id === item.id);
      if (existingItem) {
        return currentItems.map((currentItem) =>
          currentItem.id === item.id ? { ...currentItem, quantity: currentItem.quantity + 1 } : currentItem,
        );
      }
      return [...currentItems, { ...item, quantity: 1 }];
    });
    void trackStorefrontEvent({
      eventType: "add_to_cart",
      productId: item.productId,
      patternId: item.patternId,
      sizeId: item.sizeId,
    });
    showCartTooltip(`Đã thêm ${item.patternName}`);
  };
  const updateCartQuantity = (itemId: string, quantity: number) => {
    setCartItems((currentItems) =>
      currentItems
        .map((item) => (item.id === itemId ? { ...item, quantity } : item))
        .filter((item) => item.quantity > 0),
    );
  };
  const removeCartItem = (itemId: string) => {
    setCartItems((currentItems) => currentItems.filter((item) => item.id !== itemId));
  };
  const updateCartItemSelection = (itemId: string, patternId: string, sizeId: SizeId) => {
    setCartItems((currentItems) => {
      const currentItem = currentItems.find((item) => item.id === itemId);
      const product = currentItem
        ? catalogProducts.find((candidate) => candidate.id === currentItem.productId)
        : null;
      const pattern = product?.patterns.find((candidate) => candidate.id === patternId);
      if (!currentItem || !pattern?.availableSizes.includes(sizeId)) return currentItems;

      const nextId = createCartItemId(currentItem.productId, pattern.id, sizeId);
      if (nextId !== itemId) {
        const matchingItem = currentItems.find((item) => item.id === nextId);
        if (matchingItem) {
          return currentItems
            .filter((item) => item.id !== itemId)
            .map((item) =>
              item.id === nextId
                ? { ...item, quantity: item.quantity + currentItem.quantity }
                : item,
            );
        }
      }

      return currentItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              id: nextId,
              image: pattern.image,
              patternId: pattern.id,
              patternName: pattern.name,
              sizeId,
            }
          : item,
      );
    });
  };
  const clearCart = () => {
    if (!window.confirm("Xoá tất cả sản phẩm trong giỏ hàng?")) return;
    setCartItems([]);
    setOrderImageBlob(null);
    setOrderImagePreviewUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return null;
    });
    setOrderImageFileName("");
  };
  const showOrderImagePreview = (blob: Blob) => {
    const objectUrl = URL.createObjectURL(blob);
    setOrderImagePreviewUrl((currentUrl) => {
      if (currentUrl) URL.revokeObjectURL(currentUrl);
      return objectUrl;
    });
  };
  const shareOrderFile = async (file: File): Promise<"shared" | "cancelled" | "failed"> => {
    if (!navigator.share) return "failed";

    const shareData = {
      files: [file],
      title: "KNG.studio order",
      text: "Ảnh đơn hàng KNG.studio",
    };

    try {
      await navigator.share(shareData);
      return "shared";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "cancelled";

      try {
        await navigator.share({ files: [file] });
        return "shared";
      } catch (fallbackError) {
        if (fallbackError instanceof DOMException && fallbackError.name === "AbortError") return "cancelled";
        return "failed";
      }
    }
  };
  const captureOrderImage = async () => {
    if (checkoutCartItems.length === 0) return;
    setIsOrderImagePreparing(true);
    try {
      const createdAt = new Date();
      const blob = await createOrderImageBlob(checkoutCartItems, createdAt);
      if (!blob) return;
      setOrderImageBlob(blob);
      setOrderImageFileName(createOrderFileName(createdAt));
      showOrderImagePreview(blob);
      void trackStorefrontEvent({ eventType: "order_image_created" });
    } finally {
      setIsOrderImagePreparing(false);
    }
  };
  const shareCurrentOrderImage = async () => {
    if (!orderImageBlob) return;
    const result = await shareOrderFile(
      new File([orderImageBlob], orderImageFileName || createOrderFileName(), { type: "image/png" }),
    );
    if (result === "shared") {
      setOrderImagePreviewUrl((currentUrl) => {
        if (currentUrl) URL.revokeObjectURL(currentUrl);
        return null;
      });
    }
  };
  const openOrderMessage = (channel: ShareChannel) => {
    const targetUrl = channel === "instagram" ? shopConfig.contacts.instagramMessage : shopConfig.contacts.messenger;
    void trackStorefrontEvent({ eventType: "message_click" });
    window.open(targetUrl, "_blank", "noopener,noreferrer");
  };

  // ---------- 3D shop host ----------

  const closeScenePage = () => {
    setIsPageOpen(false);
    setIsSidebarOpen(false);
  };

  // Latest handlers for the controller (they close over current state).
  const sceneCommandsRef = useRef<StorefrontController | null>(null);
  useEffect(() => {
    sceneCommandsRef.current = {
      openProduct: (productId) => {
        setIsSidebarOpen(false);
        closeCart();
        const product = storefrontProducts.find((candidate) => candidate.id === productId);
        if (product) openProduct(product);
        else goHomeSection();
      },
      openHome: (sectionId) => {
        closeCart();
        goHomeSection(sectionId);
      },
      openCart: () => {
        setIsSidebarOpen(false);
        openCart();
      },
      openMenu: () => {
        closeCart();
        setIsSidebarOpen(true);
      },
      closePage: () => closeScenePage(),
    };
  });

  useEffect(() => {
    if (!scene) return;
    scene.controllerRef.current = {
      openProduct: (productId) => sceneCommandsRef.current?.openProduct(productId),
      openHome: (sectionId) => sceneCommandsRef.current?.openHome(sectionId),
      openCart: () => sceneCommandsRef.current?.openCart(),
      openMenu: () => sceneCommandsRef.current?.openMenu(),
      closePage: () => sceneCommandsRef.current?.closePage(),
    };
    return () => {
      scene.controllerRef.current = null;
    };
  }, [scene]);

  const isAnyOpen = isPageOpen || isCartOpen || isSidebarOpen || isPolicyModalOpen || Boolean(activeImage) || Boolean(orderImagePreviewUrl);
  useEffect(() => {
    scene?.onStateChange({ pageOpen: isPageOpen, anyOpen: isAnyOpen, cartQuantity });
  }, [cartQuantity, isAnyOpen, isPageOpen, scene]);

  useEffect(() => {
    if (!scene || !isPageOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      // Inner layers (lightbox, cart, menu) close first.
      if (event.key !== "Escape" || activeImage || isCartOpen || isSidebarOpen || isPolicyModalOpen || orderImagePreviewUrl) return;
      setIsPageOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [activeImage, isCartOpen, isPageOpen, isPolicyModalOpen, isSidebarOpen, orderImagePreviewUrl, scene]);

  useEffect(() => {
    const sectionId = pendingSceneSectionRef.current;
    if (sectionId === null) return;
    pendingSceneSectionRef.current = null;
    // Effects run after the commit, so the revealed list already has a layout to scroll.
    scrollToHomeSection(sectionId || undefined);
  }, [sceneScrollRequest]);

  // ---------- Website only: URL, page meta, scroll restoration ----------

  useEffect(() => {
    if (isScene) return;
    applyStorefrontPageMeta(selectedProduct, catalogProductTypes, catalogProducts);
  }, [catalogProductTypes, catalogProducts, isScene, selectedProduct]);

  useEffect(() => {
    if (isScene || !("scrollRestoration" in window.history)) return;
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, [isScene]);

  useEffect(() => {
    if (isScene) return;
    const syncProductTypeFromRoute = () => {
      const nextSlug = getStorefrontSlugFromPath();
      if (!nextSlug) {
        shouldRestoreHomeScrollRef.current = true;
      }
      setSelectedProductSlug(nextSlug);
    };

    window.addEventListener("popstate", syncProductTypeFromRoute);
    return () => window.removeEventListener("popstate", syncProductTypeFromRoute);
  }, [isScene]);

  useEffect(() => {
    if (selectedProductSlug || !shouldRestoreHomeScrollRef.current) return;
    shouldRestoreHomeScrollRef.current = false;
    restoreHomeScroll();
  }, [selectedProductSlug]);

  // ---------- Shared effects ----------

  useEffect(() => {
    return () => {
      if (cartCloseTimeoutRef.current) {
        window.clearTimeout(cartCloseTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isCartOpen && !isPolicyModalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isCartOpen, isPolicyModalOpen]);

  // A changed cart needs a new order image.
  useEffect(() => {
    setOrderImageBlob(null);
    setOrderImageFileName("");
  }, [cartItems]);

  useEffect(() => {
    return () => {
      if (orderImagePreviewUrl) URL.revokeObjectURL(orderImagePreviewUrl);
    };
  }, [orderImagePreviewUrl]);

  useEffect(() => {
    if (!cartToast) return;
    const timeoutId = window.setTimeout(() => setCartToast(""), 2800);
    return () => window.clearTimeout(timeoutId);
  }, [cartToast]);

  useEffect(() => {
    if (hasShownStoredCartPrompt.current || cartQuantity <= 0 || isCartOpen) return;
    const timeoutId = window.setTimeout(() => {
      if (hasShownStoredCartPrompt.current) return;
      hasShownStoredCartPrompt.current = true;
      const message =
        checkoutCartQuantity > 0
          ? `${checkoutCartQuantity} sản phẩm còn hàng, chốt đơn ngay`
          : `${cartQuantity} sản phẩm trong giỏ đã hết hàng`;
      // In the 3D shop the header is hidden until the page opens, so the host shows it.
      if (scene?.onNotice && !isPageOpen) scene.onNotice(message);
      else showCartTooltip(message);
    }, 600);
    return () => window.clearTimeout(timeoutId);
  }, [cartQuantity, checkoutCartQuantity, isCartOpen, isPageOpen, scene]);

  useEffect(() => {
    if (trackedSiteVisitRef.current) return;
    trackedSiteVisitRef.current = true;
    void trackStorefrontEvent({ eventType: "site_visit" });
  }, []);

  useEffect(() => {
    if (!selectedProduct) {
      trackedProductViewRef.current = null;
      return;
    }
    if (trackedProductViewRef.current === selectedProduct.id) return;
    trackedProductViewRef.current = selectedProduct.id;
    void trackStorefrontEvent({ eventType: "product_view", productId: selectedProduct.id });
  }, [selectedProduct]);

  useEffect(() => {
    if (!activeImage) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveImage(null);
      }
      if (event.key === "ArrowLeft") {
        openGalleryImage(-1);
      }
      if (event.key === "ArrowRight") {
        openGalleryImage(1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeImage, activeImageIndex, canNavigateLightbox, galleryImages]);

  // From the 3D shop to the web store: the product being viewed, else the home page.
  const webStoreHref = selectedProduct
    ? `${shopConfig.sites.store}/${getProductSlug(selectedProduct, catalogProductTypes)}`
    : shopConfig.sites.store;
  const pageClassName = ["page-shell", "storefront", cartQuantity > 0 ? "has-cart-bar" : "", isScene ? "is-scene" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <main className={pageClassName} ref={pageRef} hidden={!isPageOpen}>
        <header className="site-header">
          {scene?.headerStart ? (
            <div className="site-header-start">
              {scene.headerStart}
              <button
                className="site-menu-button"
                type="button"
                aria-label="Mở menu"
                aria-expanded={isSidebarOpen}
                onClick={() => setIsSidebarOpen(true)}
              >
                <Menu size={20} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              className="site-menu-button"
              type="button"
              aria-label="Mở menu"
              aria-expanded={isSidebarOpen}
              onClick={() => setIsSidebarOpen(true)}
            >
              <Menu size={20} aria-hidden="true" />
            </button>
          )}
          <button className="site-title-button" type="button" onClick={goHeaderHome}>
            <h1>{shopConfig.brand}</h1>
          </button>
          <button
            className="site-cart-button"
            type="button"
            aria-label={`Mở giỏ hàng, ${cartQuantity} sản phẩm`}
            onClick={openCart}
          >
            <ShoppingBag size={20} aria-hidden="true" />
            {cartQuantity > 0 ? <span className="site-cart-badge">{cartQuantity}</span> : null}
            {cartToast ? (
              <span className="site-cart-tooltip" key={cartToastKey} role="status" aria-live="polite">
                {cartToast}
              </span>
            ) : null}
          </button>
        </header>

        {/* Product pages already list the perks under the price, so the bar only shows on the home list. */}
        {!selectedProduct ? (
          <section className="shipping-promo" aria-label="Ưu đãi vận chuyển">
            <span>Miễn phí vận chuyển từ 2 bộ</span>
            <button type="button" onClick={() => setIsPolicyModalOpen(true)}>
              Xem chi tiết
            </button>
          </section>
        ) : null}

        {/* Invitation to the 3D walk-in shop (home list only; not inside the 3D shop itself). */}
        {!isScene && !selectedProduct ? (
          <a className="store3d-invite" href={shopConfig.sites.store3d}>
            <span className="store3d-invite-icon" aria-hidden="true">
              <Box size={20} />
            </span>
            <span className="store3d-invite-text">
              <strong>Ghé tiệm 3D</strong>
              <span>Dạo tiệm, xem đồ treo trên kệ như ngoài đời</span>
            </span>
            <span className="store3d-invite-cta">
              Vào tiệm
              <ArrowRight size={15} aria-hidden="true" />
            </span>
          </a>
        ) : null}


        {catalogLoadState === "loading" ? <ProductGridSkeleton /> : null}

        {catalogLoadState !== "loading" && !selectedProduct ? (
          <>
            {popularProducts.length > 0 ? (
              <ProductRail
                className="shop-rail-featured"
                title="Đang được yêu thích"
                ranked
                cardVariant="overlay"
                eager
                allProducts={catalogProducts}
                products={popularProducts}
                productTypes={catalogProductTypes}
                onProductOpen={openProduct}
              />
            ) : null}

            <ProductGrid
              allProducts={catalogProducts}
              products={storefrontProducts}
              productTypes={catalogProductTypes}
              onProductOpen={openProduct}
            />

            <PolicySections className="storefront-policy" includeIds />
          </>
        ) : null}

        {catalogLoadState !== "loading" && selectedProduct && selectedProductType ? (
          <>
            <ProductDetail
              key={selectedProduct.id}
              product={selectedProduct}
              productTypes={catalogProductTypes}
              selectedSize={selectedSize}
              sizeChartImage={getProductTypeSizeChartImage(selectedProductType, catalogProducts)}
              sizeChartCaption={`${selectedProductType.name || "Loại sản phẩm"} - bảng size`}
              onBack={closeProduct}
              onSizeChange={setSelectedSize}
              onImageOpen={setActiveImage}
              onAddToCart={addToCart}
              view3dHref={isScene ? undefined : `${shopConfig.sites.store3d}/?p=${encodeURIComponent(selectedProduct.id)}`}
              onQuantityChange={updateCartQuantity}
              getCartItemQuantity={(itemId) => cartQuantityById.get(itemId) ?? 0}
            />
            <ProductRail
              title="Có thể bạn cũng thích"
              allProducts={catalogProducts}
              onProductOpen={openProduct}
              products={recommendedProducts}
              productTypes={catalogProductTypes}
            />
          </>
        ) : null}
      </main>

      {isScene ? null : <StorefrontFooter />}

      <div className={isSidebarOpen ? "storefront-sidebar-backdrop open" : "storefront-sidebar-backdrop"} onClick={() => setIsSidebarOpen(false)} />
      <aside className={isSidebarOpen ? "storefront-sidebar open" : "storefront-sidebar"} aria-label="Menu điều hướng" aria-hidden={!isSidebarOpen}>
        <div className="storefront-sidebar-header">
          <strong>{shopConfig.brand}</strong>
          <button type="button" aria-label="Đóng menu" onClick={() => setIsSidebarOpen(false)}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <nav className="storefront-sidebar-nav">
          {isScene && isPageOpen ? (
            <button type="button" onClick={closeScenePage}>Về tiệm 3D</button>
          ) : null}
          <button type="button" onClick={() => goHomeSection()}>{isScene ? "Tất cả sản phẩm" : "Trang chủ"}</button>
          {isScene ? (
            <a className="sidebar-site-link" href={webStoreHref}>Xem dạng trang web</a>
          ) : (
            <a className="sidebar-site-link" href={shopConfig.sites.store3d}>Ghé tiệm 3D</a>
          )}
          <details className="sidebar-products-group" open={isScene || undefined}>
            <summary>
              <span>Sản phẩm</span>
              <ChevronDown size={16} aria-hidden="true" />
            </summary>
            <button className="sidebar-all-products" type="button" onClick={() => goHomeSection("products")}>Tất cả sản phẩm</button>
            {productTypeGroups.map(({ productType, products }) =>
              products.length > 1 ? (
                <details className="sidebar-product-type" key={productType.id}>
                  <summary>
                    <span>{productType.name || "Loại sản phẩm"}</span>
                    <ChevronDown size={15} aria-hidden="true" />
                  </summary>
                  {products.map((product) => (
                    <button type="button" key={product.id} onClick={() => { setIsSidebarOpen(false); openProduct(product); }}>
                      {product.name.trim() || getProductTitle(product, catalogProductTypes)}
                    </button>
                  ))}
                </details>
              ) : (
                <button className="sidebar-product-type-link" type="button" key={productType.id} onClick={() => { setIsSidebarOpen(false); openProduct(products[0]); }}>
                  {getProductTitle(products[0], catalogProductTypes)}
                </button>
              ),
            )}
          </details>
          <button type="button" onClick={() => goHomeSection("gift")}>Quà tặng</button>
          <button type="button" onClick={() => goHomeSection("shipping")}>Phí vận chuyển</button>
          <button type="button" onClick={() => goHomeSection("discount")}>Giảm giá</button>
          <button type="button" onClick={() => goHomeSection("payment")}>Thanh toán</button>
          <button type="button" onClick={() => goHomeSection("returns")}>Đổi hàng</button>
          <button type="button" onClick={() => goHomeSection("care")}>Bảo quản</button>
        </nav>
      </aside>

      <CartOverlay
        cartItems={cartItems}
        cartTotal={cartTotal}
        isClosing={isCartClosing}
        isOpen={isCartOpen}
        multiSetDiscount={multiSetDiscount}
        orderTotal={orderTotal}
        isOrderImagePreparing={isOrderImagePreparing}
        onClose={closeCart}
        onCapture={captureOrderImage}
        onOpenMessage={openOrderMessage}
        onClear={clearCart}
        onImageOpen={setActiveImage}
        onQuantityChange={updateCartQuantity}
        onRemove={removeCartItem}
        onSelectionChange={updateCartItemSelection}
        products={catalogProducts}
        shippingFee={shippingFee}
        unavailableItemIds={unavailableCartItemIds}
      />

      {isPolicyModalOpen ? <PolicyModal onClose={() => setIsPolicyModalOpen(false)} /> : null}

      {orderImagePreviewUrl ? (
        <OrderImagePreview
          imageUrl={orderImagePreviewUrl}
          onClose={() => setOrderImagePreviewUrl(null)}
          onShare={shareCurrentOrderImage}
        />
      ) : null}

      {/* In the 3D shop the bottom bar and chat bubbles belong to the page, not the scene. */}
      {isPageOpen ? (
        <>
          <CartStickyBar
            availableQuantity={checkoutCartQuantity}
            cartQuantity={cartQuantity}
            orderTotal={orderTotal}
            onOpen={openCart}
          />
          <ContactButtons raised={cartQuantity > 0} />
        </>
      ) : null}

      {activeImage ? (
        <div
          className="lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Ảnh phóng to"
          onClick={() => setActiveImage(null)}
        >
          <button className="lightbox-close" type="button" aria-label="Đóng ảnh" onClick={() => setActiveImage(null)}>
            <X size={22} aria-hidden="true" />
          </button>
          {canNavigateLightbox ? (
            <button
              className="lightbox-nav previous"
              type="button"
              aria-label="Xem ảnh trước"
              onClick={(event) => {
                event.stopPropagation();
                openGalleryImage(-1);
              }}
            >
              <ChevronLeft size={26} aria-hidden="true" />
            </button>
          ) : null}
          <div className="lightbox-media" onClick={(event) => event.stopPropagation()}>
            <img
              src={getSupabaseImageSrc(activeImage.src, IMAGE_WIDTHS.catalog, 80)}
              srcSet={getSupabaseImageSrcSet(activeImage.src, 80)}
              sizes="100vw"
              alt={activeImage.alt}
              decoding="async"
            />
            <span className="lightbox-caption">{activeImage.caption}</span>
            {activeImage.cartItem ? (
              <button
                className={activeImageCartQuantity > 0 ? "lightbox-add-button active" : "lightbox-add-button"}
                type="button"
                onClick={() => addToCart(activeImage.cartItem!)}
              >
                <ShoppingBag size={17} aria-hidden="true" />
                Thêm vào giỏ
                {activeImageCartQuantity > 0 ? <span className="lightbox-add-count">{activeImageCartQuantity}</span> : null}
              </button>
            ) : null}
          </div>
          {canNavigateLightbox ? (
            <button
              className="lightbox-nav next"
              type="button"
              aria-label="Xem ảnh sau"
              onClick={(event) => {
                event.stopPropagation();
                openGalleryImage(1);
              }}
            >
              <ChevronRight size={26} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
