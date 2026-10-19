import { MailProviderError } from "@rakazo/adapter-kit";
import type { MailApproval, MailEdits, MessageBlock } from "@rakazo/contracts";
import {
  CARTA_WRITE_TOOLS,
  integrationPresetForEndpoint,
  isCartaAgentSpawnKey,
  isCartaEndpoint,
  isInboxAgentSpawnKey,
  isIntegrationAgentSpawnKey,
  isReadTool,
  MAX_COMPOSE_BODY,
} from "@rakazo/contracts";
import { humanizeToolName, redactSecrets } from "@rakazo/core";
import { buildRawMessage, displayAddress, parseRecipients } from "./mail-compose.js";

const MAX_APPROVAL_SUMMARY_LENGTH = 500;
const MAX_APPROVAL_DETAIL_LENGTH = 4_000;

export function buildApprovalAskBlock(
  effectId: string,
  toolName: string,
  args: Record<string, unknown>,
  secrets: string[],
  options?: {
    reviewReason?: string;
    fullMail?: boolean;
    integrationWriteTool?: string;
    /** The From account the mail call will use when it named none (see inferMailAccount). */
    mailAccount?: string;
    /** The MCP server's display name, so the title says which service runs the tool. */
    serviceName?: string;
  },
): MessageBlock {
  const summary = describeApprovalAction(toolName, args, options?.serviceName);
  const fullDetail = options?.fullMail || options?.integrationWriteTool !== undefined;
  const detail = options?.fullMail
    ? fullMailDetail(args, options.reviewReason)
    : options?.integrationWriteTool !== undefined
      ? integrationWriteDetail(toolName, options.integrationWriteTool, args, options.reviewReason)
      : formatApprovalDetail(toolName, args, options?.reviewReason);
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
    // A full mail send shows every recipient and the whole body, never a cut-off one.
    detail: safeDetail
      ? fullDetail
        ? safeDetail
        : truncate(safeDetail, MAX_APPROVAL_DETAIL_LENGTH)
      : undefined,
    mail: mailApproval(
      toolName,
      options?.mailAccount && !(typeof args.account === "string" && args.account)
        ? { ...args, account: options.mailAccount }
        : args,
      secrets,
    ),
    status: "pending",
    actions:
      toolName === "create_space"
        ? [
            { id: "allow", label: "Create space", outcome: "created" },
            { id: "deny", label: "Cancel", outcome: "cancelled" },
          ]
        : [
            { id: "allow", label: "Allow once" },
            ...(options?.fullMail || options?.integrationWriteTool !== undefined
              ? []
              : [{ id: "always", label: "Always allow this tool" }]),
            { id: "deny", label: "Deny" },
          ],
  };
}

/**
 * The Carta and Inbox agents' mail_send: always asks, never from a saved rule or Auto Review, so
 * the founder sees the whole message on a card before investor or customer mail goes out.
 */
export const isCartaMailSend = (botSpawnKey: string | null | undefined, toolName: string) =>
  toolName === "mail_send" &&
  (isCartaAgentSpawnKey(botSpawnKey) || isInboxAgentSpawnKey(botSpawnKey));

/**
 * The Carta agent's write tools on Carta's server: every call asks, whatever the saved rules say.
 * The executor names MCP tools `mcp__<slug>__<tool>`, so this reads the server and raw tool name
 * from the route, not the model-facing name.
 */
export const isCartaWrite = (
  botSpawnKey: string | null | undefined,
  route: { toolName: string; endpoint?: string } | undefined,
) =>
  isCartaAgentSpawnKey(botSpawnKey) &&
  isCartaEndpoint(route?.endpoint) &&
  (CARTA_WRITE_TOOLS as readonly string[]).includes(route?.toolName ?? "");

