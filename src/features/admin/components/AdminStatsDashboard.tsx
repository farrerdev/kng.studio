import { Fragment, useEffect, useMemo, useState, type PointerEvent, type ReactNode } from "react";
import type { StorefrontEventRow, StorefrontEventType } from "../../analytics/analyticsApi";
import {
  getLocalDateInputValue,
  getLocalMonthInputValue,
  type StorefrontStatsFilter,
} from "../../analytics/statsFilters";
import type { Product, ProductType, SizeId } from "../../../types/catalog";
import {
  WEEKDAY_LABELS,
  getChange,
  getEventCounts,
  getFunnelSteps,
  getHeatmap,
  getPatternStatsRows,
  getProductStatsRows,
  getRate,
  getSizeStats,
  getTypeStatsRows,
  type EventCounts,
  type HeatmapMetric,
  type SizeStatsRow,
} from "../stats/storefrontStats";

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

type ChartMetric = Extract<StorefrontEventType, "site_visit" | "product_view" | "add_to_cart" | "message_click">;

const CHART_METRICS: Array<{ id: ChartMetric; label: string; unit: string }> = [
  { id: "site_visit", label: "Truy cập", unit: "lượt truy cập" },
  { id: "product_view", label: "Xem sản phẩm", unit: "lượt xem" },
  { id: "add_to_cart", label: "Thêm giỏ", unit: "lượt thêm giỏ" },
  { id: "message_click", label: "Mở tin nhắn", unit: "lượt mở tin nhắn" },
];

