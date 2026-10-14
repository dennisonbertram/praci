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
  DropdownMenuTrigger,
} from "@rakazo/ui-web";
import { BellOff, Ellipsis, Star, TriangleAlert } from "lucide-react";

/** Time of day for today's mail, month and day otherwise. */
function formatMailTime(iso: string, today: boolean): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const locale = i18n.locale || "en";
  return today
    ? date.toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString(locale, { month: "short", day: "numeric" });
}

export function InboxGroup({
  title,
  rows,
  onOpen,
  onMark,
  today,
  selectedId,
  hideAttention,
}: {
  title: React.ReactNode;
  rows: MailRow[];
  onOpen: (id: string) => void;
  /** Present only while triage is enabled. */
  onMark: ((messageId: string, mark: InboxMark | null) => void) | undefined;
  today: boolean;
  selectedId?: string;
  /** Set when the group heading already says the rows need attention. */
  hideAttention?: boolean;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="mb-5">
      <h2 className="mb-1.5 text-xs font-semibold text-muted-foreground">{title}</h2>
      <div className="border-t border-border">
        {rows.map((row) => (
          <InboxRow
            key={row.id}
            row={row}
            onOpen={() => onOpen(row.id)}
            onMark={onMark}
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
  today,
  selected = false,
  hideAttention = false,
}: {
  row: MailRow;
  onOpen: () => void;
  onMark: ((messageId: string, mark: InboxMark | null) => void) | undefined;
  today: boolean;
  selected?: boolean;
  hideAttention?: boolean;
}) {
  const { t } = useLingui();
  const labelNames = {
    attention: t`Needs attention`,
    newsletter: t`Newsletter`,
    spam: t`Spam`,
    junk: t`Junk`,
  };
  const found = inboxLabel(row);
  const label = hideAttention && found === "attention" ? null : found;
  const weight = row.unread ? "font-semibold" : "";
  const muted = row.feedback === "noise";
  const marks = [
    { mark: "important", name: t`Mark important`, Icon: Star },
    { mark: "noise", name: t`Mark noise`, Icon: BellOff },
  ] as const;
  return (
    <div className="border-b border-border">
      <div className="group/row relative">
        <button
          type="button"
          aria-haspopup="dialog"
          aria-current={selected ? "true" : undefined}
          data-row-id={row.id}
          onClick={onOpen}
          className={`grid w-full min-w-0 grid-cols-[8px_minmax(0,1fr)_auto_4rem] items-center gap-x-3 gap-y-0.5 border-s-2 py-2 ps-2.5 pe-3 text-start text-sm hover:bg-muted @3xl:h-11 @3xl:grid-cols-[8px_180px_minmax(0,1fr)_auto_4rem] @3xl:py-0 ${selected ? "border-primary bg-muted" : "border-transparent"} ${onMark ? "pointer-coarse:pe-11" : ""} ${muted ? "text-muted-foreground" : "text-foreground"}`}
        >
          <span
            aria-hidden="true"
            data-unread-dot={row.unread ? "" : undefined}
            className={`col-start-1 row-start-1 size-2 rounded-full ${row.unread ? "bg-primary" : ""}`}
          />
          <span dir="auto" className={`col-start-2 row-start-1 truncate ${weight}`}>
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
          <span
            dir="auto"
            className={`col-span-3 col-start-2 row-start-2 truncate @3xl:col-span-1 @3xl:col-start-3 @3xl:row-start-1 ${weight}`}
          >
            {row.subject}
            {row.snippet ? (
              <span className="font-normal text-muted-foreground"> - {row.snippet}</span>
            ) : null}
          </span>
          {label ? (
            <Badge
              variant={label === "newsletter" ? "outline" : "secondary"}
              className={`col-start-3 row-start-1 @3xl:col-start-4 ${label === "spam" || label === "junk" ? "bg-warning/15 text-warning" : ""}`}
            >
              {labelNames[label]}
            </Badge>
          ) : null}
          <time
            dateTime={row.receivedAt}
            className={`col-start-4 row-start-1 text-end text-xs whitespace-nowrap tabular-nums @3xl:col-start-5 ${row.unread ? "font-semibold text-foreground" : "text-muted-foreground"}`}
          >
            {formatMailTime(row.receivedAt, today)}
          </time>
        </button>
        {onMark ? (
          <>
            <div
              className={`absolute end-22 top-1.5 flex items-center gap-0.5 bg-muted @3xl:top-1/2 @3xl:-translate-y-1/2 pointer-coarse:hidden ${selected ? "" : "opacity-0 group-focus-within/row:opacity-100 group-hover/row:opacity-100"}`}
            >
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
                      onMark(row.id, pressed ? null : mark);
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
                    className="absolute end-3 top-1.5 hidden pointer-coarse:inline-flex"
                  />
                }
                aria-label={t`More`}
              >
                <Ellipsis aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                {marks.map(({ mark, name }) => (
                  <DropdownMenuCheckboxItem
                    key={mark}
                    checked={row.feedback === mark}
                    onCheckedChange={(checked) => onMark(row.id, checked ? mark : null)}
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
