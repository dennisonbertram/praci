import { t } from "@lingui/core/macro";
import type {
  EquityConvertible,
  EquityConvertibleStatus,
  EquityConvertibleTotals,
} from "@rakazo/contracts";
import { EQUITY_CONVERTIBLE_STATUSES } from "@rakazo/contracts";
import {
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  NativeSelect,
  NativeSelectOption,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
} from "@rakazo/ui-web";
import { Ellipsis } from "lucide-react";
import { useEffect, useState } from "react";
import { useListParams } from "../../../lib/list-params";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";
import { CapTableEmptyState } from "../shell/CapTableEmptyState";
import { openOnRowClick } from "../shell/row-click";
import { downloadCsv, formatCents, formatDay, formatPercent, toCsv } from "./format";
import { IssueDateFilter } from "./IssueDateFilter";

export type ConvertibleAction = "view" | "edit" | "cancel" | "priced-round";

const SORTS = ["label", "stakeholderName", "status", "principalCents", "issueDate"] as const;
const PAGE_SIZE = 25;

export const convertibleStatusLabel = (status: EquityConvertibleStatus) =>
  ({
    outstanding: t`Outstanding`,
    converted: t`Converted`,
    canceled: t`Canceled`,
    repaid: t`Repaid`,
  })[status];

const percent = formatPercent;
const kindLabel = (row: EquityConvertible) => (row.kind === "safe" ? t`SAFE` : t`Note`);

