import { Trans } from "@lingui/react/macro";
import { useState } from "react";
import { Link } from "react-router-dom";
import { usePhone } from "./ListControls";

/** Rows past which a phone shows "See all"; a long inline table is a long scroll there. */
export const PHONE_ROWS = 3;

/**
 * The rows an inline list shows: `phone` of them on a phone, `desktop` on wider screens (all of
 * them when it is not set). Pair it with `SeeAll`, which shows the rest.
 */
export function useCappedRows<T>(
  rows: readonly T[],
  {
    phone = PHONE_ROWS,
    desktop,
    keep,
  }: {
    phone?: number;
    desktop?: number;
    /** A row that must stay visible (one just saved): the list opens when it would be cut off. */
    keep?: (row: T) => boolean;
  } = {},
) {
  const isPhone = usePhone();
  const [expanded, setExpanded] = useState(false);
  const cap = isPhone ? phone : desktop;
  const capped = cap !== undefined && rows.length > cap;
  const forced = capped && keep !== undefined && rows.slice(cap).some(keep);
  const open = expanded || forced;
  return {
    rows: rows.slice(0, capped && !open ? cap : undefined),
    total: rows.length,
    capped,
    expanded: open,
    toggle: () => setExpanded((value) => !value),
  };
}

/**
 * "See all (N)" under a capped list. `to` must show exactly those N rows (with search, filter and
 * sort); a phone then opens it. Without `to`, or on a wider screen, it expands in place and offers
 * "Show less".
 */
export function SeeAll({
  list,
  to,
  className = "",
}: {
  list: Pick<ReturnType<typeof useCappedRows>, "capped" | "total" | "expanded" | "toggle">;
  to?: string;
  className?: string;
}) {
  const phone = usePhone();
  if (!list.capped) return null;
  const style = `text-xs text-muted-foreground hover:text-foreground hover:underline ${className}`;
  if (to && phone) {
    return (
      <Link to={to} className={style}>
        <Trans>See all ({list.total})</Trans>
      </Link>
    );
  }
  return (
    <button type="button" className={style} onClick={list.toggle}>
      {list.expanded ? <Trans>Show less</Trans> : <Trans>See all ({list.total})</Trans>}
    </button>
  );
}
