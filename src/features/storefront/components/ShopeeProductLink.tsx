import { ExternalLink } from "lucide-react";
import { getShopeeUrl } from "../../catalog/shopeeUrl";

function ShopeeMark() {
  return (
    <svg className="product-shopee-logo" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 8.25h12l-.85 11.25H6.85L6 8.25Z" fill="currentColor" />
      <path d="M8.75 8.25V6.9a3.25 3.25 0 0 1 6.5 0v1.35" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M14.6 11.75a3.8 3.8 0 0 0-2.25-.72c-1.13 0-1.85.48-1.85 1.2 0 .78.7 1.08 1.92 1.43 1.42.4 2.38.93 2.38 2.13 0 1.27-1.08 2.18-2.72 2.18a4.3 4.3 0 0 1-2.7-.92"
        fill="none"
        stroke="#fff"
        strokeLinecap="round"
        strokeWidth="1.35"
      />
    </svg>
  );
}

export function ShopeeProductLink({ url }: { url?: string }) {
  const href = getShopeeUrl(url);
  if (!href) return null;

  return (
    <a
      className="product-shopee-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Xem sản phẩm trên Shopee (mở tab mới)"
    >
      <ShopeeMark />
      <span>Xem trên Shopee</span>
      <ExternalLink className="product-shopee-external" size={14} aria-hidden="true" />
    </a>
  );
}
