import { Trans, useLingui } from "@lingui/react/macro";
import type { InboxMark, MailRow } from "@rakazo/contracts";
import { inboxLabel, isSuspiciousCategory, rowSummary } from "@rakazo/core";
import {
  Badge,
  Button,
  Checkbox,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@rakazo/ui-web";
import {
  Archive,
  BellOff,
  Ellipsis,
  ListChecks,
  Mail,
  MailOpen,
  Paperclip,
  ShieldAlert,
  ShieldCheck,
  Star,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { maskCurrencyWhenHidden, useHideAmounts } from "../../lib/hide-amounts-preference";
import { ROW_MENU_EVENT } from "../../lib/inbox-message-cache";
import { formatMailTime } from "../../lib/mail-time";
import { dueLabel } from "./TodoCard";

/** Narrow panes drop the badge for a dot: warning for Spam/Junk, solid for Needs attention, hollow for Newsletter; Spam is a solid warning dot and Junk a warning ring. */
const LABEL_DOT = {
  attention: "bg-foreground/60",
  newsletter: "border border-muted-foreground",
  spam: "bg-warning",
  junk: "border-2 border-warning",
} as const;

/** The words of a search worth marking: operators like `from:` are dropped, and so are negations. */
export function searchTerms(query: string | undefined): string[] {
  const words = (query ?? "").match(/[^\s"()]+/g) ?? [];
  const terms = words.flatMap((word) => {
    if (word.startsWith("-")) return [];
    const [, operator = "", rest = word] = word.match(/^([a-z_]+):(.*)$/i) ?? [];
    // Other operators (has:, is:, after:) filter without matching words.
    if (operator && !/^(from|to|subject)$/i.test(operator)) return [];
    const value = rest;
    return value.length > 1 && !/^(or|and)$/i.test(value) ? [value] : [];
  });
  return [...new Set(terms.map((term) => term.toLowerCase()))];
}

const termPattern = (terms: string[]) =>
  new RegExp(
    `(${terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`,
    "gi",
  );

/** The snippet cut to start just before its first match, or null when it holds none. */
export function matchSnippet(snippet: string, terms: string[]): string | null {
  const at = snippet.search(termPattern(terms));
  if (at < 0) return null;
  return at > 30 ? `…${snippet.slice(at - 20)}` : snippet;
}

/** The text with search matches in <mark>; the text is never parsed as HTML. */
function Marked({ text, terms }: { text: string; terms: string[] }) {
  if (terms.length === 0) return <>{text}</>;
  const pattern = termPattern(terms);
  return (
    <>
      {text.split(pattern).map((part, index) =>
        // An odd index is a match: split keeps the captured group between the pieces.
        index % 2 ? (
          // biome-ignore lint/suspicious/noArrayIndexKey: the parts are a fixed split of one string
          <mark key={index} className="rounded-sm bg-warning/25 px-0.5 text-inherit">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

/** Left and Right move among a row's button and its actions, which stay out of the Tab order. */
function moveAmongStops(event: React.KeyboardEvent<HTMLElement>) {
  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
  const stops = [...event.currentTarget.querySelectorAll<HTMLElement>("[data-row-stop]")];
  const at = stops.indexOf(document.activeElement as HTMLElement);
  if (at < 0) return;
  const next = stops[at + (event.key === "ArrowRight" ? 1 : -1)];
  if (!next) return;
  event.preventDefault();
  next.focus();
}

/** Spam and trash are for inbox mail; Not spam for mail the Spam pile shows. */
export type MailMoveOp = "spam" | "notSpam" | "trash";

/** The checkbox state a list passes to its rows. */
export interface RowPicking {
  /** Present when the list can report spam or move to trash. */
  onMove?: (op: MailMoveOp, messageId: string) => void;
  /** The checked rows. */
  pickedIds?: ReadonlySet<string>;
  onPick?: (messageId: string, event: { shift: boolean }) => void;
  /** Hide the Archived badge, as in the Spam pile where the mail is not in the inbox. */
  showArchived?: boolean;
  /** Hide the Newsletter label, as in the Newsletters pile. */
  hideNewsletter?: boolean;
  /** The search the rows answer: matched words are marked and the snippet shows the match. */
  query?: string;
}

/** The InboxRow props for one row of a list that passes `RowPicking`. */
export const rowPicking = (id: string, picking: RowPicking) => ({
  showArchived: picking.showArchived,
  hideNewsletter: picking.hideNewsletter,
  query: picking.query,
  ...(picking.onMove ? { onMove: (op: MailMoveOp) => picking.onMove?.(op, id) } : {}),
  ...(picking.onPick
    ? {
        picked: picking.pickedIds?.has(id) ?? false,
        anyPicked: (picking.pickedIds?.size ?? 0) > 0,
        onPick: (event: { shift: boolean }) => picking.onPick?.(id, event),
      }
    : {}),
});

export function InboxGroup({
  title,
  rows,
  onOpen,
  onMark,
  onArchive,
  onRead,
  selectedId,
  hideAttention,
  unreadTotal,
  todoDue,
  ...picking
}: {
  /** Omitted for search results, which show one count instead. */
  title?: React.ReactNode;
  /** Unread across the whole group when only the first rows are listed, so the count holds when it expands. */
  unreadTotal?: number;
  rows: MailRow[];
  onOpen: (id: string) => void;
  /** Present only while triage is enabled. */
  onMark: ((messageId: string, mark: InboxMark | null) => void) | undefined;
  onArchive?: (messageId: string) => void;
  onRead?: (messageId: string, read: boolean) => void;
  selectedId?: string;
  /** Set when the group heading already says the rows need attention. */
  hideAttention?: boolean;
  /** Rows whose mail has an open to-do; the To do card leaves them out, so the row says so. */
  /** Mail ids that have a to-do on the Needs reply row, with its due date when it has one. */
  todoDue?: ReadonlyMap<string, string | null>;
} & RowPicking) {
  const { t } = useLingui();
  if (rows.length === 0) return null;
  // The same number the sidebar badge counts: mail not yet read, not every row in the group.
  const unread = unreadTotal ?? rows.filter((row) => row.unread).length;
  return (
    <section className="mb-5">
      {title ? (
        <h2 className="mb-2 text-[13px] font-semibold text-muted-foreground">
          {title}
          {unread > 0 ? (
            <span className="ms-1.5 font-normal tabular-nums">{t`${unread} unread`}</span>
          ) : null}
        </h2>
      ) : null}
      <div className="border-t border-foreground/10">
        {rows.map((row) => (
          <InboxRow
            key={row.id}
            row={row}
            onOpen={() => onOpen(row.id)}
            onMark={onMark}
            onArchive={onArchive}
            onRead={onRead}
            selected={row.id === selectedId}
            hideAttention={hideAttention}
            todo={todoDue?.has(row.id)}
            due={todoDue?.get(row.id) ?? undefined}
            {...rowPicking(row.id, picking)}
          />
        ))}
      </div>
    </section>
  );
}

export function InboxRow({
  row,
  onOpen,
  onMark,
  onArchive,
  onRead,
  selected = false,
  hideAttention = false,
  todo = false,
  due,
  picked = false,
  anyPicked = false,
  onPick,
  onMove,
  showArchived = true,
  hideNewsletter = false,
  query,
}: {
  row: MailRow;
  onOpen: () => void;
  onMark: ((messageId: string, mark: InboxMark | null) => void) | undefined;
  onArchive?: (messageId: string) => void;
  onRead?: (messageId: string, read: boolean) => void;
  selected?: boolean;
  hideAttention?: boolean;
  todo?: boolean;
  due?: string;
  /** The row's checkbox is checked. */
  picked?: boolean;
  /** Some row of the list is checked, so every row shows its checkbox. */
  anyPicked?: boolean;
  /** Present when the list can check rows; `shift` extends the check over a range. */
  onPick?: (event: { shift: boolean }) => void;
  /** Present when the row can be reported as spam or moved to trash; these live in the More menu only. */
  onMove?: (op: MailMoveOp) => void;
  showArchived?: boolean;
  hideNewsletter?: boolean;
  query?: string;
}) {
  const { t } = useLingui();
  useHideAmounts();
  const labelNames = {
    // Needs reply is the one phrase for mail that wants an answer; other urgent mail says why.
    attention:
      row.needsReply === true
        ? t`Needs reply`
        : row.priority === "critical"
          ? t`Urgent`
          : row.priority === "important"
            ? t`Important`
            : t`Action`,
    newsletter: t`Newsletter`,
    spam: t`Spam`,
    junk: t`Junk`,
  };
  const found = inboxLabel(row);
  const label =
    (hideAttention && found === "attention") || (hideNewsletter && found === "newsletter")
      ? null
      : found;
  const terms = searchTerms(query);
  // A search shows the snippet around the match, so the row says why it was found.
  const summary = terms.length
    ? (matchSnippet(row.snippet, terms) ?? rowSummary(row))
    : rowSummary(row);
  // The checkbox takes the place of the unread dot while the pointer is on the row or any row is checked.
  const showPick = picked || anyPicked;
  const muted = row.feedback === "noise";
  // Marks belong to the sender, so the hint says so.
  const markHint = {
    important: t`Mark important: all mail from ${row.from}`,
    noise: t`Mark noise: all mail from ${row.from}`,
  };
  const marks = onMark
    ? ([
        { mark: "important", name: t`Mark important`, Icon: Star },
        { mark: "noise", name: t`Mark noise`, Icon: BellOff },
      ] as const)
    : [];
  const actions = [
    ...(onArchive && row.inInbox
      ? [{ name: t`Archive`, Icon: Archive, run: () => onArchive(row.id) }]
      : []),
    ...(onRead
      ? [
          {
            name: row.unread ? t`Mark read` : t`Mark unread`,
            Icon: row.unread ? MailOpen : Mail,
            run: () => onRead(row.id, row.unread),
          },
        ]
      : []),
    ...(onMove && row.inInbox && row.pile !== "spam"
      ? [{ name: t`Spam`, Icon: ShieldAlert, run: () => onMove("spam"), menuOnly: true }]
      : []),
    ...(onMove && row.inInbox
      ? [{ name: t`Trash`, Icon: Trash2, run: () => onMove("trash"), menuOnly: true }]
      : []),
    ...(onMove && row.pile === "spam"
      ? [{ name: t`Not spam`, Icon: ShieldCheck, run: () => onMove("notSpam"), menuOnly: true }]
      : []),
  ];
  return (
    <div className="border-b border-foreground/10">
      {/* biome-ignore lint/a11y/noStaticElementInteractions: only moves focus between the row button and its actions; those are the controls */}
      <div className="group/row relative" onKeyDown={moveAmongStops}>
        <button
          type="button"
          aria-haspopup="dialog"
          aria-current={selected ? "true" : undefined}
          data-row-id={row.id}
          data-row-stop=""
          onClick={onOpen}
          className={`grid h-16 w-full min-w-0 grid-cols-[8px_minmax(0,1fr)_auto] content-center items-center gap-x-2 gap-y-0.5 border-s-2 ps-2.5 pe-3 text-start text-[15px] font-normal outline-none [@media(hover:hover)]:hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset @md:h-14 @md:gap-x-4 @md:ps-3.5 @md:pe-4 @md:grid-cols-[8px_110px_minmax(0,1fr)_auto_minmax(4rem,auto)] @xl:grid-cols-[8px_140px_minmax(0,1fr)_auto_minmax(4rem,auto)] @3xl:grid-cols-[8px_200px_minmax(0,1fr)_auto_minmax(4rem,auto)] ${selected ? "border-primary bg-muted" : "border-transparent"} ${marks.length + actions.length ? "pointer-coarse:pe-16" : ""} ${muted ? "text-muted-foreground" : ""}`}
        >
          <span
            aria-hidden="true"
            data-unread-dot={row.unread ? "" : undefined}
            className={`col-start-1 row-start-1 size-2 rounded-full ${row.unread ? "bg-primary" : ""} ${onPick ? (showPick ? "invisible" : "group-focus-within/row:invisible group-hover/row:invisible pointer-coarse:visible pointer-coarse:translate-x-2.5 pointer-coarse:-translate-y-3 pointer-coarse:ring-2 pointer-coarse:ring-background") : ""} `}
          />
          <span
            dir="auto"
            className={`col-start-2 row-start-1 truncate ${muted ? "text-muted-foreground" : "text-foreground"} ${row.unread ? "font-semibold" : "font-normal"}`}
          >
            {isSuspiciousCategory(row.category) ? (
              <TriangleAlert
                role="img"
                aria-label={t`Suspicious`}
                className="me-1 inline size-3.5 align-text-bottom text-destructive"
              />
            ) : null}
            {row.fromSelf ? t`You` : <Marked text={row.from} terms={terms} />}
            {row.unread ? (
              <span className="sr-only">
                <Trans> (unread)</Trans>
              </span>
            ) : null}
          </span>
          <span
            dir="auto"
            className={`col-span-2 col-start-2 row-start-2 truncate text-sm @md:col-span-1 @md:col-start-3 @md:row-start-1 @md:text-[15px] ${muted ? "text-muted-foreground" : "text-foreground/70"} ${marks.length + actions.length && selected ? "@md:pe-24" : ""}`}
          >
            {label ? (
              <span
                aria-hidden="true"
                title={labelNames[label]}
                data-label-dot={label}
                className={`me-1.5 inline-block size-2 rounded-full align-middle @md:hidden ${LABEL_DOT[label]}`}
              />
            ) : null}
            <Marked text={maskCurrencyWhenHidden(row.subject)} terms={terms} />
            {summary ? (
              <span className="text-muted-foreground">
                {" — "}
                <Marked text={maskCurrencyWhenHidden(summary)} terms={terms} />
              </span>
            ) : null}
          </span>
          {label && row.inInbox ? (
            <Badge
              variant={label === "newsletter" ? "outline" : "secondary"}
              className={`col-start-4 row-start-1 hidden @md:inline-flex ${label === "spam" || label === "junk" ? "bg-warning/15 text-warning" : ""} ${marks.length + actions.length ? `group-focus-within/row:invisible group-hover/row:invisible ${selected ? "invisible" : ""}` : ""}`}
            >
              {labelNames[label]}
            </Badge>
          ) : null}
          {todo && !label ? (
            <Badge
              variant="outline"
              className={`col-start-4 row-start-1 hidden @md:inline-flex ${marks.length + actions.length ? `group-focus-within/row:invisible group-hover/row:invisible ${selected ? "invisible" : ""}` : ""}`}
            >
              <Trans>To do</Trans>
              {due ? ` · ${dueLabel(due, new Date())}` : null}
            </Badge>
          ) : null}
          {todo && !label ? (
            <ListChecks
              role="img"
              aria-label={due ? `${t`To do`} · ${dueLabel(due, new Date())}` : t`To do`}
              className="col-start-4 row-start-1 size-4 text-muted-foreground @md:hidden"
            />
          ) : null}
          {label ? <span className="sr-only @md:hidden">{labelNames[label]}</span> : null}
          {row.inInbox || !showArchived ? null : (
            // Only search finds archived mail; say so, since it is not in the Inbox list.
            <Badge
              variant="outline"
              className={`col-start-4 row-start-1 hidden @md:inline-flex ${marks.length + actions.length ? `group-focus-within/row:invisible group-hover/row:invisible ${selected ? "invisible" : ""}` : ""}`}
            >
              <Trans>Archived</Trans>
            </Badge>
          )}
          <time
            dateTime={row.receivedAt}
            className={`col-start-3 row-start-1 text-end text-[13px] text-muted-foreground @md:col-start-5 whitespace-nowrap tabular-nums ${marks.length + actions.length ? "@max-md:group-focus-within/row:opacity-0 @max-md:group-hover/row:opacity-0 pointer-coarse:opacity-100" : ""}`}
          >
            {row.hasAttachment ? (
              <Paperclip
                role="img"
                aria-label={t`Has attachment`}
                className="me-1 inline size-3 align-text-bottom"
              />
            ) : null}
            {formatMailTime(row.receivedAt)}
          </time>
        </button>
        {onPick ? (
          <Checkbox
            aria-label={t`Select ${row.from}`}
            checked={picked}
            onClick={(event) => onPick({ shift: event.shiftKey })}
            // One Tab stop per row: Right from the row button reaches the box, and x checks the selected row.
            tabIndex={-1}
            data-row-stop=""
            // On touch the control itself is 44 px; the 16 px box is drawn inside it.
            className={`absolute start-2 top-1/2 z-10 -translate-y-1/2 @md:start-3 pointer-coarse:-start-1.5 pointer-coarse:size-11 pointer-coarse:border-transparent pointer-coarse:bg-transparent pointer-coarse:data-checked:bg-transparent pointer-coarse:dark:bg-transparent pointer-coarse:after:hidden pointer-coarse:before:absolute pointer-coarse:before:size-4 pointer-coarse:before:rounded-[4px] pointer-coarse:before:border pointer-coarse:before:border-input pointer-coarse:data-checked:before:border-primary pointer-coarse:data-checked:before:bg-primary pointer-coarse:[&>[data-slot=checkbox-indicator]]:relative ${showPick ? "" : "opacity-0 focus-visible:opacity-100 group-focus-within/row:opacity-100 group-hover/row:opacity-100 pointer-coarse:opacity-100"}`}
          />
        ) : null}
        {marks.length + actions.length ? (
          <>
            <div
              className={`absolute end-22 top-1/2 flex -translate-y-1/2 items-center gap-0.5 bg-muted pointer-coarse:hidden @max-md:hidden ${selected ? "" : "opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100"}`}
            >
              {actions
                .filter((action) => !("menuOnly" in action))
                .map(({ name, Icon, run }) => (
                  <Tooltip key={name}>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={name}
                          tabIndex={-1}
                          data-row-stop=""
                          className="text-muted-foreground"
                          onClick={(event) => {
                            event.stopPropagation();
                            run();
                          }}
                        />
                      }
                    >
                      <Icon aria-hidden="true" />
                    </TooltipTrigger>
                    <TooltipContent>{name}</TooltipContent>
                  </Tooltip>
                ))}
              {marks.map(({ mark, name, Icon }) => {
                const pressed = row.feedback === mark;
                return (
                  <Tooltip key={mark}>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label={name}
                          aria-pressed={pressed}
                          tabIndex={-1}
                          data-row-stop=""
                          className={pressed ? "text-foreground" : "text-muted-foreground"}
                          onClick={(event) => {
                            event.stopPropagation();
                            onMark?.(row.id, pressed ? null : mark);
                          }}
                        />
                      }
                    >
                      <Icon aria-hidden="true" className={pressed ? "fill-current" : ""} />
                    </TooltipTrigger>
                    <TooltipContent>{markHint[mark]}</TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
            <DropdownMenu
              onOpenChange={(open) =>
                window.dispatchEvent(new CustomEvent(ROW_MENU_EVENT, { detail: open }))
              }
            >
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className={`absolute end-3 top-1/2 hidden -translate-y-1/2 bg-muted pointer-coarse:inline-flex pointer-coarse:size-10 @max-md:inline-flex aria-expanded:opacity-100 pointer-coarse:opacity-100 ${selected ? "" : "opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100"}`}
                  />
                }
                aria-label={t`More actions for ${row.from}`}
              >
                <Ellipsis aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44 max-w-72">
                {actions.map(({ name, Icon, run }) => (
                  <DropdownMenuItem key={name} onClick={run}>
                    <Icon aria-hidden="true" />
                    {name}
                  </DropdownMenuItem>
                ))}
                {marks.map(({ mark, name, Icon }) => (
                  <DropdownMenuCheckboxItem
                    key={mark}
                    checked={row.feedback === mark}
                    onCheckedChange={(checked) => onMark?.(row.id, checked ? mark : null)}
                  >
                    <Icon aria-hidden="true" />
                    {/* No tooltip on touch, so the menu says the mark covers the whole sender. */}
                    <span className="flex min-w-0 flex-col">
                      <span>{name}</span>
                      <span className="text-xs break-words text-muted-foreground">
                        {t`All mail from ${row.from}`}
                      </span>
                    </span>
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : null}
      </div>
    </div>
  );
}
