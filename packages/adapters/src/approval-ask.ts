import { MailProviderError } from "@rakazo/adapter-kit";
import type { MailApproval, MailEdits, MailReplyFlag, MessageBlock } from "@rakazo/contracts";
import {
  AI_DATA_DISCLOSURES,
  AI_DISCLOSURE_VERSION,
  BREX_CARDS_WRITE_ARGS,
  CARTA_WRITE_TOOLS,
  integrationPresetForEndpoint,
  isCartaAgentSpawnKey,
  isCartaEndpoint,
  isGtmAgentSpawnKey,
  isIntegrationAgentSpawnKey,
  isInvestorsAgentSpawnKey,
  isMailAgentSpawnKey,
  isReadTool,
  isZernioEndpoint,
  MAIL_REPLY_BATCH_TOOL,
  MAX_COMPOSE_BODY,
  modelLabel,
  PIPELINE_IMPORT_REVIEW_TOOL,
} from "@rakazo/contracts";
import {
  ALL_SITES_ACTION_ID,
  ALL_SITES_ACTION_LABEL,
  accessCapability,
  bodyHasLink,
  humanizeToolName,
  providerLabel,
  redactSecrets,
  sanitizeMessagingLabel,
} from "@rakazo/core";
import { SITE_GATED_TOOLS, urlSite } from "@rakazo/core/egress";
import { buildRawMessage, displayAddress, parseRecipients } from "./mail-compose.js";

const MAX_APPROVAL_SUMMARY_LENGTH = 500;
const MAX_APPROVAL_DETAIL_LENGTH = 4_000;
/** Longer fetch URLs are refused, so an approval card always shows the whole URL it sends. */
export const MAX_FETCH_URL_LENGTH = 2_048;

