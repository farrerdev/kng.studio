import { LEGACY_SITE_VISIT_PRODUCT_ID, type StorefrontEventRow, type StorefrontEventType } from "../../analytics/analyticsApi";
import { getProductTitle } from "../../catalog/catalogUtils";
import { formatSelectedSize } from "../../storefront/cart/cartUtils";
import type { Product, ProductType, SizeId } from "../../../types/catalog";

// Pure aggregations over storefront_events for the admin stats screen. Counts are event counts
// (lượt), not unique visitors: events carry no visitor id.

export type EventCounts = Record<StorefrontEventType, number>;

export type ProductStatsRow = {
  id: string;
  name: string;
  views: number;
  patternViews: number;
  adds: number;
  addRate: number | null;
  isLowConversion: boolean;
};

export type PatternStatsRow = {
  id: string;
  name: string;
  views: number;
  adds: number;
  addRate: number | null;
};

export type TypeStatsRow = {
  id: string;
  name: string;
  views: number;
  patternViews: number;
  adds: number;
  addRate: number | null;
};

export type SizeStatsRow = {
  id: string;
  name: string;
  counts: Record<SizeId, number>;
  total: number;
};

const SIZE_IDS: SizeId[] = ["1", "2"];
// A product needs this many views before "xem nhiều, ít thêm giỏ" is meaningful.
const LOW_CONVERSION_MIN_VIEWS = 10;

export function createEmptyEventCounts(): EventCounts {
  return {
    site_visit: 0,
    product_view: 0,
    pattern_view: 0,
    add_to_cart: 0,
    order_image_created: 0,
    message_click: 0,
  };
}

export function getEventCounts(events: StorefrontEventRow[]) {
  return events.reduce((counts, event) => {
    counts[event.event_type] += 1;
    return counts;
  }, createEmptyEventCounts());
}

export function getRate(part: number, whole: number) {
  return whole > 0 ? part / whole : null;
}

// Below this many interactions a percentage is mostly noise (1/1 = 100%), so it isn't shown.
export const MIN_RATE_SAMPLE = 5;

/**
 * Add-to-cart rate for a product / pattern. Shoppers can add straight from the "+" button without
 * opening the photo, so an add also counts as an interaction: rate = adds / max(views, adds) ≤ 100%.
 */
export function getAddRate(adds: number, views: number) {
  const interactions = Math.max(views, adds);
  return interactions >= MIN_RATE_SAMPLE ? adds / interactions : null;
}

/** Relative change vs the previous period; null when there is nothing to compare against. */
export function getChange(current: number, previous: number | undefined) {
  if (previous === undefined) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return (current - previous) / previous;
}

function isProductEvent(event: StorefrontEventRow) {
  return Boolean(event.product_id) && event.product_id !== LEGACY_SITE_VISIT_PRODUCT_ID;
}

export function getProductStatsRows(events: StorefrontEventRow[], products: Product[], productTypes: ProductType[]) {
  const rows = new Map<string, ProductStatsRow>(
    products.map((product) => [
      product.id,
      {
        id: product.id,
        name: getProductTitle(product, productTypes),
        views: 0,
        patternViews: 0,
        adds: 0,
        addRate: null,
        isLowConversion: false,
      },
    ]),
  );

  events.forEach((event) => {
    if (!isProductEvent(event)) return;
    const row = rows.get(event.product_id!);
    if (!row) return;
    if (event.event_type === "product_view") row.views += 1;
    if (event.event_type === "pattern_view") row.patternViews += 1;
    if (event.event_type === "add_to_cart") row.adds += 1;
  });

  const activeRows = Array.from(rows.values()).filter((row) => row.views + row.patternViews + row.adds > 0);
  const totalViews = activeRows.reduce((total, row) => total + row.views, 0);
  const totalAdds = activeRows.reduce((total, row) => total + row.adds, 0);
  const shopAddRate = getRate(totalAdds, Math.max(totalViews, totalAdds)) ?? 0;

  return activeRows.map((row) => {
    const addRate = getAddRate(row.adds, row.views);
    return {
      ...row,
      addRate,
      // Plenty of views but converting at under half the shop's average.
      isLowConversion: row.views >= LOW_CONVERSION_MIN_VIEWS && (addRate ?? 0) < shopAddRate / 2,
    };
  });
}

export function getPatternStatsRows(events: StorefrontEventRow[], products: Product[], productTypes: ProductType[]) {
  const rows = new Map<string, PatternStatsRow>();
  products.forEach((product) => {
    const productTitle = getProductTitle(product, productTypes);
    product.patterns.forEach((pattern) => {
      rows.set(pattern.id, {
        id: pattern.id,
        name: `${productTitle} · ${pattern.name || "Hoạ tiết"}`,
        views: 0,
        adds: 0,
        addRate: null,
      });
    });
  });

  events.forEach((event) => {
    if (!event.pattern_id) return;
    const row = rows.get(event.pattern_id);
    if (!row) return;
    if (event.event_type === "pattern_view") row.views += 1;
    if (event.event_type === "add_to_cart") row.adds += 1;
  });

  return Array.from(rows.values())
    .filter((row) => row.views + row.adds > 0)
    .map((row) => ({ ...row, addRate: getAddRate(row.adds, row.views) }));
}

