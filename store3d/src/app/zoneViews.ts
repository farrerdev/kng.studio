import { openMessage } from "../../../src/config/messageLinks";
import { POLICY_SECTIONS } from "../../../src/features/storefront/policies";
import type { StoreCatalog, StoreProduct } from "../data/types";
import type { FaqEntry } from "../shop/faq";
import type { PanelAction, PanelView } from "../ui/Hud";
import { mountOwnerChat } from "../ui/OwnerChat";
import type { StoreTarget } from "../shop/types";
import type { Zone } from "../world/zones";

export type ZoneActions = {
  openStore: (target: StoreTarget) => void;
  petCat: () => void;
  /** Walk out to the pavement / back into the shop. */
  goOutside: () => void;
  goInside: () => void;
  /** Sit on the nearest lounge chair. */
  sitDown: () => void;
  greetOwner: () => void;
  /** Position of a shelf section along the wall (0 = first, by the door). */
  shelfPosition: (zoneId: string) => { index: number; count: number };
  /** Walk to the shelf section at `index` and open it. */
  goToShelf: (index: number) => void;
  /** Swap the counter panel for the owner chat (and back). */
  showOwnerChat: () => void;
  showCounter: () => void;
  faq: () => FaqEntry[];
  mannequinProducts: () => StoreProduct[];
  catAtHome: () => boolean;
};

/** Guests pick the channel they use: Instagram or Messenger. */
export const contactActions: PanelAction[] = [
  { label: "Instagram", brand: "instagram", run: () => openMessage("instagram") },
  { label: "Messenger", brand: "messenger", run: () => openMessage("messenger") },
];
const offlineText = "Chưa tải được sản phẩm. Kiểm tra mạng rồi tải lại trang nhé.";

/**
 * Short copy for the spot the guest is standing at. Anything about shopping (patterns, sizes,
 * cart) opens the real storefront panel instead of being re-built here.
 */