/** Markdown characters a card title would otherwise render (a requester's name is untrusted). */
const CARD_TITLE_ESCAPED = /[\\`*_[\]<>~|]/g;

export function buildApprovalAskBlock(
  effectId: string,
  toolName: string,
  args: Record<string, unknown>,
  secrets: string[],
  options?: {
    reviewReason?: string;
    /** The name of the bot a message_bot call goes to (its id alone names no one). */
    recipientBot?: string;
    /** The owner's IANA time zone; calendar ranges are written in it (UTC when unknown). */
    timezone?: string | null;
    /** One plain sentence under the card: the call asked because of a background run or a rule. */
    approvalReason?: string;
    fullMail?: boolean;
    /** A full mail card: some recipient is new to the owner or off the thread (default: yes). */
    newRecipient?: boolean;
    fullCompany?: boolean;
    integrationWriteTool?: string;
    /** Offer "Allow all sites for this agent" on a new-site card; lists the private data the agent can read. */
    allSites?: { privateAccess: string[] };
    /** Offer "Always for this routine": a rule that only this routine's runs use. */
    routineAlways?: boolean;
    /** Never offer "Always allow": the call asks every time (a run holding untrusted meeting text). */
    noAlwaysAllow?: boolean;
    /** The From account the mail call will use when it named none (see inferMailAccount). */
    mailAccount?: string;
    mailChoices?: NonNullable<MailApproval["choices"]>;
    /** The MCP server's display name, so the title says which service runs the tool. */
    serviceName?: string;
    /** Who an imessage_send goes to, resolved from the call (a thread id alone names no one). */
    imessage?: { recipient: string; line: string; disclosure?: string };
    /** A repeating schedule in plain words and local time, with its whole prompt. */
    schedule?: { summary: string; detail: string };
    /** Who and which account a money request names, looked up from the provider (see resolveMoneyNames). */
    moneyNames?: MoneyNames;
    /** share_meeting: the agent that would receive the meeting. */
    shareTarget?: string;
    /** mail_reply_batch: the stored rows. */
    mailBatch?: readonly MailBatchCardRow[];
    /** pipeline_import_review: the review of the import. */
    pipelineImport?: { importId: string; text: string; detail: string };
    /** request_access: the asking agent, and whether Always for this agent may be offered. */
    requestAccess?: { agent: string; firewalled: boolean; always: boolean };
  },
): MessageBlock {
  if (toolName === "request_access" && options?.requestAccess) {
    return buildRequestAccessBlock(effectId, args, secrets, options.requestAccess);
  }
  if (toolName === MAIL_REPLY_BATCH_TOOL) {
    return buildMailBatchAskBlock(effectId, options?.mailBatch ?? [], options?.approvalReason);
  }
  if (toolName === PIPELINE_IMPORT_REVIEW_TOOL && options?.pipelineImport) {
    // Add is its own request from the web and desktop card; the phone apps show this text and Deny.
    const { importId, text, detail } = options.pipelineImport;
    return {
      kind: "ask",
      approvalEffectId: effectId,
      text,
      detail,
      approvalReason: options.approvalReason,
      pipelineImport: { importId },
      status: "pending",
      actions: [{ id: "deny", label: "Deny" }],
    };
  }
  if (toolName === "respond_agent_connection") {
    // Shows who asked, from what was captured before the effect was recorded, not from the model.
    const name = sanitizeMessagingLabel(String(args.requester_name ?? "agent")).replace(
      CARD_TITLE_ESCAPED,
      "\\$&",
    );
    return {
      kind: "ask",
      approvalEffectId: effectId,
      text: redactSecrets(
        `${args.accept === true ? "Approve" : "Decline"} connection with “${name}”?`,
        secrets,
      ),
      detail: redactSecrets(
        `${providerLabel(String(args.requester_provider ?? ""))}: ${String(args.requester_address ?? "").replace(/[\r\n]/g, " ")}`,
        secrets,
      ),
      status: "pending",
      actions: [
        { id: "allow", label: "Allow once" },
        { id: "deny", label: "Deny" },
      ],
    };
  }
  const fetchSite = webFetchSite(toolName, args);
  const shareTarget =
    options?.shareTarget &&
    sanitizeMessagingLabel(options.shareTarget).replace(CARD_TITLE_ESCAPED, "\\$&");
  const shown = summaryArgs(toolName, args, options?.recipientBot, options?.timezone);
  const summary =
    (shareTarget ? `sharing a meeting with ${shareTarget}` : undefined) ??
    options?.schedule?.summary ??
    describeApprovalAction(
      toolName,
      options?.imessage ? { ...args, to: options.imessage.recipient } : shown,
      options?.serviceName,
      options?.moneyNames,
    );
  const fullDetail =
    options?.fullMail ||
    options?.fullCompany ||
    options?.integrationWriteTool !== undefined ||
    options?.imessage ||
    options?.schedule;
  const _fullDetailOpen = options?.fullMail || options?.imessage || options?.schedule;
  const detail = shareTarget
    ? `${shareTarget} will ask before every action after it reads the meeting.`
    : options?.schedule
      ? [options.reviewReason?.trim(), options.schedule.detail].filter(Boolean).join("\n")
      : options?.imessage
        ? imessageSendDetail(args, options.imessage, options.reviewReason)
        : options?.fullMail
          ? fullMailDetail(
              args,
              options.reviewReason,
              options.mailAccount,
              options.newRecipient !== false,
            )
          : isSendMoney(toolName)
            ? moneyDetail(args, options?.moneyNames, options?.reviewReason)
            : options?.fullCompany
              ? JSON.stringify(args, null, 2)
              : options?.integrationWriteTool !== undefined
                ? integrationWriteDetail(
                    toolName,
                    options.integrationWriteTool,
                    args,
                    options.reviewReason,
                  )
                : formatApprovalDetail(
                    toolName,
                    redactLeaves(shown, secrets) as Record<string, unknown>,
                    options?.reviewReason,
                  );
  const safeDetail = detail ? redactSecrets(detail, secrets) : undefined;
  return {
    kind: "ask",
    approvalEffectId: effectId,
    // The card's chevron reveals the exact id; hand-written cards and writes name it in their detail.
    toolId:
      HAND_WRITTEN_TOOLS.has(toolName) ||
      toolName === "create_space" ||
      isSendMoney(toolName) ||
      options?.integrationWriteTool !== undefined ||
      options?.schedule
        ? undefined
        : toolName,
    text: truncate(
      redactSecrets(
        toolName === "create_space" || isSendMoney(toolName)
          ? `${summary}?`
          : options?.schedule
            ? summary
            : `Review before ${summary}`,
        secrets,
      ),
      MAX_APPROVAL_SUMMARY_LENGTH,
    ),
    // Raw tool arguments sit behind a Details disclosure; a card the person reads to decide stays open.
    detailFolded:
      (options?.integrationWriteTool !== undefined || isSendMoney(toolName) || options?.schedule) &&
      !options?.fullMail &&
      !options?.imessage
        ? true
        : undefined,
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
      options?.mailChoices,
      options?.fullMail,
    ),
    approvalReason: options?.approvalReason,
    ...(fetchSite ? { site: fetchSite } : {}),
    status: "pending",
    actions:
      toolName === "create_space"
        ? [
            { id: "allow", label: "Create space", outcome: "created" },
            { id: "deny", label: "Cancel", outcome: "cancelled" },
          ]
        : [
            {
              id: "allow",
              label:
                isSendMoney(toolName) && args.amount != null
                  ? `Send ${formatAmount(args.amount, args.currency)}`
                  : "Allow once",
            },
            ...(options?.fullMail ||
            options?.fullCompany ||
            toolName === "fundraising_round_save" ||
            options?.integrationWriteTool !== undefined ||
            options?.noAlwaysAllow ||
            toolName === "imessage_send"
              ? []
              : [
                  {
                    id: "always",
                    label: fetchSite ? `Always allow ${fetchSite}` : "Always allow this tool",
                  },
                ]),
            ...(options?.routineAlways
              ? [{ id: "always_routine", label: "Always for this routine" }]
              : []),
            ...(options?.allSites && fetchSite
              ? [
                  {
                    id: ALL_SITES_ACTION_ID,
                    label: options.allSites.privateAccess.length
                      ? `${ALL_SITES_ACTION_LABEL} (it can read ${options.allSites.privateAccess.join(", ")})`
                      : ALL_SITES_ACTION_LABEL,
                  },
                ]
              : []),
            { id: "deny", label: "Deny" },
          ],
  };
}

/**
 * The card for request_access. The capability words are fixed server text from the closed list, so
 * the card states exactly what Allow grants; only the reason is the agent's own words, shown as plain
 * text in the detail. The answer ids are the usual three, so every client already renders them.
 */
function buildRequestAccessBlock(
  effectId: string,
  args: Record<string, unknown>,
  secrets: string[],
  card: { agent: string; firewalled: boolean; always: boolean },
): MessageBlock {
  const agent = sanitizeMessagingLabel(card.agent).replace(CARD_TITLE_ESCAPED, "\\$&");
  const words = accessCapability(args.capability)?.words ?? "use a tool you switched off";
  const reason = redactSecrets(String(args.reason ?? ""), secrets)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
  return {
    kind: "ask",
    approvalEffectId: effectId,
    text: `${agent} asks to ${words}`,
    detail: [
      reason ? `Agent's reason: ${reason}` : undefined,
      card.firewalled ? "Firewall is on, so each use will still ask you." : undefined,
    ]
      .filter(Boolean)
      .join("\n"),
    status: "pending",
    actions: [
      { id: "allow", label: "Allow for this run" },
      ...(card.always ? [{ id: "always", label: "Always for this agent" }] : []),
      { id: "deny", label: "Deny" },
    ],
  };
}

