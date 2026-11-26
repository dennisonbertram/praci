import { t } from "@lingui/core/macro";
import type { EquityStakeholderListInput, EquityStakeholderPage } from "@rakazo/contracts";
import { EQUITY_STAKEHOLDER_SORT_FIELDS } from "@rakazo/contracts";
import {
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
} from "@rakazo/ui-web";
import { ChevronDown, MoreHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { useListParams } from "../../../lib/list-params";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";
import { CapTableEmptyState } from "../shell/CapTableEmptyState";
import { openOnRowClick } from "../shell/row-click";
import {
  canTerminate,
  relationshipLabel,
  TerminateLabel,
  terminateBlocked,
} from "./StakeholderProfile";

const PAGE_SIZE = 25;
/** Secondary columns give way on a phone so names and relationships stay readable. */
const NARROW_HIDDEN = "hidden md:table-cell";
/** The URL keys the filters panel writes (see stakeholder-filter-params.ts). */
const FILTER_PARAMS = ["rel", "cc", "hold", "vest", "addr", "country", "from", "to", "dup"];
const OPTIONAL_COLUMNS = ["contactEmail", "relationship", "costCenter"] as const;
type OptionalColumn = (typeof OPTIONAL_COLUMNS)[number];

export type StakeholdersTableProps = {
  filters: Partial<EquityStakeholderListInput>;
  onOpen: (id: string) => void;
  onEdit: (id: string) => void;
  onEditProperties: (id: string) => void;
  onTerminate: (id: string) => void;
  selected: string[];
  onSelectedChange: (ids: string[]) => void;
  refreshKey?: number;
  /** More list controls, shown after Search in the same toolbar. */
  tools?: ReactNode;
};

/** The stakeholder directory: search, columns, sort, pages, selection and a menu per row. */
export function StakeholdersTable({
  filters,
  onOpen,
  onEdit,
  onEditProperties,
  onTerminate,
  selected,
  onSelectedChange,
  refreshKey = 0,
  tools,
}: StakeholdersTableProps) {
  const list = useListParams(EQUITY_STAKEHOLDER_SORT_FIELDS, { field: "name", dir: "asc" });
  const search = list.param("q") ?? "";
  const page = Math.max(1, Number(list.param("page") ?? 1) || 1);
  const hidden = new Set((list.param("cols") ?? "").split(",").filter(Boolean));
  const [result, setResult] = useState<EquityStakeholderPage | null>(null);
  const [error, setError] = useState("");
  const filterKey = JSON.stringify(filters);

  useEffect(() => {
    let live = true;
    rpc.equity.stakeholders
      .list({
        ...filters,
        search: search || undefined,
        sort: list.sort,
        page,
        pageSize: PAGE_SIZE,
      })
      .then((loaded) => {
        if (live) {
          setResult(loaded);
          setError("");
        }
      })
      .catch((cause: unknown) => live && setError(errorText(cause)));
    return () => {
      live = false;
    };
  }, [filterKey, search, list.sort.field, list.sort.dir, page, refreshKey]);

  const toggleColumn = (column: OptionalColumn) => {
    const next = new Set(hidden);
    if (next.has(column)) next.delete(column);
    else next.add(column);
    list.setParam("cols", [...next].join(","));
  };
  const head = (field: (typeof EQUITY_STAKEHOLDER_SORT_FIELDS)[number]) => ({
    sortDirection: list.sort.field === field ? list.sort.dir : null,
    onSort: () => list.toggleSort(field),
  });
  const shows = (column: OptionalColumn) => !hidden.has(column);
  const rows = result?.items ?? [];
  const pageIds = rows.map((row) => row.id);
  const allSelected = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));
  const pages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;
  const filtered = Boolean(search) || Object.values(filters).some((value) => value != null);
  const columnLabels: Record<OptionalColumn, string> = {
    contactEmail: t`Contact email`,
    relationship: t`Relationship`,
    costCenter: t`Cost center`,
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          className="max-w-xs"
          placeholder={t`Search`}
          aria-label={t`Search stakeholders`}
          value={search}
          onChange={(event) => list.setParams({ q: event.target.value, page: undefined })}
        />
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
            {t`Columns`}
            <ChevronDown aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {OPTIONAL_COLUMNS.map((column) => (
              <DropdownMenuCheckboxItem
                key={column}
                checked={shows(column)}
                onCheckedChange={() => toggleColumn(column)}
              >
                {columnLabels[column]}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {tools}
        {result && result.total > 0 && (
          <span className="ms-auto text-sm text-muted-foreground tabular-nums">
            {result.total === 1 ? t`1 stakeholder` : t`${result.total} stakeholders`}
          </span>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {!result ? (
        <Skeleton className="h-48 w-full" />
      ) : rows.length === 0 ? (
        <CapTableEmptyState
          message={filtered ? t`No matches` : t`No stakeholders`}
          action={
            filtered ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => list.clear("q", "page", ...FILTER_PARAMS)}
              >{t`Clear search and filters`}</Button>
            ) : undefined
          }
        />
      ) : (
        <Table>
          <TableHeader>
            <TableHeadRow>
              <TableHead className="w-8">
                <Checkbox
                  aria-label={t`Select all`}
                  checked={allSelected}
                  onCheckedChange={(checked) =>
                    onSelectedChange(
                      checked
                        ? [...new Set([...selected, ...pageIds])]
                        : selected.filter((id) => !pageIds.includes(id)),
                    )
                  }
                />
              </TableHead>
              <TableHead {...head("name")}>{t`Stakeholder name`}</TableHead>
              {shows("contactEmail") && (
                <TableHead className={NARROW_HIDDEN}>{t`Contact email`}</TableHead>
              )}
              {shows("relationship") && (
                <TableHead {...head("relationship")}>{t`Relationship`}</TableHead>
              )}
              {shows("costCenter") && (
                <TableHead
                  className={NARROW_HIDDEN}
                  {...head("costCenter")}
                >{t`Cost center`}</TableHead>
              )}
              <TableHead className="w-10">
                <span className="sr-only">{t`Actions`}</span>
              </TableHead>
            </TableHeadRow>
          </TableHeader>
          <TableBody aria-label={t`Stakeholders`}>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                className="cursor-pointer"
                onClick={openOnRowClick(() => onOpen(row.id))}
              >
                <TableCell>
                  <Checkbox
                    aria-label={t`Select ${row.name}`}
                    checked={selected.includes(row.id)}
                    onCheckedChange={(checked) =>
                      onSelectedChange(
                        checked ? [...selected, row.id] : selected.filter((id) => id !== row.id),
                      )
                    }
                  />
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    className="text-start font-medium underline-offset-4 hover:underline"
                    onClick={() => onOpen(row.id)}
                  >
                    {row.name}
                  </button>
                </TableCell>
                {shows("contactEmail") && (
                  <TableCell className={NARROW_HIDDEN}>{row.contactEmail}</TableCell>
                )}
                {shows("relationship") && (
                  <TableCell>
                    {row.relationship ? relationshipLabel(row.relationship) : ""}
                  </TableCell>
                )}
                {shows("costCenter") && (
                  <TableCell className={NARROW_HIDDEN}>{row.costCenter}</TableCell>
                )}
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={<Button variant="ghost" size="icon" />}
                      aria-label={t`Actions for ${row.name}`}
                    >
                      <MoreHorizontal aria-hidden="true" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-60">
                      <DropdownMenuItem onClick={() => onOpen(row.id)}>
                        {t`View stakeholder`}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEdit(row.id)}>
                        {t`Edit stakeholder`}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onEditProperties(row.id)}>
                        {t`Edit stakeholder properties`}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={!canTerminate(row)}
                        onClick={() => onTerminate(row.id)}
                      >
                        <TerminateLabel blocked={terminateBlocked(row)} />
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {result && pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => list.setParam("page", page - 1 > 1 ? String(page - 1) : undefined)}
          >{t`Previous`}</Button>
          <span className="tabular-nums text-muted-foreground">{t`Page ${page} of ${pages}`}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages}
            onClick={() => list.setParam("page", String(page + 1))}
          >{t`Next`}</Button>
        </div>
      )}
    </div>
  );
}
