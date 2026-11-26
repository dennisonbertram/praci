import { t } from "@lingui/core/macro";
import type { EquityCapTableByStakeholder, EquityStakeholderHolding } from "@rakazo/contracts";
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
} from "@rakazo/ui-web";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { useHideAmounts } from "../../../lib/hide-amounts-preference";
import { formatDollars, formatPercent, formatShares } from "./format";
import { recordHref } from "./links";

const KIND_LABEL = (kind: EquityStakeholderHolding["kind"]) =>
  ({ certificate: t`Shares`, option_grant: t`Options`, convertible: t`Convertible` })[kind];

/** The cap table by stakeholder: shares per class, options, totals; a row opens its securities. */
export function StakeholderCapTable({
  table,
  fullyDiluted,
}: {
  table: EquityCapTableByStakeholder;
  fullyDiluted: boolean;
}) {
  const hidden = useHideAmounts();
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const sharesOf = (row: { outstandingShares: string; fullyDilutedShares: string }) =>
    fullyDiluted ? row.fullyDilutedShares : row.outstandingShares;
  const percentOf = (row: { outstandingPercent: string; fullyDilutedPercent: string }) =>
    fullyDiluted ? row.fullyDilutedPercent : row.outstandingPercent;

  if (table.rows.length === 0)
    return <p className="py-6 text-center text-sm text-muted-foreground">{t`No holders yet`}</p>;

  /** The breakdown after the totals: options (fully diluted) and shares per class. */
  const breakdown = table.classes.length + (fullyDiluted ? 1 : 0);
  const breakdownCells = (row: { options: string; sharesByClass: Record<string, string> }) => (
    <>
      {fullyDiluted ? (
        <TableCell className="text-end tabular-nums">
          {row.options === "0" ? "—" : formatShares(row.options)}
        </TableCell>
      ) : null}
      {table.classes.map((shareClass) => (
        <TableCell key={shareClass.id} className="text-end tabular-nums">
          {row.sharesByClass[shareClass.id] ? formatShares(row.sharesByClass[shareClass.id]!) : "—"}
        </TableCell>
      ))}
    </>
  );

  // Totals come right after the name so they stay in view; the per-class breakdown scrolls.
  return (
    <div className="overflow-x-auto">
      <Table compact className="whitespace-nowrap">
        <TableHeader>
          <TableHeadRow>
            <TableHead>{t`Stakeholder`}</TableHead>
            <TableHead className="text-end">
              {fullyDiluted ? t`Fully diluted` : t`Outstanding`}
            </TableHead>
            <TableHead className="text-end">{t`Ownership`}</TableHead>
            <TableHead className="text-end">{t`Convertibles`}</TableHead>
            {fullyDiluted ? <TableHead className="text-end">{t`Options`}</TableHead> : null}
            {table.classes.map((shareClass) => (
              <TableHead key={shareClass.id} className="text-end">
                {shareClass.name}
              </TableHead>
            ))}
          </TableHeadRow>
        </TableHeader>
        <TableBody aria-label={t`Stakeholders`}>
          {table.rows.map((row) => {
            const expanded = open.has(row.stakeholderId);
            return (
              <Fragment key={row.stakeholderId}>
                <TableRow>
                  <TableCell className="font-medium">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ms-2 gap-1"
                      aria-expanded={expanded}
                      onClick={() => toggle(row.stakeholderId)}
                    >
                      {expanded ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
                      {row.name}
                    </Button>
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {formatShares(sharesOf(row))}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {formatPercent(percentOf(row))}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {row.convertiblePrincipalCents === "0"
                      ? "—"
                      : formatDollars(row.convertiblePrincipalCents, hidden)}
                  </TableCell>
                  {breakdownCells(row)}
                </TableRow>
                {expanded
                  ? row.securities.map((security) => (
                      <TableRow key={security.id} className="bg-muted/40 text-sm">
                        <TableCell className="ps-10 text-muted-foreground">
                          <Link
                            className="font-medium text-foreground underline-offset-4 hover:underline"
                            to={recordHref(security.kind, security.id)}
                          >
                            {security.label ?? KIND_LABEL(security.kind)}
                          </Link>
                          {` · ${[
                            security.label ? KIND_LABEL(security.kind) : null,
                            security.classOrPlanName,
                          ]
                            .filter(Boolean)
                            .join(" · ")}`}
                          <span className="ms-2">{security.issueDate}</span>
                        </TableCell>
                        <TableCell className="text-end tabular-nums">
                          {security.kind === "convertible" ? "—" : formatShares(security.quantity)}
                        </TableCell>
                        <TableCell />
                        <TableCell className="text-end tabular-nums">
                          {security.kind === "convertible"
                            ? formatDollars(security.principalCents, hidden)
                            : null}
                        </TableCell>
                        {breakdown > 0 ? <TableCell colSpan={breakdown} /> : null}
                      </TableRow>
                    ))
                  : null}
              </Fragment>
            );
          })}
          {fullyDiluted && table.unallocatedPoolShares !== "0" ? (
            <TableRow>
              <TableCell className="text-muted-foreground">{t`Available for grant`}</TableCell>
              <TableCell className="text-end tabular-nums">
                {formatShares(table.unallocatedPoolShares)}
              </TableCell>
              <TableCell colSpan={2 + breakdown} />
            </TableRow>
          ) : null}
          <TableRow className="font-medium">
            <TableCell>{t`Total`}</TableCell>
            <TableCell className="text-end tabular-nums">
              {formatShares(
                fullyDiluted
                  ? (
                      BigInt(table.totals.fullyDilutedShares) + BigInt(table.unallocatedPoolShares)
                    ).toString()
                  : table.totals.outstandingShares,
              )}
            </TableCell>
            <TableCell className="text-end tabular-nums">{formatPercent("100")}</TableCell>
            <TableCell className="text-end tabular-nums">
              {formatDollars(table.totals.convertiblePrincipalCents, hidden)}
            </TableCell>
            {breakdownCells({
              options: table.totals.options,
              sharesByClass: table.totals.sharesByClass,
            })}
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
