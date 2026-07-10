import { BarChart3 } from "lucide-react";
import type { StorefrontEventRow, StorefrontEventType } from "../../analytics/analyticsApi";
import {
  getProductTitle,
} from "../../catalog/catalogUtils";
import type { Product, ProductType } from "../../../types/catalog";

export type StatsWindowDays = 7 | 30;

type InterestRow = {
  id: string;
  name: string;
  views: number;
  adds: number;
  messages: number;
  total: number;
};

const STOREFRONT_EVENT_LABELS: Record<StorefrontEventType, string> = {
  product_view: "Xem sản phẩm",
  pattern_view: "Xem họa tiết",
  add_to_cart: "Thêm giỏ",
  order_image_created: "Tạo ảnh đơn",
  message_click: "Mở nhắn tin",
};

function createEmptyEventCounts(): Record<StorefrontEventType, number> {
  return {
    product_view: 0,
    pattern_view: 0,
    add_to_cart: 0,
    order_image_created: 0,
    message_click: 0,
  };
}

function getEventCounts(events: StorefrontEventRow[]) {
  return events.reduce((counts, event) => {
    counts[event.event_type] += 1;
    return counts;
  }, createEmptyEventCounts());
}

function getProductInterestRows(events: StorefrontEventRow[], products: Product[], productTypes: ProductType[]) {
  const rows = new Map<string, InterestRow>();

  products.forEach((product) => {
    rows.set(product.id, {
      id: product.id,
      name: getProductTitle(product, productTypes),
      views: 0,
      adds: 0,
      messages: 0,
      total: 0,
    });
  });

  events.forEach((event) => {
    if (!event.product_id) return;
    const row = rows.get(event.product_id);
    if (!row) return;

    if (event.event_type === "product_view") row.views += 1;
    if (event.event_type === "add_to_cart") row.adds += 1;
    if (event.event_type === "message_click") row.messages += 1;
    row.total = row.views + row.adds + row.messages;
  });

  return Array.from(rows.values())
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total || b.adds - a.adds || b.views - a.views)
    .slice(0, 6);
}

function getPatternInterestRows(events: StorefrontEventRow[], products: Product[], productTypes: ProductType[]) {
  const rows = new Map<string, InterestRow>();

  products.forEach((product) => {
    product.patterns.forEach((pattern) => {
      rows.set(pattern.id, {
        id: pattern.id,
        name: `${getProductTitle(product, productTypes)} · ${pattern.name || "Họa tiết"}`,
        views: 0,
        adds: 0,
        messages: 0,
        total: 0,
      });
    });
  });

  events.forEach((event) => {
    if (!event.pattern_id) return;
    const row = rows.get(event.pattern_id);
    if (!row) return;

    if (event.event_type === "pattern_view") row.views += 1;
    if (event.event_type === "add_to_cart") row.adds += 1;
    row.total = row.views + row.adds;
  });

  return Array.from(rows.values())
    .filter((row) => row.total > 0)
    .sort((a, b) => b.total - a.total || b.adds - a.adds || b.views - a.views)
    .slice(0, 6);
}

export function AdminStatsDashboard({
  days,
  events,
  isLoading,
  onDaysChange,
  products,
  productTypes,
}: {
  days: StatsWindowDays;
  events: StorefrontEventRow[];
  isLoading: boolean;
  onDaysChange: (days: StatsWindowDays) => void;
  products: Product[];
  productTypes: ProductType[];
}) {
  const eventCounts = getEventCounts(events);
  const productRows = getProductInterestRows(events, products, productTypes);
  const patternRows = getPatternInterestRows(events, products, productTypes);
  const maxEventCount = Math.max(1, ...Object.values(eventCounts));

  return (
    <section className="admin-dashboard admin-stats-screen" aria-label="Thống kê hành vi khách">
      <header className="admin-stats-header">
        <div>
          <span className="eyebrow">Behavior analytics</span>
          <h2>Thống kê hành vi khách</h2>
          <p>{isLoading ? "Đang tải số liệu..." : `Dữ liệu ẩn danh trong ${days} ngày gần nhất.`}</p>
        </div>
        <div className="admin-segmented" aria-label="Khoảng thời gian thống kê">
          {[7, 30].map((option) => (
            <button
              className={days === option ? "active" : ""}
              key={option}
              type="button"
              onClick={() => onDaysChange(option as StatsWindowDays)}
            >
              {option} ngày
            </button>
          ))}
        </div>
      </header>

      <div className="admin-stats event-stats" aria-label="Hành vi khách">
        {(Object.keys(STOREFRONT_EVENT_LABELS) as StorefrontEventType[]).map((eventType) => (
          <div key={eventType}>
            <BarChart3 size={20} aria-hidden="true" />
            <span>{STOREFRONT_EVENT_LABELS[eventType]}</span>
            <strong>{eventCounts[eventType]}</strong>
          </div>
        ))}
      </div>

      <section className="admin-chart-card" aria-label="Biểu đồ hành vi khách">
        <h3>Hành vi theo loại tương tác</h3>
        <div className="admin-bar-chart">
          {(Object.keys(STOREFRONT_EVENT_LABELS) as StorefrontEventType[]).map((eventType) => {
            const count = eventCounts[eventType];
            return (
              <div className="admin-bar-row" key={eventType}>
                <span>{STOREFRONT_EVENT_LABELS[eventType]}</span>
                <div>
                  <i style={{ width: count === 0 ? "0%" : `${Math.max(4, (count / maxEventCount) * 100)}%` }} />
                </div>
                <strong>{count}</strong>
              </div>
            );
          })}
        </div>
      </section>

      <div className="admin-insight-grid">
        <AdminInterestTable
          emptyText="Chưa có sản phẩm nào được ghi nhận trong khoảng thời gian này."
          rows={productRows}
          title="Sản phẩm được quan tâm"
        />
        <AdminInterestTable
          emptyText="Chưa có họa tiết nào được ghi nhận trong khoảng thời gian này."
          rows={patternRows}
          title="Họa tiết được quan tâm"
        />
      </div>
    </section>
  );
}

function AdminInterestTable({
  emptyText,
  rows,
  title,
}: {
  emptyText: string;
  rows: InterestRow[];
  title: string;
}) {
  return (
    <section className="admin-interest-card">
      <h3>{title}</h3>
      {rows.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>Tên</th>
              <th>Xem</th>
              <th>Giỏ</th>
              <th>Tổng</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.views}</td>
                <td>{row.adds}</td>
                <td>{row.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>{emptyText}</p>
      )}
    </section>
  );
}
