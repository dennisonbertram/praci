import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import type { Safe } from "@rakazo/contracts";
import { atCapPercent, atCapSum, countedSafes } from "@rakazo/core";
import { Link } from "react-router-dom";
import { usdFigure } from "../../lib/finance-format";
import { useHideAmounts } from "../../lib/hide-amounts-preference";

const percent = (value: number | null) => (value == null ? "—" : `${value.toFixed(1)}%`);

/**
 * SAFEs that have been sent, outside the table's 100%, as one group: "SAFEs, if converted at cap"
 * with the sum, then a row each (amount over cap). Drafts are not here; they count only in the
 * Fundraising round bar. A SAFE without a cap, such as a Mercury discount SAFE, shows a dash and
 * adds nothing.
 */
export function SafeRows({ safes }: { safes: readonly Safe[] }) {
  useHideAmounts();
  const shown = countedSafes(safes);
  if (shown.length === 0) return null;
  return (
    <section
      aria-label={t`SAFEs, if converted at cap`}
      className="mt-3 border-t border-border pt-2"
    >
      <div className="flex items-center gap-2 py-1 text-sm font-medium">
        <Link to="/app/fundraising" className="min-w-0 flex-1 underline-offset-4 hover:underline">
          {t`SAFEs, if converted at cap`}
        </Link>
        <span className="tabular-nums" data-testid="safe-sum">
          {percent(atCapSum(shown))}
        </span>
      </div>
      <ul>
        {shown.map((safe) => (
          <li key={safe.id} className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
            <span className="min-w-0 flex-1 truncate" title={safe.investorName}>
              {safe.investorName}
            </span>
            <span className="tabular-nums">
              {usdFigure(safe.amountCents / 100, 0, i18n.locale || "en")}
            </span>
            <span className="w-14 text-end tabular-nums">{percent(atCapPercent(safe))}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