export function describeZone(zone: Zone | "cat", catalog: StoreCatalog, actions: ZoneActions): PanelView {
  const offline = catalog.status === "unavailable";
  const openHome = () => actions.openStore({ kind: "home" });

  if (zone === "cat") {
    return {
      eyebrow: "Mèo của shop",
      title: "Min",
      text: "Bé mèo trắng hay đi một vòng quanh shop rồi về nằm bên cửa sổ.",
      actions: [{ label: "Vuốt ve Min", primary: true, run: actions.petCat }],
    };
  }

  switch (zone.kind) {
    case "shelf": {
      const product = zone.product;
      if (!product) {
        return { eyebrow: "Kệ hàng", title: "Đang cập nhật", text: offline ? offlineText : "Kệ này sắp có hàng." };
      }
      return {
        eyebrow: product.categoryName,
        title: product.shortName,
        text: `${product.price} · ${product.inStockPatterns.length} mẫu còn hàng`,
        rail: { productIds: [product.id] },
        actions: shelfNavigation(zone.id, actions),
        // Tapping a shelf goes straight to the product page (with ‹ › to step along the wall).
        open: () => actions.openStore({ kind: "product", productId: product.id }),
      };
    }
    case "popular":
      return {
        eyebrow: "Đang được yêu thích",
        title: "Được ghé xem nhiều nhất 30 ngày qua",
        text: catalog.popular.length ? undefined : "Chưa đủ lượt xem để xếp hạng.",
        rail: { productIds: catalog.popular.map((product) => product.id), featured: true },
        actions: [{ label: "Xem tất cả sản phẩm", run: openHome }],
      };
    case "counter":
      return {
        eyebrow: "Quầy thu ngân",
        title: `${greeting()}, mình là chủ shop`,
        text: "Hỏi mình về phí ship, giảm giá, size hay đổi hàng nhé.",
        actions: [
          { label: "Hỏi chủ shop", primary: true, run: actions.showOwnerChat },
          {
            label: "Xem tất cả sản phẩm",
            run: () => {
              actions.greetOwner();
              openHome();
            },
          },
          { label: "Giỏ hàng", run: () => actions.openStore({ kind: "cart" }) },
        ],
      };
    case "fitting":
      return {
        eyebrow: "Phòng thử",
        title: "Phân vân size?",
        text: "Gửi shop chiều cao, cân nặng và dáng người, shop chọn size giúp nhé.",
        actions: contactActions,
      };
    case "door-out":
      return {
        eyebrow: "Cửa ra vào",
        title: "Ra phố một chút?",
        text: "Bên kia đường là sông Hàn và cầu Rồng.",
        actions: [{ label: "Ra ngoài", primary: true, run: actions.goOutside }],
      };
    case "door-in":
      return {
        eyebrow: "KNG.studio",
        title: "Mời bạn vào shop",
        actions: [{ label: "Vào shop", primary: true, run: actions.goInside }],
      };
    case "policy":
      return {
        eyebrow: "Bảng quy định",
        title: "Quy định mua hàng",
        mount: mountPolicyList,
        actions: [
          { label: "Xem đầy đủ", primary: true, run: () => actions.openStore({ kind: "home", sectionId: "policy" }) },
          { label: "Hỏi chủ shop", run: actions.showOwnerChat },
        ],
      };
    case "scrunchies":
      return {
        eyebrow: "Quà tặng",
        title: "Scrunchies tặng kèm",
        text: "Mỗi bộ đồ đều được tặng một dây buộc tóc scrunchies cùng họa tiết.",
      };
    case "lounge":
      return {
        eyebrow: "Góc trà",
        title: "Ngồi nghỉ chút nhé",
        text: "Trà hoa cúc mới pha. Min hay nằm ngay cửa sổ bên cạnh.",
        actions: [{ label: "Ngồi uống trà", primary: true, run: actions.sitDown }],
      };
    case "mannequins": {
      const products = actions.mannequinProducts();
      return {
        eyebrow: "Mới lên kệ",
        title: products.length ? "Hai mẫu mới nhất" : "Đang thay đồ cho ma-nơ-canh",
        rail: { productIds: products.map((product) => product.id) },
      };
    }
    case "cat-seat":
      return {
        eyebrow: "Ổ của Min",
        title: actions.catAtHome() ? "Min đang nằm ở đây" : "Min đi dạo rồi",
        text: actions.catAtHome() ? "Lại gần rồi vuốt ve bé nhé." : "Bé hay đi một vòng quanh shop rồi quay về.",
      };
  }
}

/** The storefront's policies as readable cards (title + text or bullet list). */
function mountPolicyList(host: HTMLElement): void {
  const list = document.createElement("div");
  list.className = "policy-list";
  for (const section of POLICY_SECTIONS) {
    const card = document.createElement("article");
    card.className = "policy-list__item";
    const title = document.createElement("h3");
    title.textContent = section.title;
    card.append(title);
    if (section.items) {
      const ul = document.createElement("ul");
      for (const item of section.items) {
        const li = document.createElement("li");
        li.textContent = item;
        ul.append(li);
      }
      card.append(ul);
    } else {
      const p = document.createElement("p");
      p.textContent = section.body;
      card.append(p);
    }
    list.append(card);
  }
  host.append(list);
}

/** Owner chat shown in the counter panel. */
export function describeOwnerChat(actions: ZoneActions): PanelView {
  return {
    eyebrow: "Chủ shop",
    title: "Hỏi mình nhé",
    mount: (host) => mountOwnerChat(host, actions.faq(), contactActions),
    actions: [{ label: "‹ Quay lại", run: actions.showCounter }],
  };
}

/** Just two buttons: the next set to the left and to the right (wrapping round at the ends). */
function shelfNavigation(zoneId: string, actions: ZoneActions): PanelAction[] {
  const { index, count } = actions.shelfPosition(zoneId);
  if (count < 2) return [];
  return [
    { label: "‹ Mẫu bên trái", run: () => actions.goToShelf((index - 1 + count) % count) },
    { label: "Mẫu bên phải ›", run: () => actions.goToShelf((index + 1) % count) },
  ];
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 11) return "Chào buổi sáng";
  if (hour < 14) return "Chào buổi trưa";
  if (hour < 18) return "Chào buổi chiều";
  return "Chào buổi tối";
}