/** One row of a reply batch as an older client's card lists it. */
export type MailBatchCardRow = {
  to: readonly string[];
  cc: readonly string[];
  bcc: readonly string[];
  subject: string;
  flags: readonly MailReplyFlag[];
  newEmail?: boolean;
};

const MAIL_REPLY_FLAG_TEXT: Record<MailReplyFlag, string> = {
  not_on_thread: "Not on this thread",
  new_message: "New message",
  important_sender: "Important sender",
  no_reply_address: "No-reply address",
  no_reply_needed: "You said no reply needed",
  already_sent: "Already sent a few minutes ago",
  duplicate_email: "Possible duplicate",
  new_recipient: "New recipient",
  has_link: "Has a link",
  same_text: "Same text as others",
};

/**
 * The card for a reply batch: its one action is Discard, so no answer to it can send or save a rule.
 * Send selected is a separate request. The rows are listed for clients without the batch card. Each
 * recipient is shown whole and bare: the model writes the display name, and a name can say anything.
 */
function buildMailBatchAskBlock(
  effectId: string,
  rows: readonly MailBatchCardRow[],
  approvalReason?: string,
): MessageBlock {
  const bare = (entries: readonly string[]) =>
    entries.map((entry) => entry.match(/<([^>]+)>\s*$/)?.[1] ?? entry);
  return {
    kind: "ask",
    approvalEffectId: effectId,
    text: mailBatchTitle(rows),
    detail: rows
      .map((row) => {
        const to = [...bare(row.to), ...bare(row.cc), ...bare(row.bcc)].join(", ");
        const flag = row.flags[0] ? ` (${MAIL_REPLY_FLAG_TEXT[row.flags[0]]})` : "";
        return `${row.newEmail ? "New: " : ""}${to}: ${truncate(row.subject, 120)}${flag}`;
      })
      .join("\n"),
    approvalReason,
    mailBatch: { count: rows.length, sent: 0, failed: 0, unknown: 0 },
    status: "pending",
    actions: [{ id: "deny", label: "Discard" }],
  };
}

