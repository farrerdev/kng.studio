import { getPriceValue } from "../../../shared/utils/money";

type DiscountProps = { price: string; listPrice?: string | null };

/** Whole percent off the list price, or 0 when the price isn't discounted. */
function getPercentOff({ price, listPrice }: DiscountProps) {
  const listValue = listPrice ? getPriceValue(listPrice) : 0;
  const off = listValue - getPriceValue(price);
  return off > 0 ? Math.max(1, Math.round((off / listValue) * 100)) : 0;
}

/**
 * Struck-through list price shown right after a discounted price. The "-4%" label follows it
 * unless `label` is false, for places that pin a DiscountBadge on the photo instead.
 */
export function DiscountMark({ price, listPrice, label = true }: DiscountProps & { label?: boolean }) {
  const percent = getPercentOff({ price, listPrice });
  if (!percent) return null;

  return (
    <>
      <del className="shop-price-list" aria-label={`Giá gốc ${listPrice}`}>
        {listPrice}
      </del>
      {label ? <span className="shop-price-off">-{percent}%</span> : null}
    </>
  );
}

/** "-4%" pinned to the top-right corner of a photo; the parent must be positioned. */
export function DiscountBadge(props: DiscountProps) {
  const percent = getPercentOff(props);
  return percent ? <span className="shop-price-off pinned">-{percent}%</span> : null;
}
