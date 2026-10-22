import { i18n } from "@lingui/core";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import type { AuditRequest, InvestorUpdate } from "@rakazo/contracts";
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Spinner,
} from "@rakazo/ui-web";
import { MoreHorizontal } from "lucide-react";
import { shortDay } from "../../lib/finance-format";
import { SectionCard } from "../SectionCard";

const day = (iso: string) => shortDay(iso.slice(0, 10), new Date(), i18n.locale || "en");

/** The line under an audit request's name: the as-of date and due date, then what to check. */
function auditSubline(audit: AuditRequest): string {
  const parts: string[] = [];
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
  onDraft,
  onClose,
}: {
  audit: AuditRequest;
  onDraft: (audit: AuditRequest) => void;
  onClose: (audit: AuditRequest, status: "done" | "dismissed") => void;
}) {
  const done = audit.status === "done";
  return (
    <li
      data-audit-id={audit.id}
      className="flex min-h-11 items-center gap-2 border-t border-border first:border-t-0"
    >
      <div className="min-w-0 flex-1 py-1.5">
        <span className="block truncate text-sm font-medium" title={audit.fund}>
          {t`Audit request · ${audit.fund}`}
        </span>
        <span className="block truncate text-xs text-muted-foreground">{auditSubline(audit)}</span>
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
          disabled={audit.drafting}
          onClick={() => onDraft(audit)}
        >
          {audit.drafting ? <Spinner aria-hidden="true" /> : null}
          {audit.drafting ? <Trans>Drafting…</Trans> : <Trans>Draft reply</Trans>}
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
  onOpen,
  onDraftAudit = () => {},
  onCloseAudit = () => {},
}: {
  drafts: InvestorUpdate[];
  audits?: AuditRequest[];
  onOpen: (update: InvestorUpdate) => void;
  onDraftAudit?: (audit: AuditRequest) => void;
  onCloseAudit?: (audit: AuditRequest, status: "done" | "dismissed") => void;
}) {
  if (drafts.length === 0 && audits.length === 0) return null;
  return (
    <SectionCard title={t`Action items`} attention>
      <ul>
        {audits.map((audit) => (
          <AuditRow key={audit.id} audit={audit} onDraft={onDraftAudit} onClose={onCloseAudit} />
        ))}
        {drafts.map((draft) => (
          <li
            key={draft.id}
            className="flex min-h-11 items-center gap-2 border-t border-border first:border-t-0"
          >
            <div className="min-w-0 flex-1 py-1.5">
              <span className="block truncate text-sm font-medium" title={draft.subject}>
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
        ))}
      </ul>
    </SectionCard>
  );
}