function mailBatchTitle(rows: readonly MailBatchCardRow[]): string {
  const fresh = rows.filter((row) => row.newEmail).length;
  const replies = rows.length - fresh;
  return [
    fresh === 1 ? "1 new email" : fresh > 1 ? `${fresh} new emails` : "",
    replies === 1 ? "1 reply" : replies > 1 || rows.length === 0 ? `${replies} replies` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function webFetchSite(toolName: string, args: Record<string, unknown>): string | undefined {
  return SITE_GATED_TOOLS.has(toolName) && typeof args.url === "string"
    ? urlSite(args.url)
    : undefined;
}

/**
 * The inline request to allow AI data sharing for mail. It is an approval card, so it pauses the
 * run and the owner's answer resumes it. "Allow" records consent for the recipient named in the
 * effect (never the card), at this disclosure version.
 */
export function buildConsentAskBlock(
  effectId: string,
  recipient?: { name: string; detail?: string },
): MessageBlock {
  // "OpenRouter (https://...)" -> "OpenRouter"; a gateway with no model id has nothing to name.
  const provider = recipient?.name.replace(/ \(.*\)$/, "").trim();
  const model = recipient?.detail?.startsWith("Forwards")
    ? ""
    : modelLabel(recipient?.detail ?? "");
  const named = Boolean(provider && model);
  return {
    kind: "ask",
    approvalEffectId: effectId,
    text: named
      ? `Let ${model} (${provider}) see this agent's chats and mail?`
      : "Share your chats and mail with the AI model that runs your bots?",
    // The clause says the permission is standing, not for this one read.
    detail: `${named ? "This agent uses a model you haven't allowed yet. Models you already allowed are unaffected. " : ""}${AI_DATA_DISCLOSURES.model} This stays on until you turn it off in Settings under Privacy and approvals.`,
    consent: { version: AI_DISCLOSURE_VERSION },
    status: "pending",
    actions: [
      { id: "allow", label: "Allow" },
      { id: "deny", label: "Not now" },
    ],
  };
}

/** The label of the one allow button on a desktop app card; it covers the rest of the run in that app. */
export const DESKTOP_APP_ALLOW_LABEL = "Allow for this run";

/**
 * The first action in an app on the owner's computer (docs/local-desktop-control). Allow covers
 * that app for this run only, so there is no "Always allow".
 */
export function buildDesktopAppAskBlock(
  effectId: string,
  appName: string,
  computerWord: "Mac" | "computer",
  secrets: string[],
): MessageBlock {
  return {
    kind: "ask",
    approvalEffectId: effectId,
    text: redactSecrets(
      `Use ${sanitizeMessagingLabel(appName).replace(CARD_TITLE_ESCAPED, "\\$&")} on this ${computerWord}`,
      secrets,
    ),
    status: "pending",
    actions: [
      { id: "allow", label: DESKTOP_APP_ALLOW_LABEL },
      { id: "deny", label: "Deny" },
    ],
  };
}

/**
 * The Carta, Inbox and email agents' mail_send: always asks, never from a saved rule or Auto Review, so
 * the founder sees the whole message on a card before investor or customer mail goes out.
 */
export const isCartaMailSend = (botSpawnKey: string | null | undefined, toolName: string) =>
  toolName === "mail_send" &&
  (isCartaAgentSpawnKey(botSpawnKey) ||
    isInvestorsAgentSpawnKey(botSpawnKey) ||
    isMailAgentSpawnKey(botSpawnKey));

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
  if (isGtmAgentSpawnKey(botSpawnKey)) {
    if (route?.connectorId !== "mcp" || !isZernioEndpoint(route.endpoint)) return false;
    return !isReadTool(
      { name: route.toolName ?? "", annotations: { readOnlyHint: readOnly } },
      integrationPresetForEndpoint(route.endpoint),
    );
  }
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
  // A connected-app account or a directly connected source: every change shows the full call.
  return (
    (Boolean(route?.connectionId) || route?.connectorId === "installed") &&
    route?.connectorId !== "mcp" &&
    readOnly !== true
  );
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
/** A money request as labelled rows: what, to whom, from where. No tool id and no raw JSON. */
function moneyDetail(
  args: Record<string, unknown>,
  names: MoneyNames | undefined,
  reviewReason?: string,
): string {
  const lines = reviewReason?.trim() ? [reviewReason.trim()] : [];
  lines.push(
    `Amount: ${args.amount == null ? "not given" : formatAmount(args.amount, args.currency)}`,
    `To: ${names?.recipient ?? String(args.recipientId ?? "not given")}`,
    `From account: ${names?.account ?? String(args.accountId ?? "not given")}`,
  );
  for (const key of ["note", "memo", "externalMemo"])
    if (typeof args[key] === "string" && args[key]) lines.push(`Note: ${args[key]}`);
  return lines.join("\n");
}

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
    ...(brexCardsPreview(rawTool, args) ?? [`arguments: ${JSON.stringify(args, null, 2)}`]),
  );
  return lines.join("\n");
}