/** Whether an integration-agent write requires approval, using the shared preset classification. */
export const isIntegrationAgentWrite = (
  botSpawnKey: string | null | undefined,
  route:
    | {
        connectorId?: string;
        connectionId?: string;
        endpoint?: string;
        toolName?: string;
      }
    | undefined,
  readOnly: boolean | undefined,
): boolean => {
  if (isCartaAgentSpawnKey(botSpawnKey)) {
    if (route?.connectorId !== "mcp" || !isCartaEndpoint(route.endpoint)) return false;
    return !isReadTool(
      { name: route.toolName ?? "", annotations: { readOnlyHint: readOnly } },
      integrationPresetForEndpoint(route.endpoint),
    );
  }
  if (!isIntegrationAgentSpawnKey(botSpawnKey)) return false;
  if (route?.connectorId === "mcp")
    return !isReadTool(
      { name: route.toolName ?? "", annotations: { readOnlyHint: readOnly } },
      integrationPresetForEndpoint(route.endpoint),
    );
  return Boolean(route?.connectionId) && route?.connectorId !== "mcp" && readOnly !== true;
};

/** Whether a mail_send call carries the whole message (no draftId shortcut). */
export function cartaMailSendIsComplete(args: Record<string, unknown>): boolean {
  const filled = (value: unknown) => typeof value === "string" && value.trim() !== "";
  return (
    !filled(args.draftId) &&
    strings(args.to).length > 0 &&
    filled(args.subject) &&
    filled(args.body)
  );
}

/** The raw tool name and every argument, nested ones included, so the user sees the operation. */
function integrationWriteDetail(
  toolName: string,
  rawTool: string,
  args: Record<string, unknown>,
  reviewReason?: string,
): string {
  const lines = reviewReason?.trim() ? [reviewReason.trim()] : [];
  lines.push(
    `tool: ${toolName}`,
    ...(rawTool === toolName ? [] : [`server tool: ${rawTool}`]),
    `arguments: ${JSON.stringify(args, null, 2)}`,
  );
  return lines.join("\n");
}

/** Every recipient, Bcc included, and the whole body. */
function fullMailDetail(args: Record<string, unknown>, reviewReason?: string): string {
  const lines = reviewReason?.trim() ? [reviewReason.trim()] : [];
  for (const key of ["to", "cc", "bcc"]) {
    const list = strings(args[key]);
    lines.push(`${key}: ${list.length ? list.join(", ") : "(none)"}`);
  }
  lines.push(`subject: ${String(args.subject ?? "")}`, `body: ${String(args.body ?? "")}`);
  return lines.join("\n");
}

/** What the approval is for, in words; never a raw tool name for mail. */
export function describeApprovalAction(
  toolName: string,
  args: Record<string, unknown>,
  serviceName?: string,
): string {
  if (toolName === "mail_send" || toolName === "mail_draft") {
    const [first, ...rest] = strings(args.to);
    const to = first ? ` to ${first}${rest.length ? ` and ${rest.length} more` : ""}` : "";
    return toolName === "mail_send" ? `sending email${to}` : `saving a draft${to}`;
  }
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
  if (toolName === "contacts_save") {
    return `Save contact “${args.name ? String(args.name) : "Untitled"}”`;
  }
  const target = pickScopeLabel(args);
  const label = serviceName
    ? `${serviceName}: ${humanizeToolName(toolName)}`
    : humanizeToolName(toolName);
  return target ? `${label} → ${target}` : label;
}

/** Tools whose title and detail are written by hand; every other card shows the exact tool id. */
const HAND_WRITTEN_TOOLS = new Set([
  "mail_send",
  "mail_draft",
  "destination.write",
  "delete_bot",
  "archive_bot",
  "create_space",
  "contacts_save",
]);

function formatApprovalDetail(
  toolName: string,
  args: Record<string, unknown>,
  reviewReason?: string,
): string | undefined {
  const lines: string[] = [];
  if (reviewReason?.trim()) {
    lines.push(reviewReason.trim().replace(/\u2014|\u2013/g, "-"));
  }
  if (!HAND_WRITTEN_TOOLS.has(toolName)) lines.push(`tool: ${toolName}`);
  if (toolName === "create_space") {
    lines.push(
      "Bots, groups, chats, files, memory, and integrations in this space stay separate from other spaces.",
    );
  }
  const keys =
    toolName === "contacts_save"
      ? ["name", "email", "organization", "kind", "notes"]
      : ["collection", "title", "to", "subject", "amount", "body"];
  for (const key of keys) {
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
 * (draftId, no body) shows as a locked card, and an oversized body stays on the generic card.
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
    // Replacing a saved draft is not something the card can edit.
    ...(typeof args.draftId === "string" && args.draftId.trim() ? { locked: true } : {}),
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
