import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { Contact } from "@rakazo/contracts";
import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableHeadRow,
  TableRow,
  TableScrollRegion,
} from "@rakazo/ui-web";
import { Columns3, MoreHorizontal, Phone } from "lucide-react";
import { useEffect, useState } from "react";
import { todayDay } from "../../lib/day-input";
import { maskCurrencyWhenHidden, useHideAmounts } from "../../lib/hide-amounts-preference";
import { sortBy, useListParams } from "../../lib/list-params";
import type { PipelineRow, RowEdits, SortField } from "../../lib/pipeline-rows";
import { filterRows, isDue, SORT_FIELDS, sortValue, toPipelineRow } from "../../lib/pipeline-rows";
import { SAVED_ROW_CLASS } from "../../lib/use-contact-notices";
import { SeeAll, useCappedRows } from "../CappedList";
import { SearchField } from "../ListControls";
import { SectionCard } from "../SectionCard";
import { usdOrNull } from "./format";
import { LogCallBody, outcomeNames } from "./LogCall";
import {
  BlankAction,
  callLabel,
  Dash,
  dayLabel,
  InterestChoice,
  InterestPick,
  isOverdue,
  NextCallEditor,
  ReferredByPicker,
  StatusPick,
  statusNames,
  ValueEditor,
} from "./PipelineControls";
import { PipelineFilter, pipelineFilters } from "./PipelineFilter";
import { RowSheet } from "./RowSheet";

type OptionalColumn = "referredBy" | "amount" | "details";
const COLUMNS_KEY = "rakazo:crm-pipeline-columns";
const OPTIONAL: OptionalColumn[] = ["referredBy", "amount", "details"];

function readColumns(): OptionalColumn[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(COLUMNS_KEY) ?? "[]");
    return Array.isArray(saved) ? OPTIONAL.filter((column) => saved.includes(column)) : [];
  } catch {
    return [];
  }
}
function writeColumns(columns: OptionalColumn[]) {
  try {
    localStorage.setItem(COLUMNS_KEY, JSON.stringify(columns));
  } catch {
    // Private mode: the choice lasts for this page only.
  }
}

const lastCallText = (row: PipelineRow) =>
  row.lastCall
    ? `${outcomeNames()[row.lastCall.outcome]} ${dayLabel(todayDay(new Date(row.lastCall.at)))}`
    : null;
/** The day of the record's last mail or meeting contact, in the Last call column's format. */
const lastContactText = (row: PipelineRow) =>
  row.lastContactAt ? dayLabel(todayDay(new Date(row.lastContactAt))) : null;
const waitingText = (row: PipelineRow) =>
  row.waitingSince ? t`Waiting for Mercury · ${dayLabel(row.waitingSince.slice(0, 10))}` : null;

/**
 * The prospect pipeline as a table: columns that grow with the page's width (container queries,
 * never the viewport), one Filter control that reaches every column, Due now, inline Interest,
 * Status, Next call and Log call. Below 760 px it is a two-line list with a row sheet.
 */
