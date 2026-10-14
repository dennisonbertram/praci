import { MailProviderError } from "@rakazo/adapter-kit";
import type { MailApproval, MailEdits, MessageBlock } from "@rakazo/contracts";
import { MAX_COMPOSE_BODY } from "@rakazo/contracts";
import { redactSecrets } from "@rakazo/core";
import { buildRawMessage, displayAddress, parseRecipients } from "./mail-compose.js";

const MAX_APPROVAL_SUMMARY_LENGTH = 500;
const MAX_APPROVAL_DETAIL_LENGTH = 4_000;

export function buildApprovalAskBlock(
  effectId: string,
  toolName: string,
  args: Record<string, unknown>,
  secrets: string[],
  options?: { reviewReason?: string },
): MessageBlock {
  const summary = describeApprovalAction(toolName, args);
  const detail = formatApprovalDetail(toolName, args, options?.reviewReason);
  const safeDetail = detail ? redactSecrets(detail, secrets) : undefined;
  return {
    kind: "ask",
    approvalEffectId: effectId,
    text: truncate(
      redactSecrets(
        toolName === "create_space" ? `${summary}?` : `Review before ${summary}`,
        secrets,
      ),
      MAX_APPROVAL_SUMMARY_LENGTH,
    ),
    detail: safeDetail ? truncate(safeDetail, MAX_APPROVAL_DETAIL_LENGTH) : undefined,
    mail: mailApproval(toolName, args, secrets),
    status: "pending",
    actions:
      toolName === "create_space"
        ? [
            { id: "allow", label: "Create space", outcome: "created" },
            { id: "deny", label: "Cancel", outcome: "cancelled" },
          ]
        : [
            { id: "allow", label: "Allow once" },
            { id: "always", label: "Always allow this tool" },
            { id: "deny", label: "Deny" },
          ],
  };
}

function describeApprovalAction(toolName: string, args: Record<string, unknown>): string {
  if (toolName === "destination.write") {
    const collection = args.collection ? String(args.collection) : "records";
    const title = args.title ? ` "${String(args.title)}"` : "";
    return `writing${title} to ${collection}`;
  }
  if (toolName === "delete_bot" || toolName === "archive_bot") {
    const name = args.confirm_name ?? args.confirmName;
    return name ? `${toolName.replace("_", " ")} (${String(name)})` : toolName.replace("_", " ");
  }
  if (toolName === "create_space") {
    const name = args.name ? String(args.name) : "Untitled";
    return `Create space “${name}”`;
  }
  const target = pickScopeLabel(args);
  return target ? `${toolName} → ${target}` : toolName;
}

function formatApprovalDetail(
  toolName: string,
  args: Record<string, unknown>,
  reviewReason?: string,
): string | undefined {
  const lines: string[] = [];
  if (reviewReason?.trim()) {
    lines.push(reviewReason.trim().replace(/\u2014|\u2013/g, "-"));
  }
  if (toolName === "create_space") {
    lines.push(
      "Bots, groups, chats, files, memory, and integrations in this space stay separate from other spaces.",
    );
  }
  for (const key of ["collection", "title", "to", "subject", "amount", "body"]) {
    const value = args[key];
    if (value == null || value === "") continue;
    lines.push(`${key}: ${String(value)}`);
  }
  if (lines.length === 0) return undefined;
  return lines.join("\n");
}

function pickScopeLabel(args: Record<string, unknown>): string | undefined {
  for (const key of ["to", "title", "collection", "subject", "amount"]) {
    const value = args[key];
    if (value != null && value !== "") return String(value);
  }
  return undefined;
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

/**
 * The fields of a mail_draft or mail_send call, for the inline mail card. A send of a saved draft
 * (draftId, no body) has nothing to show or edit, and an oversized body stays on the generic card.
 */
function mailApproval(
  toolName: string,
  args: Record<string, unknown>,
  secrets: string[],
): MailApproval | undefined {
  if (toolName !== "mail_draft" && toolName !== "mail_send") return undefined;
  const text = (value: unknown) => (typeof value === "string" ? redactSecrets(value, secrets) : "");
  const body = text(args.body);
  if (body.length > MAX_COMPOSE_BODY) return undefined;
  if (toolName === "mail_send" && typeof args.draftId === "string" && args.draftId.trim()) {
    return undefined;
  }
  return {
    tool: toolName,
    ...(typeof args.account === "string" && args.account
      ? { account: redactSecrets(args.account, secrets) }
      : {}),
    to: strings(args.to).map((item) => redactSecrets(item, secrets)),
    cc: strings(args.cc).map((item) => redactSecrets(item, secrets)),
    bcc: strings(args.bcc).map((item) => redactSecrets(item, secrets)),
    subject: text(args.subject),
    body,
    ...(typeof args.replyToId === "string" && args.replyToId.trim() ? { reply: true } : {}),
  };
}

/** Edits as stored on the call: recipients parsed to address lists. */
export type NormalizedMailEdits = {
  to?: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  body?: string;
};

/**
 * Checks edited mail fields with the rules the mail tools apply when they run, and returns them in
 * the argument shape of mail_draft and mail_send. Returns an error message for an invalid field.
 */
export function normalizeMailEdits(
  edits: MailEdits,
): { ok: true; edits: NormalizedMailEdits } | { ok: false; error: string } {
  try {
    const lists: Pick<NormalizedMailEdits, "to" | "cc" | "bcc"> = {};
    for (const key of ["to", "cc", "bcc"] as const) {
      const value = edits[key];
      if (value !== undefined) lists[key] = parseRecipients(value).map(displayAddress);
    }
    const checked = {
      to: parseRecipients((lists.to ?? []).join(", ")),
      cc: parseRecipients((lists.cc ?? []).join(", ")),
      bcc: parseRecipients((lists.bcc ?? []).join(", ")),
      subject: edits.subject ?? "",
      text: edits.body ?? "",
    };
    // Recipient syntax, counts, and header-injection checks; a draft may still lack a recipient.
    buildRawMessage(checked, { draft: true });
    return {
      ok: true,
      edits: {
        ...lists,
        ...(edits.subject === undefined ? {} : { subject: edits.subject }),
        ...(edits.body === undefined ? {} : { body: edits.body }),
      },
    };
  } catch (error) {
    if (error instanceof MailProviderError) return { ok: false, error: error.message };
    throw error;
  }
}

/** The checks the mail tools apply when they run, on a whole call's arguments. True when they pass. */
export function mailRequestIsValid(kind: string, request: Record<string, unknown>): boolean {
  try {
    buildRawMessage(
      {
        to: parseRecipients(strings(request.to).join(", ")),
        cc: parseRecipients(strings(request.cc).join(", ")),
        bcc: parseRecipients(strings(request.bcc).join(", ")),
        subject: typeof request.subject === "string" ? request.subject : "",
        text: typeof request.body === "string" ? request.body : "",
      },
      { draft: kind === "mail_draft" },
    );
    return true;
  } catch (error) {
    if (error instanceof MailProviderError) return false;
    throw error;
  }
}