// Brex names, merchants and memos are text from outside Rakazo: quoted with their newlines
// escaped, so they stay on one line of the card and cannot pass for the card's own wording.
const quoted = (value: string) => JSON.stringify(value);
const flat = (value: string) => value.replace(/\s+/g, " ").trim();
const words = (value: string) => value.toLowerCase().replace(/_/g, " ");
const dollars = (cents: number) => `${formatAmount(cents / 100, "USD")} USD`;
const person = (m: { userId: string; name: string }) => `${quoted(m.name)} (${flat(m.userId)})`;
const people = (list: { userId: string; name: string }[]) =>
  list.length ? list.map(person).join(", ") : "none";
const merchants = (list: string[] | null) =>
  list ? list.map(quoted).join(", ") : "none (cleared)";

/**
 * The change a Brex cards write makes, in words, built only from its own arguments (the same
 * schema the server checks). Returns undefined when the tool is not a Brex write or the arguments
 * do not match, so the card falls back to the generic rendering.
 */
function brexCardsPreview(rawTool: string, args: Record<string, unknown>): string[] | undefined {
  if (!Object.hasOwn(BREX_CARDS_WRITE_ARGS, rawTool)) return undefined;
  const tool = rawTool as keyof typeof BREX_CARDS_WRITE_ARGS;
  const parsed = BREX_CARDS_WRITE_ARGS[tool].safeParse(args);
  if (!parsed.success) return undefined;
  const a = parsed.data as Record<string, any>;
  const card = () => `Card: ${quoted(a.cardName)} ••${a.lastFour} (${flat(a.cardId)})`;
  const optional = (label: string, value: unknown, text?: string) =>
    value === undefined ? [] : [`${label}: ${text ?? value}`];
  switch (tool) {
    case "create_vendor_card":
      return [
        "Create virtual vendor card",
        `Card: ${quoted(a.cardName)}`,
        `Owner: ${person({ userId: a.ownerUserId, name: a.ownerName })}`,
        `Limit: ${dollars(a.amountCents)}, ${words(a.duration)}`,
        ...optional("Allowed merchants", a.allowedMerchants, merchants(a.allowedMerchants)),
        ...optional("Blocked merchants", a.blockedMerchants, merchants(a.blockedMerchants)),
        ...optional("Locks after", a.lockAfterDate),
      ];
    case "update_card":
      return [
        "Update card",
        card(),
        ...optional("Limit", a.amountCents, a.amountCents && dollars(a.amountCents)),
        ...optional("Period", a.duration, a.duration && words(a.duration)),
        ...optional("Locks after", a.lockAfterDate, a.lockAfterDate ?? "none (cleared)"),
        ...optional("Allowed merchants", a.allowedMerchants, merchants(a.allowedMerchants)),
        ...optional("Blocked merchants", a.blockedMerchants, merchants(a.blockedMerchants)),
      ];
    case "lock_card":
      return ["Lock card", card(), `Reason: ${words(a.reason)}`];
    case "terminate_card":
      return [
        "Terminate card permanently. This cannot be undone.",
        card(),
        `Reason: ${words(a.reason)}`,
      ];
    case "create_spend_limit":
      return [
        "Create spend limit",
        `Name: ${quoted(a.name)}`,
        `Limit: ${dollars(a.amountCents)}, ${words(a.period)}`,
        ...optional("Starts", a.startDate),
        ...optional("Ends", a.endDate),
        `Template: ${quoted(a.templateName)} (${flat(a.templateSpendLimitId)})`,
        `Members: ${people(a.members)}`,
      ];
    case "update_spend_limit":
      return [
        "Update spend limit",
        `Spend limit: ${quoted(a.spendLimitName)} (${flat(a.spendLimitId)})`,
        ...optional("Limit", a.amountCents, a.amountCents && dollars(a.amountCents)),
        ...optional("Ends", a.endDate),
        ...optional("Status", a.status, a.status && words(a.status)),
        ...optional("Add members", a.addMembers, a.addMembers && people(a.addMembers)),
        ...optional("Remove members", a.removeMembers, a.removeMembers && people(a.removeMembers)),
      ];
    case "update_expense_memo":
      return [
        "Replace expense memo",
        `Expense: ${flat(a.expenseId)}`,
        `New memo: ${quoted(a.memo)}`,
      ];
  }
}

