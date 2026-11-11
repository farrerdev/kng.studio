import { lazy, Suspense, useEffect, useState } from "react";
import { fallbackCatalog } from "../features/catalog/catalogRows";
import { useStorefrontCatalog } from "../features/catalog/useStorefrontCatalog";
import { Storefront } from "../features/storefront/Storefront";
import { isSupabaseConfigured } from "../lib/supabaseConfig";
import { LoadingPanel } from "../shared/components/LoadingPanel";
import type { CatalogData } from "../features/catalog/catalogRows";
import type { Product, ProductImage, ProductType } from "../types/catalog";

// Admin (and supabase-js) loads as its own chunk so storefront visitors never download it.
const AdminPage = lazy(() => import("./AdminPage"));

const isAdminPath = () => typeof window !== "undefined" && window.location.pathname.startsWith("/admin");

// Admin always edits fresh data (inactive products included).
const fetchAdminCatalog = async (): Promise<CatalogData> => (await import("../features/catalog/catalogApi")).fetchCatalog({ includeInactive: true });

function App() {
  return isAdminPath() ? <AdminRoot /> : <StorefrontPage />;
}

/** The public shop. The same <Storefront> also runs inside the 3D shop (store3d/). */
function StorefrontPage() {
  const catalog = useStorefrontCatalog();
  return <Storefront catalog={catalog} />;
}

function AdminRoot() {
  const [catalogProductTypes, setCatalogProductTypes] = useState<ProductType[]>(isSupabaseConfigured ? [] : fallbackCatalog.productTypes);
  const [catalogProducts, setCatalogProducts] = useState<Product[]>(isSupabaseConfigured ? [] : fallbackCatalog.products);
  const [currentShopInfoImage, setCurrentShopInfoImage] = useState<ProductImage | null>(
    isSupabaseConfigured ? null : fallbackCatalog.shopInfoImage,
  );
  const [catalogStatus, setCatalogStatus] = useState("Đang tải catalog...");
  const [catalogLoadState, setCatalogLoadState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    document.title = "KNG.studio Admin";
  }, []);

  useEffect(() => {
    let isMounted = true;
    fetchAdminCatalog()
      .then((catalog) => {
        if (!isMounted) return;
        setCatalogProductTypes(isSupabaseConfigured ? catalog.productTypes : fallbackCatalog.productTypes);
        setCatalogProducts(isSupabaseConfigured ? catalog.products : fallbackCatalog.products);
        setCurrentShopInfoImage(isSupabaseConfigured ? catalog.shopInfoImage : fallbackCatalog.shopInfoImage);
        setCatalogStatus(isSupabaseConfigured ? "" : "Đang dùng mock data.");
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

export default App;
