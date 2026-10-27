import { BarChart3, ClipboardList, Eye, LogOut, RotateCcw, Save, ShoppingBag, X } from "lucide-react";
import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from "react";
import { getAdminProductTypeSlugFromPath } from "./routes";
import {
  fetchStorefrontStats,
  markAnalyticsOptOutDevice,
  type StorefrontEventRow,
} from "../features/analytics/analyticsApi";
import {
  DEFAULT_STOREFRONT_STATS_FILTER,
  getStorefrontStatsRange,
  type StorefrontStatsFilter,
} from "../features/analytics/statsFilters";
import { AdminOrderCreator } from "../features/admin/components/AdminOrderCreator";
import { AdminProductManager } from "../features/admin/components/AdminProductManager";
import { AdminStatsDashboard } from "../features/admin/components/AdminStatsDashboard";
import { getProductTitle, getProductTypeSlug } from "../features/catalog/catalogUtils";
import type { CartItem } from "../features/storefront/cart/cartTypes";
import { IMAGE_WIDTHS } from "../features/storefront/storefrontConstants";
import type { GalleryImage } from "../features/storefront/storefrontTypes";
import { supabase } from "../lib/supabase";
import {
  cleanupUnreferencedCatalogImages,
  deleteCatalogProduct,
  deleteCatalogProductType,
  isSupabaseConfigured,
  patchCatalogProductType,
  patchCatalogSortOrder,
  patchCatalogProduct,
  uploadCatalogImage,
} from "../features/catalog/catalogApi";
import type { CatalogImageCleanupResult } from "../features/catalog/catalogApi";
import { syncAllProductPreviewImages, syncProductPreviewImage } from "../features/catalog/productPreviewImage";
import { LoadingPanel } from "../shared/components/LoadingPanel";
import { getSupabaseImageSrc, getSupabaseImageSrcSet } from "../shared/utils/image";
import { moveItem } from "../shared/utils/reorder";
import type { Product, ProductImage, ProductPattern, ProductType, SizeId } from "../types/catalog";

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

type AdminScreen = "catalog" | "stats" | "order";
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

const PREVIEW_BACKFILL_STORAGE_KEY = "kng.studio.preview-backfill-at";
const PREVIEW_BACKFILL_INTERVAL_MS = 24 * 60 * 60 * 1000;

const shouldBackfillPreviewImages = () => {
  try {
    const lastRun = Number(window.localStorage.getItem(PREVIEW_BACKFILL_STORAGE_KEY));
    return !lastRun || Date.now() - lastRun > PREVIEW_BACKFILL_INTERVAL_MS;
  } catch {
    return true;
  }
};

const markPreviewImagesBackfilled = () => {
  try {
    window.localStorage.setItem(PREVIEW_BACKFILL_STORAGE_KEY, String(Date.now()));
  } catch {
    // Without storage the backfill simply runs again next time.
  }
};

const getCatalogSnapshotKey = (productTypes: ProductType[], products: Product[]) =>
  JSON.stringify({ productTypes, products });

const withCatalogImageCleanupMessage = (message: string, cleanup: CatalogImageCleanupResult) => {
  if (cleanup.warning) return `${message} ${cleanup.warning}`;
  if (cleanup.deletedCount > 0) return `${message} Đã dọn ${cleanup.deletedCount} ảnh cũ.`;
  return message;
};

