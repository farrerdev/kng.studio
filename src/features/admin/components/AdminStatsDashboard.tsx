import type { StorefrontEventRow, StorefrontEventType } from "../../analytics/analyticsApi";
import {
  getLocalDateInputValue,
  getLocalMonthInputValue,
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

const FILTER_TABS: Array<{ mode: StorefrontStatsFilter["mode"]; label: string }> = [
  { mode: "today", label: "Hôm nay" },
  { mode: "yesterday", label: "Hôm qua" },
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
  const selectedDate = filter.mode === "day" ? filter.date : getLocalDateInputValue();
  const selectedMonth = filter.mode === "month" ? filter.month : getLocalMonthInputValue();

  return (
    <section className="admin-dashboard admin-stats-screen" aria-label="Thống kê hành vi khách">
      <div className="admin-stats-filterbar" aria-busy={isLoading}>
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

      <section className="admin-dashboard-group" aria-label="Tổng quan hành vi khách">
        <h3>Tổng quan</h3>
        <div className="admin-overview-section">
          <div className="admin-stats event-stats" aria-label="Hành vi khách">
            {overviewItems.map((item) => (
              <div key={item.id}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="admin-dashboard-group" aria-label="Sản phẩm được quan tâm">
        <h3>Sản phẩm được quan tâm</h3>
        <div className="admin-insight-grid single">
          <AdminInterestTable
            emptyText="Chưa có sản phẩm nào được ghi nhận trong khoảng thời gian này."
            rows={productRows}
          />
        </div>
      </section>
    </section>
  );
}

function AdminInterestTable({
  emptyText,
  rows,
}: {
  emptyText: string;
  rows: InterestRow[];
}) {
  return (
    <section className="admin-interest-card">
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
