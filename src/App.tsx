import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  Menu,
  Star,
  Image,
  Instagram,
  MapPin,
  Minus,
  PackageCheck,
  Plus,
  RotateCcw,
  Save,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";
import { type Dispatch, type SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import { shopConfig } from "./config/shop";
import { sizeOptions } from "./data/mockCatalog";
import { supabase } from "./lib/supabase";
import {
  fallbackCatalog,
  fetchCatalog,
  isSupabaseConfigured,
  saveCatalog,
  uploadCatalogImage,
} from "./services/catalogApi";
import type { Product, ProductImage, ProductPattern, ProductType, SizeId } from "./types/catalog";

function formatPrice(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return raw;
  const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return formatted + "đ";
}

function getPriceValue(raw: string) {
  return Number(raw.replace(/[^0-9]/g, "")) || 0;
}

function formatMoney(value: number) {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "đ";
}

function createCartItemId(productId: string, patternId: string, sizeId: SizeId) {
  return `${productId}__${patternId}__${sizeId}`;
}

const SHIPPING_FEE = 20000;
const CART_STORAGE_KEY = "kng.studio.cart";

function createOrderFileName(date = new Date()) {
  const dateParts = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");
  const timeParts = [
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0"),
  ].join("");
  return `kng-order-${dateParts}-${timeParts}.png`;
}

function formatOrderCreatedAt(date: Date) {
  const dateParts = [
    String(date.getDate()).padStart(2, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    date.getFullYear(),
  ].join("/");
  const timeParts = [
    String(date.getHours()).padStart(2, "0"),
    String(date.getMinutes()).padStart(2, "0"),
    String(date.getSeconds()).padStart(2, "0"),
  ].join(":");
  return `${timeParts} ${dateParts}`;
}

function loadStoredCartItems(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const rawCart = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!rawCart) return [];
    const parsedCart = JSON.parse(rawCart);
    if (!Array.isArray(parsedCart)) return [];
    return parsedCart.filter(
      (item): item is CartItem =>
        typeof item?.id === "string" &&
        typeof item?.productId === "string" &&
        typeof item?.patternId === "string" &&
        (item?.sizeId === "1" || item?.sizeId === "2") &&
        typeof item?.quantity === "number" &&
        item.quantity > 0 &&
        typeof item?.productName === "string" &&
        typeof item?.patternName === "string" &&
        typeof item?.price === "string" &&
        typeof item?.image?.src === "string" &&
        typeof item?.image?.alt === "string",
    );
  } catch {
    return [];
  }
}

function getProductType(product: Product, productTypes: ProductType[]) {
  return productTypes.find((productType) => productType.id === product.productTypeId) ?? null;
}

function getProductTitle(product: Product, productTypes: ProductType[]) {
  const productType = getProductType(product, productTypes);
  const typeName = productType?.name.trim() || "Loại sản phẩm";
  const productName = product.name.trim();
  return productName ? `${typeName} - ${productName}` : typeName;
}

function getProductDisplayName(product: Product) {
  return product.name.trim() || "Mẫu";
}

function getProductPrice(product: Product, productTypes: ProductType[]) {
  return getProductType(product, productTypes)?.price ?? product.price;
}

function getProductCoverImage(product: Product, productTypes: ProductType[], _products: Product[]): ProductImage {
  const firstPatternImage = product.patterns[0]?.image;
  if (firstPatternImage) return firstPatternImage;

  return {
    id: `${product.id}-cover-fallback`,
    src: "/images/shop-info.webp",
    alt: `Ảnh bìa ${getProductTitle(product, productTypes)}`,
  };
}

function getProductTypeSizeChartImage(productType: ProductType, products: Product[]): ProductImage {
  if (productType.sizeChartImage.src.trim()) {
    return productType.sizeChartImage;
  }

  const firstSizeChart = products.find((product) => product.productTypeId === productType.id)?.sizeChartImage;
  return (
    firstSizeChart ?? {
      id: `${productType.id}-size-chart-fallback`,
      src: "/images/size-chart-moc.webp",
      alt: `Bảng size ${productType.name || "loại sản phẩm"}`,
    }
  );
}

function slugify(value: string) {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "san-pham";
}

function getProductTypeSlug(productType: ProductType) {
  return slugify(productType.name || productType.id);
}

function getProductSlug(product: Product, productTypes: ProductType[]) {
  return slugify(getProductTitle(product, productTypes) || product.id);
}

function getStorefrontSlugFromPath() {
  if (typeof window === "undefined") return null;
  const path = decodeURIComponent(window.location.pathname).replace(/^\/+|\/+$/g, "");
  if (!path || path === "admin" || path.startsWith("admin/")) return null;
  return path.split("/")[0] || null;
}

function getAdminProductTypeSlugFromPath() {
  if (typeof window === "undefined") return null;
  const path = decodeURIComponent(window.location.pathname).replace(/^\/+|\/+$/g, "");
  if (path === "admin" || !path.startsWith("admin/")) return null;
  return path.split("/")[1] || null;
}

function moveItem<T>(items: T[], fromIndex: number, direction: -1 | 1) {
  const toIndex = fromIndex + direction;
  if (toIndex < 0 || toIndex >= items.length) return items;

  const nextItems = [...items];
  const [item] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, item);
  return nextItems;
}

type GalleryImage = ProductImage & {
  caption: string;
  cartItem?: CartDraft;
};

type CartItem = {
  id: string;
  productId: string;
  patternId: string;
  sizeId: SizeId;
  quantity: number;
  productName: string;
  patternName: string;
  price: string;
  image: ProductImage;
};

type CartDraft = Omit<CartItem, "quantity">;

type ShareChannel = "instagram" | "messenger";

type AdminImageActionFieldProps = {
  image: ProductImage;
  caption: string;
  ariaLabel: string;
  className?: string;
  onPreview: (image: GalleryImage) => void;
  onFileSelected: (file: File) => void;
};

function AdminImageActionField({
  image,
  caption,
  ariaLabel,
  className,
  onPreview,
  onFileSelected,
}: AdminImageActionFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasImage = image.src.trim().length > 0;

  const rootClassName = className ? `pattern-thumb-field ${className}` : "pattern-thumb-field";

  return (
    <div className={hasImage ? rootClassName : `${rootClassName} empty`}>
      <button
        className="thumb-image-button"
        type="button"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        onClick={() => {
          if (!hasImage) {
            inputRef.current?.click();
            return;
          }
          setIsOpen((current) => !current);
        }}
      >
        {hasImage ? (
          <img src={image.src} alt={image.alt} />
        ) : (
          <span className="thumb-empty-state">
            <Plus size={16} aria-hidden="true" />
          </span>
        )}
      </button>
      {hasImage && isOpen ? (
        <div className="thumb-action-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              onPreview({ ...image, caption });
            }}
          >
            Xem ảnh
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              inputRef.current?.click();
            }}
          >
            Upload ảnh mới
          </button>
        </div>
      ) : null}
      <input
        ref={inputRef}
        className="thumb-file-input"
        type="file"
        accept="image/*"
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          onFileSelected(file);
          event.target.value = "";
        }}
      />
    </div>
  );
}

type LoadingPanelProps = {
  variant?: "client" | "admin";
};

function LoadingPanel({ variant = "client" }: LoadingPanelProps) {
  return (
    <section className={`loading-panel ${variant}`} aria-label="Đang tải" aria-live="polite" aria-busy="true">
      <span className="loading-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    </section>
  );
}

function MessengerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 2C6.48 2 2 6.15 2 11.25c0 2.9 1.45 5.49 3.72 7.18V22l3.39-1.86c.92.25 1.89.39 2.89.39 5.52 0 10-4.15 10-9.28S17.52 2 12 2Zm1.03 12.53-2.55-2.7-4.96 2.7 5.43-5.76 2.59 2.7 4.93-2.7-5.44 5.76Z"
      />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M15.12 8.18h-2.02V6.86c0-.49.33-.61.56-.61h1.43V4.01L13.12 4c-2.19 0-2.69 1.64-2.69 2.69v1.49H8.98v2.31h1.45V17h2.67v-6.51h1.8l.22-2.31Z"
      />
    </svg>
  );
}

function InstagramBrandIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M7.75 2h8.5A5.76 5.76 0 0 1 22 7.75v8.5A5.76 5.76 0 0 1 16.25 22h-8.5A5.76 5.76 0 0 1 2 16.25v-8.5A5.76 5.76 0 0 1 7.75 2Zm0 2A3.75 3.75 0 0 0 4 7.75v8.5A3.75 3.75 0 0 0 7.75 20h8.5A3.75 3.75 0 0 0 20 16.25v-8.5A3.75 3.75 0 0 0 16.25 4h-8.5Zm8.8 1.5a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"
      />
    </svg>
  );
}

function ThreadsIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M17.86 10.3c-.11-1.95-.78-3.49-1.98-4.55C14.9 4.88 13.57 4.43 12 4.43c-2.66 0-4.57 1.52-5.32 4.18l1.89.51c.5-1.83 1.63-2.75 3.4-2.75 2.15 0 3.42 1.25 3.67 3.61a8.9 8.9 0 0 0-3.08-.44c-2.72.16-4.46 1.52-4.35 3.4.06.96.59 1.79 1.48 2.34.76.47 1.73.69 2.74.63 1.34-.08 2.39-.66 3.03-1.68.49-.78.7-1.79.65-2.96 1.33.8 2.04 1.95 1.89 3.28-.2 1.77-1.78 3.57-5.66 3.84-3.52.25-6.18-1.02-7.5-3.57-1.2-2.33-1.25-6.15 1.68-8.86C8.02 4.58 9.89 3.91 12.09 3.9c2.22-.02 4.02.69 5.35 2.1 1.33 1.4 2.04 3.42 2.12 6h1.94c-.08-3.08-.98-5.53-2.65-7.29C17.14 2.92 14.88 2 12.08 2 9.4 2.02 7.06 2.87 5.31 4.49 1.78 7.74 1.84 12.49 3.11 15.3c1.53 3.38 4.91 5.19 9.36 4.88 4.57-.32 7.07-2.55 7.43-5.39.25-2.03-.52-3.56-2.04-4.49Zm-5.53 3.68c-1.12.07-2.11-.38-2.16-1.16-.04-.58.4-1.24 2.5-1.36.27-.02.54-.03.79-.03.85 0 1.6.11 2.22.31-.06 1.46-.78 2.15-2.35 2.24Z"
      />
    </svg>
  );
}

function ZaloIcon() {
  return <span className="zalo-mark" aria-hidden="true">Zalo</span>;
}

function formatSelectedSize(sizeId: SizeId) {
  return sizeOptions.find((size) => size.id === sizeId)?.label ?? `Size ${sizeId}`;
}

function getCartTotal(cartItems: CartItem[]) {
  return cartItems.reduce((total, item) => total + getPriceValue(item.price) * item.quantity, 0);
}

function getCartQuantity(cartItems: CartItem[]) {
  return cartItems.reduce((total, item) => total + item.quantity, 0);
}

function getShippingFee(cartItems: CartItem[]) {
  if (cartItems.length === 0) return 0;
  return getCartQuantity(cartItems) >= 2 ? 0 : SHIPPING_FEE;
}

function getOrderTotal(cartItems: CartItem[]) {
  return getCartTotal(cartItems) + getShippingFee(cartItems);
}

function loadOrderImage(src: string) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function wrapCanvasText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(" ");
  let line = "";
  let currentY = y;
  words.forEach((word) => {
    const nextLine = line ? `${line} ${word}` : word;
    if (context.measureText(nextLine).width > maxWidth && line) {
      context.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
      return;
    }
    line = nextLine;
  });
  if (line) context.fillText(line, x, currentY);
  return currentY + lineHeight;
}

