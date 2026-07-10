export function formatPrice(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return raw;
  const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return formatted + "đ";
}

export function getPriceValue(raw: string) {
  return Number(raw.replace(/[^0-9]/g, "")) || 0;
}

export function formatMoney(value: number) {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".") + "đ";
}
