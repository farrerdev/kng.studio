import {
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  LogOut,
  Menu,
  RotateCcw,
  Save,
  ShoppingBag,
  X,
} from "lucide-react";
import { type Dispatch, type SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import { getAdminProductTypeSlugFromPath, getStorefrontSlugFromPath } from "./routes";
import { shopConfig } from "../config/shop";
import {
  fetchStorefrontStats,
  markAnalyticsOptOutDevice,
  trackStorefrontEvent,
  type StorefrontEventRow,
} from "../features/analytics/analyticsApi";
import {
  DEFAULT_STOREFRONT_STATS_FILTER,
  getStorefrontStatsRange,
  type StorefrontStatsFilter,
} from "../features/analytics/statsFilters";
import { AdminProductManager } from "../features/admin/components/AdminProductManager";
import { AdminStatsDashboard } from "../features/admin/components/AdminStatsDashboard";
import { CartCheckoutCta } from "../features/storefront/cart/CartCheckoutCta";
import { CartOverlay, OrderImagePreview } from "../features/storefront/cart/CartOverlay";
import {
  getProductCoverImage,
  getProductDisplayName,
  getProductPrice,
  getProductSlug,
  getProductTitle,
  getProductType,
  getProductTypeSizeChartImage,
  getProductTypeSlug,
} from "../features/catalog/catalogUtils";
import { loadStoredCartItems } from "../features/storefront/cart/cartStorage";
import type { CartDraft, CartItem } from "../features/storefront/cart/cartTypes";
import { getCartQuantity, getCartTotal, getOrderTotal, getShippingFee } from "../features/storefront/cart/cartUtils";
import { createOrderFileName, createOrderImageBlob } from "../features/storefront/cart/orderImage";
import { getProductGalleryImages, getVisibleProducts } from "../features/storefront/storefrontGallery";
import { CART_STORAGE_KEY, IMAGE_WIDTHS } from "../features/storefront/storefrontConstants";
import { OtherProductsCarousel } from "../features/storefront/components/OtherProductsCarousel";
import { PolicyModal, PolicySections } from "../features/storefront/components/PolicySections";
import { ProductCard } from "../features/storefront/components/ProductCard";
import { ContactButtons, StorefrontFooter } from "../features/storefront/components/StorefrontChrome";
import type { GalleryImage, ShareChannel } from "../features/storefront/storefrontTypes";
import { supabase } from "../lib/supabase";
import {
  fallbackCatalog,
  fetchCatalog,
  isSupabaseConfigured,
  saveCatalog,
  uploadCatalogImage,
} from "../features/catalog/catalogApi";
import { LoadingPanel } from "../shared/components/LoadingPanel";
import { getSupabaseImageSrc } from "../shared/utils/image";
import { formatPrice } from "../shared/utils/money";
import { moveItem } from "../shared/utils/reorder";
import type { Product, ProductImage, ProductPattern, ProductType, SizeId } from "../types/catalog";

const SITE_URL = "https://kngstudio.vercel.app";
const DEFAULT_PAGE_TITLE = "KNG.studio | Muslin homewear";
const DEFAULT_PAGE_DESCRIPTION = "Catalog đồ ngủ muslin homewear KNG.studio tại Đà Nẵng: xem mẫu còn hàng, size, giá và nhắn shop để chốt đơn.";
const DEFAULT_PAGE_IMAGE = `${SITE_URL}/favicon-192.png`;

function createProductPageMeta(product: Product, productTypes: ProductType[], products: Product[]) {
  const productTitle = getProductTitle(product, productTypes);
  const productPrice = formatPrice(getProductPrice(product, productTypes));
  const productSlug = getProductSlug(product, productTypes);
  const coverImage = getProductCoverImage(product, productTypes, products);

  return {
    title: `${productTitle} | KNG.studio`,
    description: `${productTitle} - ${productPrice}. Xem mẫu còn hàng, size và nhắn KNG.studio để chốt đơn.`,
    url: `${SITE_URL}/${productSlug}`,
    image: getAbsolutePreviewImageSrc(coverImage.src),
    imageAlt: coverImage.alt || productTitle,
    type: "product",
    twitterCard: "summary_large_image",
  };
}

function getAbsolutePreviewImageSrc(src: string) {
  try {
    return new URL(getSupabaseImageSrc(src || DEFAULT_PAGE_IMAGE, 1200, 82, 630, "contain"), window.location.origin).toString();
  } catch {
    return DEFAULT_PAGE_IMAGE;
  }
}

function updateMetaTag(attribute: "name" | "property", key: string, content: string) {
  const selector = `meta[${attribute}="${key}"]`;
  let metaTag = document.querySelector<HTMLMetaElement>(selector);
  if (!metaTag) {
    metaTag = document.createElement("meta");
    metaTag.setAttribute(attribute, key);
    document.head.appendChild(metaTag);
  }
  metaTag.content = content;
}

function updateCanonical(href: string) {
  let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonical.href = href;
}

function App() {
  const [catalogProductTypes, setCatalogProductTypes] = useState<ProductType[]>(
    isSupabaseConfigured ? [] : fallbackCatalog.productTypes,
  );
  const [catalogProducts, setCatalogProducts] = useState<Product[]>(
    isSupabaseConfigured ? [] : fallbackCatalog.products,
  );
  const [currentShopInfoImage, setCurrentShopInfoImage] = useState<ProductImage | null>(
    isSupabaseConfigured ? null : fallbackCatalog.shopInfoImage,
  );
  const [catalogStatus, setCatalogStatus] = useState("Đang tải catalog...");
  const [catalogLoadState, setCatalogLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [selectedSize, setSelectedSize] = useState<SizeId>("1");
  const [activeImage, setActiveImage] = useState<GalleryImage | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>(() => loadStoredCartItems());
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
  const [selectedProductSlug, setSelectedProductSlug] = useState<string | null>(() => getStorefrontSlugFromPath());
  const homeScrollYRef = useRef(0);
  const shouldRestoreHomeScrollRef = useRef(false);
  const cartCloseTimeoutRef = useRef<number | null>(null);
  const trackedProductViewRef = useRef<string | null>(null);
  const trackedSiteVisitRef = useRef(false);
  const isAdminRoute = typeof window !== "undefined" && window.location.pathname.startsWith("/admin");

  const storefrontProducts = useMemo(() => {
    const typeOrder = new Map(catalogProductTypes.map((productType, index) => [productType.id, index]));
    return catalogProducts
      .map((product, index) => ({ product, index }))
      .filter(({ product }) => product.patterns.length > 0)
      .sort((left, right) => {
        const leftTypeOrder = typeOrder.get(left.product.productTypeId) ?? Number.MAX_SAFE_INTEGER;
        const rightTypeOrder = typeOrder.get(right.product.productTypeId) ?? Number.MAX_SAFE_INTEGER;
        return leftTypeOrder === rightTypeOrder ? left.index - right.index : leftTypeOrder - rightTypeOrder;
      })
      .map(({ product }) => product);
  }, [catalogProductTypes, catalogProducts]);
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
  const cartQuantity = useMemo(() => getCartQuantity(cartItems), [cartItems]);
  const cartTotal = useMemo(() => getCartTotal(cartItems), [cartItems]);
  const shippingFee = useMemo(() => getShippingFee(cartItems), [cartItems]);
  const orderTotal = useMemo(() => getOrderTotal(cartItems), [cartItems]);
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
      homeScrollYRef.current = window.scrollY;
    }
    const slug = getProductSlug(product, catalogProductTypes);
    setSelectedProductSlug(slug);
    window.history.pushState(null, "", `/${slug}`);
    window.scrollTo({ top: 0 });
  };
  const restoreHomeScroll = () => {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: homeScrollYRef.current });
    });
  };
  const closeProduct = () => {
    setSelectedProductSlug(null);
    window.history.pushState(null, "", "/");
    restoreHomeScroll();
  };
  const goHeaderHome = () => {
    setIsSidebarOpen(false);
    if (selectedProduct) {
      closeProduct();
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const goHomeSection = (sectionId?: string) => {
    setIsSidebarOpen(false);
    if (selectedProduct) {
      setSelectedProductSlug(null);
      window.history.pushState(null, "", "/");
      window.requestAnimationFrame(() => {
        if (sectionId) {
          document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
          return;
        }
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
      return;
    }
    if (sectionId) {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
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
    if (cartItems.length === 0) return;
    setIsOrderImagePreparing(true);
    try {
      const createdAt = new Date();
      const blob = await createOrderImageBlob(cartItems, createdAt);
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

  useEffect(() => {
    if (isAdminRoute) {
      document.title = "KNG.studio Admin";
      return;
    }

    const pageMeta = selectedProduct
      ? createProductPageMeta(selectedProduct, catalogProductTypes, catalogProducts)
      : {
          title: DEFAULT_PAGE_TITLE,
          description: DEFAULT_PAGE_DESCRIPTION,
          url: `${SITE_URL}/`,
          image: DEFAULT_PAGE_IMAGE,
          imageAlt: "KNG.studio",
          type: "website",
          twitterCard: "summary",
        };

    document.title = pageMeta.title;
    updateMetaTag("name", "description", pageMeta.description);
    updateMetaTag("property", "og:type", pageMeta.type);
    updateMetaTag("property", "og:title", pageMeta.title);
    updateMetaTag("property", "og:description", pageMeta.description);
    updateMetaTag("property", "og:url", pageMeta.url);
    updateMetaTag("property", "og:image", pageMeta.image);
    updateMetaTag("property", "og:image:alt", pageMeta.imageAlt);
    updateMetaTag("name", "twitter:card", pageMeta.twitterCard);
    updateMetaTag("name", "twitter:title", pageMeta.title);
    updateMetaTag("name", "twitter:description", pageMeta.description);
    updateMetaTag("name", "twitter:image", pageMeta.image);
    updateMetaTag("name", "twitter:image:alt", pageMeta.imageAlt);
    updateCanonical(pageMeta.url);
  }, [catalogProductTypes, catalogProducts, isAdminRoute, selectedProduct]);

  useEffect(() => {
    if (!("scrollRestoration" in window.history)) return;
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    return () => {
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

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

  useEffect(() => {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
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
      showCartTooltip(`${cartQuantity} sản phẩm trong giỏ hàng, chốt đơn ngay`);
    }, 600);
    return () => window.clearTimeout(timeoutId);
  }, [cartQuantity, isCartOpen]);

  useEffect(() => {
    const syncProductTypeFromRoute = () => {
      const nextSlug = getStorefrontSlugFromPath();
      if (!nextSlug) {
        shouldRestoreHomeScrollRef.current = true;
      }
      setSelectedProductSlug(nextSlug);
    };

    window.addEventListener("popstate", syncProductTypeFromRoute);
    return () => window.removeEventListener("popstate", syncProductTypeFromRoute);
  }, []);

  useEffect(() => {
    if (selectedProductSlug || !shouldRestoreHomeScrollRef.current) return;
    shouldRestoreHomeScrollRef.current = false;
    restoreHomeScroll();
  }, [selectedProductSlug]);

  useEffect(() => {
    if (isAdminRoute || trackedSiteVisitRef.current) return;
    trackedSiteVisitRef.current = true;
    void trackStorefrontEvent({ eventType: "site_visit" });
  }, [isAdminRoute]);

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

  useEffect(() => {
    let isMounted = true;
    fetchCatalog()
      .then((catalog) => {
        if (!isMounted) return;
        setCatalogProductTypes(isSupabaseConfigured ? catalog.productTypes : fallbackCatalog.productTypes);
        setCatalogProducts(isSupabaseConfigured ? catalog.products : fallbackCatalog.products);
        setCurrentShopInfoImage(isSupabaseConfigured ? catalog.shopInfoImage : fallbackCatalog.shopInfoImage);
        setCatalogStatus(isSupabaseConfigured ? "Đã tải dữ liệu thật." : "Đang dùng mock data.");
        setCatalogLoadState("ready");
      })
      .catch(() => {
        if (!isMounted) return;
        setCatalogProductTypes(isSupabaseConfigured ? [] : fallbackCatalog.productTypes);
        setCatalogProducts(isSupabaseConfigured ? [] : fallbackCatalog.products);
        setCurrentShopInfoImage(isSupabaseConfigured ? null : fallbackCatalog.shopInfoImage);
        setCatalogStatus(isSupabaseConfigured ? "Không tải được dữ liệu Supabase." : "Đang dùng mock data.");
        setCatalogLoadState(isSupabaseConfigured ? "error" : "ready");
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const emptyShopInfoImage: ProductImage = {
    id: "shop-info-empty",
    src: "",
    alt: "Bảng giá & Quy định chung",
  };

  if (isAdminRoute) {
    return (
      <AdminPage
        catalogStatus={catalogStatus}
        isCatalogLoading={catalogLoadState === "loading"}
        productTypes={catalogProductTypes}
        products={catalogProducts}
        shopInfoImage={currentShopInfoImage ?? emptyShopInfoImage}
        onProductTypesChange={setCatalogProductTypes}
        onProductsChange={setCatalogProducts}
        onRefresh={async () => {
          const catalog = await fetchCatalog();
          const nextProductTypes = isSupabaseConfigured ? catalog.productTypes : fallbackCatalog.productTypes;
          const nextProducts = isSupabaseConfigured ? catalog.products : fallbackCatalog.products;
          setCatalogProductTypes(nextProductTypes);
          setCatalogProducts(nextProducts);
          const nextShopInfoImage = (isSupabaseConfigured ? catalog.shopInfoImage : fallbackCatalog.shopInfoImage) ?? emptyShopInfoImage;
          setCurrentShopInfoImage(nextShopInfoImage);
          return { productTypes: nextProductTypes, products: nextProducts, shopInfoImage: nextShopInfoImage };
        }}
        onShopInfoImageChange={(updater) =>
          setCurrentShopInfoImage((currentImage) =>
            typeof updater === "function" ? updater(currentImage ?? emptyShopInfoImage) : updater,
          )
        }
      />
    );
  }

  return (
    <>
      <main className="page-shell storefront">
        <header className="site-header">
          <button
            className="site-menu-button"
            type="button"
            aria-label="Mở menu"
            aria-expanded={isSidebarOpen}
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu size={20} aria-hidden="true" />
          </button>
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

        <section className="shipping-promo" aria-label="Ưu đãi vận chuyển">
          <span>Miễn phí vận chuyển từ 2 bộ</span>
          <button type="button" onClick={() => setIsPolicyModalOpen(true)}>
            Xem chi tiết
          </button>
        </section>

        {catalogLoadState === "loading" ? <LoadingPanel /> : null}

        {catalogLoadState !== "loading" && !selectedProduct ? (
          <>
            <section
              className={cartQuantity > 0 ? "product-type-showcase has-cart-cta" : "product-type-showcase"}
              id="products"
              aria-label="Sản phẩm"
            >
              <div className="section-title">
                <h2>Sản phẩm</h2>
                <span>{storefrontProducts.length} mẫu</span>
              </div>
              <div className="storefront-product-grid">
                {storefrontProducts.map((product) => {
                  const coverImage = getProductCoverImage(product, catalogProductTypes, catalogProducts);
                  const productTitle = getProductTitle(product, catalogProductTypes);
                  return (
                    <button
                      className="storefront-product-card"
                      key={product.id}
                      type="button"
                      onClick={() => openProduct(product)}
                    >
                      <img
                        src={getSupabaseImageSrc(coverImage.src, IMAGE_WIDTHS.catalog, 80)}
                        sizes="(max-width: 760px) 50vw, 50vw"
                        alt={coverImage.alt}
                        loading="lazy"
                        decoding="async"
                      />
                      <span className="storefront-product-info">
                        <span>{productTitle}</span>
                        <strong>{formatPrice(getProductPrice(product, catalogProductTypes))}</strong>
                      </span>
                    </button>
                  );
                })}
              </div>
              <CartCheckoutCta cartQuantity={cartQuantity} onClick={openCart} />
            </section>

            <PolicySections className="storefront-policy" includeIds />
          </>
        ) : null}

        {catalogLoadState !== "loading" && selectedProduct && selectedProductType ? (
        <section className="product-type-screen" aria-label={`Sản phẩm ${getProductTitle(selectedProduct, catalogProductTypes)}`}>
          <button className="back-button" type="button" onClick={closeProduct}>
            <ChevronLeft size={18} aria-hidden="true" />
            Sản phẩm
          </button>
          <header className="product-type-screen-header">
            <h2>{getProductTitle(selectedProduct, catalogProductTypes)}</h2>
            <strong>{formatPrice(getProductPrice(selectedProduct, catalogProductTypes))}</strong>
          </header>
          <div className="catalog-layout">
            <section className="catalog-list" aria-label="Danh sách sản phẩm">
              {visibleProduct ? (
                <ProductCard
                  key={visibleProduct.id}
                  onImageOpen={setActiveImage}
                  onAddToCart={addToCart}
                  getCartItemQuantity={(itemId) => cartQuantityById.get(itemId) ?? 0}
                  onOpenPolicy={() => setIsPolicyModalOpen(true)}
                  product={visibleProduct}
                  productTypes={catalogProductTypes}
                  selectedSize={selectedSize}
                  onSizeChange={setSelectedSize}
                  sizeChartCaption={`${selectedProductType.name || "Loại sản phẩm"} - bảng size`}
                  sizeChartImage={getProductTypeSizeChartImage(selectedProductType, catalogProducts)}
                  compact
                />
              ) : (
                <section className="empty-state">
                  <h3>Size này tạm hết hàng</h3>
                  <p>Bạn có thể chọn size khác hoặc nhắn Instagram/Messenger để shop kiểm tra mẫu mới nhất.</p>
                </section>
              )}
              <CartCheckoutCta cartQuantity={cartQuantity} onClick={openCart} compact />
              <OtherProductsCarousel
                allProducts={catalogProducts}
                currentProductId={selectedProduct.id}
                onProductOpen={openProduct}
                products={storefrontProducts}
                productTypes={catalogProductTypes}
              />
            </section>
          </div>
        </section>
        ) : null}
      </main>

      <StorefrontFooter />

      <div className={isSidebarOpen ? "storefront-sidebar-backdrop open" : "storefront-sidebar-backdrop"} onClick={() => setIsSidebarOpen(false)} />
      <aside className={isSidebarOpen ? "storefront-sidebar open" : "storefront-sidebar"} aria-label="Menu điều hướng" aria-hidden={!isSidebarOpen}>
        <div className="storefront-sidebar-header">
          <strong>{shopConfig.brand}</strong>
          <button type="button" aria-label="Đóng menu" onClick={() => setIsSidebarOpen(false)}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <nav className="storefront-sidebar-nav">
          <button type="button" onClick={() => goHomeSection()}>Trang chủ</button>
          <details className="sidebar-products-group">
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
        orderTotal={orderTotal}
        isOrderImagePreparing={isOrderImagePreparing}
        onClose={closeCart}
        onCapture={captureOrderImage}
        onOpenMessage={openOrderMessage}
        onClear={clearCart}
        onQuantityChange={updateCartQuantity}
        onRemove={removeCartItem}
        shippingFee={shippingFee}
      />

      {isPolicyModalOpen ? <PolicyModal onClose={() => setIsPolicyModalOpen(false)} /> : null}

      {orderImagePreviewUrl ? (
        <OrderImagePreview
          imageUrl={orderImagePreviewUrl}
          onClose={() => setOrderImagePreviewUrl(null)}
          onShare={shareCurrentOrderImage}
        />
      ) : null}

      <ContactButtons />

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

type AdminPageProps = {
  catalogStatus: string;
  isCatalogLoading: boolean;
  productTypes: ProductType[];
  products: Product[];
  shopInfoImage: ProductImage;
  onProductTypesChange: Dispatch<SetStateAction<ProductType[]>>;
  onProductsChange: Dispatch<SetStateAction<Product[]>>;
  onShopInfoImageChange: Dispatch<SetStateAction<ProductImage>>;
  onRefresh: () => Promise<{ productTypes: ProductType[]; products: Product[]; shopInfoImage: ProductImage }>;
};

const createId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const createImage = (id: string, src = "", alt = "Ảnh sản phẩm"): ProductImage => ({
  id,
  src,
  alt,
});

type AdminSaveState = {
  status: "idle" | "saving" | "success" | "error";
  message: string;
};

type AdminScreen = "catalog" | "stats";
type AdminEditSession = {
  mode: "productType" | "product";
  id: string;
  isNew: boolean;
  baselineProductTypes: ProductType[];
  baselineProducts: Product[];
};
type AdminHomeSortSession = {
  productTypes: ProductType[];
  products: Product[];
};
type AdminProductDetailOrigin = "home" | "type";
type AdminClosingDetail = "productType" | "product" | null;

const getCatalogSnapshotKey = (productTypes: ProductType[], products: Product[]) =>
  JSON.stringify({ productTypes, products });

function AdminPage({
  catalogStatus,
  isCatalogLoading,
  productTypes,
  products,
  shopInfoImage: adminShopInfoImage,
  onProductTypesChange,
  onProductsChange,
  onRefresh,
}: AdminPageProps) {
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [selectedAdminProductTypeId, setSelectedAdminProductTypeId] = useState<string | null>(null);
  const [adminProductTypeSlug, setAdminProductTypeSlug] = useState<string | null>(() => getAdminProductTypeSlugFromPath());
  const [adminScreen, setAdminScreen] = useState<AdminScreen>(() => (getAdminProductTypeSlugFromPath() ? "catalog" : "stats"));
  const [statsFilter, setStatsFilter] = useState<StorefrontStatsFilter>(DEFAULT_STOREFRONT_STATS_FILTER);
  const [storefrontEvents, setStorefrontEvents] = useState<StorefrontEventRow[]>([]);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(Boolean(supabase));
  const [isBusy, setIsBusy] = useState(false);
  const [adminMessage, setAdminMessage] = useState(catalogStatus);
  const [saveState, setSaveState] = useState<AdminSaveState>({ status: "idle", message: "" });
  const [adminTypeEditSession, setAdminTypeEditSession] = useState<AdminEditSession | null>(null);
  const [adminProductEditSession, setAdminProductEditSession] = useState<AdminEditSession | null>(null);
  const [adminProductDetailOrigin, setAdminProductDetailOrigin] = useState<AdminProductDetailOrigin | null>(null);
  const [closingAdminDetail, setClosingAdminDetail] = useState<AdminClosingDetail>(null);
  const [previewImage, setPreviewImage] = useState<GalleryImage | null>(null);
  const [homeSortSession, setHomeSortSession] = useState<AdminHomeSortSession | null>(null);
  const [hasHomeReorderChanges, setHasHomeReorderChanges] = useState(false);
  const adminDetailScrollYRef = useRef<number | null>(null);

  useEffect(() => {
    setAdminMessage(catalogStatus);
  }, [catalogStatus]);

  const defaultProductType = productTypes[0] ?? null;
  const selectedAdminProductType =
    productTypes.find((productType) => productType.id === selectedAdminProductTypeId) ?? null;
  const selectedTypeProducts = selectedAdminProductType
    ? products.filter((product) => product.productTypeId === selectedAdminProductType.id)
    : [];
  const selectedProduct = products.find((product) => product.id === expandedProductId) ?? null;
  const isAdminTypeDetailOpen = adminScreen === "catalog" && Boolean(adminProductTypeSlug && selectedAdminProductType);
  const isAdminProductDetailOpen = adminScreen === "catalog" && Boolean(expandedProductId && selectedProduct);
  const isAdminTypeOverlayVisible =
    isAdminTypeDetailOpen && (!isAdminProductDetailOpen || adminProductDetailOrigin === "type");
  const isAdminProductOverlayVisible = isAdminProductDetailOpen;
  const isAdminDetailOverlayActive =
    isAdminTypeOverlayVisible || isAdminProductOverlayVisible || closingAdminDetail !== null;
  const isHomeSorting = Boolean(homeSortSession);
  const activeAdminTypeEditSession =
    adminTypeEditSession &&
    selectedAdminProductType &&
    adminTypeEditSession.mode === "productType" &&
    adminTypeEditSession.id === selectedAdminProductType.id
      ? adminTypeEditSession
      : null;
  const activeAdminProductEditSession =
    adminProductEditSession &&
    selectedProduct &&
    adminProductEditSession.mode === "product" &&
    adminProductEditSession.id === selectedProduct.id
      ? adminProductEditSession
      : null;
  const isPristineNewAdminType = Boolean(
    activeAdminTypeEditSession?.isNew &&
      selectedAdminProductType &&
      selectedAdminProductType.name.trim() === "" &&
      selectedAdminProductType.price.trim() === "" &&
      selectedAdminProductType.coverImage.src.trim() === "" &&
      selectedAdminProductType.sizeChartImage.src.trim() === "" &&
      selectedTypeProducts.length === 0 &&
      getCatalogSnapshotKey(
        productTypes.filter((productType) => productType.id !== selectedAdminProductType.id),
        products,
      ) === getCatalogSnapshotKey(activeAdminTypeEditSession.baselineProductTypes, activeAdminTypeEditSession.baselineProducts),
  );
  const hasAdminTypeChanges = Boolean(
    activeAdminTypeEditSession &&
      !isPristineNewAdminType &&
      getCatalogSnapshotKey(productTypes, products) !==
        getCatalogSnapshotKey(activeAdminTypeEditSession.baselineProductTypes, activeAdminTypeEditSession.baselineProducts),
  );
  const isPristineNewAdminProduct = Boolean(
    activeAdminProductEditSession?.isNew &&
      selectedProduct &&
      selectedProduct.name.trim() === "" &&
      selectedProduct.fit.trim() === "" &&
      selectedProduct.material === "Xô muslin 2 lớp" &&
      selectedProduct.patterns.length === 0 &&
      selectedProduct.modelImages.length === 0 &&
      selectedProduct.sizeChartImage.src.trim() === "" &&
      productTypes.some(
        (productType) => productType.id === selectedProduct.productTypeId && selectedProduct.price === productType.price,
      ) &&
      getCatalogSnapshotKey(
        productTypes,
        products.filter((product) => product.id !== selectedProduct.id),
      ) ===
        getCatalogSnapshotKey(activeAdminProductEditSession.baselineProductTypes, activeAdminProductEditSession.baselineProducts),
  );
  const hasAdminProductChanges = Boolean(
    activeAdminProductEditSession &&
      !isPristineNewAdminProduct &&
      getCatalogSnapshotKey(productTypes, products) !==
        getCatalogSnapshotKey(activeAdminProductEditSession.baselineProductTypes, activeAdminProductEditSession.baselineProducts),
  );
  const hiddenDraftProductTypeId = activeAdminTypeEditSession?.isNew ? activeAdminTypeEditSession.id : null;
  const hiddenDraftProductId = activeAdminProductEditSession?.isNew ? activeAdminProductEditSession.id : null;

  const createAdminEditSession = (
    mode: AdminEditSession["mode"],
    id: string,
    isNew = false,
    baselineProductTypes = productTypes,
    baselineProducts = products,
  ): AdminEditSession => ({
    mode,
    id,
    isNew,
    baselineProductTypes,
    baselineProducts,
  });

  const startAdminTypeEditSession = (
    id: string,
    isNew = false,
    baselineProductTypes = productTypes,
    baselineProducts = products,
  ) => setAdminTypeEditSession(createAdminEditSession("productType", id, isNew, baselineProductTypes, baselineProducts));

  const startAdminProductEditSession = (
    id: string,
    isNew = false,
    baselineProductTypes = productTypes,
    baselineProducts = products,
  ) => setAdminProductEditSession(createAdminEditSession("product", id, isNew, baselineProductTypes, baselineProducts));

  const rememberAdminDetailScroll = () => {
    if (adminDetailScrollYRef.current === null) {
      adminDetailScrollYRef.current = window.scrollY;
    }
  };

  const restoreAdminDetailScroll = () => {
    adminDetailScrollYRef.current = null;
  };

  const toggleExpandProduct = (productId: string) => {
    setExpandedProductId((current) => (current === productId ? null : productId));
  };

  const openAdminProductType = (productType: ProductType) => {
    rememberAdminDetailScroll();
    const slug = getProductTypeSlug(productType);
    setClosingAdminDetail(null);
    setAdminProductDetailOrigin(null);
    setSelectedAdminProductTypeId(productType.id);
    setAdminProductTypeSlug(slug);
    setExpandedProductId(null);
    startAdminTypeEditSession(productType.id);
  };

  const closeAdminProductType = (syncPath = true) => {
    setSelectedAdminProductTypeId(null);
    setAdminProductTypeSlug(null);
    setExpandedProductId(null);
    setAdminProductDetailOrigin(null);
    setAdminTypeEditSession(null);
    setAdminProductEditSession(null);
    if (syncPath && window.location.pathname !== "/admin") {
      window.history.pushState(null, "", "/admin");
    }
  };

  const selectAdminProduct = (productId: string | null, origin: AdminProductDetailOrigin = "home") => {
    setClosingAdminDetail(null);
    if (productId) {
      rememberAdminDetailScroll();
    }
    setExpandedProductId(productId);
    if (productId) {
      const product = products.find((currentProduct) => currentProduct.id === productId);
      const productType = productTypes.find((currentType) => currentType.id === product?.productTypeId);
      if (productType) {
        setSelectedAdminProductTypeId(productType.id);
        setAdminProductTypeSlug(getProductTypeSlug(productType));
        if (origin === "type" && !activeAdminTypeEditSession) {
          startAdminTypeEditSession(productType.id);
        }
      }
      setAdminProductDetailOrigin(origin);
      startAdminProductEditSession(productId);
      return;
    }

    if (selectedAdminProductType) {
      startAdminTypeEditSession(selectedAdminProductType.id);
    }
  };

  useEffect(() => {
    if (!adminProductTypeSlug) {
      setSelectedAdminProductTypeId(null);
      return;
    }
    if (
      selectedAdminProductTypeId &&
      productTypes.some((currentProductType) => currentProductType.id === selectedAdminProductTypeId)
    ) {
      return;
    }
    const productType = productTypes.find((currentProductType) => getProductTypeSlug(currentProductType) === adminProductTypeSlug);
    if (productType) {
      setSelectedAdminProductTypeId(productType.id);
      return;
    }
    setSelectedAdminProductTypeId(null);
  }, [adminProductTypeSlug, productTypes, selectedAdminProductTypeId]);

  useEffect(() => {
    if (!isAdminDetailOverlayActive) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isAdminDetailOverlayActive]);

  useEffect(() => {
    if (!selectedAdminProductTypeId) return;
    if (productTypes.some((productType) => productType.id === selectedAdminProductTypeId)) return;
    setSelectedAdminProductTypeId(null);
  }, [productTypes, selectedAdminProductTypeId]);

  useEffect(() => {
    if (!isAdminTypeDetailOpen || !selectedAdminProductType) return;
    setAdminTypeEditSession((currentSession) => {
      if (currentSession?.mode === "productType" && currentSession.id === selectedAdminProductType.id) return currentSession;
      return createAdminEditSession("productType", selectedAdminProductType.id, false, productTypes, products);
    });
  }, [isAdminTypeDetailOpen, selectedAdminProductType?.id, productTypes, products]);

  useEffect(() => {
    if (!isAdminProductDetailOpen || !selectedProduct) return;
    setAdminProductEditSession((currentSession) => {
      if (currentSession?.mode === "product" && currentSession.id === selectedProduct.id) return currentSession;
      return createAdminEditSession("product", selectedProduct.id, false, productTypes, products);
    });
  }, [isAdminProductDetailOpen, selectedProduct?.id, productTypes, products]);

  useEffect(() => {
    const syncAdminRoute = () => {
      setAdminProductTypeSlug(getAdminProductTypeSlugFromPath());
    };

    window.addEventListener("popstate", syncAdminRoute);
    return () => window.removeEventListener("popstate", syncAdminRoute);
  }, []);

  useEffect(() => {
    if (!supabase) {
      return;
    }

    supabase.auth
      .getSession()
      .then(({ data }) => {
        const hasSession = Boolean(data.session);
        if (hasSession) markAnalyticsOptOutDevice();
        setIsSignedIn(hasSession);
      })
      .finally(() => setIsAuthLoading(false));

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const hasSession = Boolean(session);
      if (hasSession) markAnalyticsOptOutDevice();
      setIsSignedIn(hasSession);
      setIsAuthLoading(false);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const loadStorefrontStats = async (filter = statsFilter) => {
    if (!isSignedIn) return;
    setIsStatsLoading(true);
    try {
      setStorefrontEvents(await fetchStorefrontStats(getStorefrontStatsRange(filter)));
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : "Không tải được thống kê.");
    } finally {
      setIsStatsLoading(false);
    }
  };

  useEffect(() => {
    if (!isSignedIn || adminScreen !== "stats") return;
    void loadStorefrontStats(statsFilter);
  }, [adminScreen, isSignedIn, statsFilter]);

  const updateProduct = (productId: string, patch: Partial<Product>) => {
    onProductsChange((currentProducts) =>
      currentProducts.map((product) => (product.id === productId ? { ...product, ...patch } : product)),
    );
  };

  const addProductType = () => {
    rememberAdminDetailScroll();
    const id = createId("type");
    const productType = {
      id,
      name: "",
      price: "",
      coverImage: createImage(createId("type-cover"), "", "Ảnh bìa loại sản phẩm"),
      sizeChartImage: createImage(createId("type-size-chart"), "", "Bảng size loại sản phẩm"),
    };
    const baselineProductTypes = productTypes;
    const baselineProducts = products;
    onProductTypesChange((currentTypes) => [
      ...currentTypes,
      productType,
    ]);
    setSelectedAdminProductTypeId(id);
    setAdminProductTypeSlug(getProductTypeSlug(productType));
    setExpandedProductId(null);
    setAdminProductDetailOrigin(null);
    setClosingAdminDetail(null);
    startAdminTypeEditSession(id, true, baselineProductTypes, baselineProducts);
  };

  const updateProductType = (productTypeId: string, patch: Partial<ProductType>) => {
    onProductTypesChange((currentTypes) =>
      currentTypes.map((productType) =>
        productType.id === productTypeId ? { ...productType, ...patch } : productType,
      ),
    );
  };

  const removeProductType = (productTypeId: string) => {
    if (productTypes.length <= 1) return;
    const nextProductType = productTypes.find((productType) => productType.id !== productTypeId);
    if (!nextProductType) return;

    onProductTypesChange((currentTypes) => currentTypes.filter((productType) => productType.id !== productTypeId));
    setSelectedAdminProductTypeId((current) => (current === productTypeId ? null : current));
    onProductsChange((currentProducts) =>
      currentProducts.map((product) =>
        product.productTypeId === productTypeId
          ? { ...product, productTypeId: nextProductType.id, price: nextProductType.price }
          : product,
      ),
    );
  };

  const reorderProductType = (productTypeId: string, direction: -1 | 1) => {
    onProductTypesChange((currentTypes) => {
      const index = currentTypes.findIndex((productType) => productType.id === productTypeId);
      const nextTypes = index === -1 ? currentTypes : moveItem(currentTypes, index, direction);
      if (nextTypes !== currentTypes) {
        setHasHomeReorderChanges(true);
      }
      return nextTypes;
    });
  };

  const reorderProduct = (productId: string, direction: -1 | 1) => {
    onProductsChange((currentProducts) => {
      const index = currentProducts.findIndex((product) => product.id === productId);
      return index === -1 ? currentProducts : moveItem(currentProducts, index, direction);
    });
  };

  const reorderProductWithinType = (productId: string, direction: -1 | 1) => {
    onProductsChange((currentProducts) => {
      const product = currentProducts.find((currentProduct) => currentProduct.id === productId);
      if (!product) return currentProducts;

      const typeProducts = currentProducts.filter((currentProduct) => currentProduct.productTypeId === product.productTypeId);
      const typeIndex = typeProducts.findIndex((currentProduct) => currentProduct.id === productId);
      const targetTypeProduct = typeProducts[typeIndex + direction];
      if (!targetTypeProduct) return currentProducts;

      const index = currentProducts.findIndex((currentProduct) => currentProduct.id === productId);
      const targetIndex = currentProducts.findIndex((currentProduct) => currentProduct.id === targetTypeProduct.id);
      if (index === -1 || targetIndex === -1) return currentProducts;

      const nextProducts = [...currentProducts];
      const [movedProduct] = nextProducts.splice(index, 1);
      nextProducts.splice(targetIndex, 0, movedProduct);
      setHasHomeReorderChanges(true);
      return nextProducts;
    });
  };

  const startHomeSorting = () => {
    setHomeSortSession({ productTypes, products });
    setHasHomeReorderChanges(false);
  };

  const cancelHomeSorting = () => {
    if (homeSortSession) {
      onProductTypesChange(homeSortSession.productTypes);
      onProductsChange(homeSortSession.products);
    }
    setHomeSortSession(null);
    setHasHomeReorderChanges(false);
  };

  const saveHomeSorting = async () => {
    if (!homeSortSession || !hasHomeReorderChanges) return;
    const saved = await saveToSupabase();
    if (!saved) return;
    setHomeSortSession(null);
    setHasHomeReorderChanges(false);
  };

  const updatePattern = (productId: string, patternId: string, patch: Partial<ProductPattern>) => {
    onProductsChange((currentProducts) =>
      currentProducts.map((product) =>
        product.id === productId
          ? {
              ...product,
              patterns: product.patterns.map((pattern) =>
                pattern.id === patternId ? { ...pattern, ...patch } : pattern,
              ),
            }
          : product,
      ),
    );
  };

  const updateModelImage = (productId: string, imageId: string, patch: Partial<ProductImage>) => {
    onProductsChange((currentProducts) =>
      currentProducts.map((product) =>
        product.id === productId
          ? {
              ...product,
              modelImages: product.modelImages.map((image) =>
                image.id === imageId ? { ...image, ...patch } : image,
              ),
            }
          : product,
      ),
    );
  };

  const togglePatternSize = (productId: string, pattern: ProductPattern, sizeId: SizeId) => {
    const availableSizes = pattern.availableSizes.includes(sizeId)
      ? pattern.availableSizes.filter((currentSize) => currentSize !== sizeId)
      : [...pattern.availableSizes, sizeId];
    updatePattern(productId, pattern.id, { availableSizes });
  };

  const setPatternAsCover = (productId: string, patternId: string) => {
    onProductsChange((currentProducts) =>
      currentProducts.map((product) => {
        if (product.id !== productId) return product;
        const patternIndex = product.patterns.findIndex((pattern) => pattern.id === patternId);
        if (patternIndex <= 0) return product;
        const nextPatterns = [...product.patterns];
        const [coverPattern] = nextPatterns.splice(patternIndex, 1);
        nextPatterns.unshift(coverPattern);
        return { ...product, patterns: nextPatterns };
      }),
    );
  };

  const addProduct = (productTypeId = selectedAdminProductType?.id ?? defaultProductType?.id) => {
    rememberAdminDetailScroll();
    const id = createId("product");
    const baselineProductTypes = productTypes;
    const baselineProducts = products;
    const productType =
      productTypes.find((currentProductType) => currentProductType.id === productTypeId) ??
      defaultProductType ?? {
      id: createId("type"),
      name: "",
      price: "",
      coverImage: createImage(createId("type-cover"), "", "Ảnh bìa loại sản phẩm"),
      sizeChartImage: createImage(createId("type-size-chart"), "", "Bảng size loại sản phẩm"),
    };

    if (!defaultProductType) {
      onProductTypesChange((currentTypes) => [...currentTypes, productType]);
    }

    const newProduct: Product = {
      id,
      productTypeId: productType.id,
      name: "",
      price: productType.price,
      fit: "",
      material: "Xô muslin 2 lớp",
      patterns: [],
      modelImages: [],
      sizeChartImage: createImage(createId("size-chart"), "", "Ảnh bảng size"),
    };
    onProductsChange((currentProducts) => [...currentProducts, newProduct]);
    setSelectedAdminProductTypeId(productType.id);
    setExpandedProductId(id);
    setAdminProductTypeSlug(getProductTypeSlug(productType));
    setAdminProductDetailOrigin(selectedAdminProductType ? "type" : "home");
    setClosingAdminDetail(null);
    startAdminProductEditSession(id, true, baselineProductTypes, baselineProducts);
  };

  const addPatterns = (productId: string, urls: string[]) => {
    const newPatterns: ProductPattern[] = urls.map((url) => ({
      id: createId("pattern"),
      name: "",
      accent: "#c8b69a",
      image: createImage(createId("pattern-image"), url, "Họa tiết"),
      availableSizes: ["1", "2"],
    }));

    onProductsChange((currentProducts) =>
      currentProducts.map((product) =>
        product.id === productId ? { ...product, patterns: [...product.patterns, ...newPatterns] } : product,
      ),
    );
  };

  const removePattern = (productId: string, patternId: string) => {
    onProductsChange((currentProducts) =>
      currentProducts.map((product) =>
        product.id === productId
          ? { ...product, patterns: product.patterns.filter((pattern) => pattern.id !== patternId) }
          : product,
      ),
    );
  };

  const addModelImage = (productId: string, src: string) => {
    const newImage = createImage(createId("model-image"), src, "Ảnh mẫu & chi tiết sản phẩm");
    onProductsChange((currentProducts) =>
      currentProducts.map((product) =>
        product.id === productId ? { ...product, modelImages: [...product.modelImages, newImage] } : product,
      ),
    );
  };

  const addModelImages = (productId: string, urls: string[]) => {
    const newImages = urls.map((url) => createImage(createId("model-image"), url, "Ảnh mẫu & chi tiết sản phẩm"));
    onProductsChange((currentProducts) =>
      currentProducts.map((product) =>
        product.id === productId ? { ...product, modelImages: [...product.modelImages, ...newImages] } : product,
      ),
    );
  };

  const removeProduct = (product: Product) => {
    const productTitle = getProductTitle(product, productTypes);
    const confirmed = window.confirm(`Xóa sản phẩm "${productTitle}"? Sau khi bấm Lưu Supabase, sản phẩm này sẽ bị xóa khỏi database.`);
    if (!confirmed) return;

    onProductsChange((currentProducts) => currentProducts.filter((currentProduct) => currentProduct.id !== product.id));
    setExpandedProductId((current) => (current === product.id ? null : current));
  };

  const removeModelImage = (productId: string, imageId: string) => {
    onProductsChange((currentProducts) =>
      currentProducts.map((product) =>
        product.id === productId
          ? { ...product, modelImages: product.modelImages.filter((image) => image.id !== imageId) }
          : product,
      ),
    );
  };

  const reorderModelImage = (productId: string, imageId: string, direction: -1 | 1) => {
    onProductsChange((currentProducts) =>
      currentProducts.map((product) => {
        if (product.id !== productId) return product;
        const imageIndex = product.modelImages.findIndex((image) => image.id === imageId);
        if (imageIndex === -1) return product;
        return { ...product, modelImages: moveItem(product.modelImages, imageIndex, direction) };
      }),
    );
  };

  const signIn = async () => {
    if (!supabase) return;
    setIsBusy(true);
    setAdminMessage("Đang đăng nhập...");
    const { error } = await supabase.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword,
    });
    setIsBusy(false);
    setAdminMessage(error ? error.message : "Đã đăng nhập.");
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setAdminMessage("Đã đăng xuất.");
  };

  const saveToSupabase = async () => {
    setIsBusy(true);
    setAdminMessage("Đang lưu lên Supabase...");
    setSaveState({ status: "saving", message: "Đang lưu lên Supabase..." });
    try {
      await saveCatalog({
        productTypes,
        products,
        shopInfoImage: adminShopInfoImage,
      });
      setHasHomeReorderChanges(false);
      const message = `Đã lưu lúc ${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}.`;
      setAdminMessage(message);
      setSaveState({ status: "success", message });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không lưu được catalog.";
      setAdminMessage(message);
      setSaveState({ status: "error", message });
      return false;
    } finally {
      setIsBusy(false);
    }
  };

  const saveAdminTypeDetail = async () => {
    if (!activeAdminTypeEditSession || !hasAdminTypeChanges) return;
    const saved = await saveToSupabase();
    if (!saved) return;
    setAdminTypeEditSession({
      ...activeAdminTypeEditSession,
      isNew: false,
      baselineProductTypes: productTypes,
      baselineProducts: products,
    });
  };

  const saveAdminProductDetail = async () => {
    if (!activeAdminProductEditSession || !hasAdminProductChanges) return;
    const saved = await saveToSupabase();
    if (!saved) return;
    setAdminProductEditSession({
      ...activeAdminProductEditSession,
      isNew: false,
      baselineProductTypes: productTypes,
      baselineProducts: products,
    });
  };

  const closeAdminDetailWithAnimation = (detail: Exclude<AdminClosingDetail, null>, afterClose: () => void) => {
    setClosingAdminDetail(detail);
    window.setTimeout(() => {
      afterClose();
    }, 190);
    window.setTimeout(() => {
      setClosingAdminDetail(null);
      restoreAdminDetailScroll();
    }, 280);
  };

  const leaveAdminProductDetail = () => {
    const isClosingHomeProduct = adminProductDetailOrigin === "home";
    if (isClosingHomeProduct) {
      setAdminProductDetailOrigin(null);
      setSelectedAdminProductTypeId(null);
      setAdminProductTypeSlug(null);
    }

    closeAdminDetailWithAnimation("product", () => {
      setExpandedProductId(null);
      setAdminProductEditSession(null);
      if (!isClosingHomeProduct) {
        setAdminProductDetailOrigin(null);
        if (selectedAdminProductType && !activeAdminTypeEditSession) {
          startAdminTypeEditSession(selectedAdminProductType.id);
        }
      }
    });
  };

  const leaveAdminTypeDetail = () => {
    closeAdminDetailWithAnimation("productType", () => closeAdminProductType());
  };

  const discardAdminProductDetailChanges = () => {
    if (!activeAdminProductEditSession) {
      leaveAdminProductDetail();
      return;
    }

    const isClosingHomeProduct = adminProductDetailOrigin === "home";
    closeAdminDetailWithAnimation("product", () => {
      onProductTypesChange(activeAdminProductEditSession.baselineProductTypes);
      onProductsChange(activeAdminProductEditSession.baselineProducts);
      setExpandedProductId(null);
      setAdminProductEditSession(null);
      setAdminProductDetailOrigin(null);
      if (isClosingHomeProduct) {
        setSelectedAdminProductTypeId(null);
        setAdminProductTypeSlug(null);
      } else if (selectedAdminProductType) {
        setAdminTypeEditSession((currentSession) =>
          currentSession ??
          createAdminEditSession(
            "productType",
            selectedAdminProductType.id,
            false,
            activeAdminProductEditSession.baselineProductTypes,
            activeAdminProductEditSession.baselineProducts,
          ),
        );
      }
    });
  };

  const discardAdminTypeDetailChanges = () => {
    if (!activeAdminTypeEditSession) {
      leaveAdminTypeDetail();
      return;
    }

    closeAdminDetailWithAnimation("productType", () => {
      onProductTypesChange(activeAdminTypeEditSession.baselineProductTypes);
      onProductsChange(activeAdminTypeEditSession.baselineProducts);
      closeAdminProductType();
    });
  };

  const backFromAdminProductDetail = () => {
    if (isPristineNewAdminProduct) {
      discardAdminProductDetailChanges();
      return;
    }

    if (!hasAdminProductChanges) {
      leaveAdminProductDetail();
      return;
    }

    const confirmed = window.confirm(
      activeAdminProductEditSession?.isNew
        ? "Bỏ tạo mới? Dữ liệu vừa nhập sẽ không được lưu."
        : "Bạn có thay đổi chưa lưu. Bấm OK để bỏ thay đổi và quay lại.",
    );
    if (!confirmed) return;
    discardAdminProductDetailChanges();
  };

  const backFromAdminTypeDetail = () => {
    if (isPristineNewAdminType) {
      discardAdminTypeDetailChanges();
      return;
    }

    if (!hasAdminTypeChanges) {
      leaveAdminTypeDetail();
      return;
    }

    const confirmed = window.confirm(
      activeAdminTypeEditSession?.isNew
        ? "Bỏ tạo mới? Dữ liệu vừa nhập sẽ không được lưu."
        : "Bạn có thay đổi chưa lưu. Bấm OK để bỏ thay đổi và quay lại.",
    );
    if (!confirmed) return;
    discardAdminTypeDetailChanges();
  };

  const refreshFromSupabase = async () => {
    setIsBusy(true);
    setAdminMessage("Đang tải lại dữ liệu...");
    try {
      const refreshedCatalog = await onRefresh();
      setHasHomeReorderChanges(false);
      if (adminScreen === "stats") {
        await loadStorefrontStats(statsFilter);
      }
      setAdminMessage("Đã tải lại dữ liệu từ Supabase.");
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : "Không tải lại được dữ liệu.");
    } finally {
      setIsBusy(false);
    }
  };

  const uploadImage = async (file: File, folder: string, onUploaded: (url: string) => void) => {
    setIsBusy(true);
    setAdminMessage("Đang upload ảnh...");
    try {
      const publicUrl = await uploadCatalogImage(file, folder);
      onUploaded(publicUrl);
      setAdminMessage("Upload ảnh xong, bấm Lưu Supabase để ghi dữ liệu.");
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : "Không upload được ảnh.");
    } finally {
      setIsBusy(false);
    }
  };

  const uploadImages = async (files: File[], folder: string, onUploaded: (urls: string[]) => void) => {
    if (files.length === 0) return;

    setIsBusy(true);
    setAdminMessage(`Đang upload ${files.length} ảnh...`);
    try {
      const publicUrls: string[] = [];
      for (const file of files) {
        publicUrls.push(await uploadCatalogImage(file, folder));
      }
      onUploaded(publicUrls);
      setAdminMessage("Upload ảnh xong, bấm Lưu Supabase để ghi dữ liệu.");
    } catch (error) {
      setAdminMessage(error instanceof Error ? error.message : "Không upload được ảnh.");
    } finally {
      setIsBusy(false);
    }
  };

  if (!isSupabaseConfigured) {
    return (
      <main className="admin-shell">
        <section className="admin-empty">
          <h2>Chưa cấu hình Supabase</h2>
          <p>Thêm `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY`, chạy SQL trong `supabase/schema.sql`, rồi mở lại `/admin`.</p>
          <a className="admin-link" href="/">
            <Eye size={17} aria-hidden="true" />
            Xem mock site
          </a>
        </section>
      </main>
    );
  }

  if (isAuthLoading || isCatalogLoading) {
    return (
      <main className="admin-shell">
        <LoadingPanel variant="admin" />
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main className="admin-shell">
        <section className="admin-login">
          <div>
            <span className="eyebrow">Supabase admin</span>
            <h1>Đăng nhập KNG.studio</h1>
            <p>Dùng email/password đã tạo trong Supabase Auth.</p>
          </div>
          <label>
            <span>Email</span>
            <input value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} type="email" />
          </label>
          <label>
            <span>Password</span>
            <input
              value={adminPassword}
              onChange={(event) => setAdminPassword(event.target.value)}
              type="password"
            />
          </label>
          <button className="admin-button primary" type="button" disabled={isBusy} onClick={signIn}>
            <Save size={17} aria-hidden="true" />
            Đăng nhập
          </button>
          <p>{adminMessage}</p>
        </section>
      </main>
    );
  }

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <h1>KNG.studio admin</h1>
        <div className="admin-toolbar">
          <div className="admin-actions admin-actions-main">
            <a className="icon-button" href="/" aria-label="Xem site" title="Xem site">
              <Eye size={17} aria-hidden="true" />
            </a>
            <button
              className="icon-button"
              type="button"
              disabled={isBusy || isStatsLoading}
              onClick={refreshFromSupabase}
              aria-label="Reload DB"
              title="Reload DB"
            >
              <RotateCcw size={17} aria-hidden="true" />
            </button>
            <button className="icon-button" type="button" disabled={isBusy} onClick={signOut} aria-label="Đăng xuất" title="Đăng xuất">
              <LogOut size={17} aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>

      <div className="admin-actions admin-actions-secondary">
        {adminScreen === "stats" ? (
          <button className="admin-button primary full-width" type="button" onClick={() => setAdminScreen("catalog")}>
            <ShoppingBag size={17} aria-hidden="true" />
            Quản lý sản phẩm
          </button>
        ) : (
          <>
            <button
              className="admin-button ghost"
              type="button"
              disabled={isBusy || isHomeSorting}
              onClick={() => {
                setAdminScreen("stats");
                setSelectedAdminProductTypeId(null);
                setAdminProductTypeSlug(null);
                setExpandedProductId(null);
                setAdminProductDetailOrigin(null);
                setAdminTypeEditSession(null);
                setAdminProductEditSession(null);
                window.history.pushState(null, "", "/admin");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
            >
              <BarChart3 size={17} aria-hidden="true" />
              Thống kê
            </button>
            {isHomeSorting ? (
              <div className="admin-sort-actions">
                <button className="admin-button ghost" type="button" disabled={isBusy} onClick={cancelHomeSorting}>
                  Huỷ
                </button>
                <button className="admin-button primary" type="button" disabled={isBusy || !hasHomeReorderChanges} onClick={saveHomeSorting}>
                  Lưu
                </button>
              </div>
            ) : (
              <button className="admin-button primary" type="button" disabled={isBusy} onClick={startHomeSorting}>
                Sắp xếp
              </button>
            )}
          </>
        )}
      </div>

      {adminScreen === "stats" ? (
        <AdminStatsDashboard
          events={storefrontEvents}
          filter={statsFilter}
          isLoading={isStatsLoading}
          onFilterChange={setStatsFilter}
          products={products}
          productTypes={productTypes}
        />
      ) : (
        <>
          <AdminProductManager
            adminMessage={adminMessage}
            adminProductTypeSlug={adminProductTypeSlug}
            expandedProductId={expandedProductId}
            hasProductDetailChanges={hasAdminProductChanges}
            hasTypeDetailChanges={hasAdminTypeChanges}
            isProductDetailClosing={closingAdminDetail === "product"}
            isProductDetailVisible={isAdminProductOverlayVisible}
            isTypeDetailClosing={closingAdminDetail === "productType"}
            isTypeDetailVisible={isAdminTypeOverlayVisible}
            isHomeSorting={isHomeSorting}
            isSavingDetail={isBusy}
            productTypeCount={productTypes.length}
            productTypes={productTypes}
            products={products}
            hiddenDraftProductId={hiddenDraftProductId}
            hiddenDraftProductTypeId={hiddenDraftProductTypeId}
            selectedAdminProductType={selectedAdminProductType}
            selectedTypeProducts={selectedTypeProducts}
            onAddModelImages={addModelImages}
            onAddPatterns={addPatterns}
            onAddProduct={addProduct}
            onAddProductType={addProductType}
            onBackFromProductDetail={backFromAdminProductDetail}
            onBackFromTypeDetail={backFromAdminTypeDetail}
            onCloseProductType={closeAdminProductType}
            onOpenProductType={openAdminProductType}
            onPreviewImage={setPreviewImage}
            onRemoveModelImage={removeModelImage}
            onRemovePattern={removePattern}
            onRemoveProduct={removeProduct}
            onRemoveProductType={removeProductType}
            onReorderModelImage={reorderModelImage}
            onReorderProductType={reorderProductType}
            onReorderProductWithinType={reorderProductWithinType}
            onSelectProductFromHome={(productId) => selectAdminProduct(productId, "home")}
            onSetPatternAsCover={setPatternAsCover}
            onSaveProductDetail={saveAdminProductDetail}
            onSaveTypeDetail={saveAdminTypeDetail}
            onTogglePatternSize={togglePatternSize}
            onUpdateModelImage={updateModelImage}
            onUpdatePattern={updatePattern}
            onUpdateProduct={updateProduct}
            onUpdateProductType={updateProductType}
            onUploadImage={uploadImage}
            onUploadImages={uploadImages}
          />

        {saveState.status !== "idle" ? (
          <div
            className={`admin-save-overlay ${saveState.status}`}
            role="status"
            aria-live="polite"
            aria-busy={saveState.status === "saving"}
          >
            <div>
              {saveState.status === "saving" ? (
                <span className="loading-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              ) : null}
              <strong>{saveState.status === "success" ? "Lưu thành công" : saveState.status === "error" ? "Lưu thất bại" : saveState.message}</strong>
              {saveState.status !== "saving" ? <span>{saveState.message}</span> : null}
              {saveState.status !== "saving" ? (
                <button className="admin-button primary" type="button" onClick={() => setSaveState({ status: "idle", message: "" })}>
                  Đóng
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {previewImage ? (
          <button
            className="lightbox"
            type="button"
            aria-label="Đóng ảnh phóng to"
            onClick={() => setPreviewImage(null)}
          >
            <span className="lightbox-close">
              <X size={22} aria-hidden="true" />
            </span>
            <img
              src={getSupabaseImageSrc(previewImage.src, IMAGE_WIDTHS.catalog, 80)}
              sizes="100vw"
              alt={previewImage.alt}
              decoding="async"
            />
            <span className="lightbox-caption">{previewImage.caption}</span>
          </button>
        ) : null}
        </>
      )}
    </main>
  );
}

export default App;
