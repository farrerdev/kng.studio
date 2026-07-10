import { X } from "lucide-react";

type PolicySection =
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
      items: string[];
    };

const POLICY_SECTIONS: PolicySection[] = [
  {
    id: "gift",
    title: "Quà tặng",
    body: "Mỗi set được tặng kèm dây buộc tóc scrunchies cùng họa tiết với sản phẩm.",
  },
  {
    id: "shipping",
    title: "Phí ship",
    body: "Phí ship đồng giá 20k. Shop miễn phí vận chuyển cho đơn từ 2 bộ.",
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
      "Khách hàng chịu 1 đầu phí ship đổi hàng, KNG hỗ trợ 1 đầu ship gửi lại.",
      "Lưu ý: shop chỉ hỗ trợ đổi 1 lần duy nhất.",
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

type PolicySectionsProps = {
  className: string;
  includeIds?: boolean;
};

export function PolicySections({ className, includeIds = false }: PolicySectionsProps) {
  return (
    <section className={className} id={includeIds ? "policy" : undefined} aria-label="Quy định mua hàng">
      {POLICY_SECTIONS.map((section) => (
        <article id={includeIds ? section.id : undefined} key={section.id}>
          <h3>{section.title}</h3>
          {section.items ? (
            <ul>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <p>{section.body}</p>
          )}
        </article>
      ))}
    </section>
  );
}

type PolicyModalProps = {
  onClose: () => void;
};

export function PolicyModal({ onClose }: PolicyModalProps) {
  return (
    <div className="policy-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="policy-modal-title" onClick={onClose}>
      <section className="policy-modal-panel" onClick={(event) => event.stopPropagation()}>
        <header className="policy-modal-header">
          <div>
            <span>Trước khi mua</span>
            <h2 id="policy-modal-title">Quy định mua hàng</h2>
          </div>
          <button type="button" aria-label="Đóng quy định mua hàng" onClick={onClose}>
            <X size={21} aria-hidden="true" />
          </button>
        </header>
        <PolicySections className="policy-modal-sections" />
      </section>
    </div>
  );
}
