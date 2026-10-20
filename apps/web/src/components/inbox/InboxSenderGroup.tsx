import { Trans, useLingui } from "@lingui/react/macro";
import type { InboxMark, MailRow } from "@rakazo/contracts";
import type { SenderGroup } from "@rakazo/core";
import { rowSummary } from "@rakazo/core";
import { Button, Checkbox, Tooltip, TooltipContent, TooltipTrigger } from "@rakazo/ui-web";
import { Archive, ChevronRight } from "lucide-react";
import { maskCurrencyWhenHidden, useHideAmounts } from "../../lib/hide-amounts-preference";
import { formatMailTime } from "../../lib/mail-time";
import type { RowPicking } from "./InboxRow";
import { InboxRow, rowPicking } from "./InboxRow";

/** The id the keyboard and the focus use for a group header; message ids never start with it. */
export const SENDER_GROUP_PREFIX = "group:";
export const senderGroupId = (key: string) => `${SENDER_GROUP_PREFIX}${key}`;
export const isSenderGroupId = (id: string) => id.startsWith(SENDER_GROUP_PREFIX);

/**
 * One sender's mail in the Updates or Newsletters pile: a header with the count and the newest
 * mail's summary, and the messages below it once expanded. A sender with one message shows that
 * message as an ordinary row.
 */
export function InboxSenderGroup({
  group,
  expanded,
  onToggle,
  onOpen,
  onMark,
  onArchive,
  onRead,
  onArchiveGroup,
  onPickGroup,
  selectedId,
  ...picking
}: {
  group: SenderGroup<MailRow>;
  expanded: boolean;
  onToggle: () => void;
  onOpen: (messageId: string) => void;
  /** Present only while triage is enabled. */
  onMark: ((messageId: string, mark: InboxMark | null) => void) | undefined;
  onArchive?: (messageId: string) => void;
  onRead?: (messageId: string, read: boolean) => void;
  /** Archives every message of the group. */
  onArchiveGroup?: () => void;
  /** Checks, or unchecks, every message of the group. */
  onPickGroup?: () => void;
  /** The focused row, or the focused group header (`senderGroupId`). */
  selectedId?: string;
} & RowPicking) {
  const { t } = useLingui();
  useHideAmounts();
  const { newest } = group;
  const rowProps = (row: MailRow) => ({
    row,
    onOpen: () => onOpen(row.id),
    onMark,
    onArchive,
    onRead,
    selected: row.id === selectedId,
    ...rowPicking(row.id, picking),
  });
  if (group.count === 1) return <InboxRow {...rowProps(newest)} />;

  const id = senderGroupId(group.key);
  const selected = selectedId === id;
  const checked = group.rows.filter((row) => picking.pickedIds?.has(row.id)).length;
  const anyPicked = (picking.pickedIds?.size ?? 0) > 0;
  const showPick = checked > 0 || anyPicked;
  const summary = rowSummary(newest);
  const hasActions = Boolean(onArchiveGroup);
  return (
    <div>
      <div className="group/row relative border-b border-foreground/10">
        <button
          type="button"
          aria-expanded={expanded}
          data-row-id={id}
          onClick={onToggle}
          className={`grid h-16 w-full min-w-0 grid-cols-[8px_minmax(0,1fr)_auto] content-center items-center gap-x-2 gap-y-0.5 border-s-2 ps-2.5 pe-3 text-start text-[15px] font-normal hover:bg-muted @md:h-14 @md:gap-x-4 @md:ps-3.5 @md:pe-4 @md:grid-cols-[8px_110px_minmax(0,1fr)_auto] @xl:grid-cols-[8px_140px_minmax(0,1fr)_auto] @3xl:grid-cols-[8px_200px_minmax(0,1fr)_auto] ${selected ? "border-primary bg-muted" : "border-transparent"} ${hasActions ? "pointer-coarse:pe-16" : ""}`}
        >
          <span
            aria-hidden="true"
            data-unread-dot={group.unreadCount > 0 ? "" : undefined}
            className={`col-start-1 row-start-1 size-2 rounded-full ${group.unreadCount > 0 ? "bg-primary" : ""} ${onPickGroup ? (showPick ? "invisible" : "group-focus-within/row:invisible group-hover/row:invisible") : ""}`}
          />
          <span
            dir="auto"
            className={`col-start-2 row-start-1 flex min-w-0 items-center gap-1.5 text-foreground ${group.unreadCount > 0 ? "font-semibold" : "font-normal"}`}
          >
            <span className="truncate">{group.sender}</span>
            <span className="shrink-0 text-[13px] font-normal tabular-nums text-muted-foreground">
              {group.count}
            </span>
            <ChevronRight
              aria-hidden="true"
              className={`size-3.5 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`}
            />
            {group.unreadCount > 0 ? (
              <span className="sr-only">
                <Trans> (unread)</Trans>
              </span>
            ) : null}
          </span>
          <span
            dir="auto"
            className={`col-span-2 col-start-2 row-start-2 truncate text-sm text-foreground/70 @md:col-span-1 @md:col-start-3 @md:row-start-1 @md:text-[15px] ${hasActions ? "@md:group-hover/row:pe-10 @md:group-focus-within/row:pe-10" : ""}`}
          >
            {maskCurrencyWhenHidden(newest.subject)}
            {summary ? (
              <span className="text-muted-foreground"> — {maskCurrencyWhenHidden(summary)}</span>
            ) : null}
          </span>
          <time
            dateTime={newest.receivedAt}
            className={`col-start-3 row-start-1 whitespace-nowrap text-end text-[13px] tabular-nums text-muted-foreground @md:col-start-4 ${hasActions ? "@max-md:group-focus-within/row:opacity-0 @max-md:group-hover/row:opacity-0 pointer-coarse:opacity-100" : ""}`}
          >
            {formatMailTime(newest.receivedAt)}
          </time>
        </button>
        {onPickGroup ? (
          <Checkbox
            aria-label={t`Select`}
            checked={checked === group.count}
            indeterminate={checked > 0 && checked < group.count}
            onClick={onPickGroup}
            className={`absolute start-2 top-1/2 z-10 -translate-y-1/2 @md:start-3 ${showPick ? "" : "opacity-0 focus-visible:opacity-100 group-focus-within/row:opacity-100 group-hover/row:opacity-100"}`}
          />
        ) : null}
        {onArchiveGroup ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t`Archive`}
                  tabIndex={selected ? 0 : -1}
                  className={`absolute end-3 top-1/2 -translate-y-1/2 bg-muted text-muted-foreground @md:end-24 pointer-coarse:size-10 ${selected ? "" : "opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100 pointer-coarse:opacity-100"}`}
                  onClick={onArchiveGroup}
                />
              }
            >
              <Archive aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent>{t`Archive`}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>
      {expanded ? (
        <div className="ms-4 border-s border-foreground/10">
          {group.rows.map((row) => (
            <InboxRow key={row.id} {...rowProps(row)} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