/** Who, on which line, and the whole text. */
function imessageSendDetail(
  args: Record<string, unknown>,
  target: { recipient: string; line: string; disclosure?: string },
  reviewReason?: string,
): string {
  const lines = reviewReason?.trim() ? [reviewReason.trim()] : [];
  lines.push(`to: ${target.recipient}`, `line: ${target.line}`);
  if (target.disclosure) lines.push(`first message also sends: ${target.disclosure}`);
  lines.push(`text: ${String(args.text ?? "")}`);
  return lines.join("\n");
}

/**
 * Every bare address behind a recipient list, parsed as the sender parses it, so one entry holding
 * several addresses shows them all. The model writes display names, and a name can say anything. An
 * entry that does not parse is shown whole.
 */
const bareAddresses = (value: unknown): string[] =>
  strings(value).flatMap((entry) => {
    try {
      return parseRecipients(entry).map((parsed) => parsed.address);
    } catch {
      return [entry];
    }
  });

/**
 * The sending account, every recipient (Bcc included) as a bare address, the subject, the whole
 * body, and the flags a new email earns. The model writes display names, so none is shown.
 */
function fullMailDetail(
  args: Record<string, unknown>,
  reviewReason?: string,
  account?: string,
  newRecipient = true,
): string {
  const lines = reviewReason?.trim() ? [reviewReason.trim()] : [];
  const from = typeof args.account === "string" && args.account ? args.account : account;
  if (from) lines.push(`from: ${from}`);
  for (const key of ["to", "cc", "bcc"]) {
    const list = bareAddresses(args[key]);
    lines.push(`${key}: ${list.length ? list.join(", ") : "(none)"}`);
  }
  const body = String(args.body ?? "");
  lines.push(`subject: ${String(args.subject ?? "")}`, `body: ${body}`);
  const flags = [
    ...(newRecipient ? [MAIL_REPLY_FLAG_TEXT.new_recipient] : []),
    ...(bodyHasLink(body) ? [MAIL_REPLY_FLAG_TEXT.has_link] : []),
  ];
  if (flags.length) lines.push(`flags: ${flags.join(", ")}`);
  return lines.join("\n");
}

/** A bank's request to send money, whichever server slug the tool sits under. */
export const isSendMoney = (toolName: string) => /(^|__)requestSendMoney$/.test(toolName);

export type MoneyNames = { recipient?: string; account?: string };

/**
 * The names behind a send-money request's recipientId and accountId, read with the provider's own
 * read tools through `read`. A failed or empty lookup leaves that name out, so the headline shows that id instead. The caller caches lookups for the same id.
 */
export async function resolveMoneyNames(
  toolName: string,
  args: Record<string, unknown>,
  read: (tool: "getRecipient" | "getAccount", args: Record<string, string>) => Promise<unknown>,
): Promise<MoneyNames | undefined> {
  if (!isSendMoney(toolName)) return undefined;
  const nameOf = async (tool: "getRecipient" | "getAccount", key: string, id: unknown) => {
    if (typeof id !== "string" || !id) return undefined;
    try {
      const row = (await read(tool, { [key]: id })) as Record<string, unknown> | undefined;
      // An account goes by its nickname; a payee by its legal name.
      const name = tool === "getAccount" ? row?.nickname || row?.name : row?.name || row?.nickname;
      return typeof name === "string" && name.trim() ? name.trim() : undefined;
    } catch {
      return undefined;
    }
  };
  const [recipient, account] = await Promise.all([
    nameOf("getRecipient", "recipientId", args.recipientId),
    nameOf("getAccount", "accountId", args.accountId),
  ]);
  return { recipient, account };
}

