import { useEffect, useMemo, useState, type PointerEvent } from "react";
import { LEGACY_SITE_VISIT_PRODUCT_ID, type StorefrontEventRow, type StorefrontEventType } from "../../analytics/analyticsApi";
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

type VisitChartBucket = {
  key: string;
  label: string;
  shortLabel: string;
  count: number;
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
    if (event.product_id === LEGACY_SITE_VISIT_PRODUCT_ID) return;
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

function padNumber(value: number) {
  return String(value).padStart(2, "0");
}

function getDateKey(date: Date) {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
}

function getDateLabel(date: Date) {
  return `${padNumber(date.getDate())}/${padNumber(date.getMonth() + 1)}`;
}

function getChartDateFromFilter(filter: StorefrontStatsFilter) {
  if (filter.mode === "day") return new Date(`${filter.date}T00:00:00`);
  const now = new Date();
  if (filter.mode === "yesterday") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  }
  return now;
}

function createHourlyBuckets(filter: StorefrontStatsFilter): VisitChartBucket[] {
  const date = getChartDateFromFilter(filter);
  const dateKey = getDateKey(date);
  return Array.from({ length: 24 }, (_, hour) => ({
    key: `${dateKey}-${hour}`,
    label: `${padNumber(hour)}:00`,
    shortLabel: hour % 4 === 0 || hour === 23 ? `${padNumber(hour)}:00` : "",
    count: 0,
  }));
}

function createDailyBuckets(filter: StorefrontStatsFilter): VisitChartBucket[] {
  if (filter.mode === "month") {
    const [year, month] = filter.month.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(year, month - 1, index + 1);
      return {
        key: getDateKey(date),
        label: getDateLabel(date),
        shortLabel: index === 0 || (index + 1) % 5 === 0 || index === daysInMonth - 1 ? getDateLabel(date) : "",
        count: 0,
      };
    });
  }

  const days = filter.mode === "30d" ? 30 : 7;
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days + 1);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    return {
      key: getDateKey(date),
      label: getDateLabel(date),
      shortLabel: days === 7 || index === 0 || (index + 1) % 5 === 0 || index === days - 1 ? getDateLabel(date) : "",
      count: 0,
    };
  });
}

function getVisitChartBuckets(events: StorefrontEventRow[], filter: StorefrontStatsFilter) {
  const isHourly = filter.mode === "today" || filter.mode === "yesterday" || filter.mode === "day";
  const buckets = isHourly ? createHourlyBuckets(filter) : createDailyBuckets(filter);
  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  events.forEach((event) => {
    if (event.event_type !== "site_visit") return;
    const date = new Date(event.created_at);
    const key = isHourly ? `${getDateKey(date)}-${date.getHours()}` : getDateKey(date);
    const bucket = bucketMap.get(key);
    if (bucket) bucket.count += 1;
  });

  return { buckets, isHourly };
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
  const visitChart = useMemo(() => getVisitChartBuckets(events, filter), [events, filter]);
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
          <VisitLineChart buckets={visitChart.buckets} isHourly={visitChart.isHourly} />
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

function VisitLineChart({ buckets, isHourly }: { buckets: VisitChartBucket[]; isHourly: boolean }) {
  const lastValueIndex = buckets.reduce((lastIndex, bucket, index) => (bucket.count > 0 ? index : lastIndex), -1);
  const [activeIndex, setActiveIndex] = useState(lastValueIndex >= 0 ? lastValueIndex : 0);
  const width = 640;
  const height = 220;
  const padding = { top: 18, right: 12, bottom: 34, left: 42 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxCount = Math.max(4, ...buckets.map((bucket) => bucket.count));
  const yTicks = Array.from({ length: 5 }, (_, index) => Math.ceil((maxCount / 4) * (4 - index)));
  yTicks[yTicks.length - 1] = 0;

  const getX = (index: number) =>
    padding.left + (buckets.length <= 1 ? 0 : (index / (buckets.length - 1)) * chartWidth);
  const getY = (count: number) => padding.top + chartHeight - (count / maxCount) * chartHeight;
  const points = buckets.map((bucket, index) => `${getX(index)},${getY(bucket.count)}`).join(" ");
  useEffect(() => {
    setActiveIndex(lastValueIndex >= 0 ? lastValueIndex : 0);
  }, [buckets, lastValueIndex]);

  const boundedActiveIndex = Math.min(buckets.length - 1, Math.max(0, activeIndex));
  const activeBucket = buckets[boundedActiveIndex] ?? buckets[0];
  const activeX = getX(boundedActiveIndex);
  const activeY = getY(activeBucket?.count ?? 0);
  const activeTooltipX = Math.min(width - 150, Math.max(54, activeX - 68));

  const updateActiveIndex = (event: PointerEvent<SVGRectElement>) => {
    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * width;
    const ratio = Math.min(1, Math.max(0, (x - padding.left) / chartWidth));
    setActiveIndex(Math.round(ratio * (buckets.length - 1)));
  };

  return (
    <div className="admin-visit-chart-card">
      <div className="admin-visit-chart-heading">
        <span>Truy cập theo {isHourly ? "giờ" : "ngày"}</span>
        <strong>{activeBucket ? `${activeBucket.label}: ${activeBucket.count}` : "0"}</strong>
      </div>
      <svg
        className="admin-visit-chart"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Biểu đồ lượt truy cập"
        onPointerLeave={() => setActiveIndex(lastValueIndex >= 0 ? lastValueIndex : 0)}
      >
        {yTicks.map((tick, index) => {
          const y = padding.top + (index / (yTicks.length - 1)) * chartHeight;
          return (
            <g key={`${tick}-${index}`}>
              <text x={padding.left - 14} y={y + 4} textAnchor="end">
                {tick}
              </text>
              <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} />
            </g>
          );
        })}
        <polyline points={points} />
        <line className="active-line" x1={activeX} x2={activeX} y1={padding.top} y2={padding.top + chartHeight} />
        <circle cx={activeX} cy={activeY} r="5" />
        {activeBucket ? (
          <g className="chart-tooltip" transform={`translate(${activeTooltipX}, 8)`}>
            <rect width="136" height="42" rx="4" />
            <text x="10" y="17">{activeBucket.label}</text>
            <text x="10" y="33">{activeBucket.count} lượt truy cập</text>
          </g>
        ) : null}
        <line className="axis-line" x1={padding.left} x2={width - padding.right} y1={padding.top + chartHeight} y2={padding.top + chartHeight} />
        {buckets.map((bucket, index) =>
          bucket.shortLabel ? (
            <text className="x-label" key={bucket.key} x={getX(index)} y={height - 7} textAnchor="middle">
              {bucket.shortLabel}
            </text>
          ) : null,
        )}
        <rect
          className="chart-hit-area"
          x={padding.left}
          y={padding.top}
          width={chartWidth}
          height={chartHeight + 28}
          onPointerDown={updateActiveIndex}
          onPointerMove={updateActiveIndex}
        />
      </svg>
    </div>
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
