import type { MouseEvent } from "react";
import { Instagram, MapPin } from "lucide-react";
import { needsAppMessageLink, openMessage, type MessageChannel } from "../../../config/messageLinks";
import { shopConfig } from "../../../config/shop";
import { FacebookIcon, InstagramBrandIcon, MessengerIcon, ThreadsIcon, ZaloIcon } from "../../../shared/icons/SocialIcons";

export function ContactButtons({ raised = false }: { raised?: boolean }) {
  // Inside Instagram / Facebook / Threads the plain links stay in the embedded browser.
  const openInApp = (channel: MessageChannel) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (!needsAppMessageLink()) return;
    event.preventDefault();
    openMessage(channel);
  };

  return (
    <div className={raised ? "contact-buttons raised" : "contact-buttons"} aria-label="Nhắn tin đặt hàng">
      <a
        className="contact-button instagram"
        href={shopConfig.contacts.instagramMessage}
        target="_blank"
        rel="noreferrer"
        aria-label="Nhắn tin KNG.studio qua Instagram"
        onClick={openInApp("instagram")}
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
        onClick={openInApp("messenger")}
      >
        <MessengerIcon />
        <span>Messenger</span>
      </a>
    </div>
  );
}

export function StorefrontFooter() {
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
