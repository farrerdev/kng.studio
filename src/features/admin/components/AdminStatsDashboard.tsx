import type { StorefrontEventRow, StorefrontEventType } from "../../analytics/analyticsApi";
import {
  getLocalDateInputValue,
  getLocalMonthInputValue,
  getStorefrontStatsFilterLabel,
  type StorefrontStatsFilter,
} from "../../analytics/statsFilters";
import {
  getProductTitle,
} from "../../catalog/catalogUtils";
import type { Product, ProductType } from "../../../types/catalog";

type InterestRow = {
  id: string;
  name: string;
  views: number;
  adds: number;
  messages: number;
  total: number;
};

const STOREFRONT_EVENT_LABELS: Record<StorefrontEventType, string> = {
  site_visit: "Truy cập",
  product_view: "Xem sản phẩm",
  pattern_view: "Xem họa tiết",
  add_to_cart: "Thêm giỏ",
  order_image_created: "Tạo ảnh đơn",
  message_click: "Mở nhắn tin",
};

const CHART_EVENT_TYPES: StorefrontEventType[] = [
  "site_visit",
  "product_view",
  "add_to_cart",
  "order_image_created",
  "message_click",
];

const FILTER_TABS: Array<{ mode: StorefrontStatsFilter["mode"]; label: string }> = [
  { mode: "yesterday", label: "Hôm qua" },
  { mode: "today", label: "Hôm nay" },
  { mode: "7d", label: "7 ngày" },
  { mode: "30d", label: "30 ngày" },
  { mode: "day", label: "Theo ngày" },
  { mode: "month", label: "Theo tháng" },
];

function createEmptyEventCounts(): Record<StorefrontEventType, number> {
  return {
    site_visit: 0,
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

export function AdminStatsDashboard({
  events,
  filter,
  isLoading,
  onFilterChange,
  products,
  productTypes,
}: {
  events: StorefrontEventRow[];
  filter: StorefrontStatsFilter;
  isLoading: boolean;
  onFilterChange: (filter: StorefrontStatsFilter) => void;
  products: Product[];
  productTypes: ProductType[];
}) {
  const eventCounts = getEventCounts(events);
  const productRows = getProductInterestRows(events, products, productTypes);
  const addToCartRate = eventCounts.product_view > 0 ? Math.round((eventCounts.add_to_cart / eventCounts.product_view) * 100) : 0;
  const overviewItems = [
    { id: "site_visit", label: "Truy cập", value: eventCounts.site_visit },
    { id: "product_view", label: "Xem sản phẩm", value: eventCounts.product_view },
    { id: "add_to_cart", label: "Thêm giỏ", value: eventCounts.add_to_cart },
    { id: "add_to_cart_rate", label: "Tỉ lệ thêm vào giỏ", value: `${addToCartRate}%` },
    { id: "order_image_created", label: "Tạo ảnh đơn", value: eventCounts.order_image_created },
    { id: "message_click", label: "Mở tin nhắn", value: eventCounts.message_click },
  ];
  const maxEventCount = Math.max(1, ...CHART_EVENT_TYPES.map((eventType) => eventCounts[eventType]));
  const selectedDate = filter.mode === "day" ? filter.date : getLocalDateInputValue();
  const selectedMonth = filter.mode === "month" ? filter.month : getLocalMonthInputValue();

  return (
    <section className="admin-dashboard admin-stats-screen" aria-label="Thống kê hành vi khách">
      <header className="admin-stats-header">
        <div>
          <span className="eyebrow">Behavior analytics</span>
          <h2>Thống kê hành vi khách</h2>
          <p>{isLoading ? "Đang tải số liệu..." : `Dữ liệu ẩn danh trong ${getStorefrontStatsFilterLabel(filter)}.`}</p>
        </div>
        <div className="admin-stats-controls">
          <div className="admin-segmented" aria-label="Khoảng thời gian thống kê">
            {FILTER_TABS.map((tab) => (
              <button
                className={filter.mode === tab.mode ? "active" : ""}
                key={tab.mode}
                type="button"
                onClick={() => {
                  if (tab.mode === "day") {
                    onFilterChange({ mode: "day", date: selectedDate });
                    return;
                  }
                  if (tab.mode === "month") {
                    onFilterChange({ mode: "month", month: selectedMonth });
                    return;
                  }
                  onFilterChange({ mode: tab.mode });
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {filter.mode === "day" ? (
            <input
              aria-label="Chọn ngày thống kê"
              type="date"
              value={selectedDate}
              onChange={(event) => {
                if (event.target.value) onFilterChange({ mode: "day", date: event.target.value });
              }}
            />
          ) : null}
          {filter.mode === "month" ? (
            <input
              aria-label="Chọn tháng thống kê"
              type="month"
              value={selectedMonth}
              onChange={(event) => {
                if (event.target.value) onFilterChange({ mode: "month", month: event.target.value });
              }}
            />
          ) : null}
        </div>
      </header>

      <section className="admin-overview-section" aria-label="Tổng quan hành vi khách">
        <h3>Tổng quan</h3>
        <div className="admin-stats event-stats" aria-label="Hành vi khách">
          {overviewItems.map((item) => (
            <div key={item.id}>
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="admin-chart-card" aria-label="Biểu đồ hành vi khách">
        <h3>Hành vi theo loại tương tác</h3>
        <div className="admin-bar-chart">
          {CHART_EVENT_TYPES.map((eventType) => {
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

      <div className="admin-insight-grid single">
        <AdminInterestTable
          emptyText="Chưa có sản phẩm nào được ghi nhận trong khoảng thời gian này."
          rows={productRows}
          title="Sản phẩm được quan tâm"
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
