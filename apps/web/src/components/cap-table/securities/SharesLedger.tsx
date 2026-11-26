import { t } from "@lingui/core/macro";
import type {
  EquityCertificate,
  EquityCertificateStatus,
  EquityCertificateTotals,
  EquityShareClass,
} from "@rakazo/contracts";
import {
  EQUITY_ACCEPTANCE_STATUS_LABELS,
  EQUITY_CERTIFICATE_STATUS_LABELS,
  EQUITY_CERTIFICATE_STATUSES,
  EQUITY_OUTSTANDING_CERTIFICATE_STATUSES,
} from "@rakazo/contracts";
import {
  Badge,
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuCheckboxItem,
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
import {
  downloadCsv,
  formatCents,
  formatDay,
  formatPrice,
  formatShares,
  pricePlaces,
  toCsv,
} from "./format";
import { IssueDateFilter } from "./IssueDateFilter";

export type CertificateAction =
  | "view"
  | "transfer"
  | "modify"
  | "repurchase"
  | "cancel"
  | "convert";

const SORTS = [
  "label",
  "stakeholderName",
  "status",
  "quantity",
  "issueDate",
  "pricePerShare",
] as const;
type SortField = (typeof SORTS)[number];
const PAGE_SIZE = 25;

type Column = {
  id: string;
  label: () => string;
  sort?: SortField;
  end?: boolean;
  /** Tailwind width class; the stakeholder column takes what is left. */
  width?: string;
  cell: (row: EquityCertificate, places: number) => string;
};

const COLUMNS: readonly Column[] = [
  {
    id: "stakeholder",
    label: () => t`Stakeholder`,
    sort: "stakeholderName",
    cell: (row) => row.stakeholderName,
  },
  { id: "class", width: "w-32", label: () => t`Share class`, cell: (row) => row.shareClassName },
  {
    id: "status",
    width: "w-32",
    label: () => t`Status`,
    sort: "status",
    cell: (row) => EQUITY_CERTIFICATE_STATUS_LABELS[row.status],
  },
  {
    id: "shares",
    width: "w-24",
    label: () => t`Shares`,
    sort: "quantity",
    end: true,
    cell: (row) => formatShares(row.quantity),
  },
  {
    id: "price",
    width: "w-24",
    label: () => t`Price per share`,
    sort: "pricePerShare",
    end: true,
    cell: (row, places) => formatPrice(row.pricePerShare, places),
  },
  {
    id: "paid",
    width: "w-24",
    label: () => t`Price paid per share`,
    end: true,
    cell: (row, places) => formatPrice(row.pricePaidPerShare, places),
  },
  {
    id: "value",
    width: "w-32",
    label: () => t`Transaction value`,
    end: true,
    cell: (row) => formatCents(row.transactionValueCents),
  },
  {
    id: "issued",
    width: "w-28",
    label: () => t`Issue date`,
    sort: "issueDate",
    cell: (row) => formatDay(row.issueDate),
  },
];
const DEFAULT_COLUMNS = ["stakeholder", "status", "shares", "price", "paid", "value", "issued"];

/** Who still has to sign, short enough to sit under a security label; the full status is the title. */
const SIGNER_LABELS: Record<string, () => string> = {
  awaiting_officer_signature: () => t`Officer to sign`,
  awaiting_holder_signature: () => t`Holder to sign`,
  awaiting_witness_signature: () => t`Witness to sign`,
  awaiting_spouse_signature: () => t`Spouse to sign`,
  awaiting_cosigner_signature: () => t`Cosigner to sign`,
};

const isOutstanding = (row: EquityCertificate) =>
  EQUITY_OUTSTANDING_CERTIFICATE_STATUSES.includes(row.status);

/** The shares ledger: every certificate, searchable, filterable and sortable, with its actions. */
export function SharesLedger({
  onOpen,
  onAction,
  onBulk,
  reloadKey = 0,
}: {
  onOpen: (id: string) => void;
  onAction: (action: CertificateAction, certificate: EquityCertificate) => void;
  /** Cancel or convert the selected certificates together. */
  onBulk?: (action: "cancel" | "convert", certificates: EquityCertificate[]) => void;
  /** Bump to load the page again after a change. */
  reloadKey?: number;
}) {
  const list = useListParams(SORTS, { field: "issueDate", dir: "desc" });
  const search = list.param("q") ?? "";
  const statuses = (list.param("status")?.split(",") ?? []) as EquityCertificateStatus[];
  const shareClassId = list.param("class");
  const issuedFrom = list.param("from");
  const issuedTo = list.param("to");
  const page = Number(list.param("page") ?? "1") || 1;
  const [draft, setDraft] = useState(search);
  const [rows, setRows] = useState<EquityCertificate[] | null>(null);
  const [total, setTotal] = useState(0);
  const [totals, setTotals] = useState<EquityCertificateTotals | null>(null);
  const [error, setError] = useState("");
  const [classes, setClasses] = useState<EquityShareClass[]>([]);
  const [visible, setVisible] = useState<string[]>(DEFAULT_COLUMNS);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const statusKey = statuses.join(",");

  useEffect(() => {
    rpc.equity.shareClasses
      .list({ pageSize: 500 })
      .then((loaded) => setClasses(loaded.items))
      .catch(() => setClasses([]));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (draft !== search) list.setParams({ q: draft || undefined, page: undefined });
    }, 250);
    return () => clearTimeout(timer);
  });

  useEffect(() => {
    let live = true;
    setError("");
    const filters = {
      ...(search ? { search } : {}),
      ...(statuses.length ? { status: statuses } : {}),
      ...(shareClassId ? { shareClassId: [shareClassId] } : {}),
      ...(issuedFrom ? { issuedFrom } : {}),
      ...(issuedTo ? { issuedTo } : {}),
    };
    rpc.equity
      .certificateTotals(filters)
      .then((loaded) => {
        if (live) setTotals(loaded);
      })
      .catch(() => {
        if (live) setTotals(null);
      });
    rpc.equity.certificates
      .list({ page, pageSize: PAGE_SIZE, sort: list.sort, ...filters })
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
  }, [
    page,
    list.sort.field,
    list.sort.dir,
    search,
    statusKey,
    shareClassId,
    reloadKey,
    issuedFrom,
    issuedTo,
  ]);

  const columns = COLUMNS.filter((column) => visible.includes(column.id));
  const places = pricePlaces(
    (rows ?? []).flatMap((row) => [row.pricePerShare, row.pricePaidPerShare]),
  );
  const csvColumns = [
    { label: t`Security`, value: (row: EquityCertificate) => row.label },
    ...columns.map((column) => ({
      label: column.label(),
      value: (row: EquityCertificate) => column.cell(row, places),
    })),
  ];
  const exportRows = (items: readonly EquityCertificate[]) =>
    downloadCsv("shares-ledger.csv", toCsv(items, csvColumns));
  const toggleStatus = (status: EquityCertificateStatus, on: boolean) => {
    const next = on ? [...statuses, status] : statuses.filter((item) => item !== status);
    list.setParams({ status: next.join(",") || undefined, page: undefined });
  };
  const toggleRow = (id: string, on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Boolean(search || statuses.length || shareClassId || issuedFrom || issuedTo);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="sm" disabled={selected.size === 0} />}
          >
            {t`Actions`}
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              onClick={() => exportRows((rows ?? []).filter((row) => selected.has(row.id)))}
            >
              {t`Export selected`}
            </DropdownMenuItem>
            {onBulk ? (
              <>
                <DropdownMenuItem
                  disabled={(rows ?? []).some((row) => selected.has(row.id) && !isOutstanding(row))}
                  onClick={() =>
                    onBulk(
                      "convert",
                      (rows ?? []).filter((row) => selected.has(row.id)),
                    )
                  }
                >
                  {t`Convert share class`}
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  disabled={(rows ?? []).some((row) => selected.has(row.id) && !isOutstanding(row))}
                  onClick={() =>
                    onBulk(
                      "cancel",
                      (rows ?? []).filter((row) => selected.has(row.id)),
                    )
                  }
                >
                  {t`Cancel certificates`}
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
        {selected.size > 0 ? (
          <>
            <span className="text-sm text-muted-foreground">{t`${selected.size} selected`}</span>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              {t`Clear selection`}
            </Button>
          </>
        ) : null}
        <Input
          type="search"
          aria-label={t`Search certificates`}
          placeholder={t`Search`}
          className="h-8 w-48"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
            {statuses.length ? t`Status (${statuses.length})` : t`Status`}
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            {EQUITY_CERTIFICATE_STATUSES.map((status) => (
              <DropdownMenuCheckboxItem
                key={status}
                checked={statuses.includes(status)}
                onCheckedChange={(on) => toggleStatus(status, on)}
              >
                {EQUITY_CERTIFICATE_STATUS_LABELS[status]}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {classes.length > 1 ? (
          <NativeSelect
            aria-label={t`Share class`}
            size="sm"
            value={shareClassId ?? ""}
            onChange={(event) =>
              list.setParams({ class: event.target.value || undefined, page: undefined })
            }
          >
            <NativeSelectOption value="">{t`All classes`}</NativeSelectOption>
            {classes.map((item) => (
              <NativeSelectOption key={item.id} value={item.id}>
                {item.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        ) : null}
        <IssueDateFilter
          from={issuedFrom}
          to={issuedTo}
          onChange={(range) => list.setParams({ from: range.from, to: range.to, page: undefined })}
        />
        {filtered ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDraft("");
              list.clear("q", "status", "class", "from", "to", "page");
            }}
          >
            {t`Clear filters`}
          </Button>
        ) : null}
        <div className="ms-auto flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant="outline" size="sm" />}
            >{t`Columns`}</DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {COLUMNS.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.id}
                  checked={visible.includes(column.id)}
                  onCheckedChange={(on) =>
                    setVisible((current) =>
                      on ? [...current, column.id] : current.filter((id) => id !== column.id),
                    )
                  }
                >
                  {column.label()}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="outline"
            size="sm"
            disabled={!rows?.length}
            onClick={() => exportRows(rows ?? [])}
          >
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
          message={filtered ? t`No matching certificates` : t`No certificates yet`}
        />
      ) : (
        <div className="overflow-x-auto">
          <Table compact className="min-w-4xl whitespace-nowrap">
            <TableHeader>
              <TableHeadRow>
                <TableHead className="w-8">
                  <Checkbox
                    aria-label={t`Select all`}
                    checked={rows.every((row) => selected.has(row.id))}
                    onCheckedChange={(on) =>
                      setSelected(on ? new Set(rows.map((row) => row.id)) : new Set())
                    }
                  />
                </TableHead>
                <TableHead
                  className="w-28"
                  sortDirection={list.sort.field === "label" ? list.sort.dir : null}
                  onSort={() => list.toggleSort("label")}
                >
                  {t`Security`}
                </TableHead>
                {columns.map((column) => (
                  <TableHead
                    key={column.id}
                    className={
                      [column.width, column.end ? "text-end" : ""].join(" ").trim() || undefined
                    }
                    {...(column.sort
                      ? {
                          sortDirection: list.sort.field === column.sort ? list.sort.dir : null,
                          onSort: () => list.toggleSort(column.sort!),
                        }
                      : {})}
                  >
                    {column.label()}
                  </TableHead>
                ))}
                <TableHead className="w-10">
                  <span className="sr-only">{t`Actions`}</span>
                </TableHead>
              </TableHeadRow>
            </TableHeader>
            <TableBody aria-label={t`Certificates`}>
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
                      checked={selected.has(row.id)}
                      onCheckedChange={(on) => toggleRow(row.id, on)}
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
                    {row.acceptanceStatus !== "accepted" ? (
                      <Badge
                        variant="outline"
                        className="mt-1 flex max-w-full"
                        title={EQUITY_ACCEPTANCE_STATUS_LABELS[row.acceptanceStatus]}
                      >
                        <span className="truncate">
                          {SIGNER_LABELS[row.acceptanceStatus]?.() ??
                            EQUITY_ACCEPTANCE_STATUS_LABELS[row.acceptanceStatus]}
                        </span>
                      </Badge>
                    ) : null}
                  </TableCell>
                  {columns.map((column) => (
                    <TableCell
                      key={column.id}
                      className={column.end ? "text-end tabular-nums" : undefined}
                    >
                      {column.cell(row, places)}
                    </TableCell>
                  ))}
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
                        <DropdownMenuSeparator />
                        {(
                          [
                            ["transfer", t`Transfer`],
                            ["modify", t`Modify`],
                            ["repurchase", t`Repurchase`],
                            ["convert", t`Convert`],
                            ["cancel", t`Cancel`],
                          ] as const
                        ).map(([action, label]) => (
                          <DropdownMenuItem
                            key={action}
                            disabled={!isOutstanding(row)}
                            variant={action === "cancel" ? "destructive" : "default"}
                            onClick={() => onAction(action, row)}
                          >
                            {label}
                          </DropdownMenuItem>
                        ))}
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
            ? t`1 certificate, ${formatShares(totals.shares)} shares`
            : t`${totals.count} certificates, ${formatShares(totals.shares)} shares`}
        </p>
      ) : null}
      {pages > 1 ? (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => list.setParam("page", page - 1 > 1 ? String(page - 1) : undefined)}
          >
            {t`Previous`}
          </Button>
          <span className="tabular-nums text-muted-foreground">{t`${page} of ${pages}`}</span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= pages}
            onClick={() => list.setParam("page", String(page + 1))}
          >
            {t`Next`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
