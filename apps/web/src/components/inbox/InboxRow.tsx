import { i18n } from "@lingui/core";
import { Trans, useLingui } from "@lingui/react/macro";
import type { InboxMark, MailRow } from "@rakazo/contracts";
import { inboxLabel, isSuspiciousCategory } from "@rakazo/core";
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@rakazo/ui-web";
import { Archive, BellOff, Ellipsis, Mail, MailOpen, Star, TriangleAlert } from "lucide-react";

/** Time of day for today's mail, month and day otherwise, with the year for another year. */
function formatMailTime(iso: string, today: boolean): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const locale = i18n.locale || "en";
  return today
    ? date.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString(locale, {
        month: "short",
        day: "numeric",
        ...(date.getFullYear() === new Date().getFullYear() ? {} : { year: "numeric" }),
      });
}

export function InboxGroup({
  title,
  rows,
  onOpen,
  onMark,
  onArchive,
  onRead,
  today,
  selectedId,
  hideAttention,
}: {
  /** Omitted for search results, which show one count instead. */
  title?: React.ReactNode;
  rows: MailRow[];
  onOpen: (id: string) => void;
  /** Present only while triage is enabled. */
  onMark: ((messageId: string, mark: InboxMark | null) => void) | undefined;
  onArchive?: (messageId: string) => void;
  onRead?: (messageId: string, read: boolean) => void;
  /** Omitted for mixed-date lists: each row then decides from its own date. */
  today?: boolean;
  selectedId?: string;
  /** Set when the group heading already says the rows need attention. */
  hideAttention?: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="mb-5">
      {title ? (
        <h2 className="mb-1.5 text-xs font-semibold text-muted-foreground">
          {title}
          <span className="ms-1.5 font-normal tabular-nums">{rows.length}</span>
        </h2>
      ) : null}
      <div className="border-t border-border">
        {rows.map((row) => (
          <InboxRow
            key={row.id}
            row={row}
            onOpen={() => onOpen(row.id)}
            onMark={onMark}
            onArchive={onArchive}
            onRead={onRead}
            today={today}
            selected={row.id === selectedId}
            hideAttention={hideAttention}
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
  today,
  selected = false,
  hideAttention = false,
}: {
  row: MailRow;
  onOpen: () => void;
  onMark: ((messageId: string, mark: InboxMark | null) => void) | undefined;
  onArchive?: (messageId: string) => void;
  onRead?: (messageId: string, read: boolean) => void;
  today?: boolean;
  selected?: boolean;
  hideAttention?: boolean;
}) {
  const { t } = useLingui();
  const received = new Date(row.receivedAt);
  const isToday = today ?? received.toDateString() === new Date().toDateString();
  const labelNames = {
    attention: t`Needs attention`,
    newsletter: t`Newsletter`,
    spam: t`Spam`,
    junk: t`Junk`,
  };
  const found = inboxLabel(row);
  const label = hideAttention && found === "attention" ? null : found;
  const muted = row.feedback === "noise";
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
  ];
  return (
    <div className="border-b border-border">
      <div className="group/row relative">
        <button
          type="button"
          aria-haspopup="dialog"
          title={hideAttention && row.reason ? row.reason : undefined}
          aria-current={selected ? "true" : undefined}
          data-row-id={row.id}
          onClick={onOpen}
          className={`grid h-11 w-full min-w-0 grid-cols-[8px_72px_minmax(0,1fr)_auto] items-center gap-x-2 border-s-2 ps-2.5 pe-3 text-start text-sm font-normal hover:bg-muted @md:gap-x-3 @md:grid-cols-[8px_110px_minmax(0,1fr)_auto_minmax(4rem,auto)] @xl:grid-cols-[8px_140px_minmax(0,1fr)_auto_minmax(4rem,auto)] @3xl:grid-cols-[8px_180px_minmax(0,1fr)_auto_minmax(4rem,auto)] ${selected ? "border-primary bg-muted" : "border-transparent"} ${marks.length + actions.length ? "pointer-coarse:pe-11" : ""} text-muted-foreground`}
        >
          <span
            aria-hidden="true"
            data-unread-dot={row.unread ? "" : undefined}
            className={`col-start-1 row-start-1 size-2 rounded-full ${row.unread ? "bg-primary" : ""}`}
          />
          <span
            dir="auto"
            className={`col-start-2 row-start-1 truncate ${row.unread && !muted ? "text-foreground" : ""}`}
          >
            {isSuspiciousCategory(row.category) ? (
              <TriangleAlert
                role="img"
                aria-label={t`Suspicious`}
                className="me-1 inline size-3.5 align-text-bottom text-destructive"
              />
            ) : null}
            {row.from}
            {row.unread ? (
              <span className="sr-only">
                <Trans> (unread)</Trans>
              </span>
            ) : null}
          </span>
          <span dir="auto" className="col-start-3 row-start-1 truncate">
            {row.subject}
            {row.snippet ? <span> - {row.snippet}</span> : null}
          </span>
          {label ? (
            <Badge
              variant={label === "newsletter" ? "outline" : "secondary"}
              className={`col-start-4 row-start-1 hidden @md:inline-flex ${label === "spam" || label === "junk" ? "bg-warning/15 text-warning" : ""}`}
            >
              {labelNames[label]}
            </Badge>
          ) : null}
          {label ? <span className="sr-only @md:hidden">{labelNames[label]}</span> : null}
          <time
            dateTime={row.receivedAt}
            className={`col-start-4 row-start-1 text-end text-xs @md:col-start-5 whitespace-nowrap tabular-nums ${marks.length + actions.length ? "@max-md:group-focus-within/row:opacity-0 @max-md:group-hover/row:opacity-0 pointer-coarse:opacity-100" : ""}`}
          >
            {formatMailTime(row.receivedAt, isToday)}
          </time>
        </button>
        {marks.length + actions.length ? (
          <>
            <div
              className={`absolute end-22 top-1/2 flex -translate-y-1/2 items-center gap-0.5 bg-muted pointer-coarse:hidden @max-md:hidden ${selected ? "" : "opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100"}`}
            >
              {actions.map(({ name, Icon, run }) => (
                <Button
                  key={name}
                  variant="ghost"
                  size="icon-xs"
                  aria-label={name}
                  tabIndex={selected ? 0 : -1}
                  className="text-muted-foreground"
                  onClick={(event) => {
                    event.stopPropagation();
                    run();
                  }}
                >
                  <Icon aria-hidden="true" />
                </Button>
              ))}
              {marks.map(({ mark, name, Icon }) => {
                const pressed = row.feedback === mark;
                return (
                  <Button
                    key={mark}
                    variant="ghost"
                    size="icon-xs"
                    aria-label={name}
                    aria-pressed={pressed}
                    tabIndex={selected ? 0 : -1}
                    className={pressed ? "text-foreground" : "text-muted-foreground"}
                    onClick={(event) => {
                      event.stopPropagation();
                      onMark?.(row.id, pressed ? null : mark);
                    }}
                  >
                    <Icon aria-hidden="true" className={pressed ? "fill-current" : ""} />
                  </Button>
                );
              })}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className={`absolute end-3 top-1/2 hidden -translate-y-1/2 bg-muted pointer-coarse:inline-flex @max-md:inline-flex aria-expanded:opacity-100 pointer-coarse:opacity-100 ${selected ? "" : "opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100"}`}
                  />
                }
                aria-label={t`More`}
              >
                <Ellipsis aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                {actions.map(({ name, Icon, run }) => (
                  <DropdownMenuItem key={name} onClick={run}>
                    <Icon aria-hidden="true" />
                    {name}
                  </DropdownMenuItem>
                ))}
                {marks.map(({ mark, name }) => (
                  <DropdownMenuCheckboxItem
                    key={mark}
                    checked={row.feedback === mark}
                    onCheckedChange={(checked) => onMark?.(row.id, checked ? mark : null)}
                  >
                    {name}
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