export function getTypeStatsRows(productRows: ProductStatsRow[], products: Product[], productTypes: ProductType[]) {
  const productTypeIds = new Map(products.map((product) => [product.id, product.productTypeId]));
  const rows = new Map<string, TypeStatsRow>(
    productTypes.map((productType) => [
      productType.id,
      { id: productType.id, name: productType.name || "Loại sản phẩm", views: 0, patternViews: 0, adds: 0, addRate: null },
    ]),
  );

  productRows.forEach((productRow) => {
    const row = rows.get(productTypeIds.get(productRow.id) ?? "");
    if (!row) return;
    row.views += productRow.views;
    row.patternViews += productRow.patternViews;
    row.adds += productRow.adds;
  });

  return Array.from(rows.values())
    .filter((row) => row.views + row.patternViews + row.adds > 0)
    .map((row) => ({ ...row, addRate: getAddRate(row.adds, row.views) }));
}

/** Add-to-cart split by size: one row for the whole shop, then one per product. */
export function getSizeStats(events: StorefrontEventRow[], products: Product[], productTypes: ProductType[]) {
  const createCounts = (): Record<SizeId, number> => ({ "1": 0, "2": 0 });
  const overall = createCounts();
  const byProduct = new Map<string, Record<SizeId, number>>();

  events.forEach((event) => {
    if (event.event_type !== "add_to_cart" || !event.size_id || !SIZE_IDS.includes(event.size_id)) return;
    overall[event.size_id] += 1;
    if (!isProductEvent(event)) return;
    const counts = byProduct.get(event.product_id!) ?? createCounts();
    counts[event.size_id] += 1;
    byProduct.set(event.product_id!, counts);
  });

  const productRows: SizeStatsRow[] = products
    .filter((product) => byProduct.has(product.id))
    .map((product) => {
      const counts = byProduct.get(product.id)!;
      return { id: product.id, name: getProductTitle(product, productTypes), counts, total: counts["1"] + counts["2"] };
    })
    .sort((a, b) => b.total - a.total);

  return {
    overall: { id: "all", name: "Tất cả", counts: overall, total: overall["1"] + overall["2"] } satisfies SizeStatsRow,
    productRows,
    sizeLabels: Object.fromEntries(SIZE_IDS.map((sizeId) => [sizeId, formatSelectedSize(sizeId)])) as Record<SizeId, string>,
  };
}


export type StatsHighlight = {
  id: string;
  label: string;
  value: string;
  detail: string;
  tone?: "warning";
};

/** Short, plain-language takeaways for the top of the stats screen. Skips anything without enough data. */
export function getStatsHighlights({
  productRows,
  patternRows,
  sizeOverall,
  sizeLabels,
  events,
}: {
  productRows: ProductStatsRow[];
  patternRows: PatternStatsRow[];
  sizeOverall: SizeStatsRow;
  sizeLabels: Record<SizeId, string>;
  events: StorefrontEventRow[];
}): StatsHighlight[] {
  const highlights: StatsHighlight[] = [];

  const topProduct = [...productRows].sort((a, b) => b.adds - a.adds || b.views - a.views)[0];
  if (topProduct && topProduct.adds > 0) {
    highlights.push({
      id: "top-product",
      label: "Thêm giỏ nhiều nhất",
      value: topProduct.name,
      detail: `${topProduct.adds} giỏ`,
    });
  }

  const topPattern = [...patternRows].sort((a, b) => b.adds - a.adds || b.views - a.views)[0];
  if (topPattern && topPattern.adds > 0) {
    highlights.push({
      id: "top-pattern",
      label: "Hoạ tiết hút khách",
      value: topPattern.name.split(" · ").pop() ?? topPattern.name,
      detail: `${topPattern.adds} giỏ`,
    });
  }

  const weakProduct = productRows
    .filter((row) => row.isLowConversion)
    .sort((a, b) => b.views - a.views)[0];
  if (weakProduct) {
    highlights.push({
      id: "weak-product",
      label: "Xem nhiều, ít thêm giỏ",
      value: weakProduct.name,
      detail: `${weakProduct.views} xem · ${weakProduct.adds} giỏ`,
      tone: "warning",
    });
  }

  if (sizeOverall.total >= MIN_RATE_SAMPLE) {
    const topSize = SIZE_IDS.reduce((best, sizeId) => (sizeOverall.counts[sizeId] > sizeOverall.counts[best] ? sizeId : best), SIZE_IDS[0]);
    highlights.push({
      id: "top-size",
      label: "Size được chọn nhiều",
      value: sizeLabels[topSize],
      detail: `${Math.round((sizeOverall.counts[topSize] / sizeOverall.total) * 100)}%`,
    });
  }

  const hourCounts = Array.from({ length: 24 }, () => 0);
  events.forEach((event) => {
    if (event.event_type === "site_visit") hourCounts[new Date(event.created_at).getHours()] += 1;
  });
  const peakHour = hourCounts.indexOf(Math.max(...hourCounts));
  if (hourCounts[peakHour] >= MIN_RATE_SAMPLE) {
    highlights.push({
      id: "peak-hour",
      label: "Giờ đông khách",
      value: `${peakHour}h – ${peakHour + 1}h`,
      detail: `${hourCounts[peakHour]} lượt`,
    });
  }

  return highlights;
}