export default function AdminPage({
  catalogStatus,
  isCatalogLoading,
  productTypes,
  products,
  onProductTypesChange,
  onProductsChange,
  onRefresh,
}: AdminPageProps) {
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [selectedAdminProductTypeId, setSelectedAdminProductTypeId] = useState<string | null>(null);
  const [adminProductTypeSlug, setAdminProductTypeSlug] = useState<string | null>(() => getAdminProductTypeSlugFromPath());
  const [adminScreen, setAdminScreen] = useState<AdminScreen>(() => (getAdminProductTypeSlugFromPath() ? "catalog" : "stats"));
  const [statsFilter, setStatsFilter] = useState<StorefrontStatsFilter>(DEFAULT_STOREFRONT_STATS_FILTER);
  const [adminOrderItems, setAdminOrderItems] = useState<CartItem[]>([]);
  const [storefrontEvents, setStorefrontEvents] = useState<StorefrontEventRow[]>([]);
  const [isStatsLoading, setIsStatsLoading] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(Boolean(supabase));
  const [isBusy, setIsBusy] = useState(false);
  const [loginMessage, setLoginMessage] = useState("");
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
      !selectedProduct.shopeeUrl?.trim() &&
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

  // Backfill link-preview images at most once a day (older products, or a failed earlier sync);
  // saving a product already keeps its own preview current.
  const hasSyncedPreviewImagesRef = useRef(false);
  useEffect(() => {
    if (!isSignedIn || isCatalogLoading || products.length === 0 || hasSyncedPreviewImagesRef.current) return;
    hasSyncedPreviewImagesRef.current = true;
    if (!shouldBackfillPreviewImages()) return;
    void syncAllProductPreviewImages(products).then(({ failedCount }) => {
      if (failedCount === 0) markPreviewImagesBackfilled();
    });
  }, [isCatalogLoading, isSignedIn, products]);

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

  const removeProductType = async (productTypeId: string) => {
    if (productTypes.length <= 1) return;
    const nextProductType = productTypes.find((productType) => productType.id !== productTypeId);
    if (!nextProductType) return;

    const productType = productTypes.find((currentProductType) => currentProductType.id === productTypeId);
    if (!productType) return;
    if (!window.confirm(`Xóa loại "${productType.name || "Chưa đặt tên"}"? Các sản phẩm sẽ được chuyển sang loại kế tiếp.`)) return;

    setIsBusy(true);
    setSaveState({ status: "saving", message: "Đang xóa loại sản phẩm..." });
    try {
      const cleanup = activeAdminTypeEditSession?.isNew && activeAdminTypeEditSession.id === productTypeId
        ? await cleanupUnreferencedCatalogImages([productType.coverImage.src, productType.sizeChartImage.src])
        : await deleteCatalogProductType(productType, nextProductType.id);
      onProductTypesChange((currentTypes) => currentTypes.filter((currentProductType) => currentProductType.id !== productTypeId));
      setSelectedAdminProductTypeId((current) => (current === productTypeId ? null : current));
      onProductsChange((currentProducts) =>
        currentProducts.map((product) =>
          product.productTypeId === productTypeId
            ? { ...product, productTypeId: nextProductType.id, price: nextProductType.price }
            : product,
        ),
      );
      setAdminTypeEditSession(null);
      const message = withCatalogImageCleanupMessage("Đã xóa đúng loại sản phẩm đã chọn.", cleanup);
      setAdminMessage(message);
      setSaveState({ status: "success", message });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không xóa được loại sản phẩm.";
      setAdminMessage(message);
      setSaveState({ status: "error", message });
    } finally {
      setIsBusy(false);
    }
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
    setIsBusy(true);
    setSaveState({ status: "saving", message: "Đang lưu thứ tự..." });
    try {
      await patchCatalogSortOrder({
        productTypes,
        products,
        baselineProductTypes: homeSortSession.productTypes,
        baselineProducts: homeSortSession.products,
      });
      setHomeSortSession(null);
      setHasHomeReorderChanges(false);
      const message = `Đã lưu lúc ${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}.`;
      setAdminMessage(message);
      setSaveState({ status: "success", message });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không lưu được thứ tự.";
      setAdminMessage(message);
      setSaveState({ status: "error", message });
    } finally {
      setIsBusy(false);
    }
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

  const removeProduct = async (product: Product) => {
    const productTitle = getProductTitle(product, productTypes);
    const confirmed = window.confirm(`Xóa sản phẩm "${productTitle}"? Chỉ sản phẩm này và dữ liệu con của nó sẽ bị xóa.`);
    if (!confirmed) return;

    setIsBusy(true);
    setSaveState({ status: "saving", message: "Đang xóa sản phẩm..." });
    try {
      const cleanup = activeAdminProductEditSession?.isNew && activeAdminProductEditSession.id === product.id
        ? await cleanupUnreferencedCatalogImages([
            product.sizeChartImage.src,
            ...product.patterns.map((pattern) => pattern.image.src),
            ...product.modelImages.map((image) => image.src),
          ])
        : await deleteCatalogProduct(product);
      onProductsChange((currentProducts) => currentProducts.filter((currentProduct) => currentProduct.id !== product.id));
      setExpandedProductId((current) => (current === product.id ? null : current));
      setAdminProductEditSession(null);
      const message = withCatalogImageCleanupMessage("Đã xóa đúng sản phẩm đã chọn.", cleanup);
      setAdminMessage(message);
      setSaveState({ status: "success", message });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không xóa được sản phẩm.";
      setAdminMessage(message);
      setSaveState({ status: "error", message });
    } finally {
      setIsBusy(false);
    }
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
    setLoginMessage("Đang đăng nhập...");
    const { error } = await supabase.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword,
    });
    setIsBusy(false);
    setLoginMessage(error ? "Email hoặc mật khẩu không đúng." : "");
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setAdminMessage("Đã đăng xuất.");
  };

  const saveAdminTypeDetail = async () => {
    if (!activeAdminTypeEditSession || !hasAdminTypeChanges) return;
    const productType = productTypes.find((currentProductType) => currentProductType.id === activeAdminTypeEditSession.id);
    if (!productType) return;

    setIsBusy(true);
    setSaveState({ status: "saving", message: "Đang lưu loại sản phẩm..." });
    try {
      const baselineProductType = activeAdminTypeEditSession.baselineProductTypes.find(
        (currentProductType) => currentProductType.id === productType.id,
      );
      const cleanup = await patchCatalogProductType({
        productType,
        baselineProductType,
        sortOrder: productTypes.indexOf(productType),
        baselineSortOrder: baselineProductType
          ? activeAdminTypeEditSession.baselineProductTypes.indexOf(baselineProductType)
          : undefined,
      });
      const message = withCatalogImageCleanupMessage(
        `Đã lưu lúc ${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}.`,
        cleanup,
      );
      setAdminMessage(message);
      setSaveState({ status: "success", message });
      setAdminTypeEditSession({
        ...activeAdminTypeEditSession,
        isNew: false,
        baselineProductTypes: productTypes,
        baselineProducts: products,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không lưu được loại sản phẩm.";
      setAdminMessage(message);
      setSaveState({ status: "error", message });
    } finally {
      setIsBusy(false);
    }
  };

  const saveAdminProductDetail = async () => {
    if (!activeAdminProductEditSession || !hasAdminProductChanges) return;
    const product = products.find((currentProduct) => currentProduct.id === activeAdminProductEditSession.id);
    const productType = productTypes.find((currentProductType) => currentProductType.id === product?.productTypeId);
    if (!product || !productType) {
      setSaveState({ status: "error", message: "Không tìm thấy sản phẩm hoặc loại sản phẩm để lưu." });
      return;
    }

    setIsBusy(true);
    setAdminMessage("Đang lưu sản phẩm lên Supabase...");
    setSaveState({ status: "saving", message: "Đang lưu sản phẩm lên Supabase..." });
    try {
      const baselineProduct = activeAdminProductEditSession.baselineProducts.find(
        (currentProduct) => currentProduct.id === product.id,
      );
      const cleanup = await patchCatalogProduct({
        product,
        baselineProduct,
        productType,
        sortOrder: products.indexOf(product),
        baselineSortOrder: baselineProduct
          ? activeAdminProductEditSession.baselineProducts.indexOf(baselineProduct)
          : undefined,
      });
      const previewWarning = await syncProductPreviewImage(product).then(
        () => "",
        (error) => {
          console.warn("Product preview sync failed", error);
          return " Chưa cập nhật được ảnh preview link, sẽ thử lại lần sau mở admin.";
        },
      );
      const message = withCatalogImageCleanupMessage(
        `Đã lưu lúc ${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}.`,
        cleanup,
      ) + previewWarning;
      setAdminMessage(message);
      setSaveState({ status: "success", message });
      setAdminProductEditSession({
        ...activeAdminProductEditSession,
        isNew: false,
        baselineProductTypes: productTypes,
        baselineProducts: products,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không lưu được sản phẩm.";
      setAdminMessage(message);
      setSaveState({ status: "error", message });
    } finally {
      setIsBusy(false);
    }
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
            <span className="eyebrow">KNG.studio</span>
            <h1>Đăng nhập quản trị</h1>
            <p>Nhập thông tin đăng nhập để tiếp tục.</p>
          </div>
          <label>
            <span>Email</span>
            <input value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} type="email" />
          </label>
          <label>
            <span>Mật khẩu</span>
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
          {loginMessage ? <p role="status">{loginMessage}</p> : null}
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
        {adminScreen !== "catalog" ? (
          <>
            {adminScreen === "order" ? (
              <button className="admin-button ghost" type="button" onClick={() => setAdminScreen("stats")}>
                <BarChart3 size={17} aria-hidden="true" />
                Thống kê
              </button>
            ) : null}
            <button className="admin-button primary" type="button" onClick={() => setAdminScreen("catalog")}>
              <ShoppingBag size={17} aria-hidden="true" />
              Quản lý sản phẩm
            </button>
            {adminScreen === "stats" ? (
              <button className="admin-button primary" type="button" onClick={() => setAdminScreen("order")}>
                <ClipboardList size={17} aria-hidden="true" />
                Tạo đơn
              </button>
            ) : null}
          </>
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

      {adminScreen === "order" ? (
        <AdminOrderCreator
          orderItems={adminOrderItems}
          onOrderItemsChange={setAdminOrderItems}
          products={products}
          productTypes={productTypes}
        />
      ) : adminScreen === "stats" ? (
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
              srcSet={getSupabaseImageSrcSet(previewImage.src, 80)}
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
