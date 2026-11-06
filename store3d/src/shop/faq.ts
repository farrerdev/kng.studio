import { shopConfig } from "../../../src/config/shop";
import { sizeOptions } from "../../../src/data/mockCatalog";
import { POLICY_SECTIONS } from "../../../src/features/storefront/policies";

// What the shop owner can answer: only information the storefront already publishes (policies,
// sizes, materials from the catalog, contacts). Answers are built from that data, never written
// separately, so they change when the storefront does.

export type FaqEntry = {
  id: string;
  /** Chip label, phrased as the guest would ask. */
  question: string;
  answer: string;
};

function policyText(id: string): string {
  const section = POLICY_SECTIONS.find((candidate) => candidate.id === id);
  if (!section) return "";
  return section.items ? section.items.map((item) => `• ${item}`).join("\n") : section.body;
}

export function buildFaq(materials: string[]): FaqEntry[] {
  const sizes = sizeOptions.map((size) => `${size.label}: ${size.range}`).join(", ");
  const fabric = [...new Set(materials.map((material) => material.trim()).filter(Boolean))].join(", ");
  const entries: FaqEntry[] = [
    { id: "shipping", question: "Phí ship bao nhiêu?", answer: policyText("shipping") },
    { id: "discount", question: "Mua nhiều có giảm không?", answer: policyText("discount") },
    { id: "gift", question: "Có quà tặng gì không?", answer: policyText("gift") },
    { id: "size", question: "Chọn size thế nào?", answer: `Shop có ${sizes}. Mỗi mẫu có bảng size riêng trong trang sản phẩm. Phân vân thì nhắn mình chiều cao, cân nặng để mình tư vấn nhé.` },
    { id: "order", question: "Đặt hàng thế nào?", answer: "Bạn thêm mẫu vào giỏ, mở giỏ hàng rồi bấm \"Xem ảnh đơn hàng\" để lưu ảnh đơn. Sau đó gửi ảnh cho shop qua Instagram hoặc Messenger để shop xác nhận nhé." },
    { id: "payment", question: "Thanh toán thế nào?", answer: policyText("payment") },
    { id: "returns", question: "Đổi hàng được không?", answer: policyText("returns") },
    { id: "care", question: "Giặt, bảo quản sao?", answer: policyText("care") },
    { id: "contact", question: "Liên hệ shop ở đâu?", answer: `${shopConfig.brand} ở ${shopConfig.location}. Bạn nhắn shop qua Instagram hoặc Messenger nhé, mình trả lời sớm nhất có thể.` },
  ];
  if (fabric) {
    entries.splice(4, 0, {
      id: "fabric",
      question: "Vải gì vậy?",
      answer: `Đồ ở tiệm may từ ${fabric}. Vải muslin mềm, thoáng và càng giặt càng mềm.`,
    });
  }
  return entries.filter((entry) => entry.answer);
}
