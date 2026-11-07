import { useEffect, useMemo, useState, type PointerEvent, type ReactNode } from "react";
import type { StorefrontEventRow, StorefrontEventSource, StorefrontEventType } from "../../analytics/analyticsApi";
import {
  getLocalDateInputValue,
  getLocalMonthInputValue,
  type StorefrontStatsFilter,
} from "../../analytics/statsFilters";
import type { Product, ProductType, SizeId } from "../../../types/catalog";
import {
  getChange,
  getEventCounts,
  getPatternStatsRows,
  getProductStatsRows,
  getRate,
  getSizeStats,
  getStatsHighlights,
  type StatsHighlight,
  getTypeStatsRows,
  type EventCounts,
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

type SourceFilter = "all" | StorefrontEventSource;

const SOURCE_TABS: Array<{ id: SourceFilter; label: string }> = [
  { id: "all", label: "Tất cả" },
  { id: "web", label: "Web" },
  { id: "3d", label: "Cửa hàng 3D" },
];

function bySource(events: StorefrontEventRow[], source: SourceFilter) {
  return source === "all" ? events : events.filter((event) => event.source === source);
}

export function AdminStatsDashboard({
  events: allEvents,
  filter,
  isLoading,
  onFilterChange,
  previousEvents: allPreviousEvents,
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
  // Web store, 3D shop, or both (events from before the split count as web).
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const events = useMemo(() => bySource(allEvents, sourceFilter), [allEvents, sourceFilter]);
  const previousEvents = useMemo(
    () => (allPreviousEvents ? bySource(allPreviousEvents, sourceFilter) : null),
    [allPreviousEvents, sourceFilter],
  );
  const eventCounts = useMemo(() => getEventCounts(events), [events]);
  const previousCounts = useMemo(() => (previousEvents ? getEventCounts(previousEvents) : null), [previousEvents]);
  const productRows = useMemo(() => getProductStatsRows(events, products, productTypes), [events, products, productTypes]);
  const patternRows = useMemo(() => getPatternStatsRows(events, products, productTypes), [events, products, productTypes]);
  const typeRows = useMemo(() => getTypeStatsRows(productRows, products, productTypes), [productRows, products, productTypes]);
  const sizeStats = useMemo(() => getSizeStats(events, products, productTypes), [events, products, productTypes]);
  const highlights = useMemo(
    () =>
      getStatsHighlights({
        productRows,
        patternRows,
        sizeOverall: sizeStats.overall,
        sizeLabels: sizeStats.sizeLabels,
        events,
      }),
    [events, patternRows, productRows, sizeStats],
  );
  const [chartMetric, setChartMetric] = useState<ChartMetric>("site_visit");
  const activeMetric = CHART_METRICS.find((metric) => metric.id === chartMetric) ?? CHART_METRICS[0];
  const eventChart = useMemo(
    () => getEventChartBuckets(events, filter, chartMetric),
    [events, filter, chartMetric],
  );
  const addToCartRate = getRate(eventCounts.add_to_cart, Math.max(eventCounts.product_view, eventCounts.add_to_cart));
  const previousAddToCartRate = previousCounts
    ? getRate(previousCounts.add_to_cart, Math.max(previousCounts.product_view, previousCounts.add_to_cart))
    : null;
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
        <div className="admin-segmented" aria-label="Nguồn truy cập">
          {SOURCE_TABS.map((tab) => (
            <button
              className={sourceFilter === tab.id ? "active" : ""}
              key={tab.id}
              type="button"
              aria-pressed={sourceFilter === tab.id}
              onClick={() => setSourceFilter(tab.id)}
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

      <section className="admin-dashboard-group" aria-label="Điểm nổi bật">
        <h3>Điểm nổi bật</h3>
        <StatsHighlights highlights={highlights} isLoading={isLoading} />
      </section>

      <section className="admin-dashboard-group" aria-label="Phễu mua hàng">
        <h3>Phễu mua hàng</h3>
        <PurchaseFunnel counts={eventCounts} />
      </section>

      <div className="admin-stats-grid">
        <section className="admin-dashboard-group" aria-label="Xếp hạng">
          <h3>Xếp hạng</h3>
          <RankingCard productRows={productRows} patternRows={patternRows} typeRows={typeRows} />
        </section>

        <div className="admin-stats-side">
          <section className="admin-dashboard-group compact" aria-label="Size được thêm giỏ">
            <h3>Size được thêm giỏ</h3>
            <SizeSplit overall={sizeStats.overall} sizeLabels={sizeStats.sizeLabels} />
          </section>
          <section className="admin-dashboard-group compact" aria-label="Giờ khách vào">
            <h3>Giờ khách vào</h3>
            <HourBars events={events} />
          </section>
        </div>
      </div>
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

function StatsHighlights({ highlights, isLoading }: { highlights: StatsHighlight[]; isLoading: boolean }) {
  if (highlights.length === 0) {
    return (
      <p className="admin-highlights-empty">
        {isLoading ? "Đang tải số liệu…" : "Chưa đủ dữ liệu trong khoảng này. Thử chọn 30 ngày để xem xu hướng."}
      </p>
    );
  }
  return (
    <ul className="admin-highlights">
      {highlights.map((highlight) => (
        <li className={highlight.tone === "warning" ? "admin-highlight warning" : "admin-highlight"} key={highlight.id}>
          <span className="admin-highlight-label">{highlight.label}</span>
          <strong title={highlight.value}>{highlight.value}</strong>
          <span className="admin-highlight-detail">{highlight.detail}</span>
        </li>
      ))}
    </ul>
  );
}

const FUNNEL_STEPS: Array<{ id: keyof EventCounts; label: string }> = [
  { id: "site_visit", label: "Truy cập" },
  { id: "product_view", label: "Xem sản phẩm" },
  { id: "add_to_cart", label: "Thêm giỏ" },
  { id: "order_image_created", label: "Chốt đơn" },
];

// Four buying steps side by side; the step that loses the most shoppers is highlighted.
function PurchaseFunnel({ counts }: { counts: EventCounts }) {
  const steps = FUNNEL_STEPS.map((step, index) => {
    const previous = index > 0 ? counts[FUNNEL_STEPS[index - 1].id] : null;
    const rate = previous ? Math.min(1, counts[step.id] / previous) : null;
    return { ...step, count: counts[step.id], rate };
  });
  const worstIndex = steps.reduce(
    (worst, step, index) => (step.rate !== null && (worst < 0 || step.rate < (steps[worst].rate ?? 1)) ? index : worst),
    -1,
  );

  return (
    <ol className="admin-funnel-steps">
      {steps.map((step, index) => (
        <li key={step.id} className={index === worstIndex ? "is-worst" : undefined}>
          <span className="admin-funnel-step-label">{step.label}</span>
          <strong>{step.count}</strong>
          {step.rate !== null ? (
            <small>
              {formatPercent(step.rate)} đi tiếp
              {index === worstIndex ? " · rơi nhiều nhất" : ""}
            </small>
          ) : (
            <small>Điểm bắt đầu</small>
          )}
        </li>
      ))}
    </ol>
  );
}

type RankingRow = { id: string; name: string; views: number; adds: number };
type RankingTab = "product" | "pattern" | "type";

const RANKING_TABS: Array<{ id: RankingTab; label: string }> = [
  { id: "product", label: "Sản phẩm" },
  { id: "pattern", label: "Hoạ tiết" },
  { id: "type", label: "Kiểu dáng" },
];
const RANKING_PREVIEW_ROWS = 5;

// One ranked list (by add-to-cart, then views) with tabs instead of three wide tables.
function RankingCard({
  productRows,
  patternRows,
  typeRows,
}: {
  productRows: RankingRow[];
  patternRows: RankingRow[];
  typeRows: RankingRow[];
}) {
  const [tab, setTab] = useState<RankingTab>("product");
  const [isExpanded, setIsExpanded] = useState(false);
  const source = tab === "product" ? productRows : tab === "pattern" ? patternRows : typeRows;
  const rows = [...source].sort((a, b) => b.adds - a.adds || b.views - a.views);
  const visibleRows = isExpanded ? rows : rows.slice(0, RANKING_PREVIEW_ROWS);
  const maxAdds = Math.max(1, ...rows.map((row) => row.adds));

  return (
    <div className="admin-ranking">
      <div className="admin-ranking-tabs" role="tablist" aria-label="Xếp hạng theo">
        {RANKING_TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? "active" : undefined}
            onClick={() => {
              setTab(item.id);
              setIsExpanded(false);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="admin-ranking-empty">Chưa có dữ liệu trong khoảng này.</p>
      ) : (
        <ol className="admin-ranking-list">
          {visibleRows.map((row) => {
            const isCold = row.adds === 0 && row.views >= 10;
            return (
              <li key={row.id}>
                <div className="admin-ranking-row">
                  <span className="admin-ranking-name">{row.name}</span>
                  <span className={isCold ? "admin-ranking-meta cold" : "admin-ranking-meta"}>
                    {row.adds} giỏ · {row.views} xem
                  </span>
                </div>
                <span className="admin-ranking-bar" aria-hidden="true">
                  <i style={{ width: `${(row.adds / maxAdds) * 100}%` }} />
                </span>
              </li>
            );
          })}
        </ol>
      )}
      {rows.length > RANKING_PREVIEW_ROWS ? (
        <button className="admin-ranking-more" type="button" onClick={() => setIsExpanded((current) => !current)}>
          {isExpanded ? "Thu gọn" : `Xem tất cả (${rows.length})`}
        </button>
      ) : null}
    </div>
  );
}

function SizeSplit({ overall, sizeLabels }: { overall: SizeStatsRow; sizeLabels: Record<SizeId, string> }) {
  if (overall.total === 0) return <p className="admin-ranking-empty">Chưa có lượt thêm giỏ.</p>;
  const sizes = (Object.keys(sizeLabels) as SizeId[]).map((sizeId) => ({
    id: sizeId,
    label: sizeLabels[sizeId],
    share: overall.counts[sizeId] / overall.total,
    count: overall.counts[sizeId],
  }));
  return (
    <div className="admin-mini-card">
      <span className="admin-size-split" aria-hidden="true">
        {sizes.map((size, index) => (
          <i key={size.id} className={index === 0 ? "primary" : undefined} style={{ width: `${size.share * 100}%` }} />
        ))}
      </span>
      <div className="admin-size-split-legend">
        {sizes.map((size) => (
          <span key={size.id}>
            {size.label} · {formatPercent(size.share)} <small>({size.count})</small>
          </span>
        ))}
      </div>
    </div>
  );
}

// Visits per hour of day across the whole range; the busiest hour is drawn darker.
function HourBars({ events }: { events: StorefrontEventRow[] }) {
  const counts = Array.from({ length: 24 }, () => 0);
  events.forEach((event) => {
    if (event.event_type === "site_visit") counts[new Date(event.created_at).getHours()] += 1;
  });
  const max = Math.max(...counts);
  if (max === 0) return <p className="admin-ranking-empty">Chưa có lượt truy cập.</p>;
  const peak = counts.indexOf(max);
  return (
    <div className="admin-mini-card">
      <div className="admin-hour-bars" role="img" aria-label={`Giờ đông nhất ${peak}h với ${max} lượt truy cập`}>
        {counts.map((count, hour) => (
          <span
            key={hour}
            className={hour === peak ? "peak" : undefined}
            style={{ height: `${Math.max(4, (count / max) * 100)}%` }}
            title={`${hour}h: ${count} lượt`}
          />
        ))}
      </div>
      <div className="admin-hour-axis" aria-hidden="true">
        <span>0h</span>
        <span>6h</span>
        <span>12h</span>
        <span>18h</span>
        <span>23h</span>
      </div>
      <p className="admin-mini-note">
        Đông nhất {peak}h–{peak + 1}h · {max} lượt
      </p>
    </div>
  );
}