/** What the approval is for, in words; never a raw tool name for mail. */
export function describeApprovalAction(
  toolName: string,
  args: Record<string, unknown>,
  serviceName?: string,
  moneyNames?: MoneyNames,
): string {
  if (isSendMoney(toolName)) {
    const amount = args.amount == null ? "money" : formatAmount(args.amount, args.currency);
    // A failed lookup shows the id, never a vague "a recipient".
    const idOf = (id: unknown, fallback: string) => (typeof id === "string" && id ? id : fallback);
    return `Send ${amount} to ${moneyNames?.recipient ?? idOf(args.recipientId, "a recipient")} from ${moneyNames?.account ?? idOf(args.accountId, "an account")}`;
  }
  if (toolName === "mail_send" || toolName === "mail_draft") {
    const [first, ...rest] = strings(args.to);
    const to = first ? ` to ${first}${rest.length ? ` and ${rest.length} more` : ""}` : "";
    return toolName === "mail_send" ? `sending email${to}` : `saving a draft${to}`;
  }
  if (toolName === "imessage_send") {
    const to = typeof args.to === "string" && args.to ? args.to : "a conversation";
    return `sending iMessage to ${to}`;
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
  if (toolName === "fundraising_round_save") {
    return `${args.id ? "Change" : "Start"} round “${args.name ? String(args.name) : "Untitled"}”`;
  }
  const target = webFetchSite(toolName, args) ?? pickScopeLabel(args);
  const label = serviceName
    ? `${serviceName}: ${humanizeToolName(toolName)}`
    : humanizeToolName(toolName);
  return target ? `${label} → ${target}` : label;
}

/** Tools whose title and detail are written by hand; every other card shows the exact tool id. */
const HAND_WRITTEN_TOOLS = new Set([
  "mail_send",
  "mail_draft",
  "mail_reply_batch",
  "imessage_send",
  "destination.write",
  "delete_bot",
  "archive_bot",
  "create_space",
  "contacts_save",
  "fundraising_round_save",
  "page_create",
  "page_write",
  "page_edit",
  "remember",
  "save_memory",
  PIPELINE_IMPORT_REVIEW_TOOL,
]);

/** The scope an email thread agent's read asks about, so the card shows what would be looked up. */
const READ_SCOPE_KEYS: Record<string, string[]> = {
  search_data_room: ["query", "filters"],
  read_data_room_item: ["item_id"],
  contacts_list: ["query", "kind"],
};

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
  if (toolName === "fundraising_round_save") {
    for (const [label, key] of [
      ["Name", "name"],
      ["Target", "targetUsd"],
      ["Post-money cap", "postMoneyCapUsd"],
    ] as const) {
      const value = args[key];
      if (value == null || value === "") continue;
      lines.push(`${label}: ${key === "name" ? String(value) : formatAmount(value, "USD")}`);
    }
    return lines.join("\n") || undefined;
  }
  // What the card shows of these calls, so the person sees the text they approve.
  const toolFields: Record<string, readonly (readonly [string, string])[]> = {
    remember: [
      ["content", "content"],
      ["path", "path"],
    ],
    save_memory: [
      ["content", "content"],
      ["path", "path"],
    ],
    page_edit: [["page", "page"]],
    page_write: [
      ["page", "page"],
      ["content", "content"],
    ],
    page_create: [
      ["title", "title"],
      ["kind", "kind"],
    ],
  };
  if (toolName === "page_edit") {
    const oldText = typeof args.old_string === "string" ? args.old_string : "";
    const newText = typeof args.new_string === "string" ? args.new_string : "";
    let prefix = 0;
    while (
      prefix < oldText.length &&
      prefix < newText.length &&
      oldText[prefix] === newText[prefix]
    )
      prefix++;
    let suffix = 0;
    while (
      suffix < oldText.length - prefix &&
      suffix < newText.length - prefix &&
      oldText[oldText.length - 1 - suffix] === newText[newText.length - 1 - suffix]
    )
      suffix++;
    const removed = oldText.slice(prefix, oldText.length - suffix).trim();
    const added = newText.slice(prefix, newText.length - suffix).trim();
    const page = args.page;
    if (page != null && page !== "") lines.push(`page: ${String(page)}`);
    if (removed) lines.push(`Removes: ${removed}`);
    if (added) lines.push(`Adds: ${added}`);
    return lines.length === 0 ? undefined : lines.join("\n");
  }
  const readKeys = READ_SCOPE_KEYS[toolName];
  const fields = toolFields[toolName];
  if (readKeys || fields) {
    for (const [label, key] of fields ?? readKeys!.map((key) => [key, key] as const)) {
      const text = argumentText(args[key]);
      if (text) lines.push(`${label}: ${readKeys ? truncate(text, 300) : text}`);
    }
  } else {
    // Any argument may name who or where a call reaches, so the card shows them all. A fetch
    // carries data in its path and query, so the whole URL leads.
    const leading = SITE_GATED_TOOLS.has(toolName)
      ? ["url"]
      : toolName === "contacts_save"
        ? ["name", "email", "organization", "kind", "notes"]
        : ["collection", "title", "to", "subject", "amount", "body", "message", "range"];
    lines.push(...argumentLines(args, leading));
  }
  if (lines.length === 0) return undefined;
  return lines.join("\n");
}

/** Longer text goes below the short values, so recipients and places always come first. */
const SHORT_ARGUMENT_LENGTH = 200;

/**
 * Every argument as a `key: value` line, the leading keys first: short values, then long lists and
 * objects, then long text such as a message body, which the card's length limit cuts first.
 */