async function createOrderImageBlob(cartItems: CartItem[], createdAt = new Date()) {
  const width = 1080;
  const rowHeight = 188;
  const height = Math.max(900, 420 + cartItems.length * rowHeight);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return null;

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#111111";
  context.font = "700 54px Helvetica Neue, Arial, sans-serif";
  context.fillText("KNG.studio", 56, 82);
  context.font = "500 25px Helvetica Neue, Arial, sans-serif";
  context.fillStyle = "#6b6b6b";
  context.fillText("Thông tin đơn hàng", 56, 122);
  context.font = "500 22px Helvetica Neue, Arial, sans-serif";
  context.fillText(`Thời gian: ${formatOrderCreatedAt(createdAt)}`, 56, 158);
  context.strokeStyle = "#d9d9d9";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(56, 190);
  context.lineTo(width - 56, 190);
  context.stroke();

  let y = 236;
  for (const item of cartItems) {
    const image = await loadOrderImage(item.image.src);
    context.fillStyle = "#f4f4f4";
    context.fillRect(56, y - 36, 132, 132);
    if (image) {
      context.save();
      context.beginPath();
      context.rect(56, y - 36, 132, 132);
      context.clip();
      const scale = Math.max(132 / image.width, 132 / image.height);
      const drawWidth = image.width * scale;
      const drawHeight = image.height * scale;
      context.drawImage(image, 56 + (132 - drawWidth) / 2, y - 36 + (132 - drawHeight) / 2, drawWidth, drawHeight);
      context.restore();
    }

    context.fillStyle = "#111111";
    context.font = "700 28px Helvetica Neue, Arial, sans-serif";
    const titleBottom = wrapCanvasText(context, item.productName, 216, y, 520, 34);
    context.font = "500 24px Helvetica Neue, Arial, sans-serif";
    context.fillStyle = "#4d4d4d";
    context.fillText(`${item.patternName} · ${formatSelectedSize(item.sizeId)}`, 216, titleBottom + 8);
    context.fillText(`Số lượng: ${item.quantity}`, 216, titleBottom + 44);
    context.fillStyle = "#111111";
    context.font = "700 26px Helvetica Neue, Arial, sans-serif";
    context.fillText(formatMoney(getPriceValue(item.price) * item.quantity), width - 260, y + 34);
    context.strokeStyle = "#eeeeee";
    context.beginPath();
    context.moveTo(56, y + 128);
    context.lineTo(width - 56, y + 128);
    context.stroke();
    y += rowHeight;
  }

  const subtotal = getCartTotal(cartItems);
  const shippingFee = getShippingFee(cartItems);
  const total = getOrderTotal(cartItems);
  const summaryTop = height - 190;
  context.font = "500 28px Helvetica Neue, Arial, sans-serif";
  context.fillStyle = "#4d4d4d";
  context.fillText("Tạm tính", 56, summaryTop);
  context.fillText(formatMoney(subtotal), width - 300, summaryTop);
  context.fillText("Phí ship", 56, summaryTop + 48);
  if (shippingFee === 0) {
    context.fillStyle = "#8a8a8a";
    context.fillText("20.000đ", width - 430, summaryTop + 48);
    context.strokeStyle = "#8a8a8a";
    context.beginPath();
    context.moveTo(width - 430, summaryTop + 39);
    context.lineTo(width - 335, summaryTop + 39);
    context.stroke();
    context.fillStyle = "#111111";
    context.fillText("0đ", width - 300, summaryTop + 48);
  } else {
    context.fillText(formatMoney(shippingFee), width - 300, summaryTop + 48);
  }
  context.strokeStyle = "#d9d9d9";
  context.beginPath();
  context.moveTo(56, summaryTop + 82);
  context.lineTo(width - 56, summaryTop + 82);
  context.stroke();
  context.fillStyle = "#111111";
  context.font = "800 38px Helvetica Neue, Arial, sans-serif";
  context.fillText("Tổng", 56, height - 58);
  context.fillText(formatMoney(total), width - 300, height - 58);

  return new Promise<Blob | null>((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png", 0.94));
}

function getVisibleProducts(selectedSize: SizeId, catalogProducts: Product[]) {
  return catalogProducts
    .map((product) => ({
      ...product,
      patterns: product.patterns.filter((pattern) => pattern.availableSizes.includes(selectedSize)),
    }))
    .filter((product) => product.patterns.length > 0);
}

function getProductGalleryImages(product: Product, productTypes: ProductType[], selectedSize: SizeId): GalleryImage[] {
  const productTitle = getProductTitle(product, productTypes);
  const price = formatPrice(getProductPrice(product, productTypes));
  return [
    ...product.patterns.map((pattern) => ({
      ...pattern.image,
      caption: `${productTitle} - ${pattern.name} · ${formatSelectedSize(selectedSize)}`,
      cartItem: {
        id: createCartItemId(product.id, pattern.id, selectedSize),
        productId: product.id,
        patternId: pattern.id,
        sizeId: selectedSize,
        productName: productTitle,
        patternName: pattern.name,
        price,
        image: pattern.image,
      },
    })),
    ...product.modelImages.map((image, index) => ({
      ...image,
      caption: `${productTitle} - ảnh mẫu & chi tiết ${index + 1}`,
    })),
  ];
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
  const [cartToast, setCartToast] = useState("");
  const [orderImageBlob, setOrderImageBlob] = useState<Blob | null>(null);
  const [orderImageFileName, setOrderImageFileName] = useState("");
  const [isOrderImagePreparing, setIsOrderImagePreparing] = useState(false);
  const [orderImagePreviewUrl, setOrderImagePreviewUrl] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [selectedProductSlug, setSelectedProductSlug] = useState<string | null>(() => getStorefrontSlugFromPath());
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
  const openProduct = (product: Product) => {
    const hasSelectedSize = product.patterns.some((pattern) => pattern.availableSizes.includes(selectedSize));
    if (!hasSelectedSize) {
      const nextSize = product.patterns.flatMap((pattern) => pattern.availableSizes)[0];
      if (nextSize) setSelectedSize(nextSize);
    }

    const slug = getProductSlug(product, catalogProductTypes);
    setSelectedProductSlug(slug);
    window.history.pushState(null, "", `/${slug}`);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const closeProduct = () => {
    setSelectedProductSlug(null);
    window.history.pushState(null, "", "/");
    window.scrollTo({ top: 0, behavior: "instant" });
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
    setCartToast(`Đã thêm ${item.patternName}`);
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
  const shareOrderFile = async (file: File) => {
    if (!navigator.share) return false;

    const shareData = {
      files: [file],
      title: "KNG.studio order",
      text: "Ảnh đơn hàng KNG.studio",
    };

    try {
      await navigator.share(shareData);
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return true;

      try {
        await navigator.share({ files: [file] });
        return true;
      } catch (fallbackError) {
        if (fallbackError instanceof DOMException && fallbackError.name === "AbortError") return true;
        return false;
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
    } finally {
      setIsOrderImagePreparing(false);
    }
  };
  const shareCurrentOrderImage = async () => {
    if (!orderImageBlob) return;
    await shareOrderFile(new File([orderImageBlob], orderImageFileName || createOrderFileName(), { type: "image/png" }));
  };
  const openOrderMessage = (channel: ShareChannel) => {
    const targetUrl = channel === "instagram" ? shopConfig.contacts.instagramMessage : shopConfig.contacts.messenger;
    window.open(targetUrl, "_blank", "noopener,noreferrer");
  };

  useEffect(() => {
    document.title = isAdminRoute ? "KNG.studio Admin" : "KNG.studio | Muslin homewear";
  }, [isAdminRoute]);

  useEffect(() => {
    if (!isCartOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isCartOpen]);

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
    const timeoutId = window.setTimeout(() => setCartToast(""), 1500);
    return () => window.clearTimeout(timeoutId);
  }, [cartToast]);

  useEffect(() => {
    const syncProductTypeFromRoute = () => {
      setSelectedProductSlug(getStorefrontSlugFromPath());
    };

    window.addEventListener("popstate", syncProductTypeFromRoute);
    return () => window.removeEventListener("popstate", syncProductTypeFromRoute);
  }, []);

  useEffect(() => {
    if (!selectedProduct) return;
    if (selectedProduct.patterns.some((pattern) => pattern.availableSizes.includes(selectedSize))) return;
    const nextSize = selectedProduct.patterns.flatMap((pattern) => pattern.availableSizes)[0];
    if (nextSize) setSelectedSize(nextSize);
  }, [selectedProduct, selectedSize]);

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
          setCatalogProductTypes(isSupabaseConfigured ? catalog.productTypes : fallbackCatalog.productTypes);
          setCatalogProducts(isSupabaseConfigured ? catalog.products : fallbackCatalog.products);
          setCurrentShopInfoImage(isSupabaseConfigured ? catalog.shopInfoImage : fallbackCatalog.shopInfoImage);
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
          <h1>{shopConfig.brand}</h1>
          <button
            className="site-cart-button"
            type="button"
            aria-label={`Mở giỏ hàng, ${cartQuantity} sản phẩm`}
            onClick={() => setIsCartOpen(true)}
          >
            <ShoppingBag size={20} aria-hidden="true" />
            {cartQuantity > 0 ? <span>{cartQuantity}</span> : null}
          </button>
        </header>

        <section className="shipping-promo" aria-label="Ưu đãi vận chuyển">
          <span>Miễn phí vận chuyển đơn từ 2 bộ</span>
        </section>

        {catalogLoadState === "loading" ? <LoadingPanel /> : null}

        {catalogLoadState !== "loading" && !selectedProduct ? (
          <>
            <section className="product-type-showcase" id="products" aria-label="Sản phẩm">
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
                      <img src={coverImage.src} alt={coverImage.alt} loading="lazy" />
                      <span className="storefront-product-info">
                        <span>{productTitle}</span>
                        <strong>{formatPrice(getProductPrice(product, catalogProductTypes))}</strong>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="storefront-policy" id="policy" aria-label="Quy định đặt hàng">
              <article id="gift">
                <h3>Quà tặng</h3>
                <p>Mỗi set được tặng kèm dây buộc tóc scrunchies cùng họa tiết với sản phẩm.</p>
              </article>
              <article id="shipping">
                <h3>Phí ship</h3>
                <p>Phí ship đồng giá 20k. Shop miễn phí vận chuyển cho đơn từ 2 bộ.</p>
              </article>
              <article id="payment">
                <h3>Thanh toán</h3>
                <p>Khách hàng vui lòng thanh toán trước để shop xác nhận và chuẩn bị đơn.</p>
              </article>
              <article id="returns">
                <h3>Đổi hàng</h3>
                <ul>
                  <li>Khách hàng vui lòng quay video khi nhận hàng và mở gói sản phẩm.</li>
                  <li>Với sản phẩm lỗi do nhà sản xuất hoặc shop giao sai mẫu, KNG hỗ trợ đổi 1-1 và chịu toàn bộ chi phí đổi hàng.</li>
                  <li>Với sản phẩm không ưng ý hoặc không vừa, khách có thể đổi sang sản phẩm khác ngang giá hoặc bằng giá sản phẩm cũ trong vòng 3 ngày kể từ ngày nhận hàng.</li>
                  <li>Khách hàng chịu 1 đầu phí ship đổi hàng, KNG hỗ trợ 1 đầu ship gửi lại.</li>
                  <li>Lưu ý: shop chỉ hỗ trợ đổi 1 lần duy nhất.</li>
                </ul>
              </article>
            </section>
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
          <button type="button" onClick={() => goHomeSection("shipping")}>Phí ship</button>
          <button type="button" onClick={() => goHomeSection("payment")}>Thanh toán</button>
          <button type="button" onClick={() => goHomeSection("returns")}>Đổi hàng</button>
        </nav>
      </aside>

      <CartOverlay
        cartItems={cartItems}
        cartTotal={cartTotal}
        isOpen={isCartOpen}
        orderTotal={orderTotal}
        isOrderImagePreparing={isOrderImagePreparing}
        onClose={() => setIsCartOpen(false)}
        onCapture={captureOrderImage}
        onOpenMessage={openOrderMessage}
        onClear={clearCart}
        onQuantityChange={updateCartQuantity}
        onRemove={removeCartItem}
        shippingFee={shippingFee}
      />

      {cartToast ? (
        <div className="cart-toast" role="status" aria-live="polite">
          <ShoppingBag size={17} aria-hidden="true" />
          {cartToast}
        </div>
      ) : null}

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
            <img src={activeImage.src} alt={activeImage.alt} />
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

type ProductCardProps = {
  product: Product;
  productTypes: ProductType[];
  selectedSize: SizeId;
  onImageOpen: (image: GalleryImage) => void;
  onAddToCart: (item: CartDraft) => void;
  getCartItemQuantity: (itemId: string) => number;
  onSizeChange?: (sizeId: SizeId) => void;
  sizeChartCaption?: string;
  sizeChartImage?: ProductImage;
  compact?: boolean;
};

function ProductCard({
  product,
  productTypes,
  selectedSize,
  onImageOpen,
  onAddToCart,
  getCartItemQuantity,
  onSizeChange,
  sizeChartCaption,
  sizeChartImage,
  compact = false,
}: ProductCardProps) {
  const productTitle = getProductTitle(product, productTypes);
  const productPrice = formatPrice(getProductPrice(product, productTypes));

  return (
    <article className="product-card">
      <div className="product-detail">
          <section className="product-overview" aria-label={`Thông tin ${productTitle}`}>
            {product.material.trim() ? <span className="product-material">{product.material}</span> : null}
            {product.fit.trim() ? <p>{product.fit}</p> : null}
            {!compact ? <strong>{formatPrice(getProductPrice(product, productTypes))}</strong> : null}
          </section>

          {compact && sizeChartImage ? (
            <section className="product-size-controls" aria-label={`Bảng size và chọn size ${productTitle}`}>
              <button
                className="size-chart-inline type-size-chart"
                type="button"
                onClick={() =>
                  onImageOpen({
                    ...sizeChartImage,
                    caption: sizeChartCaption ?? `${productTitle} - bảng size`,
                  })
                }
              >
                <div className="size-chart-inline-text">
                  <h4>Bảng size chi tiết</h4>
                  <span>Tap để xem lớn</span>
                </div>
                <img loading="lazy" src={sizeChartImage.src} alt={sizeChartImage.alt} />
              </button>
              <h3 className="size-selector-title">Chọn size để xem mẫu</h3>
              <div className="size-options" role="radiogroup" aria-label="Chọn size">
                {sizeOptions.map((size) => (
                  <button
                    className={selectedSize === size.id ? "size-option active" : "size-option"}
                    key={size.id}
                    type="button"
                    role="radio"
                    aria-checked={selectedSize === size.id}
                    onClick={() => onSizeChange?.(size.id)}
                  >
                    <span>{size.label}</span>
                    <strong>{size.range}</strong>
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section aria-label={`Họa tiết còn hàng của ${productTitle}`}>
            <div className="section-title">
              <h4>Họa tiết còn size {selectedSize}</h4>
              <span>{product.patterns.length} mẫu</span>
            </div>
            <div className="pattern-grid">
              {product.patterns.map((pattern) => {
                const cartItem: CartDraft = {
                  id: createCartItemId(product.id, pattern.id, selectedSize),
                  productId: product.id,
                  patternId: pattern.id,
                  sizeId: selectedSize,
                  productName: productTitle,
                  patternName: pattern.name,
                  price: productPrice,
                  image: pattern.image,
                };
                const cartQuantity = getCartItemQuantity(cartItem.id);
                return (
                  <article className={cartQuantity > 0 ? "image-tile in-cart" : "image-tile"} key={pattern.id}>
                    <button
                      className="image-tile-preview"
                      type="button"
                      onClick={() =>
                        onImageOpen({
                          ...pattern.image,
                          caption: `${productTitle} - ${pattern.name} · ${formatSelectedSize(selectedSize)}`,
                          cartItem,
                        })
                      }
                    >
                      <img loading="lazy" src={pattern.image.src} alt={pattern.image.alt} />
                      <span>{pattern.name}</span>
                    </button>
                    <button
                      className={cartQuantity > 0 ? "pattern-add-button active" : "pattern-add-button"}
                      type="button"
                      aria-label={`Thêm ${pattern.name} size ${selectedSize} vào giỏ`}
                      onClick={() => onAddToCart(cartItem)}
                    >
                      <Plus size={18} aria-hidden="true" />
                      {cartQuantity > 0 ? <span>{cartQuantity}</span> : null}
                    </button>
                    {cartQuantity > 0 ? <span className="pattern-cart-status">Đã thêm vào giỏ hàng</span> : null}
                  </article>
                );
              })}
            </div>
          </section>

          {product.modelImages.length > 0 ? (
          <section aria-label={`Ảnh mẫu & chi tiết sản phẩm ${productTitle}`}>
            <div className="section-title">
              <h4>Ảnh mẫu &amp; chi tiết sản phẩm</h4>
              <span>Tap để xem lớn</span>
            </div>
            <div className="model-grid">
              {product.modelImages.map((image, index) => (
                <button
                  className="model-tile"
                  key={image.id}
                  type="button"
                  onClick={() =>
                    onImageOpen({
                      ...image,
                      caption: `${productTitle} - ảnh mẫu & chi tiết ${index + 1}`,
                    })
                  }
                >
                  <img loading="lazy" src={image.src} alt={image.alt} />
                </button>
              ))}
            </div>
          </section>
          ) : null}

          {!compact ? (
            <section aria-label={`Bảng size ${productTitle}`}>
              <button
                className="size-chart-inline"
                type="button"
                onClick={() =>
                  onImageOpen({
                    ...product.sizeChartImage,
                    caption: `${productTitle} - bảng size`,
                  })
                }
              >
                <div className="size-chart-inline-text">
                  <h4>Bảng size chi tiết</h4>
                  <span>Tap để xem lớn</span>
                </div>
                <img loading="lazy" src={product.sizeChartImage.src} alt={product.sizeChartImage.alt} />
              </button>
            </section>
          ) : null}
      </div>
    </article>
  );
}

function OrderImagePreview({
  imageUrl,
  onClose,
  onShare,
}: {
  imageUrl: string;
  onClose: () => void;
  onShare: () => void;
}) {
  return (
    <div className="order-preview-backdrop" role="dialog" aria-modal="true" aria-label="Ảnh đơn hàng" onClick={onClose}>
      <section className="order-preview-panel" onClick={(event) => event.stopPropagation()}>
        <button className="order-preview-close" type="button" aria-label="Đóng ảnh đơn hàng" onClick={onClose}>
          <X size={20} aria-hidden="true" />
        </button>
        <div>
          <span>Ảnh đơn hàng</span>
          <p>Kiểm tra ảnh đơn hàng, sau đó bấm lưu ảnh để lưu vào Ảnh. Nếu không hiện, nhấn giữ ảnh bên dưới để lưu.</p>
        </div>
        <button className="order-preview-share" type="button" onClick={onShare}>
          <Save size={17} aria-hidden="true" />
          Lưu ảnh
        </button>
        <img src={imageUrl} alt="Ảnh đơn hàng KNG.studio" />
      </section>
    </div>
  );
}

type CartOverlayProps = {
  cartItems: CartItem[];
  cartTotal: number;
  isOpen: boolean;
  orderTotal: number;
  isOrderImagePreparing: boolean;
  onClose: () => void;
  onCapture: () => void;
  onOpenMessage: (channel: ShareChannel) => void;
  onClear: () => void;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onRemove: (itemId: string) => void;
  shippingFee: number;
};

function CartOverlay({
  cartItems,
  cartTotal,
  isOpen,
  orderTotal,
  isOrderImagePreparing,
  onClose,
  onCapture,
  onOpenMessage,
  onClear,
  onQuantityChange,
  onRemove,
  shippingFee,
}: CartOverlayProps) {
  if (!isOpen) return null;

  return (
    <div className="cart-backdrop" role="dialog" aria-modal="true" aria-label="Giỏ hàng" onClick={onClose}>
      <aside className="cart-panel" onClick={(event) => event.stopPropagation()}>
        <header className="cart-header">
          <div>
            <span>Giỏ hàng</span>
            <h2>{cartItems.length > 0 ? `${cartItems.length} mẫu đã chọn` : "Chưa có sản phẩm"}</h2>
          </div>
          <div className="cart-header-actions">
            {cartItems.length > 0 ? (
              <button className="cart-clear-button" type="button" onClick={onClear}>
                Xoá tất cả
              </button>
            ) : null}
            <button className="cart-close-button" type="button" aria-label="Đóng giỏ hàng" onClick={onClose}>
              <X size={21} aria-hidden="true" />
            </button>
          </div>
        </header>

        {cartItems.length > 0 ? (
          <div className="cart-scroll">
            <div className="cart-list">
              {cartItems.map((item) => (
                <article className="cart-row" key={item.id}>
                  <img src={item.image.src} alt={item.image.alt} />
                  <div className="cart-row-info">
                    <h3>{item.productName}</h3>
                    <p>{item.patternName} · {formatSelectedSize(item.sizeId)}</p>
                    <strong>{item.price}</strong>
                    <div className="cart-row-actions">
                      <div className="cart-quantity" aria-label={`Số lượng ${item.patternName}`}>
                        <button type="button" onClick={() => onQuantityChange(item.id, item.quantity - 1)} aria-label="Giảm số lượng">
                          <Minus size={14} aria-hidden="true" />
                        </button>
                        <span>{item.quantity}</span>
                        <button type="button" onClick={() => onQuantityChange(item.id, item.quantity + 1)} aria-label="Tăng số lượng">
                          <Plus size={14} aria-hidden="true" />
                        </button>
                      </div>
                      <button className="cart-remove" type="button" onClick={() => onRemove(item.id)}>
                        Xoá
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <footer className="cart-footer">
              <div className="cart-summary-row">
                <span>Tổng tạm tính</span>
                <strong>{formatMoney(cartTotal)}</strong>
              </div>
              <div className="cart-summary-row">
                <span>Phí ship</span>
                <strong className="shipping-fee">
                  {shippingFee === 0 ? <del>20.000đ</del> : null}
                  {formatMoney(shippingFee)}
                </strong>
              </div>
              <div className="cart-total">
                <span>Tổng thanh toán</span>
                <strong>{formatMoney(orderTotal)}</strong>
              </div>
              <div className="checkout-flow">
                <h3>Quy trình chốt đơn</h3>
                <div className="checkout-step">
                  <span>Bước 1</span>
                  <p>Lưu ảnh đơn hàng về máy.</p>
                  <button
                    className="cart-capture-button"
                    type="button"
                    disabled={isOrderImagePreparing}
                    onClick={onCapture}
                  >
                    {isOrderImagePreparing ? "Đang chuẩn bị ảnh" : "Xem ảnh đơn hàng"}
                  </button>
                </div>
                <div className="checkout-step">
                  <span>Bước 2</span>
                  <p>Gửi ảnh cho shop để xác nhận và thanh toán.</p>
                  <div className="cart-share-actions">
                    <button type="button" onClick={() => onOpenMessage("instagram")}>
                      <Instagram size={18} aria-hidden="true" />
                      Gửi Instagram
                    </button>
                    <button type="button" onClick={() => onOpenMessage("messenger")}>
                      <MessengerIcon />
                      Gửi Messenger
                    </button>
                  </div>
                </div>
              </div>
            </footer>
          </div>
        ) : (
          <section className="cart-empty">
            <ShoppingBag size={34} aria-hidden="true" />
            <h3>Chưa có mẫu nào trong giỏ</h3>
            <p>Chọn hoạ tiết đang còn size rồi bấm dấu cộng để thêm vào giỏ.</p>
          </section>
        )}
      </aside>
    </div>
  );
}

function ContactButtons() {
  return (
    <div className="contact-buttons" aria-label="Nhắn tin đặt hàng">
      <a
        className="contact-button instagram"
        href={shopConfig.contacts.instagramMessage}
        target="_blank"
        rel="noreferrer"
        aria-label="Nhắn tin KNG.studio qua Instagram"
      >
        <Instagram size={22} aria-hidden="true" />
        <span>Instagram</span>
      </a>
      <a
        className="contact-button messenger"
        href={shopConfig.contacts.messenger}
        target="_blank"
        rel="noreferrer"
        aria-label="Nhắn tin KNG.studio qua Messenger"
      >
        <MessengerIcon />
        <span>Messenger</span>
      </a>
    </div>
  );
}

function StorefrontFooter() {
  const footerLinks = [
    { icon: <FacebookIcon />, name: "Facebook", href: shopConfig.contacts.facebook, className: "facebook" },
    { icon: <InstagramBrandIcon />, name: "Instagram", href: shopConfig.contacts.instagram, className: "instagram" },
    { icon: <ZaloIcon />, name: "Zalo", href: shopConfig.contacts.zalo, className: "zalo" },
    { icon: <ThreadsIcon />, name: "Threads", href: shopConfig.contacts.threads, className: "threads" },
  ];

  return (
    <footer className="storefront-footer" aria-label="Thông tin KNG.studio">
      <div className="storefront-footer-inner">
        <div className="storefront-footer-brand">
          <span>{shopConfig.subtitle}</span>
          <h2>{shopConfig.brand}</h2>
        </div>
        <address className="storefront-footer-address">
          <MapPin size={16} aria-hidden="true" />
          <span>Ngũ Hành Sơn, Đà Nẵng</span>
        </address>
        <nav className="storefront-footer-socials" aria-label="Kênh liên hệ">
          {footerLinks.map((link) => (
            <a
              className={`storefront-footer-social ${link.className}`}
              href={link.href}
              key={link.name}
              target="_blank"
              rel="noreferrer"
              aria-label={link.name}
            >
              {link.icon}
            </a>
          ))}
        </nav>
        <p>©2026 KNG.studio. Cảm ơn bạn đã ủng hộ shop.</p>
      </div>
    </footer>
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
  onRefresh: () => Promise<void>;
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

function AdminPage({
  catalogStatus,
  isCatalogLoading,
  productTypes,
  products,
  shopInfoImage: adminShopInfoImage,
  onProductTypesChange,
  onProductsChange,
  onShopInfoImageChange,
  onRefresh,
}: AdminPageProps) {
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const [expandedProductTypeId, setExpandedProductTypeId] = useState<string | null>(null);
  const [selectedAdminProductTypeId, setSelectedAdminProductTypeId] = useState<string | null>(null);
  const [adminProductTypeSlug, setAdminProductTypeSlug] = useState<string | null>(() => getAdminProductTypeSlugFromPath());
  const [showStats, setShowStats] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(Boolean(supabase));
  const [isBusy, setIsBusy] = useState(false);
  const [adminMessage, setAdminMessage] = useState(catalogStatus);
  const [saveState, setSaveState] = useState<AdminSaveState>({ status: "idle", message: "" });
  const [previewImage, setPreviewImage] = useState<GalleryImage | null>(null);

  useEffect(() => {
    setAdminMessage(catalogStatus);
  }, [catalogStatus]);

  const patternCount = products.reduce((total, product) => total + product.patterns.length, 0);
  const availablePatternCount = products.reduce(
    (total, product) => total + product.patterns.filter((pattern) => pattern.availableSizes.length > 0).length,
    0,
  );
  const defaultProductType = productTypes[0] ?? null;
  const selectedAdminProductType =
    productTypes.find((productType) => productType.id === selectedAdminProductTypeId) ?? null;
  const selectedTypeProducts = selectedAdminProductType
    ? products.filter((product) => product.productTypeId === selectedAdminProductType.id)
    : [];

  const toggleExpandProduct = (productId: string) => {
    setExpandedProductId((current) => (current === productId ? null : productId));
  };

  const toggleExpandProductType = (productTypeId: string) => {
    setExpandedProductTypeId((current) => (current === productTypeId ? null : productTypeId));
  };

  const openAdminProductType = (productType: ProductType) => {
    const slug = getProductTypeSlug(productType);
    setSelectedAdminProductTypeId(productType.id);
    setAdminProductTypeSlug(slug);
    window.history.pushState(null, "", `/admin/${slug}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeAdminProductType = () => {
    setSelectedAdminProductTypeId(null);
    setAdminProductTypeSlug(null);
    setExpandedProductId(null);
    window.history.pushState(null, "", "/admin");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    if (!adminProductTypeSlug) {
      setSelectedAdminProductTypeId(null);
      return;
    }
    const productType = productTypes.find((currentProductType) => getProductTypeSlug(currentProductType) === adminProductTypeSlug);
    if (productType) {
      setSelectedAdminProductTypeId(productType.id);
      return;
    }
    setSelectedAdminProductTypeId(null);
  }, [adminProductTypeSlug, productTypes]);

  useEffect(() => {
    if (!selectedAdminProductTypeId) return;
    if (productTypes.some((productType) => productType.id === selectedAdminProductTypeId)) return;
    setSelectedAdminProductTypeId(null);
  }, [productTypes, selectedAdminProductTypeId]);

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
        setIsSignedIn(Boolean(data.session));
      })
      .finally(() => setIsAuthLoading(false));

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsSignedIn(Boolean(session));
      setIsAuthLoading(false);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  const updateProduct = (productId: string, patch: Partial<Product>) => {
    onProductsChange((currentProducts) =>
      currentProducts.map((product) => (product.id === productId ? { ...product, ...patch } : product)),
    );
  };

  const addProductType = () => {
    const id = createId("type");
    const productType = {
      id,
      name: "",
      price: "",
      coverImage: createImage(createId("type-cover"), "", "Ảnh bìa loại sản phẩm"),
      sizeChartImage: createImage(createId("type-size-chart"), "", "Bảng size loại sản phẩm"),
    };
    onProductTypesChange((currentTypes) => [
      ...currentTypes,
      productType,
    ]);
    setExpandedProductTypeId(id);
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
    setExpandedProductTypeId((current) => (current === productTypeId ? null : current));
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
      return index === -1 ? currentTypes : moveItem(currentTypes, index, direction);
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
      return nextProducts;
    });
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
    const id = createId("product");
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
      const message = `Đã lưu lúc ${new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}.`;
      setAdminMessage(message);
      setSaveState({ status: "success", message });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không lưu được catalog.";
      setAdminMessage(message);
      setSaveState({ status: "error", message });
    } finally {
      setIsBusy(false);
    }
  };

  const refreshFromSupabase = async () => {
    setIsBusy(true);
    setAdminMessage("Đang tải lại dữ liệu...");
    try {
      await onRefresh();
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
        <div>
          <span className="eyebrow">Supabase admin</span>
          <h1>KNG.studio</h1>
        </div>
        <div className="admin-actions">
          <button
            className={showStats ? "icon-button active" : "icon-button"}
            type="button"
            onClick={() => setShowStats((s) => !s)}
            aria-label="Tổng quan"
          >
            <BarChart3 size={17} aria-hidden="true" />
          </button>
          <a className="admin-link" href="/">
            <Eye size={17} aria-hidden="true" />
            Xem site
          </a>
          <button className="admin-button ghost" type="button" disabled={isBusy} onClick={refreshFromSupabase}>
            <RotateCcw size={17} aria-hidden="true" />
            Reload DB
          </button>
          <button className="admin-button ghost" type="button" disabled={isBusy} onClick={signOut}>
            Đăng xuất
          </button>
          <button className="admin-button primary" type="button" disabled={isBusy} onClick={saveToSupabase}>
            <Save size={17} aria-hidden="true" />
            Lưu Supabase
          </button>
        </div>
      </header>

      {showStats ? (
        <section className="admin-stats" aria-label="Tổng quan catalog">
          <div>
            <PackageCheck size={20} aria-hidden="true" />
            <span>Sản phẩm</span>
            <strong>{products.length}</strong>
          </div>
          <div>
            <BarChart3 size={20} aria-hidden="true" />
            <span>Loại</span>
            <strong>{productTypes.length}</strong>
          </div>
          <div>
            <Image size={20} aria-hidden="true" />
            <span>Họa tiết</span>
            <strong>{patternCount}</strong>
          </div>
          <div>
            <PackageCheck size={20} aria-hidden="true" />
            <span>Đang còn</span>
            <strong>{availablePatternCount}</strong>
          </div>
        </section>
      ) : null}

      <div className="admin-status-row">
        {adminProductTypeSlug ? (
          <button className="admin-button ghost" type="button" onClick={closeAdminProductType}>
            <ChevronLeft size={17} aria-hidden="true" />
            Danh sách loại
          </button>
        ) : null}
        <p className="admin-status-text">{adminMessage}</p>
      </div>

      <div className="admin-product-list-full">
        {!adminProductTypeSlug ? (
          <>
            <section className="admin-panel-heading flat">
              <div>
                <h2>Loại sản phẩm ({productTypes.length})</h2>
                <p>Tap vào row để mở detail, tap mũi tên để sửa loại</p>
              </div>
            </section>

            <div className="product-type-list standalone">
              {productTypes.map((productType, index) => {
                const isTypeExpanded = expandedProductTypeId === productType.id;
                return (
                  <article className="product-type-item" key={productType.id}>
                    <div className="product-type-header">
                      <button className="product-type-open-button" type="button" onClick={() => openAdminProductType(productType)}>
                        <span>
                          <strong>{productType.name || "Chưa đặt tên"}</strong>
                          <em>{formatPrice(productType.price)}</em>
                        </span>
                        <small>{products.filter((product) => product.productTypeId === productType.id).length} sản phẩm</small>
                      </button>
                      <button
                        className="admin-product-chevron small"
                        type="button"
                        onClick={() => toggleExpandProductType(productType.id)}
                        aria-label={`Sửa ${productType.name || "loại sản phẩm"}`}
                        aria-expanded={isTypeExpanded}
                      >
                        {isTypeExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                    </div>

                    {isTypeExpanded ? (
                      <div className="product-type-row">
                        <AdminImageActionField
                          ariaLabel={`Mở tùy chọn bảng size ${productType.name || "loại sản phẩm"}`}
                          caption={`Bảng size ${productType.name || "loại sản phẩm"}`}
                          className="product-type-size-field"
                          image={productType.sizeChartImage}
                          onPreview={setPreviewImage}
                          onFileSelected={(file) =>
                            uploadImage(file, `product-types/${productType.id}/size-charts`, (url) =>
                              updateProductType(productType.id, {
                                sizeChartImage: {
                                  ...productType.sizeChartImage,
                                  src: url,
                                  alt: productType.sizeChartImage.alt || `Bảng size ${productType.name}`,
                                },
                              }),
                            )
                          }
                        />
                        <label className="product-type-name-field">
                          <span>Loại</span>
                          <input value={productType.name} onChange={(event) => updateProductType(productType.id, { name: event.target.value })} />
                        </label>
                        <label className="product-type-price-field">
                          <span>Giá</span>
                          <input
                            value={productType.price}
                            placeholder="Ví dụ: 390.000đ"
                            onChange={(event) => updateProductType(productType.id, { price: formatPrice(event.target.value) })}
                          />
                        </label>
                        <div className="reorder-controls" aria-label="Sắp xếp loại sản phẩm">
                          <button
                            className="icon-button"
                            type="button"
                            disabled={index === 0}
                            onClick={() => reorderProductType(productType.id, -1)}
                            aria-label={`Đưa ${productType.name || "loại sản phẩm"} lên`}
                          >
                            <ArrowUp size={15} aria-hidden="true" />
                          </button>
                          <button
                            className="icon-button"
                            type="button"
                            disabled={index === productTypes.length - 1}
                            onClick={() => reorderProductType(productType.id, 1)}
                            aria-label={`Đưa ${productType.name || "loại sản phẩm"} xuống`}
                          >
                            <ArrowDown size={15} aria-hidden="true" />
                          </button>
                        </div>
                        <button
                          className="icon-button danger"
                          type="button"
                          disabled={productTypes.length <= 1}
                          onClick={() => removeProductType(productType.id)}
                          aria-label={`Xóa loại ${productType.name}`}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>

            <button className="admin-button primary full-width" type="button" onClick={addProductType}>
              <Plus size={16} aria-hidden="true" />
              Thêm loại
            </button>
          </>
        ) : selectedAdminProductType ? (
          <section className="product-type-detail-panel" aria-label={`Sản phẩm ${selectedAdminProductType.name}`}>
            <div className="admin-panel-heading">
              <div>
                <h2>{selectedAdminProductType.name || "Chưa đặt tên"}</h2>
                <p>
                  {formatPrice(selectedAdminProductType.price)} · {selectedTypeProducts.length} sản phẩm
                </p>
              </div>
            </div>

            {selectedTypeProducts.map((product, productIndex) => {
          const isExpanded = expandedProductId === product.id;
          const productTitle = getProductTitle(product, productTypes);
          return (
            <article className="admin-product-item" key={product.id}>
              <button
                className={isExpanded ? "admin-product-header active" : "admin-product-header"}
                type="button"
                onClick={() => toggleExpandProduct(product.id)}
              >
                <div>
                  <strong>{productTitle}</strong>
                  <span>
                    {formatPrice(getProductPrice(product, productTypes))} · {product.patterns.length} họa tiết
                  </span>
                </div>
                <span className="admin-product-chevron">
                  {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </span>
              </button>

              {isExpanded ? (
                <div className="admin-product-body">
                  <div className="admin-danger-row">
                    <div className="reorder-controls" aria-label="Sắp xếp sản phẩm">
	                      <button
	                        className="admin-button small"
	                        type="button"
	                        disabled={productIndex === 0}
	                        onClick={() => reorderProductWithinType(product.id, -1)}
	                      >
                        <ArrowUp size={15} aria-hidden="true" />
                        Lên
                      </button>
	                      <button
	                        className="admin-button small"
	                        type="button"
	                        disabled={productIndex === selectedTypeProducts.length - 1}
	                        onClick={() => reorderProductWithinType(product.id, 1)}
                      >
                        <ArrowDown size={15} aria-hidden="true" />
                        Xuống
                      </button>
                    </div>
                    <button className="admin-button danger" type="button" onClick={() => removeProduct(product)}>
                      <Trash2 size={16} aria-hidden="true" />
                      Xóa sản phẩm
                    </button>
                  </div>

                  <div className="admin-card">
                    <h3>Thông tin sản phẩm</h3>
                    <div className="admin-form-grid">
                      <label>
                        <span>Loại sản phẩm</span>
                        <select
                          value={product.productTypeId}
                          onChange={(event) => {
                            const productType = productTypes.find((type) => type.id === event.target.value);
                            updateProduct(product.id, {
                              productTypeId: event.target.value,
                              price: productType?.price ?? product.price,
                            });
                          }}
                        >
                          {productTypes.map((productType) => (
                            <option value={productType.id} key={productType.id}>
                              {productType.name} - {formatPrice(productType.price)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Tên sản phẩm</span>
                        <input
                          value={product.name}
                          placeholder="Có thể để trống"
                          onChange={(event) => updateProduct(product.id, { name: event.target.value })}
                        />
                      </label>
                      <label>
                        <span>Chất liệu</span>
                        <input
                          value={product.material}
                          onChange={(event) => updateProduct(product.id, { material: event.target.value })}
                        />
                      </label>
                      <label className="full-row">
                        <span>Mô tả form dáng</span>
                        <textarea
                          value={product.fit}
                          onChange={(event) => updateProduct(product.id, { fit: event.target.value })}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="admin-card">
                    <h3>Họa tiết &amp; tồn size</h3>
                    <div className="pattern-row-list">
                      {product.patterns.map((pattern, patternIndex) => (
                        <article className="pattern-row" key={pattern.id}>
                          <AdminImageActionField
                            ariaLabel={`Mở tùy chọn ảnh ${pattern.name || "họa tiết"}`}
                            caption={pattern.name || "Họa tiết"}
                            image={pattern.image}
                            onPreview={setPreviewImage}
                            onFileSelected={(file) =>
                              uploadImage(file, `patterns/${product.id}`, (url) =>
                                updatePattern(product.id, pattern.id, {
                                  image: { ...pattern.image, src: url },
                                }),
                              )
                            }
                          />

                          <div className="pattern-row-main">
                            <div className="pattern-name-field">
                              <input
                                aria-label="Tên phân loại"
                                value={pattern.name}
                                placeholder="Nhập tên phân loại"
                                onChange={(event) =>
                                  updatePattern(product.id, pattern.id, { name: event.target.value })
                                }
                              />
                              <ChevronDown size={18} aria-hidden="true" />
                            </div>

                            <div className="pattern-size-switches" aria-label={`Tồn size ${pattern.name}`}>
                              {sizeOptions.map((size) => (
                                <button
                                  className={pattern.availableSizes.includes(size.id) ? "size-switch active" : "size-switch"}
                                  key={size.id}
                                  type="button"
                                  aria-pressed={pattern.availableSizes.includes(size.id)}
                                  onClick={() => togglePatternSize(product.id, pattern, size.id)}
                                >
                                  {size.label}
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="pattern-actions">
                            <button
                              className={patternIndex === 0 ? "icon-button active cover-pattern-button" : "icon-button cover-pattern-button"}
                              type="button"
                              aria-label={`${patternIndex === 0 ? "Đang là" : "Đặt làm"} ảnh bìa ${pattern.name || "họa tiết"}`}
                              aria-pressed={patternIndex === 0}
                              onClick={() => setPatternAsCover(product.id, pattern.id)}
                              title={patternIndex === 0 ? "Ảnh bìa" : "Đặt làm ảnh bìa"}
                            >
                              <Star size={15} aria-hidden="true" fill={patternIndex === 0 ? "currentColor" : "none"} />
                            </button>
                            <button
                              className="icon-button danger pattern-delete"
                              type="button"
                              aria-label={`Xóa ${pattern.name}`}
                              onClick={() => removePattern(product.id, pattern.id)}
                            >
                              <Trash2 size={16} aria-hidden="true" />
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                    <label className="admin-button small full-width file-button">
                      <Plus size={16} aria-hidden="true" />
                      Thêm phân loại (chọn nhiều ảnh)
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(event) => {
                          const files = Array.from(event.target.files ?? []);
                          if (files.length === 0) return;
                          uploadImages(files, `patterns/${product.id}`, (urls) => addPatterns(product.id, urls));
                          event.target.value = "";
                        }}
                      />
                    </label>
                  </div>

                  <div className="admin-card">
                    <h3>Ảnh mẫu &amp; chi tiết sản phẩm</h3>
                    <div className="admin-image-wrap">
                      {product.modelImages.map((image, imageIndex) => (
                        <div className="admin-image-wrap-item" key={image.id}>
                          <AdminImageActionField
                            ariaLabel="Mở tùy chọn ảnh mẫu & chi tiết sản phẩm"
                            caption="Ảnh mẫu & chi tiết sản phẩm"
                            image={image}
                            onPreview={setPreviewImage}
                            onFileSelected={(file) =>
                              uploadImage(file, `models/${product.id}`, (url) =>
                                updateModelImage(product.id, image.id, { src: url }),
                              )
                            }
                          />
                          <div className="model-image-actions" aria-label="Sắp xếp ảnh mẫu & chi tiết sản phẩm">
                            <button
                              className="icon-button"
                              type="button"
                              disabled={imageIndex === 0}
                              onClick={() => reorderModelImage(product.id, image.id, -1)}
                              aria-label="Đưa ảnh lên trước"
                            >
                              <ArrowUp size={13} aria-hidden="true" />
                            </button>
                            <button
                              className="icon-button"
                              type="button"
                              disabled={imageIndex === product.modelImages.length - 1}
                              onClick={() => reorderModelImage(product.id, image.id, 1)}
                              aria-label="Đưa ảnh xuống sau"
                            >
                              <ArrowDown size={13} aria-hidden="true" />
                            </button>
                            <button
                              className="icon-button danger model-delete"
                              type="button"
                              onClick={() => removeModelImage(product.id, image.id)}
                              aria-label="Xóa ảnh mẫu & chi tiết sản phẩm"
                            >
                              <Trash2 size={13} aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <label className="admin-button small full-width file-button">
                      <Plus size={16} aria-hidden="true" />
                      Thêm ảnh mẫu & chi tiết sản phẩm
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(event) => {
                          const files = Array.from(event.target.files ?? []);
                          if (files.length === 0) return;
                          uploadImages(files, `models/${product.id}`, (urls) => addModelImages(product.id, urls));
                          event.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}

            {selectedTypeProducts.length === 0 ? (
              <section className="admin-empty compact">
                <h2>Chưa có sản phẩm trong loại này</h2>
                <p>Thêm sản phẩm mới để bắt đầu nhập họa tiết và ảnh mẫu & chi tiết sản phẩm.</p>
              </section>
            ) : null}

            <button
              className="admin-button primary full-width"
              type="button"
              onClick={() => addProduct(selectedAdminProductType.id)}
            >
              <Plus size={17} aria-hidden="true" />
              Thêm sản phẩm mới
            </button>
          </section>
        ) : (
          <section className="admin-empty compact">
            <h2>Không tìm thấy loại sản phẩm</h2>
            <p>Loại sản phẩm này có thể đã đổi tên hoặc đã bị xóa.</p>
            <button className="admin-button ghost" type="button" onClick={closeAdminProductType}>
              <ChevronLeft size={17} aria-hidden="true" />
              Về danh sách loại
            </button>
          </section>
        )}

        {!adminProductTypeSlug ? (
          <div className="admin-card" style={{ marginTop: "16px" }}>
            <div className="admin-card-header">
              <h3>Bảng giá & Quy định chung</h3>
              <AdminImageActionField
                ariaLabel="Mở tùy chọn bảng giá chung"
                caption="Bảng giá & Quy định chung"
                image={adminShopInfoImage}
                onPreview={setPreviewImage}
                onFileSelected={(file) =>
                  uploadImage(file, "shop-info", (url) =>
                    onShopInfoImageChange((image) => ({ ...image, src: url })),
                  )
                }
              />
            </div>
          </div>
        ) : null}

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
            <img src={previewImage.src} alt={previewImage.alt} />
            <span className="lightbox-caption">{previewImage.caption}</span>
          </button>
        ) : null}
      </div>
    </main>
  );
}

export default App;