/** The SAFEs and convertibles ledger: every SAFE and note with its terms and amounts. */
export function ConvertiblesLedger({
  onOpen,
  onAction,
  reloadKey = 0,
}: {
  onOpen: (id: string) => void;
  /** A row's action, or "priced-round" for the selected rows. */
  onAction: (action: ConvertibleAction, rows: EquityConvertible[]) => void;
  reloadKey?: number;
}) {
  const list = useListParams(SORTS, { field: "issueDate", dir: "desc" });
  const search = list.param("cq") ?? "";
  const kind = list.param("kind") as "safe" | "note" | undefined;
  const status = list.param("cstatus") as EquityConvertibleStatus | undefined;
  const page = Number(list.param("cpage") ?? "1") || 1;
  const issuedFrom = list.param("cfrom");
  const issuedTo = list.param("cto");
  const [draft, setDraft] = useState(search);
  const [rows, setRows] = useState<EquityConvertible[] | null>(null);
  const [total, setTotal] = useState(0);
  const [totals, setTotals] = useState<EquityConvertibleTotals | null>(null);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    const timer = setTimeout(() => {
      if (draft !== search) list.setParams({ cq: draft || undefined, cpage: undefined });
    }, 250);
    return () => clearTimeout(timer);
  });

  useEffect(() => {
    let live = true;
    setError("");
    const filters = {
      ...(search ? { search } : {}),
      ...(kind ? { kind } : {}),
      ...(status ? { status: [status] } : {}),
      ...(issuedFrom ? { issuedFrom } : {}),
      ...(issuedTo ? { issuedTo } : {}),
    };
    rpc.equity
      .convertibleTotals(filters)
      .then((loaded) => {
        if (live) setTotals(loaded);
      })
      .catch(() => {
        if (live) setTotals(null);
      });
    rpc.equity.convertibles
      .list({
        page,
        pageSize: PAGE_SIZE,
        sort: { field: list.sort.field, dir: list.sort.dir },
        ...filters,
      })
      .then((loaded) => {
        if (!live) return;
        setRows(loaded.items);
        setTotal(loaded.total);
        setSelected(new Set());
      })
      .catch((cause: unknown) => {
        if (live) setError(errorText(cause));
      });
    return () => {
      live = false;
    };
  }, [page, list.sort.field, list.sort.dir, search, kind, status, reloadKey, issuedFrom, issuedTo]);

  const head = (field: (typeof SORTS)[number]) => ({
    sortDirection: list.sort.field === field ? list.sort.dir : null,
    onSort: () => list.toggleSort(field),
  });
  const chosen = (rows ?? []).filter((row) => selected.has(row.id));
  const outstanding = (rows ?? []).filter((row) => row.status === "outstanding");
  const filtered = Boolean(search || kind || status || issuedFrom || issuedTo);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const exportRows = () =>
    downloadCsv(
      "convertibles-ledger.csv",
      toCsv(rows ?? [], [
        { label: t`Security`, value: (row) => row.label },
        { label: t`Stakeholder`, value: (row) => row.stakeholderName },
        { label: t`Kind`, value: kindLabel },
        { label: t`Status`, value: (row) => convertibleStatusLabel(row.status) },
        { label: t`Principal`, value: (row) => formatCents(row.principalCents) },
        { label: t`Interest`, value: (row) => formatCents(row.interestAccruedCents) },
        { label: t`Valuation cap`, value: (row) => formatCents(row.valuationCapCents) },
        { label: t`Discount`, value: (row) => percent(row.discountPercent) },
        { label: t`Issue date`, value: (row) => row.issueDate },
      ]),
    );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={chosen.length === 0 || chosen.some((row) => row.status !== "outstanding")}
          onClick={() => onAction("priced-round", chosen)}
        >
          {chosen.length > 1
            ? t`Convert ${chosen.length} in priced round`
            : t`Convert in priced round`}
        </Button>
        <Input
          type="search"
          aria-label={t`Search convertibles`}
          placeholder={t`Search`}
          className="h-8 w-48"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <NativeSelect
          aria-label={t`Kind`}
          size="sm"
          value={kind ?? ""}
          onChange={(event) =>
            list.setParams({ kind: event.target.value || undefined, cpage: undefined })
          }
        >
          <NativeSelectOption value="">{t`SAFEs and notes`}</NativeSelectOption>
          <NativeSelectOption value="safe">{t`SAFEs`}</NativeSelectOption>
          <NativeSelectOption value="note">{t`Notes`}</NativeSelectOption>
        </NativeSelect>
        <NativeSelect
          aria-label={t`Status`}
          size="sm"
          value={status ?? ""}
          onChange={(event) =>
            list.setParams({ cstatus: event.target.value || undefined, cpage: undefined })
          }
        >
          <NativeSelectOption value="">{t`Any status`}</NativeSelectOption>
          {EQUITY_CONVERTIBLE_STATUSES.map((item) => (
            <NativeSelectOption key={item} value={item}>
              {convertibleStatusLabel(item)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <IssueDateFilter
          from={issuedFrom}
          to={issuedTo}
          onChange={(range) =>
            list.setParams({ cfrom: range.from, cto: range.to, cpage: undefined })
          }
        />
        <div className="ms-auto flex items-center gap-2">
          <Button size="sm" onClick={() => onAction("edit", [])}>
            {t`New SAFE or note`}
          </Button>
          <Button variant="outline" size="sm" disabled={!rows?.length} onClick={exportRows}>
            {t`Export CSV`}
          </Button>
        </div>
      </div>

      {error ? (
        <div role="alert" className="text-sm text-destructive">
          {error}
        </div>
      ) : rows == null ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <CapTableEmptyState
          message={filtered ? t`No matching convertibles` : t`No SAFEs or convertibles yet`}
        />
      ) : (
        <div className="overflow-x-auto">
          <Table className="min-w-4xl">
            <TableHeader>
              <TableHeadRow>
                <TableHead className="w-8">
                  <Checkbox
                    aria-label={t`Select all outstanding`}
                    disabled={outstanding.length === 0}
                    checked={
                      outstanding.length > 0 && outstanding.every((row) => selected.has(row.id))
                    }
                    onCheckedChange={(on) =>
                      setSelected(on ? new Set(outstanding.map((row) => row.id)) : new Set())
                    }
                  />
                </TableHead>
                <TableHead className="w-24" {...head("label")}>{t`Security`}</TableHead>
                <TableHead {...head("stakeholderName")}>{t`Stakeholder`}</TableHead>
                <TableHead className="w-16">{t`Kind`}</TableHead>
                <TableHead className="w-28" {...head("status")}>{t`Status`}</TableHead>
                <TableHead
                  className="w-28 text-end"
                  {...head("principalCents")}
                >{t`Principal`}</TableHead>
                <TableHead className="w-28 text-end">{t`Interest`}</TableHead>
                <TableHead className="w-32 text-end">{t`Valuation cap`}</TableHead>
                <TableHead className="w-20 text-end">{t`Discount`}</TableHead>
                <TableHead className="w-28" {...head("issueDate")}>{t`Issue date`}</TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">{t`Actions`}</span>
                </TableHead>
              </TableHeadRow>
            </TableHeader>
            <TableBody aria-label={t`Convertibles`}>
              {rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={selected.has(row.id) ? "selected" : undefined}
                  className="cursor-pointer"
                  onClick={openOnRowClick(() => onOpen(row.id))}
                >
                  <TableCell>
                    <Checkbox
                      aria-label={t`Select ${row.label}`}
                      disabled={row.status !== "outstanding"}
                      checked={selected.has(row.id)}
                      onCheckedChange={(on) =>
                        setSelected((current) => {
                          const next = new Set(current);
                          if (on) next.add(row.id);
                          else next.delete(row.id);
                          return next;
                        })
                      }
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <button
                      type="button"
                      className="underline-offset-4 hover:underline"
                      onClick={() => onOpen(row.id)}
                    >
                      {row.label}
                    </button>
                  </TableCell>
                  <TableCell>{row.stakeholderName}</TableCell>
                  <TableCell>{kindLabel(row)}</TableCell>
                  <TableCell>
                    {convertibleStatusLabel(row.status)}
                    {row.convertedToLabel ? ` · ${row.convertedToLabel}` : ""}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {formatCents(row.principalCents)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {row.kind === "note" ? formatCents(row.interestAccruedCents) : "—"}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {formatCents(row.valuationCapCents)}
                  </TableCell>
                  <TableCell className="text-end tabular-nums">
                    {percent(row.discountPercent)}
                  </TableCell>
                  <TableCell>{formatDay(row.issueDate)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t`Actions for ${row.label}`}
                          />
                        }
                      >
                        <Ellipsis aria-hidden="true" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => onOpen(row.id)}
                        >{t`View`}</DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={row.status !== "outstanding"}
                          onClick={() => onAction("edit", [row])}
                        >
                          {t`Edit`}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          disabled={row.status !== "outstanding"}
                          onClick={() => onAction("priced-round", [row])}
                        >
                          {t`Convert in priced round`}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={row.status !== "outstanding"}
                          onClick={() => onAction("cancel", [row])}
                        >
                          {t`Cancel`}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {rows?.length && totals ? (
        <p className="text-sm text-muted-foreground tabular-nums">
          {totals.count === 1
            ? t`1 SAFE or note, ${formatCents(totals.principalCents)} principal`
            : t`${totals.count} SAFEs and notes, ${formatCents(totals.principalCents)} principal`}
        </p>
      ) : null}
      {pages > 1 ? (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => list.setParam("cpage", page - 1 > 1 ? String(page - 1) : undefined)}
          >
            {t`Previous`}
          </Button>
          <span className="tabular-nums text-muted-foreground">{t`${page} of ${pages}`}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages}
            onClick={() => list.setParam("cpage", String(page + 1))}
          >
            {t`Next`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
