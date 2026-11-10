// Public shopping rules: shown on the storefront (policy list, product page, modal) and in the
// 3D shop (policy board, shop owner answers). Edit here only.

export type PolicySection =
  | {
      id: string;
      title: string;
      body: string;
      items?: never;
    }
  | {
      id: string;
      title: string;
      body?: never;
      /** Optional lead-in sentence above the list. */
      intro?: string;
      items: string[];
    };

/** The fabric explainer: informative rather than a rule, so the 3D shop's rules board skips it. */
export const FABRIC_SECTION_ID = "muslin";

export const POLICY_SECTIONS: PolicySection[] = [
  {
    id: "gift",
    title: "Quà tặng",
    body: "Mỗi set được tặng kèm dây buộc tóc scrunchies cùng họa tiết với sản phẩm.",
  },
  {
    id: "shipping",
    title: "Phí vận chuyển",
    body: "Phí vận chuyển đồng giá 20k. Shop miễn phí vận chuyển cho đơn từ 2 bộ.",
  },
  {
    id: "discount",
    title: "Giảm giá",
    body: "Giảm 10.000đ cho mỗi bộ từ bộ thứ 3.",
  },
  {
    id: "payment",
    title: "Thanh toán",
    body: "Khách hàng vui lòng thanh toán trước để shop xác nhận và chuẩn bị đơn.",
  },
  {
    id: "returns",
    title: "Đổi hàng",
    items: [
      "Khách hàng vui lòng quay video khi nhận hàng và mở gói sản phẩm.",
      "Với sản phẩm lỗi do nhà sản xuất hoặc shop giao sai mẫu, KNG hỗ trợ đổi 1-1 và chịu toàn bộ chi phí đổi hàng.",
      "Với sản phẩm không ưng ý hoặc không vừa, khách có thể đổi sang sản phẩm khác giá thấp hơn hoặc bằng giá sản phẩm cũ trong vòng 3 ngày kể từ ngày nhận hàng.",
      "Khách hàng chịu 1 đầu phí vận chuyển đổi hàng, KNG hỗ trợ 1 đầu vận chuyển gửi lại.",
      "Lưu ý: shop chỉ hỗ trợ đổi 1 lần duy nhất.",
    ],
  },
  {
    id: FABRIC_SECTION_ID,
    title: "Vải xô muslin là gì?",
    intro: "Đây là vải 100% cotton, dệt 2 lớp, với các đặc điểm:",
    items: [
      "Thoáng khí và siêu nhẹ: cấu trúc dệt thưa giúp không khí lưu thông dễ dàng, mang lại cảm giác mát mẻ.",
      "Thấm hút tốt: hút ẩm nhanh, rất phù hợp với khí hậu nhiệt đới.",
      "Mềm mại: êm dịu với làn da và mềm hơn sau mỗi lần giặt.",
      "Lành tính: dịu nhẹ, không gây kích ứng, là lựa chọn phổ biến cho trẻ sơ sinh và da nhạy cảm.",
    ],
  },
  {
    id: "care",
    title: "Hướng dẫn bảo quản",
    items: [
      "Giặt máy ở chế độ nhẹ và không dùng chất tẩy.",
      "Phơi nơi thoáng mát, tránh nắng gắt.",
      "Hạn chế sấy nóng để vải không bị khô cứng hoặc co rút.",
      "Ưu tiên ủi hơi nước. Vải muslin mềm hơn sau mỗi lần giặt.",
    ],
  },
];
