export type StorefrontStatsFilter =
  | { mode: "yesterday" }
  | { mode: "today" }
  | { mode: "7d" }
  | { mode: "30d" }
  | { mode: "day"; date: string }
  | { mode: "month"; month: string };

export type StorefrontStatsRange = {
  from: string;
  to: string;
};

export const DEFAULT_STOREFRONT_STATS_FILTER: StorefrontStatsFilter = { mode: "7d" };

function padNumber(value: number) {
  return String(value).padStart(2, "0");
}

export function getLocalDateInputValue(date = new Date()) {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
}

export function getLocalMonthInputValue(date = new Date()) {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}`;
}

function getStartOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getStartOfNextLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
}

function getLocalDayRange(dateValue: string): StorefrontStatsRange {
  const [year, month, date] = dateValue.split("-").map(Number);
  const from = new Date(year, month - 1, date);
  const to = new Date(year, month - 1, date + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

function getLocalMonthRange(monthValue: string): StorefrontStatsRange {
  const [year, month] = monthValue.split("-").map(Number);
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function getStorefrontStatsRange(filter: StorefrontStatsFilter, now = new Date()): StorefrontStatsRange {
  if (filter.mode === "day") return getLocalDayRange(filter.date);
  if (filter.mode === "month") return getLocalMonthRange(filter.month);

  if (filter.mode === "today") {
    return {
      from: getStartOfLocalDay(now).toISOString(),
      to: getStartOfNextLocalDay(now).toISOString(),
    };
  }

  if (filter.mode === "yesterday") {
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    return {
      from: getStartOfLocalDay(yesterday).toISOString(),
      to: getStartOfNextLocalDay(yesterday).toISOString(),
    };
  }

  const days = filter.mode === "30d" ? 30 : 7;
  return {
    from: new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString(),
    to: now.toISOString(),
  };
}

export function getStorefrontStatsFilterLabel(filter: StorefrontStatsFilter) {
  if (filter.mode === "today") return "hôm nay";
  if (filter.mode === "yesterday") return "hôm qua";
  if (filter.mode === "7d") return "7 ngày gần nhất";
  if (filter.mode === "30d") return "30 ngày gần nhất";
  if (filter.mode === "day") return `ngày ${filter.date}`;
  return `tháng ${filter.month}`;
}