export function PipelineTable({
  prospects,
  contacts,
  edits,
  savedId = null,
  filledSend = false,
  initialLog,
  initialSheet,
  initialSheetLog = false,
  onSendSafe,
  onOpenMercury,
  onNotSent,
  onEdit,
  onAskAbout,
}: {
  prospects: readonly Contact[];
  /** The user's contacts, for the Referred by picker. */
  contacts: readonly Contact[] | null;
  edits: RowEdits;
  /** The prospect just saved, whose row stands out. */
  savedId?: string | null;
  /** Whether Send SAFE is the page's one filled button (an open round); outline otherwise. */
  filledSend?: boolean;
  /** Story and test starting points: the row whose Log popover is open, and whose sheet. */
  initialLog?: string;
  initialSheet?: string;
  initialSheetLog?: boolean;
  onSendSafe: (prospect: Contact) => void;
  onOpenMercury: () => void;
  onNotSent: (prospect: Contact) => void;
  onEdit: (prospect: Contact) => void;
  /** Sends a question to the page's docked agent; absent when the page has none. */
  onAskAbout?: (question: string) => void;
}) {
  const hidden = useHideAmounts();
  const list = useListParams(SORT_FIELDS, { field: "nextCall", dir: "asc" });
  const query = list.param("q") ?? "";
  const [columns, setColumns] = useState<OptionalColumn[]>(readColumns);
  const [logId, setLogId] = useState(initialLog);
  // A link to a record (a contact in another page) opens its sheet by its id.
  const today = todayDay();
  const all = prospects.map(toPipelineRow);
  // A record link may name any person on the record, not only the one its row is keyed by.
  const rowFor = (id: string | undefined) =>
    id
      ? all.find((row) => row.id === id || row.people.some((person) => person.id === id))
      : undefined;
  const [sheetId, setSheetId] = useState(
    initialSheet ?? rowFor(list.param("record"))?.id ?? list.param("record"),
  );
  const filters = pipelineFilters(all);
  const filterNames = filters.map((filter) => filter.param);
  const params = Object.fromEntries(
    [...filterNames, "due"].flatMap((name) => {
      const value = list.param(name);
      return value ? [[name, value]] : [];
    }),
  );
  const status = list.param("status");
  const live = filterRows(all, { status }, "", today);
  const due = live.filter((row) => isDue(row, today)).length;
  const dueOn = list.param("due") === "1";
  const found = filterRows(all, params, query, today);
  const rows = sortBy(found, (row) => sortValue(list.sort.field, row), list.sort.dir);
  const capped = useCappedRows(rows, {
    desktop: 10,
    phone: 6,
    keep: (row) => row.id === savedId || row.id === sheetId,
  });
  const passed = all.filter((row) => row.status === "passed").length;
  const show = (column: OptionalColumn) => columns.includes(column);
  const head = (field: SortField) => ({
    sortDirection: list.sort.field === field ? list.sort.dir : null,
    onSort: () => list.toggleSort(field),
  });
  const sortFields: [SortField, string][] = [
    ["name", t`Prospect`],
    ["status", t`Status`],
    ["interest", t`Interest`],
    ["lastCall", t`Last call`],
    ["lastContact", t`Last contact`],
    ["nextStep", t`Next step`],
    ["nextCall", t`Next call`],
    ["referredBy", t`Referred by`],
    ["amount", t`Possible amount`],
    ["details", t`Fund details`],
  ];
  const optionalNames: Record<OptionalColumn, string> = {
    referredBy: t`Referred by`,
    amount: t`Possible amount`,
    details: t`Fund details`,
  };
  const clearAll = () => {
    list.clear("q", "due", ...filterNames);
  };
  const names = statusNames();
  const headClass = "sticky top-0 z-20 bg-card";
  // Every row, not just the listed ones: a linked record opens even when filtered out or past the cap.
  const sheet = all.find((row) => row.id === sheetId);
  const sheetRowId = sheet?.id;
  const linked = list.param("record");
  const closeSheet = () => {
    setSheetId(undefined);
    // Replace, so Back does not reopen a sheet the reader already closed.
    if (linked) list.setParam("record", undefined);
  };
  // Back and Forward between links open the record each URL names.
  // biome-ignore lint/correctness/useExhaustiveDependencies: follow the URL, not the rows
  useEffect(() => {
    if (!linked) return;
    const row = rowFor(linked);
    if (row) setSheetId(row.id);
    // A record that is not here opens nothing, and the link's param goes with it.
    else list.setParam("record", undefined);
  }, [linked]);
  useEffect(() => {
    // Show the row a link names: it may sit past the cap or under a filter.
    if (!sheetRowId) return;
    // The table and the phone list both carry the id; scroll to the one on screen.
    const shown = [
      ...document.querySelectorAll<HTMLElement>(`[data-contact-id="${sheetRowId}"]`),
    ].find((node) => node.offsetParent !== null || node.getClientRects().length > 0);
    shown?.scrollIntoView?.({ block: "center" });
  }, [sheetRowId]);
  // The sheet closes first, so the SAFE dialog does not open over it.
  const afterSheet = (act: () => void) => () => {
    closeSheet();
    act();
  };
  const safeFor = (row: PipelineRow) =>
    row.waitingSince
      ? {
          openMercury: afterSheet(onOpenMercury),
          notSent: afterSheet(() => onNotSent(row.contact)),
        }
      : row.status === "committed"
        ? { send: afterSheet(() => onSendSafe(row.contact)) }
        : {};
  const referrer = (row: PipelineRow, trigger: React.ReactNode) =>
    contacts ? (
      <ReferredByPicker
        row={row}
        contacts={contacts}
        trigger={trigger}
        onPick={(id) => edits.referrer(row, id)}
        onCreate={(name) => edits.createReferrer(row, name)}
      />
    ) : (
      trigger
    );
  return (
    // The card clips by default, which would stop the header from sticking.
    <SectionCard title={t`Pipeline`} className="overflow-visible">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="min-w-0 basis-full sm:max-w-56 sm:flex-1 sm:basis-40">
          <SearchField
            value={query}
            onChange={(next) => list.setParam("q", next)}
            placeholder={t`Search prospects`}
            label={t`Search prospects`}
            name="pipeline-search"
          />
        </div>
        {due > 0 || dueOn ? (
          <Button
            variant={dueOn ? "secondary" : "outline"}
            size="sm"
            aria-pressed={dueOn}
            className="pointer-coarse:h-11"
            onClick={() =>
              dueOn
                ? list.setParam("due", undefined)
                : // Due now is oldest first, so it drops the column sort it would fight.
                  list.setParams({ due: "1", sort: undefined, dir: undefined })
            }
          >
            {t`Due now · ${due}`}
          </Button>
        ) : null}
        <PipelineFilter filters={filters} list={list} sortFields={sortFields} />
        <span className="@max-[759px]/bd:hidden sm:ms-auto">
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="ghost" size="sm" />}>
              <Columns3 aria-hidden="true" />
              <Trans>Columns</Trans>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-max min-w-44">
              {OPTIONAL.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column}
                  checked={show(column)}
                  closeOnClick={false}
                  onCheckedChange={(checked) => {
                    const next = OPTIONAL.filter((c) => (c === column ? checked : show(c)));
                    setColumns(next);
                    writeColumns(next);
                  }}
                >
                  {optionalNames[column]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </span>
      </div>
      {all.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          <Trans>No prospects yet</Trans>
        </p>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            <Trans>No matches</Trans>
          </p>
          <Button variant="outline" size="sm" onClick={clearAll}>
            <Trans>Clear filters</Trans>
          </Button>
        </div>
      ) : (
        <>
          <div className="@max-[759px]/bd:hidden min-w-0">
            <TableScrollRegion
              aria-label={t`Fundraising prospects`}
              className="min-w-0 [&:not([tabindex='0'])]:overflow-visible [&[tabindex='0']]:max-h-[70vh] [&[tabindex='0']]:overflow-auto"
            >
              <Table
                compact
                className={columns.length ? "table-fixed w-max min-w-full" : "table-fixed"}
                data-testid="pipeline-table"
              >
                <TableHeader>
                  <TableHeadRow>
                    <TableHead className={`${headClass} ps-2 @[1040px]/bd:w-44`} {...head("name")}>
                      <Trans>Prospect</Trans>
                    </TableHead>
                    <TableHead className={`${headClass} w-32`} {...head("status")}>
                      <Trans>Status</Trans>
                    </TableHead>
                    <TableHead
                      className={`${headClass} w-28 @[1040px]/bd:w-60`}
                      {...head("interest")}
                    >
                      <Trans>Interest</Trans>
                    </TableHead>
                    <TableHead
                      className={`${headClass} hidden w-32 @[900px]/bd:table-cell`}
                      {...head("lastCall")}
                    >
                      <Trans>Last call</Trans>
                    </TableHead>
                    <TableHead
                      className={`${headClass} hidden w-28 @[1240px]/bd:table-cell`}
                      {...head("lastContact")}
                    >
                      <Trans>Last contact</Trans>
                    </TableHead>
                    <TableHead
                      className={`${headClass} hidden @[1040px]/bd:table-cell`}
                      {...head("nextStep")}
                    >
                      <Trans>Next step</Trans>
                    </TableHead>
                    <TableHead className={`${headClass} w-26`} {...head("nextCall")}>
                      <Trans>Next call</Trans>
                    </TableHead>
                    {show("referredBy") ? (
                      <TableHead className={`${headClass} w-24`} {...head("referredBy")}>
                        <Trans>Referred by</Trans>
                      </TableHead>
                    ) : null}
                    {show("amount") ? (
                      <TableHead
                        className={`${headClass} w-24 whitespace-nowrap text-end`}
                        {...head("amount")}
                      >
                        <Trans>Possible amount</Trans>
                      </TableHead>
                    ) : null}
                    {show("details") ? (
                      <TableHead className={`${headClass} w-32`} {...head("details")}>
                        <Trans>Fund details</Trans>
                      </TableHead>
                    ) : null}
                    {/* Wide enough for Log beside Send SAFE or the waiting menu, so neither spills out. */}
                    <TableHead className={`${headClass} w-40`}>
                      <span className="sr-only">
                        <Trans>Actions</Trans>
                      </span>
                    </TableHead>
                  </TableHeadRow>
                </TableHeader>
                <TableBody>
                  {capped.rows.map((row) => {
                    const [first, ...others] = row.people;
                    const sub =
                      waitingText(row) ??
                      (first ? `${first.name}${others.length ? ` +${others.length}` : ""}` : null);
                    const last = lastCallText(row);
                    const contact = lastContactText(row);
                    const label = callLabel(row);
                    const fundDetails = maskCurrencyWhenHidden(
                      row.details.map((d) => `${d.label}: ${d.value}`).join(" · "),
                    );
                    return (
                      <TableRow
                        key={row.id}
                        className={`group/row [&>td]:py-1.5 ${row.id === savedId ? SAVED_ROW_CLASS : ""}`}
                        data-contact-id={row.id}
                        data-testid={`row-${row.id}`}
                        onOpen={() => setSheetId(row.id)}
                      >
                        <TableCell>
                          <button
                            type="button"
                            data-row-open
                            title={row.name}
                            className="block max-w-full truncate rounded-sm text-start font-medium outline-none hover:underline"
                          >
                            {row.name}
                          </button>
                          {sub ? (
                            <div className="truncate text-xs text-muted-foreground" title={sub}>
                              {sub}
                            </div>
                          ) : null}
                        </TableCell>
                        {/* The popover and the status menu render in a portal: a click on their surface, not a control, would still reach the row's onOpen. */}
                        <TableCell
                          onClick={(e) => {
                            if (!(e.target as Element).closest("button,a,input,select,textarea"))
                              e.preventDefault();
                          }}
                        >
                          <StatusPick row={row} onChange={(next) => edits.status(row, next)} />
                          {row.status === "committed" && row.amountCents == null && !hidden ? (
                            <ValueEditor
                              label={t`Possible amount of ${row.name}`}
                              inputMode="decimal"
                              value=""
                              onSave={(text) => edits.amount(row, text)}
                            >
                              <span className="text-xs text-muted-foreground">
                                <Trans>Add amount</Trans>
                              </span>
                            </ValueEditor>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <div className="@[1040px]/bd:hidden">
                            <InterestPick row={row} onChange={(v) => edits.interest(row, v)} />
                          </div>
                          <div className="hidden @[1040px]/bd:block">
                            <InterestChoice row={row} onChange={(v) => edits.interest(row, v)} />
                          </div>
                        </TableCell>
                        <TableCell className="hidden @[900px]/bd:table-cell">
                          {last ? (
                            <div className="truncate text-muted-foreground" title={last}>
                              {last}
                            </div>
                          ) : (
                            <Dash />
                          )}
                        </TableCell>
                        <TableCell className="hidden @[1240px]/bd:table-cell">
                          {contact ? (
                            <div className="truncate text-muted-foreground" title={contact}>
                              {contact}
                            </div>
                          ) : (
                            <Dash />
                          )}
                        </TableCell>
                        <TableCell className="hidden @[1040px]/bd:table-cell">
                          <ValueEditor
                            label={t`Next step of ${row.name}`}
                            value={row.nextStep ?? ""}
                            onSave={(text) => edits.nextStep(row, text)}
                          >
                            {row.nextStep ? (
                              <span title={row.nextStep}>{row.nextStep}</span>
                            ) : (
                              <BlankAction>
                                <Trans>Add</Trans>
                              </BlankAction>
                            )}
                          </ValueEditor>
                        </TableCell>
                        <TableCell>
                          <NextCallEditor row={row} onSave={(next) => edits.nextCall(row, next)}>
                            {label ?? (
                              <BlankAction>
                                <Trans>Set date</Trans>
                              </BlankAction>
                            )}
                          </NextCallEditor>
                          {isOverdue(row) ? (
                            <div className="text-xs text-destructive">
                              <Trans>Overdue</Trans>
                            </div>
                          ) : null}
                        </TableCell>
                        {show("referredBy") ? (
                          <TableCell className="w-24">
                            {referrer(
                              row,
                              row.referredBy ? (
                                <span title={row.referredBy.name} className="block truncate">
                                  {row.referredBy.name}
                                </span>
                              ) : (
                                <BlankAction>
                                  <Trans>Add</Trans>
                                </BlankAction>
                              ),
                            )}
                          </TableCell>
                        ) : null}
                        {show("amount") ? (
                          <TableCell className="w-24 text-end tabular-nums">
                            {/* Hidden amounts are read-only: an editor would show the figure. */}
                            {hidden ? (
                              (usdOrNull(row.amountCents) ?? <Dash />)
                            ) : (
                              <ValueEditor
                                label={t`Possible amount of ${row.name}`}
                                inputMode="decimal"
                                value={row.amountCents == null ? "" : String(row.amountCents / 100)}
                                onSave={(text) => edits.amount(row, text)}
                              >
                                {usdOrNull(row.amountCents) ?? (
                                  <BlankAction>
                                    <Trans>Add</Trans>
                                  </BlankAction>
                                )}
                              </ValueEditor>
                            )}
                          </TableCell>
                        ) : null}
                        {show("details") ? (
                          <TableCell className="w-32">
                            {fundDetails ? (
                              <div className="truncate text-muted-foreground" title={fundDetails}>
                                {fundDetails}
                              </div>
                            ) : (
                              <Dash />
                            )}
                          </TableCell>
                        ) : null}
                        {/* The menu's and popover's items render in a portal: preventDefault keeps their clicks from reaching the row's onOpen. */}
                        <TableCell
                          className="w-40 pe-0 text-end"
                          onClick={(e) => e.preventDefault()}
                        >
                          <div className="inline-flex items-center justify-end gap-1">
                            <Popover
                              open={logId === row.id}
                              onOpenChange={(open) => setLogId(open ? row.id : undefined)}
                            >
                              <PopoverTrigger
                                nativeButton
                                render={
                                  <Button
                                    variant="ghost"
                                    size="xs"
                                    aria-label={t`Log a call with ${row.name}`}
                                    className="opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 focus-visible:opacity-100 data-[popup-open]:opacity-100 pointer-coarse:opacity-100"
                                  />
                                }
                              >
                                <Phone aria-hidden="true" />
                                <Trans>Log</Trans>
                              </PopoverTrigger>
                              <PopoverContent
                                align="end"
                                className="w-96 max-w-[calc(100vw-2rem)] text-start"
                              >
                                <LogCallBody
                                  row={row}
                                  onSave={(result) => {
                                    setLogId(undefined);
                                    edits.log(row, result);
                                  }}
                                />
                              </PopoverContent>
                            </Popover>
                            {row.waitingSince ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  render={
                                    <Button
                                      variant="ghost"
                                      size="icon-sm"
                                      aria-label={t`Actions for ${row.name}`}
                                    />
                                  }
                                >
                                  <MoreHorizontal aria-hidden="true" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-max">
                                  <DropdownMenuItem onClick={onOpenMercury}>
                                    <Trans>Open Mercury</Trans>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => onNotSent(row.contact)}>
                                    <Trans>Not sent</Trans>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : row.status === "committed" ? (
                              <Button
                                size="xs"
                                variant={filledSend ? "default" : "outline"}
                                onClick={() => onSendSafe(row.contact)}
                              >
                                <Trans>Send SAFE</Trans>
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableScrollRegion>
          </div>
          <ul className="@[760px]/bd:hidden" data-testid="pipeline-list">
            {capped.rows.map((row) => {
              const label = callLabel(row);
              return (
                <li
                  key={row.id}
                  data-testid={`item-${row.id}`}
                  data-contact-id={row.id}
                  className={`flex min-h-13 items-center gap-1 border-t border-border ${row.id === savedId ? SAVED_ROW_CLASS : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => setSheetId(row.id)}
                    className="min-w-0 flex-1 py-1.5 text-start outline-none"
                  >
                    <span className="block truncate text-sm font-medium" title={row.name}>
                      {row.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {waitingText(row) ?? names[row.status]}
                      {label ? (
                        <>
                          {" · "}
                          <span className={isOverdue(row) ? "text-destructive" : ""}>
                            {isOverdue(row) ? t`Overdue: ${label}` : t`Next call ${label}`}
                          </span>
                        </>
                      ) : null}
                    </span>
                  </button>
                  <InterestPick row={row} onChange={(v) => edits.interest(row, v)} />
                  <Button
                    variant="ghost"
                    size="icon-lg"
                    className="size-11"
                    aria-label={t`Actions for ${row.name}`}
                    onClick={() => setSheetId(row.id)}
                  >
                    <MoreHorizontal aria-hidden="true" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <div className="flex items-center justify-end gap-3 pt-1">
        {!status && passed ? (
          <Button
            variant="ghost"
            size="xs"
            className="text-muted-foreground"
            onClick={() => list.setParam("status", "passed")}
          >
            {t`Passed · ${passed}`}
          </Button>
        ) : null}
        <SeeAll list={capped} />
      </div>
      {sheet ? (
        <RowSheet
          key={sheet.id}
          row={sheet}
          contacts={contacts}
          edits={edits}
          logging={initialSheetLog && initialSheet === sheet.id}
          safe={safeFor(sheet)}
          onClose={closeSheet}
          onEditContact={() => {
            closeSheet();
            onEdit(sheet.contact);
          }}
          onAskAbout={onAskAbout}
        />
      ) : null}
    </SectionCard>
  );
}
