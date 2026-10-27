import { ChevronDown, ChevronLeft, ChevronRight, Menu, ShoppingBag, X } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { getStorefrontSlugFromPath } from "./routes";
import { shopConfig } from "../config/shop";
import { trackStorefrontEvent } from "../features/analytics/storefrontAnalytics";
import { CartCheckoutCta } from "../features/storefront/cart/CartCheckoutCta";
import { CartOverlay, OrderImagePreview } from "../features/storefront/cart/CartOverlay";
import {
  getProductCoverImage,
  getProductPrice,
  getProductSlug,
  getProductTitle,
  getProductType,
  getProductTypeSizeChartImage,
  isProductInStock,
} from "../features/catalog/catalogUtils";
import { loadStoredCartItems } from "../features/storefront/cart/cartStorage";
import type { CartDraft, CartItem } from "../features/storefront/cart/cartTypes";
import {
  createCartItemId,
  getCartQuantity,
  getCartTotal,
  getMultiSetDiscount,
  getOrderTotal,
  getShippingFee,
  isCartItemAvailable,
} from "../features/storefront/cart/cartUtils";
import { createOrderFileName, createOrderImageBlob } from "../features/storefront/cart/orderImage";
import { getProductGalleryImages, getVisibleProducts } from "../features/storefront/storefrontGallery";
import { CART_STORAGE_KEY, IMAGE_WIDTHS } from "../features/storefront/storefrontConstants";
import { OtherProductsCarousel } from "../features/storefront/components/OtherProductsCarousel";
import { PolicyModal, PolicySections } from "../features/storefront/components/PolicySections";
import { ProductCard } from "../features/storefront/components/ProductCard";
import { ShopeeProductLink } from "../features/storefront/components/ShopeeProductLink";
import { ContactButtons, StorefrontFooter } from "../features/storefront/components/StorefrontChrome";
import type { GalleryImage, ShareChannel } from "../features/storefront/storefrontTypes";
import { fallbackCatalog, type CatalogData } from "../features/catalog/catalogRows";
import { fetchStorefrontCatalog, readCachedCatalog } from "../features/catalog/storefrontCatalog";
import { isSupabaseConfigured } from "../lib/supabaseConfig";
import { LoadingPanel } from "../shared/components/LoadingPanel";
import { getSupabaseImageSrc, getSupabaseImageSrcSet } from "../shared/utils/image";
import { formatPrice } from "../shared/utils/money";
import type { Product, ProductImage, ProductType, SizeId } from "../types/catalog";

const SITE_URL = "https://kngstudio.shop";
const DEFAULT_PAGE_TITLE = "KNG.studio | Muslin homewear";
const DEFAULT_PAGE_DESCRIPTION = "Đồ ngủ muslin - ở nhà cũng xinh ✨. Xem mẫu còn hàng, bảng size, giá và đặt hàng ngay. KNG.studio - Đà Nẵng";
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

// Admin (and supabase-js) loads as its own chunk so storefront visitors never download it.
const AdminPage = lazy(() => import("./AdminPage"));

const isAdminPath = () => typeof window !== "undefined" && window.location.pathname.startsWith("/admin");

// Admin always edits fresh data; the storefront paints the visitor's last-seen catalog immediately.
const fetchAdminCatalog = async (): Promise<CatalogData> => (await import("../features/catalog/catalogApi")).fetchCatalog();

function App() {
  const [initialCatalog] = useState(() => (isSupabaseConfigured && !isAdminPath() ? readCachedCatalog() : null));
  const [catalogProductTypes, setCatalogProductTypes] = useState<ProductType[]>(
    initialCatalog?.productTypes ?? (isSupabaseConfigured ? [] : fallbackCatalog.productTypes),
  );
  const [catalogProducts, setCatalogProducts] = useState<Product[]>(
    initialCatalog?.products ?? (isSupabaseConfigured ? [] : fallbackCatalog.products),
  );
  const [currentShopInfoImage, setCurrentShopInfoImage] = useState<ProductImage | null>(
    initialCatalog ? initialCatalog.shopInfoImage : isSupabaseConfigured ? null : fallbackCatalog.shopInfoImage,
  );
  const [catalogStatus, setCatalogStatus] = useState("Đang tải catalog...");
  const [catalogLoadState, setCatalogLoadState] = useState<"loading" | "ready" | "error">(
    initialCatalog ? "ready" : "loading",
  );
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
  const isAdminRoute = isAdminPath();

  const storefrontProducts = useMemo(() => {
    const typeOrder = new Map(catalogProductTypes.map((productType, index) => [productType.id, index]));
    return catalogProducts
      .map((product, index) => ({ product, index }))
      .filter(({ product }) => isProductInStock(product))
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
      showCartTooltip(
        checkoutCartQuantity > 0
          ? `${checkoutCartQuantity} sản phẩm còn hàng, chốt đơn ngay`
          : `${cartQuantity} sản phẩm trong giỏ đã hết hàng`,
      );
    }, 600);
    return () => window.clearTimeout(timeoutId);
  }, [cartQuantity, checkoutCartQuantity, isCartOpen]);

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
    (isAdminRoute ? fetchAdminCatalog() : fetchStorefrontCatalog())
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
        if (initialCatalog) {
          setCatalogStatus("Đang hiển thị dữ liệu đã lưu trên máy.");
          return;
        }
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
      <Suspense
        fallback={
          <main className="admin-shell">
            <LoadingPanel variant="admin" />
          </main>
        }
      >
        <AdminPage
          catalogStatus={catalogStatus}
          isCatalogLoading={catalogLoadState === "loading"}
          productTypes={catalogProductTypes}
          products={catalogProducts}
          shopInfoImage={currentShopInfoImage ?? emptyShopInfoImage}
          onProductTypesChange={setCatalogProductTypes}
          onProductsChange={setCatalogProducts}
          onRefresh={async () => {
            const catalog = await fetchAdminCatalog();
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
      </Suspense>
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
                        srcSet={getSupabaseImageSrcSet(coverImage.src, 80)}
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
              <CartCheckoutCta
                availableQuantity={checkoutCartQuantity}
                cartQuantity={cartQuantity}
                onClick={openCart}
              />
            </section>

            <PolicySections className="storefront-policy" includeIds />
          </>
        ) : null}

        {catalogLoadState !== "loading" && selectedProduct && selectedProductType ? (
        <section className="product-type-screen" aria-label={`Sản phẩm ${getProductTitle(selectedProduct, catalogProductTypes)}`}>
          <div className="product-detail-actions">
            <button className="back-button" type="button" onClick={closeProduct}>
              <ChevronLeft size={18} aria-hidden="true" />
              Sản phẩm
            </button>
            <ShopeeProductLink url={selectedProduct.shopeeUrl} />
          </div>
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
              <CartCheckoutCta
                availableQuantity={checkoutCartQuantity}
                cartQuantity={cartQuantity}
                onClick={openCart}
                compact
              />
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

export default App;
