import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import type { EquityCapTableByStakeholder, EquityOverview } from "@rakazo/contracts";
import { toCsv } from "@rakazo/core/equity";
import {
  Button,
  enqueueNotificationToast,
  Input,
  Label,
  Skeleton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@rakazo/ui-web";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { percentFigure } from "../../../lib/finance-format";
import { sortBy, useListParams } from "../../../lib/list-params";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";
import { SectionCard } from "../../SectionCard";
import { OwnershipBar } from "../OwnershipBar";
import { CapTableEmptyState } from "../shell/CapTableEmptyState";
import { downloadText } from "../views/download";
import { OverviewSavedViews } from "../views/OverviewSavedViews";
import { StakeholderCapTable } from "../views/StakeholderCapTable";
import { fullyDilutedParts, ownershipLegend, percentText } from "./fully-diluted";

const locale = () => i18n.locale || "en";

/** Share counts arrive as integer strings: BigInt keeps the digits, the formatter adds separators. */
const shares = (value: string) => new Intl.NumberFormat(locale()).format(BigInt(value));

/** Cents as whole dollars, still through BigInt so no sum passes through a float. */
const dollars = (value: string) =>
  `$${new Intl.NumberFormat(locale()).format(BigInt(value) / 100n)}`;

const percent = (value: string) => percentFigure(Number(value), 2);

const SORTS = [
  "name",
  "authorized",
  "outstanding",
  "ownership",
  "diluted",
  "dilutedPercent",
  "raised",
] as const;
type SortField = (typeof SORTS)[number];

/** The class table: name, authorized, outstanding, ownership, fully diluted, raised. */
function ClassTable({
  overview,
  fullyDiluted,
}: {
  overview: EquityOverview;
  fullyDiluted: boolean;
}) {
  const list = useListParams(SORTS, { field: "diluted", dir: "desc" });
  const parts = fullyDilutedParts(overview);
  const extra = fullyDiluted
    ? [
        { key: "options", name: t`Options granted`, shares: parts.options },
        { key: "pool", name: t`Available for grant`, shares: parts.pool },
        { key: "other", name: t`Other`, shares: parts.other },
      ].filter((row) => row.shares > 0n)
    : [];
  const pick = (row: EquityOverview["classes"][number]) =>
    ({
      name: row.name,
      authorized: row.authorizedShares,
      outstanding: row.outstandingShares,
      ownership: row.outstandingPercent,
      diluted: row.outstandingShares,
      dilutedPercent: row.outstandingShares,
      raised: row.amountRaisedCents,
    })[list.sort.field];
  // BigInt-valued columns sort by size, not by their digit text.
  const rows = sortBy(
    overview.classes,
    (row) => {
      const value = pick(row);
      return /^\d+$/.test(String(value)) ? Number(BigInt(String(value))) : String(value);
    },
    list.sort.dir,
  );
  const head = (field: SortField) => ({
    sortDirection: list.sort.field === field ? list.sort.dir : null,
    onSort: () => list.toggleSort(field),
  });
  return (
    <Table>
      <TableHeader>
        <TableHeadRow>
          <TableHead {...head("name")}>{t`Share class`}</TableHead>
          <TableHead className="text-end" {...head("authorized")}>{t`Authorized`}</TableHead>
          {fullyDiluted ? (
            <>
              <TableHead className="text-end" {...head("diluted")}>{t`Fully diluted`}</TableHead>
              <TableHead
                className="text-end"
                {...head("dilutedPercent")}
              >{t`Fully diluted %`}</TableHead>
            </>
          ) : (
            <>
              <TableHead className="text-end" {...head("outstanding")}>{t`Outstanding`}</TableHead>
              <TableHead className="text-end" {...head("ownership")}>{t`Ownership`}</TableHead>
            </>
          )}
          <TableHead className="text-end" {...head("raised")}>{t`Raised`}</TableHead>
        </TableHeadRow>
      </TableHeader>
      <TableBody aria-label={t`Share classes`}>
        {rows.map((row) => (
          <TableRow key={row.shareClassId}>
            <TableCell className="font-medium">{row.name}</TableCell>
            <TableCell className="text-end tabular-nums">{shares(row.authorizedShares)}</TableCell>
            <TableCell className="text-end tabular-nums">{shares(row.outstandingShares)}</TableCell>
            <TableCell className="text-end tabular-nums">
              {percent(
                fullyDiluted
                  ? percentText(BigInt(row.outstandingShares), parts.total)
                  : row.outstandingPercent,
              )}
            </TableCell>
            <TableCell className="text-end tabular-nums">
              {dollars(row.amountRaisedCents)}
            </TableCell>
          </TableRow>
        ))}
        {extra.map((row) => (
          <TableRow key={row.key}>
            <TableCell className="text-muted-foreground">{row.name}</TableCell>
            <TableCell />
            <TableCell className="text-end tabular-nums">{shares(row.shares.toString())}</TableCell>
            <TableCell className="text-end tabular-nums">
              {percent(percentText(row.shares, parts.total))}
            </TableCell>
            <TableCell />
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/** The overview tab: what the company is made of, by share class. */
export function CapTableOverview() {
  const [overview, setOverview] = useState<EquityOverview | null>(null);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);
  const [params, setParams] = useSearchParams();
  const [byStakeholder, setByStakeholder] = useState<EquityCapTableByStakeholder | null>(null);

  // The toolbar lives in the URL so a saved view can restore it.
  const asOf = params.get("asOf") ?? "";
  const view = params.get("view") === "stakeholder" ? "stakeholder" : "class";
  const fullyDiluted = params.get("fd") !== "0";
  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if (view !== "stakeholder") return;
    let live = true;
    setByStakeholder(null);
    rpc.equity.views
      .capTableByStakeholder(asOf ? { asOf } : {})
      .then((loaded) => {
        if (live) setByStakeholder(loaded);
      })
      .catch((cause: unknown) => {
        if (live) setError(errorText(cause));
      });
    return () => {
      live = false;
    };
  }, [view, asOf, reloadCount]);

  useEffect(() => {
    let live = true;
    setError("");
    rpc.equity
      .overview(asOf ? { asOf } : {})
      .then((loaded) => {
        if (live) setOverview(loaded);
      })
      .catch((cause: unknown) => {
        if (live) setError(errorText(cause));
      });
    return () => {
      live = false;
    };
  }, [asOf, reloadCount]);

  const copySnapshot = async () => {
    setImporting(true);
    try {
      await rpc.equity.importSnapshot();
      setReloadCount((count) => count + 1);
    } catch (cause) {
      enqueueNotificationToast({
        id: "cap-table-import-failed",
        title: t`Could not copy the cap table`,
        body: errorText(cause),
      });
    } finally {
      setImporting(false);
    }
  };

  if (error)
    return (
      <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-destructive">{error}</span>
        <Button variant="outline" size="sm" onClick={() => setReloadCount((count) => count + 1)}>
          {t`Try again`}
        </Button>
      </div>
    );

  if (overview == null)
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );

  if (!overview.hasLedger)
    return (
      <CapTableEmptyState
        message={t`No cap table yet`}
        action={
          overview.canImport ? (
            <Button size="sm" onClick={() => void copySnapshot()} disabled={importing}>
              {t`Copy from current cap table`}
            </Button>
          ) : (
            // Nothing to copy: a ledger starts with its holders, added or imported there.
            <Button size="sm" render={<Link to="/app/cap-table/stakeholders" />}>
              {t`Add stakeholders`}
            </Button>
          )
        }
      />
    );

  const { totals } = overview;
  const exportCsv = () => {
    const csv =
      view === "stakeholder" && byStakeholder
        ? stakeholderCsv(byStakeholder, fullyDiluted)
        : classCsv(overview, fullyDiluted);
    downloadText(`cap-table-${overview.asOf}.csv`, csv);
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Tabs
          value={view}
          onValueChange={(value) => setParam("view", value === "stakeholder" ? value : null)}
        >
          <TabsList>
            <TabsTrigger value="class">{t`By share class`}</TabsTrigger>
            <TabsTrigger value="stakeholder">{t`By stakeholder`}</TabsTrigger>
          </TabsList>
        </Tabs>
        <Input
          type="date"
          aria-label={t`As of`}
          className="w-auto"
          value={asOf || overview.asOf}
          onChange={(event) => setParam("asOf", event.target.value || null)}
        />
        <Label className="gap-2 text-sm font-normal">
          <Switch
            checked={fullyDiluted}
            onCheckedChange={(checked) => setParam("fd", checked ? null : "0")}
          />
          {t`Fully diluted`}
        </Label>
        <div className="ms-auto flex gap-2">
          <OverviewSavedViews />
          <Button variant="outline" size="sm" onClick={exportCsv}>{t`Download CSV`}</Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>{t`Print`}</Button>
        </div>
      </div>
      <dl className="flex flex-wrap gap-x-8 gap-y-2">
        <div>
          <dt className="text-xs text-muted-foreground">{t`Fully diluted shares`}</dt>
          <dd className="text-lg font-semibold tabular-nums">
            {shares(totals.fullyDilutedShares)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">{t`Amount raised`}</dt>
          <dd className="text-lg font-semibold tabular-nums">
            {dollars(totals.amountRaisedCents)}
          </dd>
        </div>
      </dl>

      <OwnershipBar
        {...ownershipLegend(fullyDilutedParts(overview), {
          common: t`Common`,
          preferred: t`Preferred`,
          options: t`Options granted`,
          other: t`Other`,
        })}
      />

      {view === "stakeholder" ? (
        <SectionCard title={t`By stakeholder`}>
          {byStakeholder ? (
            <StakeholderCapTable table={byStakeholder} fullyDiluted={fullyDiluted} />
          ) : (
            <Skeleton className="h-40 w-full" />
          )}
        </SectionCard>
      ) : (
        <SectionCard title={t`By share class`}>
          {/* The class rows and the totals row share one width, so they scroll together on a phone. */}
          <div className="overflow-x-auto">
            <div className="min-w-xl">
              <ClassTable overview={overview} fullyDiluted={fullyDiluted} />
              <Table>
                <TableBody aria-label={t`Totals`}>
                  <TableRow>
                    <TableCell className="font-medium">{t`Total`}</TableCell>
                    <TableCell className="text-end tabular-nums">
                      {shares(
                        overview.classes
                          .reduce((sum, row) => sum + BigInt(row.authorizedShares), 0n)
                          .toString(),
                      )}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {shares(fullyDiluted ? totals.fullyDilutedShares : totals.outstandingShares)}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {/* No shares yet: there is nothing to be 100% of. */}
                      {BigInt(fullyDiluted ? totals.fullyDilutedShares : totals.outstandingShares) >
                      0n
                        ? percent("100.0000")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-end tabular-nums">
                      {dollars(totals.amountRaisedCents)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>
        </SectionCard>
      )}

      {overview.plans.length > 0 ? (
        <SectionCard title={t`Plans`}>
          <Table>
            <TableHeader>
              <TableHeadRow>
                <TableHead>{t`Plan`}</TableHead>
                <TableHead className="text-end">{t`Outstanding`}</TableHead>
                <TableHead className="text-end">{t`Available`}</TableHead>
                <TableHead className="text-end">{t`Fully diluted %`}</TableHead>
              </TableHeadRow>
            </TableHeader>
            <TableBody aria-label={t`Plans`}>
              {overview.plans.map((plan) => (
                <TableRow key={plan.planId}>
                  <TableCell className="font-medium">{plan.name}</TableCell>
                  <TableCell className="text-end tabular-nums">
                    {shares(plan.outstandingShares)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {shares(plan.availableShares)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {percent(plan.fullyDilutedPercent)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>
      ) : null}

      {overview.convertibles.length > 0 ? (
        <SectionCard title={t`Convertibles`}>
          <Table>
            <TableHeader>
              <TableHeadRow>
                <TableHead>{t`Block`}</TableHead>
                <TableHead className="text-end">{t`Principal`}</TableHead>
                <TableHead className="text-end">{t`Interest`}</TableHead>
                <TableHead className="text-end">{t`Outstanding debt`}</TableHead>
              </TableHeadRow>
            </TableHeader>
            <TableBody aria-label={t`Convertibles`}>
              {overview.convertibles.map((block, index) => (
                <TableRow key={block.blockId ?? `block-${index}`}>
                  <TableCell className="font-medium">{block.name}</TableCell>
                  <TableCell className="text-end tabular-nums">
                    {dollars(block.principalCents)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {dollars(block.interestCents)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {dollars(block.outstandingDebtCents)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </SectionCard>
      ) : null}
    </div>
  );
}

/** The by-class table as CSV, with the same columns as on screen. */
function classCsv(overview: EquityOverview, fullyDiluted: boolean): string {
  const parts = fullyDilutedParts(overview);
  return toCsv(
    [
      { key: "name", label: t`Share class` },
      { key: "authorized", label: t`Authorized` },
      { key: "shares", label: fullyDiluted ? t`Fully diluted` : t`Outstanding` },
      { key: "percent", label: fullyDiluted ? t`Fully diluted %` : t`Ownership` },
      { key: "raised", label: t`Raised (cents)` },
    ],
    [
      ...overview.classes.map((row) => ({
        name: row.name,
        authorized: row.authorizedShares,
        shares: row.outstandingShares,
        percent: fullyDiluted
          ? percentText(BigInt(row.outstandingShares), parts.total)
          : row.outstandingPercent,
        raised: row.amountRaisedCents,
      })),
      ...(fullyDiluted
        ? [
            { name: t`Options granted`, shares: parts.options },
            { name: t`Available for grant`, shares: parts.pool },
            { name: t`Other`, shares: parts.other },
          ]
            .filter((row) => row.shares > 0n)
            .map((row) => ({
              name: row.name,
              shares: row.shares,
              percent: percentText(row.shares, parts.total),
            }))
        : []),
    ],
  );
}

function stakeholderCsv(table: EquityCapTableByStakeholder, fullyDiluted: boolean): string {
  return toCsv(
    [
      { key: "name", label: t`Stakeholder` },
      ...table.classes.map((shareClass) => ({ key: shareClass.id, label: shareClass.name })),
      { key: "options", label: t`Options` },
      { key: "shares", label: fullyDiluted ? t`Fully diluted` : t`Outstanding` },
      { key: "percent", label: t`Ownership` },
      { key: "convertibles", label: t`Convertibles (cents)` },
    ],
    table.rows.map((row) => ({
      name: row.name,
      ...row.sharesByClass,
      options: row.options,
      shares: fullyDiluted ? row.fullyDilutedShares : row.outstandingShares,
      percent: fullyDiluted ? row.fullyDilutedPercent : row.outstandingPercent,
      convertibles: row.convertiblePrincipalCents,
    })),
  );
}
