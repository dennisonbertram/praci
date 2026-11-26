import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { BrexSpendLimitView } from "@rakazo/contracts";
import {
  Button,
  ContactAvatarGroup,
  cn,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
} from "@rakazo/ui-web";
import { useMemo } from "react";
import { money } from "../../lib/finance-format";
import { useHideAmounts } from "../../lib/hide-amounts-preference";
import { sortBy, useListParams } from "../../lib/list-params";
import { rpc } from "../../lib/rpc";
import { Section, useFinanceQuery } from "../finance/ui";
import { PickFilter, SearchField, SortControl } from "../ListControls";
import { BrexErrorNotice } from "./BrexSection";
import { brexStatusLabel, limitBarClass, spendPeriodLabel } from "./brex-utils";

type LimitSort = "name" | "members" | "limit" | "used" | "status";
const LIMIT_SORTS: readonly LimitSort[] = ["name", "members", "limit", "used", "status"];
const DEFAULT_LIMIT_SORT = { field: "name", dir: "asc" } as const;

const sortValue = (row: BrexSpendLimitView, field: LimitSort): string | number | null => {
  switch (field) {
    case "name":
      return row.name;
    case "members":
      return row.members.map((member) => member.name).join(", ");
    case "limit":
      return row.limitCents;
    case "used":
      return row.usedCents;
    case "status":
      return brexStatusLabel(row.status);
  }
};

const statusClass = (status: string | null) => {
  const key = status?.toUpperCase();
  if (key === "ACTIVE") return "text-success";
  if (key === "ARCHIVED" || key === "INACTIVE") return "text-muted-foreground";
  return "text-warning";
};

export function BrexLimits() {
  const amountsHidden = useHideAmounts();
  const list = useListParams(LIMIT_SORTS, DEFAULT_LIMIT_SORT);
  const query = useFinanceQuery(() => rpc.brexCards.limits(), []);
  const data = query.data;
  const q = list.param("q")?.trim().toLowerCase();
  const status = list.param("status");

  const rows = useMemo(() => {
    const filtered = (data?.limits ?? []).filter((row) => {
      if (status && row.status !== status) return false;
      if (!q) return true;
      const haystack = [row.name, row.spendLimitId, ...row.members.map((member) => member.name)]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
    return sortBy(filtered, (row) => sortValue(row, list.sort.field), list.sort.dir);
  }, [data, q, status, list.sort.field, list.sort.dir]);
  const statuses = useMemo(
    () => [...new Set((data?.limits ?? []).map((row) => row.status).filter(Boolean))] as string[],
    [data],
  );
  const sortNames: Record<LimitSort, string> = {
    name: t`Spend limit`,
    members: t`Members`,
    limit: t`Limit`,
    used: t`Used`,
    status: t`Status`,
  };

  if (query.error) return <BrexErrorNotice query={query} />;
  if (!data) {
    return (
      <div role="status" aria-label={t`Loading`}>
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {data.partial ? (
        <p className="text-xs text-muted-foreground">
          <Trans>Partial results</Trans>
        </p>
      ) : null}
      <Section>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <SearchField
            name="brex-limits-search"
            value={list.param("q") ?? ""}
            onChange={(value) => list.setParam("q", value || undefined)}
            placeholder={t`Search limits`}
            label={t`Search limits`}
            className="w-56"
          />
          <PickFilter
            label={t`Status`}
            value={status}
            anyLabel={t`Any status`}
            options={statuses.map((value) => [value, brexStatusLabel(value)] as [string, string])}
            empty={t`No statuses`}
            onChange={(value) => list.setParam("status", value)}
          />
          <span className="ms-auto flex items-center gap-1 @2xl:hidden">
            <SortControl
              fields={LIMIT_SORTS.map((field) => [field, sortNames[field]] as [LimitSort, string])}
              field={list.sort.field}
              fieldLabel={sortNames[list.sort.field]}
              direction={list.sort.dir}
              onField={(field) => list.setSort({ field, dir: "asc" })}
              onDirection={(dir) => list.setSort({ field: list.sort.field, dir })}
            />
          </span>
          {q || status ? (
            <Button variant="ghost" size="sm" onClick={() => list.clear("q", "status")}>
              <Trans>Clear filters</Trans>
            </Button>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          <Table compact>
            <TableHeader>
              <TableHeadRow>
                <TableHead
                  sortDirection={list.sort.field === "name" ? list.sort.dir : null}
                  onSort={() => list.toggleSort("name")}
                >
                  <Trans>Spend limit</Trans>
                </TableHead>
                <TableHead
                  className="hidden @lg:table-cell"
                  sortDirection={list.sort.field === "members" ? list.sort.dir : null}
                  onSort={() => list.toggleSort("members")}
                >
                  <Trans>Members</Trans>
                </TableHead>
                <TableHead
                  sortDirection={list.sort.field === "limit" ? list.sort.dir : null}
                  onSort={() => list.toggleSort("limit")}
                >
                  <Trans>Limit</Trans>
                </TableHead>
                <TableHead
                  sortDirection={list.sort.field === "used" ? list.sort.dir : null}
                  onSort={() => list.toggleSort("used")}
                >
                  <Trans>Used this period</Trans>
                </TableHead>
                <TableHead
                  sortDirection={list.sort.field === "status" ? list.sort.dir : null}
                  onSort={() => list.toggleSort("status")}
                >
                  <Trans>Status</Trans>
                </TableHead>
              </TableHeadRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={5} className="py-3 text-muted-foreground">
                    {q || status ? <Trans>No matches</Trans> : <Trans>No spend limits</Trans>}
                  </TableCell>
                </TableRow>
              ) : null}
              {rows.map((row) => (
                <TableRow key={row.spendLimitId}>
                  <TableCell className="font-medium">{row.name || row.spendLimitId}</TableCell>
                  <TableCell className="hidden @lg:table-cell">
                    <ContactAvatarGroup
                      size="sm"
                      people={row.members.map((member) => ({ name: member.name }))}
                    />
                  </TableCell>
                  <TableCell>
                    <div>
                      {row.limitCents == null
                        ? "—"
                        : money(row.limitCents, undefined, row.currency ?? undefined)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {spendPeriodLabel(row.period)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {row.usedCents == null || row.percent == null ? (
                      "—"
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                          <span
                            className={cn("block h-full rounded-full", limitBarClass(row.percent))}
                            style={{
                              width: `${amountsHidden ? 0 : Math.min(100, Math.max(0, row.percent))}%`,
                            }}
                          />
                        </span>
                        <span className="tabular-nums">
                          {money(row.usedCents, undefined, row.currency ?? undefined)}
                          {amountsHidden ? "" : ` · ${Math.round(row.percent)}%`}
                        </span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className={cn("whitespace-nowrap", statusClass(row.status))}>
                    {brexStatusLabel(row.status)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Section>
    </div>
  );
}
