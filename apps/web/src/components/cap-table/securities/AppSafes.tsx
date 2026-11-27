import { t } from "@lingui/core/macro";
import type { EquityAppSafe } from "@rakazo/contracts";
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
  TableScrollRegion,
} from "@rakazo/ui-web";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useHideAmounts } from "../../../lib/hide-amounts-preference";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";
import { formatCents, formatDay, formatPercent } from "./format";

/**
 * SAFEs recorded in Fundraising, read live from there (never copied into the ledger). Shown only
 * when there are some.
 */
export function AppSafes({ reloadKey = 0, onAdded }: { reloadKey?: number; onAdded: () => void }) {
  const hidden = useHideAmounts();
  const [rows, setRows] = useState<EquityAppSafe[]>([]);
  const [adding, setAdding] = useState<string | null>(null);
  const [error, setError] = useState("");

  const add = async (id: string) => {
    setAdding(id);
    setError("");
    try {
      await rpc.equity.appSafes.addToLedger({ safeId: id });
      onAdded();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setAdding(null);
    }
  };

  useEffect(() => {
    let live = true;
    rpc.equity.appSafes
      .list({})
      .then((loaded) => {
        if (live) setRows(loaded);
      })
      .catch(() => {
        if (live) setRows([]);
      });
    return () => {
      live = false;
    };
  }, [reloadKey]);

  if (rows.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <h2 className="text-sm font-medium">{t`From Fundraising`}</h2>
        <span className="text-sm text-muted-foreground tabular-nums">
          {t`${formatCents(rows.reduce((sum, row) => sum + BigInt(row.principalCents), 0n).toString(), hidden)} not yet in the ledger`}
        </span>
        <Link
          to="/app/fundraising"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          {t`Open Fundraising`}
        </Link>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <TableScrollRegion aria-label={t`Fundraising SAFEs`}>
        <Table className="min-w-[48rem]">
          <TableHeader>
            <TableHeadRow>
              <TableHead>{t`Investor`}</TableHead>
              <TableHead className="text-end">{t`Amount`}</TableHead>
              <TableHead className="text-end">{t`Valuation cap`}</TableHead>
              <TableHead className="text-end">{t`Discount`}</TableHead>
              <TableHead>{t`Investment date`}</TableHead>
              <TableHead className="w-32">
                <span className="sr-only">{t`Actions`}</span>
              </TableHead>
            </TableHeadRow>
          </TableHeader>
          <TableBody aria-label={t`Fundraising SAFEs`}>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.investorName}</TableCell>
                <TableCell className="text-end tabular-nums">
                  {formatCents(row.principalCents, hidden)}
                </TableCell>
                <TableCell className="text-end tabular-nums">
                  {formatCents(row.valuationCapCents, hidden)}
                </TableCell>
                <TableCell className="text-end tabular-nums">
                  {formatPercent(row.discountPercent)}
                </TableCell>
                <TableCell>{formatDay(row.issueDate)}</TableCell>
                <TableCell className="text-end">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={adding !== null}
                    aria-label={t`Add ${row.investorName} to ledger`}
                    onClick={() => void add(row.id)}
                  >
                    {t`Add to ledger`}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableScrollRegion>
    </section>
  );
}
