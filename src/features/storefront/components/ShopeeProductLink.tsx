import { ExternalLink } from "lucide-react";
import { getShopeeUrl } from "../../catalog/shopeeUrl";

export function ShopeeProductLink({ url }: { url?: string }) {
  const href = getShopeeUrl(url);
  if (!href) return null;

  return (
    <a
      className="product-shopee-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Xem giá & đánh giá trên Shopee (mở tab mới)"
    >
      Xem giá &amp; đánh giá trên Shopee
      <ExternalLink size={14} aria-hidden="true" />
    </a>
  );
}
