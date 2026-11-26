import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import type { EquityTransaction, EquityTransactionListInput } from "@rakazo/contracts";
import { EQUITY_TRANSACTION_KINDS } from "@rakazo/contracts";
import {
  Button,
  enqueueNotificationToast,
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
  TableScrollRegion,
} from "@rakazo/ui-web";
import { Fragment, useEffect, useState } from "react";
import { useHideAmounts } from "../../../lib/hide-amounts-preference";
import { useListParams } from "../../../lib/list-params";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";
import { formatDay } from "../options/format";
import { CapTableEmptyState } from "../shell/CapTableEmptyState";
import { activityCsv } from "./activity-csv";
import { Pager } from "./Pager";

type Kind = (typeof EQUITY_TRANSACTION_KINDS)[number];
const SORTS = ["createdAt", "effectiveDate", "kind"] as const;
const PAGE_SIZE = 25;

const locale = () => i18n.locale || "en";
const kindLabel = (kind: string) => {
  const words = kind.replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};
const shares = (value: string | null) =>
  value == null ? "—" : new Intl.NumberFormat(locale()).format(BigInt(value));
const dollars = (cents: string | null, hideAmounts = false) => {
  if (cents == null) return "—";
  if (hideAmounts) return "$•••";
  const value = BigInt(cents);
  const sign = value < 0n ? "-" : "";
  const abs = value < 0n ? -value : value;
  const fraction = (abs % 100n).toString().padStart(2, "0");
  return `${sign}$${new Intl.NumberFormat(locale()).format(abs / 100n)}.${fraction}`;
};
const recorded = (value: string) =>
  new Intl.DateTimeFormat(locale(), { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );

/** Bookkeeping fields a person does not read: ids, timestamps and nested records. */
const hidden = (key: string, value: unknown) =>
  key === "id" ||
  key.endsWith("Id") ||
  key === "createdAt" ||
  key === "updatedAt" ||
  (value != null && typeof value === "object");

/** "pricePaidPerShare" -> "Price paid per share"; "cashPaidCents" -> "Cash paid". */
const fieldLabel = (key: string) => {
  const words = key
    .replace(/Cents$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase();
  return (words.charAt(0).toUpperCase() + words.slice(1)).replace(/\b(ip|id|fmv|ssn)\b/gi, (w) =>
    w.toUpperCase(),
  );
};

const MONEY_FIELDS = new Set([
  "pricePerShare",
  "pricePaidPerShare",
  "exercisePrice",
  "conversionPrice",
  "originalIssuePrice",
]);

const show = (key: string, value: unknown, hideAmounts = false) => {
  if (value == null || value === "") return "—";
  if (key.endsWith("Cents")) {
    if (hideAmounts) return "$•••";
    if (/^-?\d+$/.test(String(value))) return dollars(String(value));
  }
  if (hideAmounts && MONEY_FIELDS.has(key)) return "$•••";
  if (typeof value === "string") return value.replaceAll("_", " ");
  return String(value);
};

/**
 * The fields a change touched, readable: "Field: before → after", or "Field: value" when the
 * change created the record. Ids, timestamps and unchanged or empty fields are left out.
 */
export function changedFields(before: unknown, after: unknown, hideAmounts = false): string[] {
  const a = before && typeof before === "object" ? (before as Record<string, unknown>) : null;
  const b = after && typeof after === "object" ? (after as Record<string, unknown>) : {};
  const keys = [...new Set([...Object.keys(a ?? {}), ...Object.keys(b)])];
  const same = (x: unknown, y: unknown) =>
    (x ?? null) === (y ?? null) || JSON.stringify(x) === JSON.stringify(y);
  return keys
    .filter((key) => !hidden(key, b[key] ?? a?.[key]))
    .filter((key) => !same(a?.[key], b[key]))
    .filter((key) => a != null || (b[key] != null && b[key] !== ""))
    .map((key) =>
      a == null
        ? `${fieldLabel(key)}: ${show(key, b[key], hideAmounts)}`
        : `${fieldLabel(key)}: ${show(key, a[key], hideAmounts)} → ${show(key, b[key], hideAmounts)}`,
    );
}

/** The activity tab: every change to the ledger, newest first, with filters and CSV. */
export function ActivityLog() {
  const hideAmounts = useHideAmounts();
  const list = useListParams(SORTS, { field: "createdAt", dir: "desc" });
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<Kind | "">("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<EquityTransaction[] | null>(null);
  const [total, setTotal] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);

  const filters: EquityTransactionListInput = {
    sort: list.sort,
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(kind ? { kind: [kind] } : {}),
    ...(from ? { from } : {}),
    ...(to ? { to } : {}),
  };
  const key = JSON.stringify(filters);

  useEffect(() => {
    let live = true;
    setError("");
    rpc.equity.transactions
      .list({ ...filters, page, pageSize: PAGE_SIZE })
      .then((loaded) => {
        if (!live) return;
        setRows(loaded.items);
        setTotal(loaded.total);
      })
      .catch((cause: unknown) => {
        if (live) setError(errorText(cause));
      });
    return () => {
      live = false;
    };
  }, [key, page]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const all: EquityTransaction[] = [];
      for (let next = 1; ; next += 1) {
        const loaded = await rpc.equity.transactions.list({
          ...filters,
          page: next,
          pageSize: 100,
        });
        all.push(...loaded.items);
        if (loaded.items.length === 0 || all.length >= loaded.total) break;
      }
      const url = URL.createObjectURL(new Blob([activityCsv(all)], { type: "text/csv" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "activity.csv";
      link.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      enqueueNotificationToast({
        id: "cap-table-activity-export-failed",
        title: t`Could not export activity`,
        body: errorText(cause),
      });
    } finally {
      setExporting(false);
    }
  };

  const head = (field: (typeof SORTS)[number]) => ({
    sortDirection: list.sort.field === field ? list.sort.dir : null,
    onSort: () => list.toggleSort(field),
  });
  const filtered = Boolean(search.trim() || kind || from || to);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label={t`Search activity`}
          placeholder={t`Search`}
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="w-48"
        />
        <NativeSelect
          aria-label={t`Change`}
          value={kind}
          onChange={(event) => {
            setKind(event.target.value as Kind | "");
            setPage(1);
          }}
        >
          <NativeSelectOption value="">{t`All changes`}</NativeSelectOption>
          {EQUITY_TRANSACTION_KINDS.map((value) => (
            <NativeSelectOption key={value} value={value}>
              {kindLabel(value)}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Input
          type="date"
          aria-label={t`From`}
          value={from}
          onChange={(event) => {
            setFrom(event.target.value);
            setPage(1);
          }}
          className="w-40"
        />
        <Input
          type="date"
          aria-label={t`To`}
          value={to}
          onChange={(event) => {
            setTo(event.target.value);
            setPage(1);
          }}
          className="w-40"
        />
        <Button
          variant="outline"
          size="sm"
          className="ms-auto"
          disabled={exporting || total === 0}
          onClick={() => void exportCsv()}
        >
          {t`Export CSV`}
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : rows == null ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <CapTableEmptyState message={filtered ? t`No matching activity` : t`No activity yet`} />
      ) : (
        <>
          <TableScrollRegion aria-label={t`Cap table activity`}>
            <Table className="min-w-[960px] whitespace-nowrap">
              <TableHeader>
                <TableHeadRow>
                  <TableHead className="w-44" {...head("createdAt")}>{t`Recorded`}</TableHead>
                  <TableHead className="w-28" {...head("effectiveDate")}>{t`Effective`}</TableHead>
                  <TableHead {...head("kind")}>{t`Change`}</TableHead>
                  <TableHead>{t`Security`}</TableHead>
                  <TableHead className="text-end">{t`Quantity`}</TableHead>
                  <TableHead className="text-end">{t`Value`}</TableHead>
                  <TableHead>{t`By`}</TableHead>
                  <TableHead>{t`Note`}</TableHead>
                </TableHeadRow>
              </TableHeader>
              <TableBody aria-label={t`Activity`}>
                {rows.map((row) => {
                  const changes = changedFields(row.before, row.after, hideAmounts);
                  const expanded = open === row.id;
                  return (
                    <Fragment key={row.id}>
                      <TableRow
                        {...(changes.length > 0
                          ? {
                              "aria-expanded": expanded,
                              onOpen: () => setOpen(expanded ? null : row.id),
                            }
                          : {})}
                      >
                        <TableCell className="whitespace-nowrap">
                          {recorded(row.createdAt)}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatDay(row.effectiveDate)}
                        </TableCell>
                        <TableCell>
                          {changes.length > 0 ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-auto justify-start p-0 font-normal"
                              data-row-open
                              aria-label={
                                expanded
                                  ? t`Hide details for ${kindLabel(row.kind)}`
                                  : t`Show details for ${kindLabel(row.kind)}`
                              }
                              aria-expanded={expanded}
                            >
                              {kindLabel(row.kind)}
                            </Button>
                          ) : (
                            kindLabel(row.kind)
                          )}
                        </TableCell>
                        <TableCell>{row.securityLabel ?? "—"}</TableCell>
                        <TableCell className="text-end tabular-nums">
                          {shares(row.quantity)}
                        </TableCell>
                        <TableCell className="text-end tabular-nums">
                          {dollars(row.valueCents, hideAmounts)}
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{row.actorName ?? "—"}</TableCell>
                        <TableCell className="max-w-64 truncate">{row.note ?? ""}</TableCell>
                      </TableRow>
                      {expanded ? (
                        <TableRow>
                          <TableCell colSpan={8}>
                            <ul className="grid grid-cols-1 gap-x-8 gap-y-1 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
                              {changes.map((line) => (
                                <li key={line}>{line}</li>
                              ))}
                            </ul>
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </TableScrollRegion>
          <Pager page={page} pageSize={PAGE_SIZE} total={total} onPage={setPage} />
        </>
      )}
    </div>
  );
}
