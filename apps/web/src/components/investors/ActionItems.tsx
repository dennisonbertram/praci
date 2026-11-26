import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { AuditRequest, InvestorUpdate, MailAccountSummary } from "@rakazo/contracts";
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Spinner,
} from "@rakazo/ui-web";
import { ChevronDown, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { shortDay } from "../../lib/finance-format";
import { gmailThreadUrl } from "../../lib/gmail-link";
import { SeeAll, useCappedRows } from "../CappedList";
import { SectionCard } from "../SectionCard";

const day = (iso: string) => shortDay(iso.slice(0, 10), new Date(), i18n.locale || "en");

/** The line under an audit request's name: the as-of date and due date, then what to check. */
function auditSubline(audit: AuditRequest, draftEnded: boolean): string {
  const parts: string[] = [];
  // First, so a narrow row never cuts it off.
  if (draftEnded) parts.push(t`No draft made, see Ask`);
  if (audit.asOf) {
    parts.push(
      audit.asOfMatched
        ? t`Holdings as of ${day(audit.asOf)}`
        : t`Holdings as of today, not ${day(audit.asOf)}`,
    );
  }
  if (audit.dueDate) parts.push(t`due ${day(audit.dueDate)}`);
  if (!audit.senderKnown) parts.push(t`Sender not in Auditors`);
  return parts.join(" · ");
}

function AuditRow({
  audit,
  draftEnded,
  account,
  onDraft,
  onClose,
}: {
  audit: AuditRequest;
  draftEnded: boolean;
  /** The mail account's address, which picks the /u/ part of the Gmail link. */
  account?: string;
  onDraft: (audit: AuditRequest) => void;
  onClose: (audit: AuditRequest, status: "done" | "dismissed") => void;
}) {
  const done = audit.status === "done";
  return (
    <li
      data-audit-id={audit.id}
      className="flex min-h-11 flex-wrap items-center gap-x-2 border-t border-border first:border-t-0 sm:flex-nowrap"
    >
      <div className="min-w-0 basis-full py-1.5 sm:flex-1 sm:basis-0">
        <span className="line-clamp-2 text-sm font-medium" title={audit.fund}>
          {t`Audit request · ${audit.fund}`}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {auditSubline(audit, draftEnded)}
        </span>
      </div>
      {audit.newMail && !done ? (
        <Badge variant="secondary">
          <Trans>New mail</Trans>
        </Badge>
      ) : null}
      <Badge variant="secondary">
        {done ? (
          <Trans>Done</Trans>
        ) : audit.status === "drafted" ? (
          <Trans>Draft ready</Trans>
        ) : (
          <Trans>New</Trans>
        )}
      </Badge>
      {audit.status === "open" ? (
        <Button
          variant="outline"
          size="sm"
          // Not disabled: a click while drafting opens the Ask panel.
          aria-disabled={audit.drafting}
          onClick={() => onDraft(audit)}
        >
          {audit.drafting ? <Spinner aria-hidden="true" /> : null}
          {audit.drafting ? <Trans>Drafting…</Trans> : <Trans>Draft reply</Trans>}
        </Button>
      ) : null}
      {audit.status === "drafted" ? (
        <Button
          size="sm"
          render={
            <a
              href={gmailThreadUrl(account, audit.mailThreadId)}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
        >
          <Trans>Open draft</Trans>
        </Button>
      ) : null}
      {done ? null : (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon-sm" aria-label={t`Actions for ${audit.fund}`} />
            }
          >
            <MoreHorizontal aria-hidden="true" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onClose(audit, "done")}>
              <Trans>Mark done</Trans>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onClose(audit, "dismissed")}>
              <Trans>Dismiss</Trans>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </li>
  );
}

/**
 * What needs the founder on the Investors page: audit requests (filed when the mail arrives) and an
 * update draft, which stays here until it is sent or deleted. Nothing renders when there is none.
 */
export function ActionItems({
  drafts,
  audits = [],
  draftEnded = new Set<string>(),
  mailAccounts = [],
  onOpen,
  onDraftAudit = () => {},
  onCloseAudit = () => {},
}: {
  drafts: InvestorUpdate[];
  audits?: AuditRequest[];
  /** Requests whose draft run ended without a draft. */
  draftEnded?: ReadonlySet<string>;
  /** The founder's mail accounts: a drafted row's Open draft link picks the matching address. */
  mailAccounts?: readonly MailAccountSummary[];
  onOpen: (update: InvestorUpdate) => void;
  onDraftAudit?: (audit: AuditRequest) => void;
  onCloseAudit?: (audit: AuditRequest, status: "done" | "dismissed") => void;
}) {
  // On a phone the card is one line until opened; from sm up the list always shows.
  const [open, setOpen] = useState(false);
  const count = drafts.length + audits.length;
  // A phone shows 3 of them once opened; "See all" opens the rest in place.
  const items = [
    ...audits.map((audit) => ({ audit }) as { audit: AuditRequest; draft?: undefined }),
    ...drafts.map((draft) => ({ draft }) as { draft: InvestorUpdate; audit?: undefined }),
  ];
  const list = useCappedRows(items);
  if (count === 0) return null;
  return (
    <SectionCard
      title={t`Action items`}
      attention
      className={open ? "" : "max-sm:py-2 max-sm:[&>div:first-child]:mb-0"}
      actions={
        <Button
          variant="ghost"
          size="sm"
          className="pointer-coarse:h-11 sm:hidden"
          aria-expanded={open}
          aria-label={open ? t`Hide action items` : t`Show ${count} action items`}
          onClick={() => setOpen(!open)}
        >
          {count}
          <ChevronDown className={open ? "rotate-180" : ""} aria-hidden="true" />
        </Button>
      }
    >
      <ul className={open ? "" : "max-sm:hidden"}>
        {list.rows.map(({ audit, draft }) =>
          audit ? (
            <AuditRow
              key={audit.id}
              audit={audit}
              draftEnded={draftEnded.has(audit.id)}
              account={mailAccounts.find((a) => a.connectionId === audit.connectionId)?.address}
              onDraft={onDraftAudit}
              onClose={onCloseAudit}
            />
          ) : draft ? (
            <li
              key={draft.id}
              className="flex min-h-11 flex-wrap items-center gap-x-2 border-t border-border first:border-t-0 sm:flex-nowrap"
            >
              <div className="min-w-0 basis-full py-1.5 sm:flex-1 sm:basis-0">
                <span className="line-clamp-2 text-sm font-medium" title={draft.subject}>
                  {draft.subject}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {t`Drafted ${day(draft.createdAt)}`}
                </span>
              </div>
              <Badge variant="secondary">
                <Trans>Draft</Trans>
              </Badge>
              <Button variant="outline" size="sm" onClick={() => onOpen(draft)}>
                <Trans>Open</Trans>
              </Button>
            </li>
          ) : null,
        )}
      </ul>
      <div className={open ? "mt-1 flex justify-end sm:hidden" : "hidden"}>
        <SeeAll list={list} />
      </div>
    </SectionCard>
  );
}
