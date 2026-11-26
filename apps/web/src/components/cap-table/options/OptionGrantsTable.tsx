import { t } from "@lingui/core/macro";
import type { EquityOptionGrant } from "@rakazo/contracts";
import { EQUITY_OPTION_GRANT_SORT_FIELDS, EQUITY_OPTION_STATUSES } from "@rakazo/contracts";
import {
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
} from "@rakazo/ui-web";
import { ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { useEffect, useState } from "react";
import { useHideAmounts } from "../../../lib/hide-amounts-preference";
import { useListParams } from "../../../lib/list-params";
import { rpc } from "../../../lib/rpc";
import { errorText } from "../../../lib/user-error";
import { SearchField } from "../../ListControls";
import { CapTableEmptyState } from "../shell/CapTableEmptyState";
import { openOnRowClick } from "../shell/row-click";
import { formatDay, formatPrice, formatShares } from "./format";
import { optionGrantsCsv } from "./option-grants-csv";

const PAGE_SIZE = 25;
const DASH = "—";

/** Every row-menu action; the page decides what each one opens. */
export type OptionGrantAction =
  | "modifyGrant"
  | "modifyVesting"
  | "accelerateVesting"
  | "modifyPostTermination"
  | "exercise"
  | "partiallyCancel"
  | "cancel"
  | "reverseCancellation"
  | "cancelPendingExercises"
  | "addAdminNotes"
  | "print"
  | "reverseTermination"
  | "viewStakeholder"
  | "terminateStakeholder";

type Column =
  | "security"
  | "holder"
  | "status"
  | "quantity"
  | "outstanding"
  | "price"
  | "type"
  | "grantDate"
  | "vesting";

const COLUMNS: Column[] = [
  "security",
  "holder",
  "status",
  "quantity",
  "outstanding",
  "price",
  "type",
  "grantDate",
  "vesting",
];

const STATUS_SORTS = EQUITY_OPTION_STATUSES;

const shares = formatShares;
const price = formatPrice;
const day = formatDay;

const STATUS_DOT: Record<EquityOptionGrant["status"], string> = {
  outstanding: "bg-success",
  exercised: "bg-primary",
  forfeited: "bg-destructive",
  canceled: "bg-destructive",
  expired: "bg-muted-foreground",
};

/** The transaction items that need a live grant behind them. */
const NEEDS_OUTSTANDING: OptionGrantAction[] = ["exercise", "cancel", "cancelPendingExercises"];

/** Whether a row menu item is closed to this grant. */
export function optionGrantActionDisabled(
  action: OptionGrantAction,
  grant: EquityOptionGrant,
): boolean {
  if (action === "reverseCancellation") return BigInt(grant.canceledQuantity) <= 0n;
  if (NEEDS_OUTSTANDING.includes(action)) return grant.status !== "outstanding";
  if (action === "partiallyCancel")
    return grant.status !== "outstanding" || BigInt(grant.outstandingQuantity) <= 0n;
  return false;
}

const COLUMN_LABELS: Record<Column, () => string> = {
  security: () => t`Security`,
  holder: () => t`Optionholder`,
  status: () => t`Status`,
  quantity: () => t`Original quantity`,
  // What is left after exercises, cancellations and forfeits at termination.
  outstanding: () => t`Outstanding`,
  price: () => t`Exercise price`,
  type: () => t`Type`,
  grantDate: () => t`Grant date`,
  vesting: () => t`Vesting schedule`,
};

const COLUMNS_WITH_SORT: Column[] = [
  "security",
  "holder",
  "status",
  "quantity",
  "price",
  "grantDate",
  "vesting",
];

/** A pill that holds several statuses or plans; no value means every one. */
function MultiPickFilter({
  label,
  values,
  options,
  onChange,
}: {
  label: string;
  values: string[];
  options: [string, string][];
  onChange: (values: string[]) => void;
}) {
  const toggle = (value: string) =>
    onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  const shown =
    values.length === 0
      ? label
      : values.length === 1
        ? `${label}: ${options.find(([value]) => value === values[0])?.[1] ?? values[0]}`
        : `${label}: ${values.length}`;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant={values.length > 0 ? "secondary" : "outline"}
            size="sm"
            className="rounded-full"
          />
        }
        aria-label={shown}
      >
        {shown}
        <ChevronDown aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-40">
        {options.map(([value, name]) => (
          <DropdownMenuCheckboxItem
            key={value}
            checked={values.includes(value)}
            onCheckedChange={() => toggle(value)}
            closeOnClick={false}
          >
            {name}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The Options tab: every option grant, searchable, filterable and sortable, with per-row actions. */
export function OptionGrantsTable({
  onOpen,
  onAction,
  onDraft,
  onBulkCancel,
  onIso100k,
  onBulkReprice,
}: {
  onOpen: (grant: EquityOptionGrant) => void;
  onAction: (action: OptionGrantAction, grant: EquityOptionGrant) => void;
  onDraft: () => void;
  /** Cancels the outstanding grants picked by the bulk actions menu. */
  onBulkCancel?: (grants: EquityOptionGrant[]) => void;
  /** "View ISO 100K"; the button shows only when given. */
  onIso100k?: () => void;
  /** Reprices the outstanding grants picked by the bulk actions menu. */
  onBulkReprice?: (grants: EquityOptionGrant[]) => void;
}) {
  const amountsHidden = useHideAmounts();
  const list = useListParams(EQUITY_OPTION_GRANT_SORT_FIELDS, { field: "grantDate", dir: "desc" });
  const search = list.param("search") ?? "";
  const status = (list.param("status") ?? "").split(",").filter(Boolean);
  const plans = (list.param("plan") ?? "").split(",").filter(Boolean);
  const [page, setPage] = useState(1);
  const [grants, setGrants] = useState<EquityOptionGrant[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [reloadCount, setReloadCount] = useState(0);
  const [hidden, setHidden] = useState<Column[]>([]);
  const [planNames, setPlanNames] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    let live = true;
    setError("");
    rpc.equity.optionGrants
      .list({
        page,
        pageSize: PAGE_SIZE,
        sort: list.sort,
        search: search || undefined,
        status:
          status.length > 0 ? (status as (typeof EQUITY_OPTION_STATUSES)[number][]) : undefined,
        planId: plans.length > 0 ? plans : undefined,
      })
      .then((loaded) => {
        if (!live) return;
        setGrants(loaded.items);
        setTotal(loaded.total);
        setPlanNames((names) => {
          const next = { ...names };
          for (const grant of loaded.items) next[grant.planId] = grant.planName;
          return next;
        });
      })
      .catch((cause: unknown) => {
        if (live) setError(errorText(cause));
      });
    return () => {
      live = false;
    };
    // The filters are plain values; the sort object is rebuilt every render.
  }, [
    page,
    search,
    status.join(","),
    plans.join(","),
    list.sort.field,
    list.sort.dir,
    reloadCount,
  ]);

  useEffect(() => {
    setSelected(new Set());
  }, [page, search, status.join(","), plans.join(","), list.sort.field, list.sort.dir]);

  const change = (change: Record<string, string | undefined>) => {
    setPage(1);
    list.setParams(change);
  };

  const setStatus = (values: string[]) => change({ status: values.join(",") || undefined });
  const setPlans = (values: string[]) => change({ plan: values.join(",") || undefined });

  const downloadCsv = (rows: readonly EquityOptionGrant[], filename: string) => {
    const blob = new Blob([optionGrantsCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const download = () => {
    if (!grants) return;
    downloadCsv(grants, "option-grants.csv");
  };

  const selectedGrants = (grants ?? []).filter((grant) => selected.has(grant.id));
  const outstandingSelected = selectedGrants.filter((grant) => grant.status === "outstanding");
  const allSelected =
    grants != null && grants.length > 0 && grants.every((grant) => selected.has(grant.id));
  const someSelected = selectedGrants.length > 0;
  const toggleAll = (on: boolean) =>
    setSelected(on ? new Set((grants ?? []).map((grant) => grant.id)) : new Set());
  const toggleRow = (id: string, on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const bulkCancel = () => {
    onBulkCancel?.(outstandingSelected);
    setSelected(new Set());
  };
  const bulkReprice = () => {
    onBulkReprice?.(outstandingSelected);
    setSelected(new Set());
  };

  const visible = COLUMNS.filter((column) => !hidden.includes(column));
  const filtered = Boolean(search || status.length || plans.length);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const groups: { label: string; items: [OptionGrantAction, string][] }[] = [
    {
      label: t`Option Grant`,
      items: [
        ["modifyGrant", t`Modify option grant`],
        ["modifyVesting", t`Modify vesting schedule`],
        ["accelerateVesting", t`Accelerate vesting`],
        ["modifyPostTermination", t`Modify post-termination period`],
      ],
    },
    {
      label: t`Transactions`,
      items: [
        ["exercise", t`Exercise options`],
        ["partiallyCancel", t`Partially cancel option grant`],
        ["cancel", t`Cancel option grant`],
        ["reverseCancellation", t`Reverse cancellation`],
        ["cancelPendingExercises", t`Cancel pending exercises`],
      ],
    },
    {
      label: t`Other`,
      items: [
        ["addAdminNotes", t`Add admin notes`],
        ["print", t`Print option grant`],
        ["reverseTermination", t`Reverse termination`],
      ],
    },
    {
      label: t`Stakeholder`,
      items: [
        ["viewStakeholder", t`View stakeholder`],
        ["terminateStakeholder", t`Terminate stakeholder`],
      ],
    },
  ];

  const toolbar = (
    <div className="mb-2 flex flex-wrap items-center gap-2">
      <SearchField
        name="option-grant-search"
        className="w-56"
        value={search}
        onChange={(value) => change({ search: value || undefined })}
        placeholder={t`Search option grants`}
        label={t`Search option grants`}
      />
      <MultiPickFilter
        label={t`Status`}
        values={status}
        options={STATUS_SORTS.map((value) => [
          value,
          value.charAt(0).toUpperCase() + value.slice(1),
        ])}
        onChange={setStatus}
      />
      <MultiPickFilter
        label={t`Plan`}
        values={plans}
        options={Object.entries(planNames).map(([id, name]) => [id, name])}
        onChange={setPlans}
      />
      {someSelected ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="sm" className="rounded-full" />}
          >
            {t`Actions`}
            <ChevronDown aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-44">
            <DropdownMenuItem
              onClick={() => downloadCsv(selectedGrants, "option-grants-selected.csv")}
            >
              {t`Export selected`}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={outstandingSelected.length === 0} onClick={bulkCancel}>
              {t`Cancel selected`}
            </DropdownMenuItem>
            <DropdownMenuItem disabled={outstandingSelected.length === 0} onClick={bulkReprice}>
              {t`Reprice selected`}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSelected(new Set())}>
              {t`Clear selection`}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      <span className="ms-auto flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<Button variant="outline" size="sm" className="rounded-full" />}
            aria-label={t`Select columns`}
          >
            {t`Select columns`}
            <ChevronDown aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-40">
            {COLUMNS.map((column) => (
              <DropdownMenuCheckboxItem
                key={column}
                checked={!hidden.includes(column)}
                onCheckedChange={() =>
                  setHidden((h) =>
                    h.includes(column) ? h.filter((c) => c !== column) : [...h, column],
                  )
                }
                closeOnClick={false}
              >
                {COLUMN_LABELS[column]()}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        {onIso100k && (
          <Button variant="outline" size="sm" className="rounded-full" onClick={onIso100k}>
            {t`View ISO 100K`}
          </Button>
        )}
        <Button variant="outline" size="sm" className="rounded-full" onClick={download}>
          {t`Export CSV`}
        </Button>
        <Button size="sm" className="rounded-full" onClick={onDraft}>
          {t`Draft options`}
        </Button>
      </span>
    </div>
  );

  const head = (column: Column) => ({
    sortDirection: list.sort.field === column ? list.sort.dir : null,
    onSort: () => list.toggleSort(column as (typeof EQUITY_OPTION_GRANT_SORT_FIELDS)[number]),
  });

  const cell = (grant: EquityOptionGrant, column: Column) => {
    switch (column) {
      case "security":
        return (
          <TableCell key={column}>
            <button
              type="button"
              className="font-medium underline-offset-2 hover:underline"
              onClick={() => onOpen(grant)}
            >
              {grant.label}
            </button>
          </TableCell>
        );
      case "holder":
        return (
          <TableCell key={column} className="truncate">
            {grant.stakeholderName}
          </TableCell>
        );
      case "status":
        return (
          <TableCell key={column} className="whitespace-nowrap capitalize">
            <span
              aria-hidden="true"
              className={`me-1.5 inline-block size-1.5 rounded-full ${STATUS_DOT[grant.status]}`}
            />
            {grant.status}
          </TableCell>
        );
      case "quantity":
        return (
          <TableCell key={column} className="text-end tabular-nums">
            {shares(grant.quantity)}
          </TableCell>
        );
      case "outstanding":
        return (
          <TableCell key={column} className="text-end tabular-nums">
            {shares(grant.outstandingQuantity)}
          </TableCell>
        );
      case "price":
        return (
          <TableCell key={column} className="text-end tabular-nums">
            {price(grant.exercisePrice, amountsHidden)}
          </TableCell>
        );
      case "type":
        return (
          <TableCell key={column} className="uppercase">
            {grant.optionType}
          </TableCell>
        );
      case "grantDate":
        return (
          <TableCell key={column} className="whitespace-nowrap tabular-nums">
            {day(grant.grantDate)}
          </TableCell>
        );
      case "vesting":
        return (
          <TableCell
            key={column}
            className="max-w-0 truncate text-muted-foreground"
            title={grant.vestingSchedule?.description}
          >
            {grant.vestingSchedule?.description ?? DASH}
          </TableCell>
        );
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

  return (
    <div data-list-toolbar>
      {toolbar}
      {grants == null ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : grants.length === 0 ? (
        <CapTableEmptyState
          message={filtered ? t`No matches` : t`No option grants yet`}
          action={
            filtered ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => change({ search: undefined, status: undefined, plan: undefined })}
              >
                {status.length || plans.length ? t`Clear filters` : t`Clear search`}
              </Button>
            ) : (
              <Button size="sm" onClick={onDraft}>
                {t`Draft options`}
              </Button>
            )
          }
        />
      ) : (
        <>
          <Table compact>
            <TableHeader>
              <TableHeadRow>
                <TableHead className="w-8">
                  <Checkbox
                    aria-label={t`Select all`}
                    checked={allSelected}
                    indeterminate={someSelected && !allSelected}
                    onCheckedChange={(on) => toggleAll(on)}
                  />
                </TableHead>
                {visible.map((column) =>
                  COLUMNS_WITH_SORT.includes(column) ? (
                    <TableHead key={column} {...(head(column) as ReturnType<typeof head>)}>
                      {COLUMN_LABELS[column]()}
                    </TableHead>
                  ) : (
                    <TableHead key={column}>{COLUMN_LABELS[column]()}</TableHead>
                  ),
                )}
                <TableHead className="w-10">
                  <span className="sr-only">{t`Actions`}</span>
                </TableHead>
              </TableHeadRow>
            </TableHeader>
            <TableBody aria-label={t`Option grants`}>
              {grants.map((grant) => (
                <TableRow
                  key={grant.id}
                  data-grant-id={grant.id}
                  className="cursor-pointer"
                  onClick={openOnRowClick(() => onOpen(grant))}
                >
                  <TableCell className="w-8">
                    <Checkbox
                      aria-label={t`Select ${grant.label}`}
                      checked={selected.has(grant.id)}
                      onCheckedChange={(on) => toggleRow(grant.id, on)}
                    />
                  </TableCell>
                  {visible.map((column) => cell(grant, column))}
                  <TableCell className="w-10 pe-0 text-end">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t`Actions for ${grant.label}`}
                          />
                        }
                      >
                        <MoreHorizontal aria-hidden="true" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-52">
                        {groups.map((group, index) => (
                          <DropdownMenuGroup key={group.label}>
                            {index > 0 ? <DropdownMenuSeparator /> : null}
                            <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
                            {group.items.map(([action, label]) => (
                              <DropdownMenuItem
                                key={action}
                                disabled={optionGrantActionDisabled(action, grant)}
                                onClick={() => onAction(action, grant)}
                              >
                                {label}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuGroup>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {total > PAGE_SIZE ? (
            <div className="mt-2 flex items-center justify-end gap-2 text-sm text-muted-foreground">
              <span className="tabular-nums">{t`Page ${page} of ${pageCount}`}</span>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={t`Previous page`}
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={t`Next page`}
                disabled={page >= pageCount}
                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