function getEventChartBuckets(events: StorefrontEventRow[], filter: StorefrontStatsFilter, metric: ChartMetric) {
  const isHourly = filter.mode === "today" || filter.mode === "yesterday" || filter.mode === "day";
  const buckets = isHourly ? createHourlyBuckets(filter) : createDailyBuckets(filter);
  const bucketMap = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  events.forEach((event) => {
    if (event.event_type !== metric) return;
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
  previousEvents,
  products,
  productTypes,
}: {
  events: StorefrontEventRow[];
  filter: StorefrontStatsFilter;
  isLoading: boolean;
  onFilterChange: (filter: StorefrontStatsFilter) => void;
  previousEvents: StorefrontEventRow[] | null;
  products: Product[];
  productTypes: ProductType[];
}) {
  const eventCounts = useMemo(() => getEventCounts(events), [events]);
  const previousCounts = useMemo(() => (previousEvents ? getEventCounts(previousEvents) : null), [previousEvents]);
  const productRows = useMemo(() => getProductStatsRows(events, products, productTypes), [events, products, productTypes]);
  const patternRows = useMemo(() => getPatternStatsRows(events, products, productTypes), [events, products, productTypes]);
  const typeRows = useMemo(() => getTypeStatsRows(productRows, products, productTypes), [productRows, products, productTypes]);
  const sizeStats = useMemo(() => getSizeStats(events, products, productTypes), [events, products, productTypes]);
  const [chartMetric, setChartMetric] = useState<ChartMetric>("site_visit");
  const activeMetric = CHART_METRICS.find((metric) => metric.id === chartMetric) ?? CHART_METRICS[0];
  const eventChart = useMemo(
    () => getEventChartBuckets(events, filter, chartMetric),
    [events, filter, chartMetric],
  );
  const addToCartRate = getRate(eventCounts.add_to_cart, eventCounts.product_view);
  const previousAddToCartRate = previousCounts ? getRate(previousCounts.add_to_cart, previousCounts.product_view) : null;
  const overviewItems: Array<{ id: string; label: string; value: string | number; change: ReactNode }> = [
    ...(["site_visit", "product_view", "add_to_cart"] as const).map((id) => ({
      id,
      label: CHART_METRICS.find((metric) => metric.id === id)!.label,
      value: eventCounts[id],
      change: <ChangeBadge current={eventCounts[id]} previous={previousCounts?.[id]} />,
    })),
    {
      id: "add_to_cart_rate",
      label: "Tỉ lệ thêm vào giỏ",
      value: formatPercent(addToCartRate),
      change:
        previousCounts && addToCartRate !== null && previousAddToCartRate !== null ? (
          <PointChangeBadge current={addToCartRate} previous={previousAddToCartRate} />
        ) : null,
    },
    {
      id: "order_image_created",
      label: "Tạo ảnh đơn",
      value: eventCounts.order_image_created,
      change: <ChangeBadge current={eventCounts.order_image_created} previous={previousCounts?.order_image_created} />,
    },
    {
      id: "message_click",
      label: "Mở tin nhắn",
      value: eventCounts.message_click,
      change: <ChangeBadge current={eventCounts.message_click} previous={previousCounts?.message_click} />,
    },
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
            {overviewItems.map((item) => {
              const isChartable = CHART_METRICS.some((metric) => metric.id === item.id);
              const content = (
                <>
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                  {previousCounts ? item.change : null}
                </>
              );
              if (!isChartable) return <div key={item.id}>{content}</div>;
              return (
                <button
                  className={chartMetric === item.id ? "active" : ""}
                  key={item.id}
                  onClick={() => setChartMetric(item.id as ChartMetric)}
                  type="button"
                >
                  {content}
                </button>
              );
            })}
          </div>
          {previousCounts ? <p className="admin-stats-note">▲/▼ so với khoảng thời gian liền trước, cùng độ dài.</p> : null}
          <VisitLineChart
            buckets={eventChart.buckets}
            isHourly={eventChart.isHourly}
            label={activeMetric.label}
            unit={activeMetric.unit}
          />
        </div>
      </section>

      <section className="admin-dashboard-group" aria-label="Phễu chuyển đổi">
        <h3>Phễu chuyển đổi</h3>
        <FunnelChart counts={eventCounts} />
      </section>

      <section className="admin-dashboard-group" aria-label="Sản phẩm">
        <h3>Sản phẩm</h3>
        <AdminStatsTable
          rows={productRows}
          emptyText="Chưa có sản phẩm nào được ghi nhận trong khoảng thời gian này."
          defaultSortKey="views"
          columns={[
            {
              key: "name",
              label: "Sản phẩm",
              value: (row) => row.name,
              render: (row) => (
                <>
                  {row.name}
                  {row.isLowConversion ? <em className="admin-stats-flag">Xem nhiều, ít thêm giỏ</em> : null}
                </>
              ),
            },
            { key: "views", label: "Xem SP", value: (row) => row.views },
            { key: "patternViews", label: "Xem HT", value: (row) => row.patternViews },
            { key: "adds", label: "Giỏ", value: (row) => row.adds },
            { key: "addRate", label: "Tỉ lệ", value: (row) => row.addRate ?? -1, render: (row) => formatPercent(row.addRate) },
          ]}
        />
        <p className="admin-stats-note">
          Tỉ lệ = thêm giỏ / xem sản phẩm. Đánh dấu khi có từ 10 lượt xem trở lên mà tỉ lệ dưới một nửa mức trung bình của shop.
        </p>
      </section>

      <section className="admin-dashboard-group" aria-label="Hoạ tiết">
        <h3>Hoạ tiết</h3>
        <AdminStatsTable
          rows={patternRows}
          emptyText="Chưa có hoạ tiết nào được ghi nhận trong khoảng thời gian này."
          defaultSortKey="adds"
          columns={[
            { key: "name", label: "Hoạ tiết", value: (row) => row.name },
            { key: "views", label: "Xem", value: (row) => row.views },
            { key: "adds", label: "Giỏ", value: (row) => row.adds },
            { key: "addRate", label: "Tỉ lệ", value: (row) => row.addRate ?? -1, render: (row) => formatPercent(row.addRate) },
          ]}
        />
        <p className="admin-stats-note">Xem = số lần bấm mở ảnh hoạ tiết. Tỉ lệ = thêm giỏ / xem hoạ tiết.</p>
      </section>

      <div className="admin-insight-grid">
        <section className="admin-dashboard-group compact" aria-label="Loại sản phẩm">
          <h3>Loại sản phẩm</h3>
          <AdminStatsTable
            rows={typeRows}
            emptyText="Chưa có dữ liệu."
            defaultSortKey="views"
            columns={[
              { key: "name", label: "Loại", value: (row) => row.name },
              { key: "views", label: "Xem SP", value: (row) => row.views },
              { key: "adds", label: "Giỏ", value: (row) => row.adds },
              { key: "addRate", label: "Tỉ lệ", value: (row) => row.addRate ?? -1, render: (row) => formatPercent(row.addRate) },
            ]}
          />
        </section>
        <section className="admin-dashboard-group compact" aria-label="Size được thêm giỏ">
          <h3>Size được thêm giỏ</h3>
          <SizeBreakdown overall={sizeStats.overall} productRows={sizeStats.productRows} sizeLabels={sizeStats.sizeLabels} />
        </section>
      </div>

      <section className="admin-dashboard-group" aria-label="Khung giờ">
        <h3>Khung giờ khách hoạt động</h3>
        <HourHeatmap events={events} />
      </section>
    </section>
  );
}

function VisitLineChart({
  buckets,
  isHourly,
  label,
  unit,
}: {
  buckets: VisitChartBucket[];
  isHourly: boolean;
  label: string;
  unit: string;
}) {
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
        <span>
          {label} theo {isHourly ? "giờ" : "ngày"}
        </span>
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
            <text x="10" y="33">{activeBucket.count} {unit}</text>
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

function formatPercent(rate: number | null) {
  if (rate === null) return "–";
  const percent = rate * 100;
  return `${Number.isInteger(percent) || percent >= 10 ? Math.round(percent) : percent.toFixed(1)}%`;
}

function ChangeBadge({ current, previous }: { current: number; previous: number | undefined }) {
  if (previous === undefined) return null;
  const change = getChange(current, previous);
  if (change === null) return <small className="admin-change up">Mới</small>;
  if (change === 0) return <small className="admin-change">0%</small>;
  return (
    <small className={`admin-change ${change > 0 ? "up" : "down"}`}>
      {change > 0 ? "▲" : "▼"} {formatPercent(Math.abs(change))}
    </small>
  );
}

// Rates are compared in percentage points, not as a relative change.
function PointChangeBadge({ current, previous }: { current: number; previous: number }) {
  const points = Math.round((current - previous) * 1000) / 10;
  if (points === 0) return <small className="admin-change">0 điểm</small>;
  return (
    <small className={`admin-change ${points > 0 ? "up" : "down"}`}>
      {points > 0 ? "▲" : "▼"} {Math.abs(points)} điểm
    </small>
  );
}

function FunnelChart({ counts }: { counts: EventCounts }) {
  const steps = getFunnelSteps(counts);
  const maxCount = Math.max(1, ...steps.map((step) => step.count));

  return (
    <ol className="admin-funnel">
      {steps.map((step) => (
        <li key={step.id}>
          <div className="admin-funnel-label">
            <span>{step.label}</span>
            <strong>{step.count}</strong>
          </div>
          <div className="admin-funnel-bar" aria-hidden="true">
            <span style={{ width: `${(step.count / maxCount) * 100}%` }} />
          </div>
          <small>{step.stepRate === null ? "" : `${formatPercent(step.stepRate)} từ bước trước`}</small>
        </li>
      ))}
    </ol>
  );
}

type StatsColumn<Row> = {
  key: string;
  label: string;
  value: (row: Row) => number | string;
  render?: (row: Row) => ReactNode;
};

const STATS_TABLE_PREVIEW_ROWS = 8;

function AdminStatsTable<Row extends { id: string }>({
  columns,
  defaultSortKey,
  emptyText,
  rows,
}: {
  columns: StatsColumn<Row>[];
  defaultSortKey: string;
  emptyText: string;
  rows: Row[];
}) {
  const [sortKey, setSortKey] = useState(defaultSortKey);
  const [isExpanded, setIsExpanded] = useState(false);
  const sortColumn = columns.find((column) => column.key === sortKey) ?? columns[0];
  const sortedRows = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const left = sortColumn.value(a);
        const right = sortColumn.value(b);
        // Text sorts A→Z, numbers high→low.
        return typeof left === "string" || typeof right === "string"
          ? String(left).localeCompare(String(right), "vi")
          : right - left;
      }),
    [rows, sortColumn],
  );
  const visibleRows = isExpanded ? sortedRows : sortedRows.slice(0, STATS_TABLE_PREVIEW_ROWS);

  if (rows.length === 0) {
    return (
      <section className="admin-interest-card">
        <p>{emptyText}</p>
      </section>
    );
  }

  return (
    <section className="admin-interest-card">
      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} aria-sort={column.key === sortColumn.key ? "descending" : undefined}>
                <button
                  className={column.key === sortColumn.key ? "active" : undefined}
                  type="button"
                  onClick={() => setSortKey(column.key)}
                >
                  {column.label}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row) => (
            <tr key={row.id}>
              {columns.map((column) => (
                <td key={column.key}>{column.render ? column.render(row) : column.value(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {sortedRows.length > STATS_TABLE_PREVIEW_ROWS ? (
        <button className="admin-stats-more" type="button" onClick={() => setIsExpanded((expanded) => !expanded)}>
          {isExpanded ? "Thu gọn" : `Xem tất cả (${sortedRows.length})`}
        </button>
      ) : null}
    </section>
  );
}

function SizeBreakdown({
  overall,
  productRows,
  sizeLabels,
}: {
  overall: SizeStatsRow;
  productRows: SizeStatsRow[];
  sizeLabels: Record<SizeId, string>;
}) {
  if (overall.total === 0) {
    return (
      <section className="admin-interest-card">
        <p>Chưa có lượt thêm giỏ nào trong khoảng thời gian này.</p>
      </section>
    );
  }

  const renderSplit = (row: SizeStatsRow) => {
    const sizeOneShare = row.counts["1"] / row.total;
    return (
      <div className="admin-size-split" key={row.id}>
        <div className="admin-size-split-label">
          <span>{row.name}</span>
          <small>
            {sizeLabels["1"]}: {row.counts["1"]} · {sizeLabels["2"]}: {row.counts["2"]}
          </small>
        </div>
        <div className="admin-size-split-bar" aria-label={`${sizeLabels["1"]} ${formatPercent(sizeOneShare)}`}>
          <span style={{ width: `${sizeOneShare * 100}%` }}>{sizeOneShare >= 0.18 ? formatPercent(sizeOneShare) : ""}</span>
          <span>{1 - sizeOneShare >= 0.18 ? formatPercent(1 - sizeOneShare) : ""}</span>
        </div>
      </div>
    );
  };

  return (
    <section className="admin-interest-card admin-size-card">
      <div className="admin-size-legend">
        <span>
          <i className="size-one" /> {sizeLabels["1"]}
        </span>
        <span>
          <i className="size-two" /> {sizeLabels["2"]}
        </span>
      </div>
      {renderSplit(overall)}
      {productRows.map(renderSplit)}
    </section>
  );
}

const HEATMAP_METRICS: Array<{ id: HeatmapMetric; label: string }> = [
  { id: "site_visit", label: "Truy cập" },
  { id: "product_view", label: "Xem SP" },
  { id: "add_to_cart", label: "Thêm giỏ" },
];

function HourHeatmap({ events }: { events: StorefrontEventRow[] }) {
  const [metric, setMetric] = useState<HeatmapMetric>("site_visit");
  const heatmap = useMemo(() => getHeatmap(events, metric), [events, metric]);
  const [activeCell, setActiveCell] = useState<{ day: number; hour: number } | null>(null);
  const metricLabel = HEATMAP_METRICS.find((item) => item.id === metric)?.label ?? "";
  const busiest = useMemo(() => {
    let best: { day: number; hour: number; count: number } | null = null;
    heatmap.cells.forEach((row, day) =>
      row.forEach((count, hour) => {
        if (count > 0 && (!best || count > best.count)) best = { day, hour, count };
      }),
    );
    return best as { day: number; hour: number; count: number } | null;
  }, [heatmap]);
  const shownCell = activeCell ?? busiest;

  return (
    <section className="admin-interest-card admin-heatmap-card">
      <div className="admin-segmented" aria-label="Chỉ số khung giờ">
        {HEATMAP_METRICS.map((item) => (
          <button
            className={metric === item.id ? "active" : ""}
            key={item.id}
            type="button"
            onClick={() => {
              setMetric(item.id);
              setActiveCell(null);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      {heatmap.max === 0 ? (
        <p>Chưa có dữ liệu trong khoảng thời gian này.</p>
      ) : (
        <>
          <div className="admin-heatmap" role="grid" aria-label={`${metricLabel} theo thứ và giờ`}>
            <span />
            {Array.from({ length: 24 }, (_, hour) => (
              <span className="admin-heatmap-hour" key={hour}>
                {hour % 3 === 0 ? hour : ""}
              </span>
            ))}
            {heatmap.cells.map((row, day) => (
              <Fragment key={day}>
                <span className="admin-heatmap-day">{WEEKDAY_LABELS[day]}</span>
                {row.map((count, hour) => (
                  <button
                    aria-label={`${WEEKDAY_LABELS[day]} ${hour}h: ${count}`}
                    className={activeCell?.day === day && activeCell.hour === hour ? "active" : undefined}
                    key={hour}
                    style={
                      count > 0 ? { background: `rgba(17, 17, 17, ${0.14 + (count / heatmap.max) * 0.86})` } : undefined
                    }
                    type="button"
                    onClick={() => setActiveCell({ day, hour })}
                  />
                ))}
              </Fragment>
            ))}
          </div>
          {shownCell ? (
            <p>
              {activeCell ? "" : "Đông nhất: "}
              {WEEKDAY_LABELS[shownCell.day]}, {shownCell.hour}h–{shownCell.hour + 1}h:{" "}
              <strong>
                {heatmap.cells[shownCell.day][shownCell.hour]} lượt {metricLabel.toLowerCase()}
              </strong>
            </p>
          ) : null}
        </>
      )}
    </section>
  );
}
