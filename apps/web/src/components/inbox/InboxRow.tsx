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
import { Ellipsis, TriangleAlert } from "lucide-react";

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
}: {
  title: React.ReactNode;
  rows: MailRow[];
  onOpen: (id: string) => void;
  /** Present only while triage is enabled. */
  onMark: ((messageId: string, mark: InboxMark | null) => void) | undefined;
  today: boolean;
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
}: {
  row: MailRow;
  onOpen: () => void;
  onMark: ((messageId: string, mark: InboxMark | null) => void) | undefined;
  today: boolean;
}) {
  const { t } = useLingui();
  const labelNames = {
    attention: t`Needs attention`,
    newsletter: t`Newsletter`,
    spam: t`Spam`,
    junk: t`Junk`,
  };
  const label = inboxLabel(row);
  // Unread reads as weight; read rows and rows marked noise are muted.
  const strong = row.unread && row.feedback !== "noise";
  const weight = row.unread ? "font-semibold" : "";
  return (
    <div className="border-b border-border">
      <div className="group/row relative">
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={onOpen}
          className={`grid w-full min-w-0 grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 px-3 py-2 text-start text-sm hover:bg-muted/50 @3xl:h-12 @3xl:grid-cols-[28px_170px_minmax(0,1fr)_auto] @3xl:py-0 ${onMark ? "pointer-coarse:pe-11" : ""} ${strong ? "text-foreground" : "text-muted-foreground"}`}
        >
          <span
            aria-hidden="true"
            className="col-start-1 row-start-1 grid size-7 place-items-center rounded-full bg-muted text-xs font-medium text-muted-foreground"
          >
            {row.from.match(/[\p{L}\p{N}]/u)?.[0]?.toUpperCase()}
          </span>
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
            className={`col-span-2 col-start-2 row-start-2 truncate @3xl:col-span-1 @3xl:col-start-3 @3xl:row-start-1 ${weight}`}
          >
            {row.subject}
            {row.snippet ? (
              <span className="font-normal text-muted-foreground"> - {row.snippet}</span>
            ) : null}
          </span>
          <span className="col-start-3 row-start-1 flex items-center justify-self-end gap-2 @3xl:col-start-4">
            {label ? (
              <Badge
                variant={label === "newsletter" ? "outline" : "secondary"}
                className={label === "spam" || label === "junk" ? "bg-warning/15 text-warning" : ""}
              >
                {labelNames[label]}
              </Badge>
            ) : null}
            <time
              dateTime={row.receivedAt}
              className={`text-xs whitespace-nowrap tabular-nums ${onMark ? "group-hover/row:opacity-0 group-has-[[aria-haspopup=menu]:focus-visible]/row:opacity-0 group-has-[[aria-haspopup=menu][aria-expanded=true]]/row:opacity-0 pointer-coarse:opacity-100" : ""} ${weight}`}
            >
              {formatMailTime(row.receivedAt, today)}
            </time>
          </span>
        </button>
        {onMark ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="absolute end-3 top-1.5 @3xl:top-1/2 @3xl:-translate-y-1/2 opacity-0 focus-visible:opacity-100 group-hover/row:opacity-100 pointer-coarse:opacity-100 data-popup-open:opacity-100"
                />
              }
              aria-label={t`More`}
            >
              <Ellipsis aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44">
              <DropdownMenuCheckboxItem
                checked={row.feedback === "important"}
                onCheckedChange={(checked) => onMark(row.id, checked ? "important" : null)}
              >
                <Trans>Mark important</Trans>
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={row.feedback === "noise"}
                onCheckedChange={(checked) => onMark(row.id, checked ? "noise" : null)}
              >
                <Trans>Mark noise</Trans>
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </div>
  );
}