function argumentLines(args: Record<string, unknown>, leading: readonly string[]): string[] {
  const short: string[] = [];
  const structured: string[] = [];
  const long: string[] = [];
  const keys = [...leading.filter((key) => key in args), ...Object.keys(args)];
  for (const key of new Set(keys)) {
    const value = args[key];
    const text = argumentText(value);
    if (!text) continue;
    const line = `${key}: ${text}`;
    if (text.length <= SHORT_ARGUMENT_LENGTH) short.push(line);
    else (typeof value === "string" ? long : structured).push(line);
  }
  return [...short, ...structured, ...long];
}

function argumentText(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value) && value.every((item) => item === null || typeof item !== "object"))
    return value.map(String).join(", ");
  return JSON.stringify(value) ?? "";
}

/** Redacts every string inside a value, since JSON escaping could hide a secret from the card. */
function redactLeaves(value: unknown, secrets: string[]): unknown {
  if (typeof value === "string") return redactSecrets(value, secrets);
  if (Array.isArray(value)) return value.map((item) => redactLeaves(item, secrets));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, redactLeaves(item, secrets)]),
    );
  return value;
}

const CALENDAR_READS = new Set(["calendar_agenda", "calendar_list_events"]);

/**
 * What the card shows of a call: message_bot as recipient name plus the first line of the message,
 * a calendar read as one readable range (its `to` is a time, not a recipient).
 */
function summaryArgs(
  toolName: string,
  args: Record<string, unknown>,
  recipientBot?: string,
  timezone?: string | null,
): Record<string, unknown> {
  if (toolName === "message_bot") {
    const message = typeof args.message === "string" ? args.message.trim().split(/\r?\n/)[0] : "";
    return {
      ...args,
      to: (recipientBot
        ? sanitizeMessagingLabel(recipientBot)
        : typeof args.bot_id === "string"
          ? args.bot_id
          : undefined
      )?.replace(CARD_TITLE_ESCAPED, "\\$&"),
      message: message ? truncate(message, 200) : undefined,
    };
  }
  if (CALENDAR_READS.has(toolName)) {
    const [from, to] =
      toolName === "calendar_agenda" ? [args.from, args.to] : [args.timeMin, args.timeMax];
    const { from: _f, to: _t, timeMin: _a, timeMax: _b, ...rest } = args;
    const part = (value: unknown) => (typeof value === "string" && value ? value : undefined);
    const f = part(from);
    const t = part(to);
    const range =
      f && t
        ? `${readableTime(f, timezone)} to ${readableTime(t, timezone)}`
        : f
          ? `from ${readableTime(f, timezone)}`
          : t
            ? `until ${readableTime(t, timezone)}`
            : undefined;
    return { ...rest, range };
  }
  return args;
}

function readableTime(value: string, timezone?: string | null): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const format = (timeZone: string) =>
    date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
      timeZone,
    });
  try {
    return format(timezone || "UTC");
  } catch {
    return format("UTC");
  }
}

function pickScopeLabel(args: Record<string, unknown>): string | undefined {
  for (const key of ["to", "title", "collection", "subject", "amount", "range"]) {
    const value = args[key];
    if (value == null || value === "") continue;
    return key === "amount" ? formatAmount(value, args.currency) : String(value);
  }
  return undefined;
}

/** "1200" becomes "$1,200.00"; a value that is not a number, or an unknown currency, stays as written. */
function formatAmount(value: unknown, currency: unknown): string {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number) || typeof value === "boolean") return String(value);
  const code = typeof currency === "string" && /^[A-Za-z]{3}$/.test(currency) ? currency : "USD";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
    }).format(number);
  } catch {
    return String(value);
  }
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
  choices?: MailApproval["choices"],
  bare = false,
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
    ...(choices?.length ? { choices } : {}),
    to: (bare ? bareAddresses(args.to) : strings(args.to)).map((item) =>
      redactSecrets(item, secrets),
    ),
    cc: (bare ? bareAddresses(args.cc) : strings(args.cc)).map((item) =>
      redactSecrets(item, secrets),
    ),
    bcc: (bare ? bareAddresses(args.bcc) : strings(args.bcc)).map((item) =>
      redactSecrets(item, secrets),
    ),
    subject: text(args.subject),
    body,
    ...(typeof args.replyToId === "string" && args.replyToId.trim() ? { reply: true } : {}),
    // Replacing a saved draft is not something the card can edit.
    ...(typeof args.draftId === "string" && args.draftId.trim() ? { locked: true } : {}),
  };
}

/** Edits as stored on the call: recipients parsed to address lists. */
export type NormalizedMailEdits = {
  account?: string;
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
        ...(edits.account?.trim() ? { account: edits.account.trim() } : {}),
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
