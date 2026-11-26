import type {
  ApprovalActionType,
  ApprovalChoice,
  PermissionLevel,
  ActionApprovalRule as StoredActionApprovalRule,
} from "@rakazo/contracts";
import { APPROVAL_ACTION_TYPE_IDS } from "@rakazo/contracts";

export const APPROVAL_EXEMPT_TOOLS: ReadonlySet<string> = new Set([
  "computer_observe",
  "computer_act",
  "browser_navigate",
  "browser_snapshot",
  "browser_act",
  "list_files",
  "read_file",
  "read_history",
  "search_history",
  "write_file",
  "shell",
  "open_path",
  "launch_app",
  "remember",
  "request_takeover",
  "request_secret",
  "run_subagent",
  "spawn_bot",
  "schedule_list",
  "calendar_agenda",
  "schedule_cancel",
  "schedule_runs",
  // A pure function in a sandbox with no I/O, and only the source the owner approved (hash-checked).
  "tool_run",
]);
// schedule_create and schedule_update are not listed: they ask only for repeating schedules, which
// depends on the call's arguments, so the executor decides (see scheduleApproval in the adapters).

const APPROVAL_REQUIRED_BUILTIN_TOOLS = new Set([
  "destination.write",
  "delete_bot",
  "archive_bot",
  "secret_request",
  "forget_secret",
  "forget_memory",
  "cloud_agent_launch",
  "cloud_agent_reply",
  "cloud_agent_cancel",
  "mail_draft",
  "mail_modify",
  "mail_send",
  "mail_reply_batch",
  "calendar_create_event",
  "calendar_update_event",
  "calendar_delete_event",
  "drive_create_file",
  "drive_update_file",
  "contacts_save",
]);
/** Built-in mail tools that write; the "email" approval category covers them. */
const BUILTIN_MAIL_WRITE_TOOLS = new Set([
  "mail_draft",
  "mail_modify",
  "mail_send",
  "mail_reply_batch",
]);
/** Cannot be auto-reviewed or permanently allowed. imessage_send is a message to a person from the user's agent line. */
const EXPLICIT_APPROVAL_BUILTIN_TOOLS = new Set([
  // The owner grants a capability; a saved rule or Auto Review would grant every later request.
  "request_access",
  "respond_agent_connection",
  // The owner's own card per app per run (docs/local-desktop-control); never a saved rule.
  "desktop_app_act",
  "create_space",
  "imessage_send",
  "company_fact_upsert",
  "company_import_start",
  // Hands a meeting to another agent; a card every time, also when the owner is chatting.
  "share_meeting",
  // Several replies on one card, sent only by the owner's press. Its card has no Allow to save.
  "mail_reply_batch",
  // Writes to the owner's fundraising records. A spreadsheet or email the agent read is untrusted,
  // so no saved Allow rule or Auto Review may pass them.
  "fundraising_round_save",
  // One card for a whole list, applied only by the owner's press. Its card has no Allow to save.
  "pipeline_import_review",
]);

const UNATTENDED_SAFE_BUILTIN_TOOLS = new Set([
  "browser_snapshot",
  "cloud_agent_status",
  "computer_observe",
  "list_files",
  "list_secrets",
  "read_file",
  "recall_memory",
  "request_takeover",
  "run_subagent",
  "task_catalog",
  "schedule_list",
  "schedule_runs",
  "scratchpad_list",
  "board_tickets",
  "search_data_room",
  "read_data_room_item",
  "company_search",
  "company_get",
  "timeline_query",
  "calendar_query",
  "read_spreadsheet",
  "skill_read",
  // The owner's own company sections; the executor refuses it once the run is tainted.
  "company_context_lookup",
  // Reads of this bot's own thread, pages and pins only (scoped by space, user, bot and thread in
  // the handlers). The executor marks a run that reads meeting-marked history as tainted.
  "read_history",
  "search_history",
  "page_list",
  "page_read",
  "pins_read",
  // The owner's own stored meetings, like mail_get; the text is wrapped and marks the thread.
  "meetings_list",
  "meetings_search",
  "meetings_get",
  // A pure function in a sandbox with no I/O, and only the source the owner approved (hash-checked).
  "tool_run",
  "web_fetch",
  "web_search",
  // The owner's own finance records; the executor asks once the run is tainted.
  "finance_overview",
  "finance_breakdown",
  "finance_transactions",
  "finance_recurring",
  "finance_crypto",
  // Write only inside Rakazo (the owner's own notifications, pages, pins and files).
  // message_user posts a short update into the run's own thread; show_emails renders the owner's
  // own cached mail in their chat and returns no mail text to the run.
  "notify_user",
  "message_user",
  "show_emails",
  "create_ui_artifact",
  "render_ui",
  "attach_file",
  "page_write",
  "page_create",
  "pins_write",
  "page_edit",
  "page_source_set",
  "page_source_remove",
  // Praci's own legal records (reads and upserts in the actor's space and user rows). No mail,
  // posting or connector write. Tainted runs still ask: none of these is in EXTERNAL_TAINT_SAFE_TOOLS
  // or MEETING_TAINT_FREE_TOOLS, and the executor checks taint separately from this gate. Integration-agent
  // writes (requiresMandatoryApproval), Company tools, bot tool switches and space rules are unaffected.
  "legal_unreviewed_documents",
  "legal_query",
  "legal_upsert_contract",
  "legal_upsert_deadline",
  "legal_upsert_node",
  "legal_link",
  // Reads from the owner's own connected Google mail, Drive and calendar, and their contacts. Each
  // is a GET (or a read of Praci's synced cache), with no send, draft, label, move, share or delete.
  // mail_search only stores its own continuation record in Praci. Tainted runs still ask, as above.
  "mail_search",
  "mail_grep",
  "mail_get",
  "inbox_overview",
  "drive_search",
  "drive_read",
  "calendar_agenda",
  "calendar_list_events",
  "calendar_get_event",
  "contacts_list",
]);

/**
 * Scratchpad writes are safe unattended unless the item is in a category the scratchpad itself
 * gates (public_post, create_account, outbound_email; packages/adapters/src/scratchpad-tools.ts).
 * scratchpad_add carries the category in its args. scratchpad_update and scratchpad_complete
 * address an item by id, so the executor must put the stored item's category in `args.category`
 * before asking; with no category they fail closed and ask.
 */
const UNATTENDED_SCRATCHPAD_TOOLS = new Set([
  "scratchpad_add",
  "scratchpad_update",
  "scratchpad_complete",
]);
const GATED_SCRATCHPAD_CATEGORIES = new Set(["public_post", "create_account", "outbound_email"]);

const READ_ONLY_CONNECTOR_PATTERN = /(^|_)(get|list|search|find|read)(_|$)/i;
const MUTATING_CONNECTOR_PATTERN =
  /(^|_)(accept|add|approve|archive|assign|buy|cancel|charge|checkout|close|commit|copy|create|delete|deploy|disable|enable|execute|forward|grant|invite|link|mark|merge|modify|move|patch|pay|post|publish|purchase|put|register|reject|remove|rename|replace|reply|reset|revoke|run|schedule|send|set|share|start|stop|submit|subscribe|trigger|unassign|unlink|unsubscribe|update|upload|upsert|write)(_|$)/i;
const COMPOUND_CONNECTOR_ACTION_PATTERN = /_(and|or|then)_/i;

const EMAIL_CONNECTOR_SLUGS = new Set(["gmail", "outlook", "microsoft_outlook"]);
const PURCHASE_CONNECTOR_SLUGS = new Set(["stripe", "shopify", "paypal", "square"]);
const CALENDAR_CONNECTOR_SLUGS = new Set([
  "googlecalendar",
  "google_calendar",
  "calendar",
  "outlook_calendar",
  "calendly",
]);
const MESSAGING_CONNECTOR_SLUGS = new Set([
  "slack",
  "discord",
  "telegram",
  "whatsapp",
  "twilio",
  "sms",
]);

export type ActionApprovalRule = Pick<
  StoredActionApprovalRule,
  "effect" | "matchKind" | "matchValue"
> & {
  /** null or absent: a space-wide rule. A bot id: that bot's override. */
  botId?: string | null;
};

export function connectorKindFromToolName(toolName: string, connectorKinds: string[] = []): string {
  const normalizedTool = toolName.toLowerCase();
  const matched = connectorKinds
    .map((kind) => kind.toLowerCase())
    .filter((kind) => normalizedTool === kind || normalizedTool.startsWith(`${kind}_`))
    .sort((left, right) => right.length - left.length)[0];
  if (matched) return matched;
  const [segment] = toolName.split("_");
  return (segment ?? toolName).toLowerCase();
}

/**
 * `readOnly` is the connector tool's declared effect (for installed APIs, derived from the stored
 * HTTP method and read-only flag). A declared write always needs approval. A declared read never
 * relaxes the name check: the provider chooses both the name and the hint.
 */
export function connectorToolRequiresApproval(toolName: string, readOnly?: boolean): boolean {
  if (readOnly === false) return true;
  if (MUTATING_CONNECTOR_PATTERN.test(toolName)) return true;
  if (COMPOUND_CONNECTOR_ACTION_PATTERN.test(toolName)) return true;
  return !READ_ONLY_CONNECTOR_PATTERN.test(toolName);
}

export function toolRequiresApproval(
  toolName: string,
  viaConnector: boolean,
  readOnly?: boolean,
): boolean {
  if (APPROVAL_EXEMPT_TOOLS.has(toolName)) return false;
  if (toolRequiresExplicitApproval(toolName)) return true;
  if (APPROVAL_REQUIRED_BUILTIN_TOOLS.has(toolName)) return true;
  if (viaConnector) return connectorToolRequiresApproval(toolName, readOnly);
  return false;
}

/** Security-boundary changes cannot be auto-reviewed or permanently allowed. */
export function toolRequiresExplicitApproval(toolName: string): boolean {
  return EXPLICIT_APPROVAL_BUILTIN_TOOLS.has(toolName);
}

function scratchpadWriteIsGated(toolName: string, args?: Record<string, unknown>): boolean {
  const category = args?.category;
  if (toolName === "scratchpad_add" && category === undefined) return false;
  return typeof category !== "string" || GATED_SCRATCHPAD_CATEGORIES.has(category);
}

/**
 * Tools that stay free in a run whose prompt carried outside content (webhook, messaging,
 * watches, or a meeting/external bot message). They write only inside Rakazo or to the owner,
 * never to the outside. Not included: web_fetch, web_search, data room and company reads, which
 * can carry private data out. Use `externalTaintAllowsTool` for the scratchpad's category rule.
 */
export const EXTERNAL_TAINT_SAFE_TOOLS: ReadonlySet<string> = new Set([
  "ask_user",
  "skill_read",
  // Pure function, no I/O, hash-checked: it cannot carry tainted input out of Praci.
  "tool_run",
  "notify_user",
  "scratchpad_list",
  "board_tickets",
  "ticket_get",
  "scratchpad_add",
  "scratchpad_update",
  "scratchpad_complete",
  "create_ui_artifact",
  "render_ui",
  "page_write",
  "page_source_set",
  "page_source_remove",
  "page_create",
  "pins_write",
  "attach_file",
  "recall_memory",
  // Metadata reads that return names and schedules only, never values.
  "task_catalog",
  "schedule_list",
  "schedule_runs",
  "list_secrets",
]);

/**
 * Built-in reads that ask in a background run only because they are not on the safe list: they
 * return the owner's private records, which a run holding outside text could send out. A routine
 * run that has read nothing from outside (and was not started by a webhook) may let Auto Review
 * judge them instead of asking. Nothing here writes, sends or reaches the network.
 */
export const ROUTINE_AUTO_REVIEW_READ_TOOLS: ReadonlySet<string> = new Set([
  "cap_table_read",
  "fundraising_read",
  "ticket_get",
]);

const ROUTINE_ALWAYS_EXCLUDED_ACTION_TYPES: ReadonlySet<ApprovalActionType> = new Set([
  "send_email",
  "spend_money",
  "message_outside",
  "use_credentials",
  "delete_data",
]);

/**
 * True when a background card for the tool may offer "Always for this routine". Sends, payments,
 * outside messages, credentials, deletes, hard lines and tools that need an explicit approval never do.
 */
export function routineAlwaysAllowable(input: {
  toolName: string;
  viaConnector?: boolean;
  connectorKind?: string;
  readOnly?: boolean;
  args?: Record<string, unknown>;
}): boolean {
  if (toolRequiresExplicitApproval(input.toolName) || hardLineFor(input)) return false;
  if (input.toolName === "mail_send" || input.toolName === "mail_draft") return false;
  const type = actionTypeForTool(input);
  return type === null || !ROUTINE_ALWAYS_EXCLUDED_ACTION_TYPES.has(type);
}

/**
 * Tools Auto Review never judges in a background run, whatever the owner switched on: they change
 * what later runs do (schedules, skills, watches, memory), send, post or spend, or are mandatory.
 */
export const BACKGROUND_REVIEW_EXCLUDED_TOOLS: ReadonlySet<string> = new Set([
  "mail_send",
  "message_outside",
  "message_bot",
  "gtm_post",
  "remember",
  "save_memory",
  "save_shared_memory",
  "forget_memory",
  // Change what the agents are or can reach.
  "add_mcp_server",
  "spawn_bot",
  "update_bot",
]);
const BACKGROUND_REVIEW_EXCLUDED_PREFIXES = ["schedule_", "skill_", "watch_", "cloud_agent_"];
/** The tools in the list above and its prefixes: nothing lifts their card in a background run. */
export function isBackgroundExcludedTool(name: string): boolean {
  return (
    BACKGROUND_REVIEW_EXCLUDED_TOOLS.has(name) ||
    BACKGROUND_REVIEW_EXCLUDED_PREFIXES.some((prefix) => name.startsWith(prefix))
  );
}
const BACKGROUND_REVIEW_EXCLUDED_ACTION_TYPES: ReadonlySet<ApprovalActionType> = new Set([
  ...ROUTINE_ALWAYS_EXCLUDED_ACTION_TYPES,
  "calendar_changes",
  "use_computer",
  "files_and_commands",
]);

/**
 * True when Auto Review may judge a call in an unattended run: the owner turned on "Also in
 * background runs", nothing outside is in the run, a person's own words (never a webhook, bot or
 * channel message) say what the run is for, and the tool is not one of the excluded kinds.
 */
export function backgroundAutoReviewAllowed(input: {
  enabled: boolean;
  trigger?: string;
  tainted: boolean;
  outsideContentSeen: boolean;
  meetingMarked: boolean;
  firewalled: boolean;
  externalBot: boolean;
  ownerWords: string;
  toolName: string;
  viaConnector?: boolean;
  connectorKind?: string;
  readOnly?: boolean;
  args?: Record<string, unknown>;
}): boolean {
  if (!input.enabled || input.trigger === "webhook") return false;
  if (
    input.tainted ||
    input.outsideContentSeen ||
    input.meetingMarked ||
    input.firewalled ||
    input.externalBot
  ) {
    return false;
  }
  if (!input.ownerWords.trim()) return false;
  const name = input.toolName;
  if (
    toolRequiresExplicitApproval(name) ||
    BACKGROUND_REVIEW_EXCLUDED_TOOLS.has(name) ||
    hardLineFor(input)
  ) {
    return false;
  }
  if (BACKGROUND_REVIEW_EXCLUDED_PREFIXES.some((prefix) => name.startsWith(prefix))) return false;
  const type = actionTypeForTool(input);
  return type === null || !BACKGROUND_REVIEW_EXCLUDED_ACTION_TYPES.has(type);
}

/**
 * Internal writes of a Firewall agent that Auto Review may pass, but only after
 * `contentHasOutboundChannel` finds nothing in the arguments. Owner decision: this lifts the
 * Firewall plan's rule that its asks never clear without a person, for these tools only.
 */
export const FIREWALL_JUDGEABLE_WRITES: ReadonlySet<string> = new Set([
  "page_edit",
  "page_write",
  "page_create",
  "pins_write",
]);

const OUTBOUND_CHANNEL_PATTERNS = [
  /https?:\/\/|\/\/[\w-]+\.[a-z]{2,}|\bwww\./i,
  /!?\[[^\]]*\]\([^)]*\)|!\[|\]\[/,
  /<\/?[a-z!][^>]*>/i,
  /\b[\w-]+\.(com|org|net|io|ai|dev|app|co|me|ly|xyz|info|gg|sh)\b/i,
];

/**
 * True when any string in the arguments holds a URL, a Markdown image or link, an HTML tag or a
 * bare domain: each can carry data out when a page or memory is rendered or fetched. Scans every
 * string, including keys.
 */
export function contentHasOutboundChannel(value: unknown): boolean {
  if (typeof value === "string") {
    return OUTBOUND_CHANNEL_PATTERNS.some((pattern) => pattern.test(value));
  }
  if (Array.isArray(value)) return value.some(contentHasOutboundChannel);
  if (value && typeof value === "object") {
    return Object.entries(value).some(
      ([key, item]) => contentHasOutboundChannel(key) || contentHasOutboundChannel(item),
    );
  }
  return false;
}

const HTML_TAG = /<\/?[a-z!][^>]*>/i;

const OUTBOUND_TOKEN_PATTERNS = [
  /(?:https?:)?\/\/[^\s)>\]"']+/gi,
  /\bwww\.[^\s)>\]"']+/gi,
  /!?\[[^\]]*\]\([^)]*\)/g,
  /!?\[[^\]]*\]\[[^\]]*\]/g,
  /\b[\w-]+\.(?:com|org|net|io|ai|dev|app|co|me|ly|xyz|info|gg|sh)\b[^\s)>\]"']*/gi,
];

/** Every URL, link, image and bare domain in the text, whole, as exact strings. */
function outboundTokens(text: string): Set<string> {
  const found = new Set<string>();
  for (const pattern of OUTBOUND_TOKEN_PATTERNS) {
    for (const match of text.matchAll(pattern)) found.add(match[0]);
  }
  return found;
}

/**
 * True when saving `result` over `original` would put a new or changed URL, link, image or domain
 * on the page, or leave any HTML in it. Comparing the saved result catches an edit that swaps
 * private text into a URL that was already there. An empty original means any URL is new.
 */
export function pageWriteAddsChannel(_original: string, result: string): boolean {
  // Destinations are not compared: any link or image destination in the result asks.
  return (
    HTML_TAG.test(result) ||
    /\]\(|\]\[|^\s{0,3}\[[^\]]+\]:|<|https?:|www\.|data:|mailto:/im.test(result) ||
    outboundTokens(result).size > 0
  );
}

const FIXED_MAIL_LABELS = new Set(["TRASH", "SPAM", "DRAFT", "SENT"]);

/** A mail_modify that names a delete, report or draft label is never judged. */
export function mailModifyTouchesFixedLabel(args: Record<string, unknown>): boolean {
  return [args.addLabels, args.removeLabels].some(
    (list) =>
      Array.isArray(list) &&
      list.some((label) => typeof label === "string" && FIXED_MAIL_LABELS.has(label.toUpperCase())),
  );
}

/** True when a tainted run may call the tool without a card. Same scratchpad rule as unattended. */
export function externalTaintAllowsTool(toolName: string, args?: Record<string, unknown>): boolean {
  if (!EXTERNAL_TAINT_SAFE_TOOLS.has(toolName)) return false;
  return !UNATTENDED_SCRATCHPAD_TOOLS.has(toolName) || !scratchpadWriteIsGated(toolName, args);
}

/**
 * In an unattended run (nobody is watching, or the input comes from outside) a call runs without
 * asking only if it is a read-only connector tool or a safe built-in. Everything else asks.
 * An Allow rule never lifts this; the executor treats the result as a mandatory ask.
 * The one exception is mail_modify: it cannot delete, trash, send or mark spam, and every change
 * (archive, mark read, label) is reversible, so the rules decide. No rule still asks. The executor further requires a rule for the tool
 * itself: a category Allow (send_email) does not run it unattended.
 */
export function unattendedToolRequiresApproval(
  unattended: boolean,
  toolName: string,
  viaConnector: boolean,
  readOnly?: boolean,
  args?: Record<string, unknown>,
): boolean {
  if (!unattended) return false;
  if (viaConnector) return connectorToolRequiresApproval(toolName, readOnly);
  if (toolName === "secret_request") {
    const method = args?.method;
    return !(method === undefined || method === "GET" || method === "HEAD");
  }
  if (UNATTENDED_SCRATCHPAD_TOOLS.has(toolName)) return scratchpadWriteIsGated(toolName, args);
  if (toolName === "mail_modify") return false;
  return !UNATTENDED_SAFE_BUILTIN_TOOLS.has(toolName);
}

/** @deprecated Use unattendedToolRequiresApproval with the stored `Run.unattended`. */
export function unattendedTriggerToolRequiresApproval(
  trigger: string,
  toolName: string,
  viaConnector: boolean,
  readOnly?: boolean,
  args?: Record<string, unknown>,
): boolean {
  return unattendedToolRequiresApproval(
    trigger === "webhook",
    toolName,
    viaConnector,
    readOnly,
    args,
  );
}

export const BLOCKED_ACTION_MESSAGE =
  "The user's approval settings block this action. Do not retry it or try another way to do the same thing; tell the user it is blocked by their settings if it matters.";

/**
 * Action types of the approvals table, in display order.
 * `primary` rows show by default; the rest sit under "More actions".
 */
export const ACTION_TYPES: ReadonlyArray<{
  id: ApprovalActionType;
  defaultEffect: ApprovalChoice;
  primary: boolean;
}> = [
  { id: "send_email", defaultEffect: "ask", primary: true },
  { id: "organize_mail", defaultEffect: "allow", primary: false },
  { id: "spend_money", defaultEffect: "ask", primary: true },
  { id: "connected_apps_write", defaultEffect: "allow", primary: true },
  { id: "calendar_changes", defaultEffect: "allow", primary: true },
  { id: "files_and_commands", defaultEffect: "allow", primary: true },
  { id: "use_computer", defaultEffect: "allow", primary: false },
  { id: "delete_data", defaultEffect: "allow", primary: false },
  { id: "message_outside", defaultEffect: "allow", primary: false },
  { id: "use_credentials", defaultEffect: "allow", primary: false },
];

const ACTION_TYPE_IDS = new Set<string>(APPROVAL_ACTION_TYPE_IDS);
/** Rules saved before the table (seeded for every new space) use these category names. */
const LEGACY_CATEGORY_ALIASES: Record<string, ApprovalActionType> = {
  email: "send_email",
  purchase: "spend_money",
};

/** The action type a rule's category matchValue stands for, or null for any other category. */
export function actionTypeFromCategory(category: string): ApprovalActionType | null {
  const normalized = category.toLowerCase();
  if (ACTION_TYPE_IDS.has(normalized)) return normalized as ApprovalActionType;
  return LEGACY_CATEGORY_ALIASES[normalized] ?? null;
}

const BUILTIN_ACTION_TYPES: Record<string, ApprovalActionType> = {
  mail_send: "send_email",
  mail_reply_batch: "send_email",
  mail_draft: "send_email",
  mail_modify: "organize_mail",
  calendar_create_event: "calendar_changes",
  calendar_update_event: "calendar_changes",
  calendar_delete_event: "calendar_changes",
  write_file: "files_and_commands",
  shell: "files_and_commands",
  open_path: "files_and_commands",
  launch_app: "files_and_commands",
  computer_act: "use_computer",
  desktop_app_act: "use_computer",
  browser_act: "use_computer",
  browser_navigate: "use_computer",
  delete_bot: "delete_data",
  archive_bot: "delete_data",
  forget_memory: "delete_data",
  forget_secret: "delete_data",
  imessage_send: "message_outside",
  secret_request: "use_credentials",
  request_secret: "use_credentials",
  fill_secret: "use_credentials",
};

/**
 * Tool to action type.
 *
 * | Tool                                                                | Action type          |
 * | mail_send, mail_draft; consequential gmail/outlook                  | send_email           |
 * | mail_modify (archive, label, read; Trash, Spam, Drafts, Sent ask)   | organize_mail        |
 * | consequential Stripe/Shopify/PayPal/Square; purchase, pay_, charge, checkout, buy_ names | spend_money |
 * | calendar_create/update/delete_event; consequential calendar connectors | calendar_changes  |
 * | write_file, shell, open_path, launch_app                            | files_and_commands   |
 * | computer_act, browser_act, browser_navigate                         | use_computer         |
 * | delete_bot, archive_bot, forget_memory, forget_secret; connector tools named delete/remove/trash | delete_data |
 * | imessage_send; consequential Slack/Discord/Telegram/WhatsApp/Twilio/SMS connectors | message_outside |
 * | secret_request, request_secret, fill_secret                         | use_credentials      |
 * | any other approval-requiring built-in or consequential connector tool | connected_apps_write |
 * | read-only tools                                                     | null                 |
 *
 * Connector rows apply only when `viaConnector` is true. Purchase and email are checked before
 * the delete pattern, so deleting a Gmail thread is "Send email".
 */
export function actionTypeForTool(input: {
  toolName: string;
  viaConnector?: boolean;
  connectorKind?: string;
  readOnly?: boolean;
  args?: Record<string, unknown>;
}): ApprovalActionType | null {
  const { toolName } = input;
  const builtin = BUILTIN_ACTION_TYPES[toolName];
  if (builtin) return builtin;
  if (!input.viaConnector) {
    // Built-ins that need approval but have no row of their own write to connected services.
    return APPROVAL_REQUIRED_BUILTIN_TOOLS.has(toolName) ? "connected_apps_write" : null;
  }
  // A declared read-only hint is honoured only when the name is not mutating or compound. A
  // name like gmail_send_email is classified by name, so a connector cannot dodge a category
  // Block by claiming readOnly. Unattended runs still ask through unattendedToolRequiresApproval.
  const call = { ...input, toolName, viaConnector: true };
  if (input.readOnly === true && !connectorWrite(call)) return null;
  if (!connectorToolRequiresApproval(toolName, input.readOnly)) return null;
  const kind = (input.connectorKind ?? connectorKindFromToolName(toolName)).toLowerCase();
  if (isMoneyConnectorAction(call)) return "spend_money";
  if (EMAIL_CONNECTOR_SLUGS.has(kind) || /send.*mail|gmail_send|outlook_send/i.test(toolName)) {
    return "send_email";
  }
  if (CALENDAR_CONNECTOR_SLUGS.has(kind) || /calendar/i.test(toolName)) return "calendar_changes";
  if (MESSAGING_CONNECTOR_SLUGS.has(kind)) return "message_outside";
  if (/(^|_)(delete|remove|trash)(_|$)/i.test(toolName)) return "delete_data";
  return "connected_apps_write";
}

/** A per-tool rule can never be Allow for a tool that always needs an explicit approval. */
export function toolRuleAllowsAllow(toolName: string): boolean {
  return !toolRequiresExplicitApproval(toolName);
}

export const EFFECT_TO_CHOICE: Record<StoredActionApprovalRule["effect"], ApprovalChoice> = {
  always_allow: "allow",
  require_approval: "ask",
  block: "block",
};
export const CHOICE_TO_EFFECT: Record<ApprovalChoice, StoredActionApprovalRule["effect"]> = {
  allow: "always_allow",
  ask: "require_approval",
  block: "block",
};

/**
 * The table's rows for the space, and the override of one bot when `botId` is given. Rows show the
 * gate's decision at `level`: with no saved rule a stricter level asks, and at Ask for everything
 * no saved Allow clears a call, so only Block or Ask can show. An always-ask type's saved Allow
 * never runs a call either — every call is a hard line — so it shows Ask at every level. Saved
 * rows are never rewritten.
 */
export function buildApprovalTable(
  rules: ActionApprovalRule[],
  botId?: string,
  level: PermissionLevel = "open",
): Array<{
  actionType: ApprovalActionType;
  effect: ApprovalChoice;
  spaceEffect: ApprovalChoice;
  botEffect: ApprovalChoice | null;
  primary: boolean;
}> {
  const choiceFor = (type: ApprovalActionType, scope: string | null): ApprovalChoice | null => {
    const found = rules.filter(
      (rule) =>
        rule.matchKind === "category" &&
        (rule.botId ?? null) === scope &&
        actionTypeFromCategory(rule.matchValue) === type,
    );
    if (found.length === 0) return null;
    // Legacy and new rows can both exist for one type; the stricter one shows.
    const effects = found.map((rule) => EFFECT_TO_CHOICE[rule.effect]);
    return effects.includes("block") ? "block" : effects.includes("ask") ? "ask" : "allow";
  };
  // Mirrors resolveActionApprovalDetail (no rule: a stricter level asks) and the executor's
  // mandatory ask at Ask for everything, which only a Block outranks. An always-ask type's every
  // call is a hard line, so a saved Allow asks there too and the row can only ever be Ask or Block.
  const shown = (id: ApprovalActionType, saved: ApprovalChoice | null): ApprovalChoice | null =>
    saved === "allow" && (level === "ask_everything" || ALWAYS_ASK_ACTION_TYPES.has(id))
      ? "ask"
      : saved;
  return ACTION_TYPES.map(({ id, defaultEffect, primary }) => {
    const unsaved = level === "open" ? defaultEffect : "ask";
    const spaceEffect = shown(id, choiceFor(id, null)) ?? unsaved;
    const botEffect = botId ? shown(id, choiceFor(id, botId)) : null;
    return { actionType: id, effect: botEffect ?? spaceEffect, spaceEffect, botEffect, primary };
  });
}

/**
 * Tools whose results bring in nothing from outside during the run: confirmations of the bot's own
 * writes, the owner's answers, and the product's own saved state (memory, skills, history), which
 * is treated like the conversation already in context. Every other result (pages, search hits,
 * files, connector data, the screen, shell output, other bots) can carry text an attacker wrote,
 * and taints the run. New tools taint by default.
 */
const OWN_STATE_RESULT_TOOLS = new Set([
  "ask_user",
  "company_context_lookup",
  "attach_file",
  "end_call",
  "list_fleet",
  "list_secrets",
  "message_user",
  "read_history",
  "recall_memory",
  "remember",
  "render_plot",
  "render_ui",
  "request_secret",
  "save_memory",
  "save_shared_memory",
  "schedule_cancel",
  "schedule_create",
  "schedule_list",
  "scratchpad_add",
  "scratchpad_complete",
  "scratchpad_list",
  "scratchpad_remove",
  "scratchpad_update",
  "search_history",
  "skill_read",
  "task_catalog",
  "write_file",
]);

export function toolResultTaintsRun(toolName: string): boolean {
  return !OWN_STATE_RESULT_TOOLS.has(toolName);
}

/**
 * A connector read still sends its arguments to the connector's server. Until outside content
 * enters the run, those arguments come from the owner's request. After that, injected text could
 * choose them, so a read skips approval only on a connector this run already used before then or
 * was approved for. Reads on that connector stay free, so list-then-get flows never ask twice.
 */
export function connectorReadRequiresApproval(input: {
  tainted: boolean;
  connectorTrusted: boolean;
}): boolean {
  return input.tainted && !input.connectorTrusted;
}

/**
 * web_fetch sends its whole URL, query string included, to the site it names, so a site this run
 * was not given is a new destination that injected text could have picked. Trusted sites (named in
 * the owner's own words, approved earlier in the run, or the exact URL of a search result) and
 * sites with an always-allow rule go through. Anything else is new: planActionGate decides who
 * judges it, and newSiteOutcome what happens when nobody passed it.
 */
export function outboundSiteGate(input: {
  site: string;
  trusted: boolean;
  rules: ActionApprovalRule[];
}): "allow" | "new" {
  return input.trusted || siteAlwaysAllowed(input.rules, input.site) ? "allow" : "new";
}

/**
 * A new site that Auto Review did not pass needs a person. A webhook run has nobody to ask, so
 * there it is refused.
 */
export function newSiteOutcome(input: {
  trigger: string;
  decision: "ask" | "allow";
}): "ask" | "allow" | "deny" {
  if (input.decision === "allow") return "allow";
  return input.trigger === "webhook" ? "deny" : "ask";
}

/** The action id of the card button that saves a bot's "all sites" rule, and its label. */
export const ALL_SITES_ACTION_ID = "always_bot_sites";
export const ALL_SITES_ACTION_LABEL = "Allow all sites for this agent";

/**
 * A rule for the bot and the tool web_fetch means: this agent fetches any site without asking.
 * The caller still refuses it for a firewalled or external agent, a tainted run, a webhook run,
 * and a URL that repeats private data.
 */
export function botAllowsAllSites(rules: ActionApprovalRule[], botId: string): boolean {
  return rules.some(
    (rule) =>
      rule.botId === botId &&
      rule.effect === "always_allow" &&
      rule.matchKind === "tool" &&
      rule.matchValue === "web_fetch",
  );
}

/**
 * What private owner data a tool list can read, in a few words for a card. Not listed: shared
 * memory and spreadsheet tools (every agent is offered them; a spreadsheet result is tracked as
 * private text by the URL check) and calendar_agenda (the agent's own schedule).
 */
const PRIVATE_DATA_AREAS: ReadonlyArray<[string, RegExp]> = [
  ["mail", /^(mail_|inbox_|show_emails$)/],
  ["Drive", /^drive_/],
  ["calendar", /^calendar_(?!agenda$)/],
  ["finance", /^(finance_|cap_table_|fundraising_|investor_)/],
  ["Data room", /^(search_data_room|read_data_room_item|add_to_data_room)$/],
  [
    "contacts and records",
    /^(contacts_|legal_|audit_|meetings_|share_meeting$|imessage_|company_|desktop_app_)/,
  ],
];

export function privateDataAreas(toolNames: Iterable<string>): string[] {
  const names = [...toolNames];
  return PRIVATE_DATA_AREAS.filter(([, pattern]) => names.some((name) => pattern.test(name))).map(
    ([area]) => area,
  );
}

export function siteAlwaysAllowed(rules: ActionApprovalRule[], site: string): boolean {
  return rules.some(
    (rule) =>
      rule.effect === "always_allow" &&
      rule.matchKind === "site" &&
      rule.matchValue.toLowerCase() === site,
  );
}

function categoryMatches(
  category: string,
  effect: ActionApprovalRule["effect"],
  toolName: string,
  connectorKind: string,
  readOnly: boolean | undefined,
  viaConnector: boolean | undefined,
  args: Record<string, unknown> | undefined,
): boolean {
  const normalized = category.toLowerCase();
  const consequential = connectorToolRequiresApproval(toolName, readOnly);
  // Rules saved before the table keep their old, wider matching (they work without `viaConnector`).
  if (normalized === "email") {
    // mail_modify is organize_mail now: a saved "email" rule no longer asks for it.
    if (BUILTIN_MAIL_WRITE_TOOLS.has(toolName)) return toolName !== "mail_modify";
    if (EMAIL_CONNECTOR_SLUGS.has(connectorKind.toLowerCase())) return consequential;
    if (consequential && /send.*mail|gmail_send|outlook_send/i.test(toolName)) return true;
  }
  if (normalized === "purchase") {
    if (PURCHASE_CONNECTOR_SLUGS.has(connectorKind.toLowerCase())) return consequential;
    if (consequential && /purchase|pay_|charge|checkout|buy_/i.test(toolName)) return true;
  }
  const type = actionTypeFromCategory(category);
  if (!type) return false;
  const actualType = actionTypeForTool({ toolName, viaConnector, connectorKind, readOnly, args });
  if (actualType === type) return true;
  // A saved Connected apps (write) Block used to cover payments before they had their own
  // category. Keep that refusal effective, but do not expand old Allows or Ask rules.
  return effect === "block" && type === "connected_apps_write" && actualType === "spend_money";
}

function ruleMatches(
  rule: ActionApprovalRule,
  toolName: string,
  connectorKind: string,
  readOnly: boolean | undefined,
  viaConnector: boolean | undefined,
  site: string | undefined,
  args: Record<string, unknown> | undefined,
): boolean {
  const value = rule.matchValue.toLowerCase();
  switch (rule.matchKind) {
    case "site":
      return site === value;
    case "tool":
      return toolName.toLowerCase() === value;
    case "connector":
      return connectorKind.toLowerCase() === value;
    case "category":
      return categoryMatches(
        rule.matchValue,
        rule.effect,
        toolName,
        connectorKind,
        readOnly,
        viaConnector,
        args,
      );
    default:
      return false;
  }
}

function ruleSpecificity(rule: ActionApprovalRule): number {
  switch (rule.matchKind) {
    case "site":
      return 4;
    case "tool":
      return 3;
    case "connector":
      return 2;
    case "category":
      return 1;
    default:
      return 0;
  }
}

export type ActionApprovalSource =
  | "block"
  | "require_approval"
  | "always_allow"
  | "default"
  | "action_type_default";

export type ActionApprovalResolved = {
  decision: "ask" | "allow" | "block";
  source: ActionApprovalSource;
  matchingRules: ActionApprovalRule[];
};

type ResolveInput = {
  toolName: string;
  connectorKind?: string;
  /** True for connector tools; the executor knows this. Needed to map connector writes to a type. */
  viaConnector?: boolean;
  readOnly?: boolean;
  args?: Record<string, unknown>;
  /** The destination of an outbound fetch (see outboundSiteGate). */
  site?: string;
  /** Space-wide rules (botId null) and any bot's rules; only this bot's apply. */
  rules: ActionApprovalRule[];
  /** The acting bot. Its rules beat space-wide rules, whatever their specificity. */
  botId?: string;
  /**
   * The effective permission level. Only a call with no matching rule reads it: at ask_changes
   * and ask_everything every action type asks by default. Open is applied by the executor, which
   * knows whether the run is clean, so it changes nothing here.
   */
  level?: PermissionLevel;
};

/**
 * Deterministic rule resolution.
 * 1. Rules for the acting bot are tried first; if any matches, only they decide. Otherwise
 *    space-wide rules decide.
 * 2. Within a scope the most specific match wins (tool, then connector, then category). At equal
 *    specificity block beats ask beats allow.
 * 3. With no matching rule, a tool that maps to an action type uses that type's default
 *    (`action_type_default`); any other tool is allowed (`default`).
 * A tool that always needs an explicit approval is never allowed: Allow resolves to ask. Block
 * still applies to it.
 */
export function resolveActionApprovalDetail(input: ResolveInput): ActionApprovalResolved {
  const connectorKind = input.connectorKind ?? connectorKindFromToolName(input.toolName);
  const matching = (scope: ActionApprovalRule[]) =>
    scope.filter((rule) =>
      ruleMatches(
        rule,
        input.toolName,
        connectorKind,
        input.readOnly,
        input.viaConnector,
        input.site,
        input.args,
      ),
    );
  const botRules = matching(
    input.botId ? input.rules.filter((rule) => rule.botId === input.botId) : [],
  );
  const matchingRules =
    botRules.length > 0 ? botRules : matching(input.rules.filter((rule) => !rule.botId));
  const explicit = toolRequiresExplicitApproval(input.toolName);

  if (matchingRules.length === 0) {
    const type = actionTypeForTool({
      toolName: input.toolName,
      viaConnector: input.viaConnector,
      connectorKind,
      readOnly: input.readOnly,
      args: input.args,
    });
    const typeDefault = ACTION_TYPES.find((entry) => entry.id === type)?.defaultEffect;
    if (type && input.level && input.level !== "open") {
      return { decision: "ask", source: "action_type_default", matchingRules };
    }
    if (typeDefault === "ask" || (typeDefault && explicit)) {
      return { decision: "ask", source: "action_type_default", matchingRules };
    }
    // Organizing mail is reversible and its mandatory checks run separately, so its Allow default
    // is final: it needs no Auto Review pass.
    if (type === "organize_mail" && typeDefault === "allow")
      return { decision: "allow", source: "always_allow", matchingRules };
    if (typeDefault === "allow")
      return { decision: "allow", source: "action_type_default", matchingRules };
    return { decision: "allow", source: "default", matchingRules };
  }

  // A site rule is the most specific, but it only chooses a destination: it never lifts a Block
  // that the tool, connector or category carries.
  if (
    matchingRules.some((rule) => rule.matchKind === "site") &&
    matchingRules.some((rule) => rule.matchKind !== "site" && rule.effect === "block")
  ) {
    return { decision: "block", source: "block", matchingRules };
  }
  const highestSpecificity = Math.max(...matchingRules.map(ruleSpecificity));
  const winners = matchingRules.filter((rule) => ruleSpecificity(rule) === highestSpecificity);
  if (winners.some((rule) => rule.effect === "block")) {
    return { decision: "block", source: "block", matchingRules };
  }
  if (winners.some((rule) => rule.effect === "require_approval") || explicit) {
    return { decision: "ask", source: "require_approval", matchingRules };
  }
  return { decision: "allow", source: "always_allow", matchingRules };
}

export function resolveActionApproval(input: ResolveInput): "ask" | "allow" | "block" {
  return resolveActionApprovalDetail(input).decision;
}

/**
 * What a person must always decide:
 * - `outside_email`: an email send with any recipient outside the owner-trusted set;
 * - `money`: spending or moving money;
 * - `permanent_delete`: a delete that has no undo;
 * - `credentials`: using a credential to write, and granting a capability.
 * No saved rule, routine allowance, background review or Auto Review clears one; the call asks
 * every time, also in unattended and goal runs.
 */
export type HardLine = "outside_email" | "money" | "permanent_delete" | "credentials";

export type HardLineCall = {
  toolName: string;
  viaConnector?: boolean;
  connectorKind?: string;
  readOnly?: boolean;
  args?: Record<string, unknown>;
  /**
   * For an email send: true only when every address `emailSendRecipients` returned was checked
   * and is owner-trusted. Anything else (unchecked, unknown, absent) counts as outside.
   */
  recipientsTrusted?: boolean;
};

/** Built-in deletes with no undo. delete_bot and archive_bot archive a bot, which can be restored. */
const PERMANENT_DELETE_BUILTIN_TOOLS = new Set([
  "forget_memory",
  "forget_secret",
  "calendar_delete_event",
  "skill_delete",
]);
/** Built-ins that grant a capability: access to tools, a connection, a space, a meeting. */
const CAPABILITY_GRANT_BUILTIN_TOOLS = new Set([
  "request_access",
  "respond_agent_connection",
  "create_space",
  "share_meeting",
  "forget_secret",
]);
const MONEY_NAME_SEGMENTS = new Set([
  "pay",
  "pays",
  "payment",
  "payments",
  "payout",
  "payouts",
  "refund",
  "refunds",
  "charge",
  "charges",
  "purchase",
  "purchases",
  "buy",
  "checkout",
  "withdraw",
  "withdrawal",
  "transfer",
  "transfers",
  "wire",
  "donate",
  "money",
  "amount",
]);
const DELETE_NAME_SEGMENTS = new Set([
  "delete",
  "deletes",
  "remove",
  "trash",
  "destroy",
  "purge",
  "erase",
  "wipe",
  "terminate",
]);
const CAPABILITY_NAME_SEGMENTS = new Set([
  "share",
  "invite",
  "invites",
  "grant",
  "collaborator",
  "collaborators",
  "permission",
  "permissions",
  "acl",
  "member",
  "members",
  "role",
  "roles",
  "token",
  "tokens",
  "credential",
  "credentials",
  "secret",
  "secrets",
  "password",
  "apikey",
]);
const EMAIL_NAME_SEGMENTS = new Set(["email", "emails", "mail", "gmail", "outlook"]);
const SEND_NAME_SEGMENTS = new Set(["send", "sends", "reply", "forward"]);
const EMAIL_ADDRESS = /[^\s<>"'`,;:()[\]]+@[^\s<>"'`,;:()[\]]+\.[a-z]{2,}/gi;

/** A tool or argument name as lowercase words: `requestSendMoney` and `REQUEST_SEND_MONEY` alike. */
function nameSegments(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function stringsIn(value: unknown, into: string[] = []): string[] {
  if (typeof value === "string") into.push(value);
  else if (Array.isArray(value)) for (const item of value) stringsIn(item, into);
  else if (value && typeof value === "object") {
    for (const item of Object.values(value)) stringsIn(item, into);
  }
  return into;
}

/**
 * A connector call that writes; built-ins are false. A declared write is a write. Otherwise the
 * first verb in the tool's own name decides (camelCase too, after any `server__` prefix), so a
 * read hint cannot hide `requestSendMoney` and `listSendMoneyRequests` stays a read. A name with
 * no verb is a write unless declared a read.
 */
function connectorWrite(call: HardLineCall): boolean {
  if (call.viaConnector !== true) return false;
  if (call.readOnly === false) return true;
  const words = nameSegments(call.toolName.split("__").at(-1) ?? call.toolName);
  if (COMPOUND_CONNECTOR_ACTION_PATTERN.test(words.join("_"))) return true;
  for (const word of words) {
    if (MUTATING_CONNECTOR_PATTERN.test(word)) return true;
    if (READ_ONLY_CONNECTOR_PATTERN.test(word)) return false;
  }
  return call.readOnly !== true;
}

/** The shared connector money classifier used by category rules and the mandatory-approval gate. */
function isMoneyConnectorAction(call: HardLineCall): boolean {
  if (!connectorWrite(call)) return false;
  const kind = (call.connectorKind ?? connectorKindFromToolName(call.toolName)).toLowerCase();
  const segments = nameSegments(call.toolName);
  return (
    PURCHASE_CONNECTOR_SLUGS.has(kind) ||
    /purchase|pay_|charge|checkout|buy_/i.test(call.toolName) ||
    segments.some((part) => MONEY_NAME_SEGMENTS.has(part)) ||
    Object.keys(call.args ?? {}).some((key) => nameSegments(key).includes("amount"))
  );
}

/**
 * The lowercased addresses an email send goes to, or undefined when the call is not an email send.
 * A built-in mail_send reads to, cc and bcc; a connector send counts every address in its
 * arguments. An entry with no address, or a send of a saved draft (its recipients are not in the
 * call), adds "" so the send can never count as trusted.
 */
export function emailSendRecipients(call: HardLineCall): string[] | undefined {
  const args = call.args ?? {};
  const addressesOf = (values: string[]) =>
    values.flatMap((text) => text.match(EMAIL_ADDRESS)?.map((a) => a.toLowerCase()) ?? [""]);
  if (call.toolName === "mail_reply_batch") return [""];
  if (call.toolName === "mail_send") {
    const draft = typeof args.draftId === "string" && args.draftId.trim() !== "";
    const listed = [args.to, args.cc, args.bcc].flatMap((list) => stringsIn(list));
    return [...(draft ? [""] : []), ...(listed.length ? addressesOf(listed) : [""])];
  }
  if (!connectorWrite(call)) return undefined;
  const segments = nameSegments(call.toolName);
  const kind = (call.connectorKind ?? connectorKindFromToolName(call.toolName)).toLowerCase();
  const email =
    EMAIL_CONNECTOR_SLUGS.has(kind) || segments.some((part) => EMAIL_NAME_SEGMENTS.has(part));
  if (!email || !segments.some((part) => SEND_NAME_SEGMENTS.has(part))) return undefined;
  const found = stringsIn(args).flatMap((text) => text.match(EMAIL_ADDRESS) ?? []);
  return found.length ? found.map((address) => address.toLowerCase()) : [""];
}

/** Action types whose every call is a hard line, so their Allow / Ask setting never changes anything. */
export const ALWAYS_ASK_ACTION_TYPES: ReadonlySet<ApprovalActionType> = new Set(["spend_money"]);

/**
 * The hard line a call crosses, or null. Pure and deterministic, from the call alone (plus the
 * caller's recipient check), so every run, client and path applies the same list.
 */
export function hardLineFor(call: HardLineCall): HardLine | null {
  const recipients = emailSendRecipients(call);
  if (
    recipients !== undefined &&
    (call.recipientsTrusted !== true || recipients.length === 0 || recipients.includes(""))
  ) {
    return "outside_email";
  }
  if (actionTypeForTool(call) === "spend_money") return "money";
  const write = connectorWrite(call);
  const segments = nameSegments(call.toolName);
  if (
    CAPABILITY_GRANT_BUILTIN_TOOLS.has(call.toolName) ||
    (call.toolName === "secret_request" &&
      !(
        call.args?.method === undefined ||
        call.args.method === "GET" ||
        call.args.method === "HEAD"
      )) ||
    (write &&
      (segments.some((part) => CAPABILITY_NAME_SEGMENTS.has(part)) ||
        segments.join("_").includes("api_key")))
  ) {
    return "credentials";
  }
  if (
    PERMANENT_DELETE_BUILTIN_TOOLS.has(call.toolName) ||
    (write && segments.some((part) => DELETE_NAME_SEGMENTS.has(part)))
  ) {
    return "permanent_delete";
  }
  return null;
}

export type AutoReviewJudgeDecision = "pass" | "ask" | "error";

/**
 * Pure combiner for Auto Review after rule resolution.
 * Rules win: block blocks, require_approval asks, always_allow runs. Only a call with no rule
 * (the global default, or an action type's default) may call a judge, and never an unattended
 * run. The judge only escalates a default allow to ask, or lets a default ask through; it never
 * silent-denies. Without a judge (Auto Review off, or no checker) such a call asks.
 */
export function planActionGate(input: {
  resolved: ActionApprovalResolved;
  consequential: boolean;
  autoReviewEnabled: boolean;
  checkerConfigured: boolean;
  /** An unattended run never plans a judge: nobody is there to be spared the card. */
  unattended?: boolean;
  /** Except a read of ROUTINE_AUTO_REVIEW_READ_TOOLS in a clean, non-webhook routine run. */
  routineRead?: boolean;
  /** A fetch to a site the run was not given (see outboundSiteGate). */
  newDestination?: boolean;
  /** A goal run (/goal) never plans a judge: the owner is not there to be spared a card, and nothing is auto-approved. */
  goalRun?: boolean;
}): "ask" | "allow" | "judge" | "block" {
  const { resolved } = input;
  if (resolved.decision === "block") return "block";
  // A rule for the whole tool is not a choice of sites, so it never allows a new one; only a site
  // rule does, and that makes the site no longer new. A rule that asks still asks. Auto Review may
  // pass a new site, judging only the owner's own words and the full URL: it never sees tool
  // results or inbound messages, so text injected there cannot argue for the site. Without Auto
  // Review, and in an unattended run, which never plans a judge, a person decides.
  if (input.newDestination) {
    if (resolved.decision === "ask" && resolved.source === "require_approval") return "ask";
    return !input.unattended && !input.goalRun && input.autoReviewEnabled && input.checkerConfigured
      ? "judge"
      : "ask";
  }
  const forReviewer =
    (!input.unattended || input.routineRead === true) &&
    !input.goalRun &&
    input.consequential &&
    (resolved.source === "default" || resolved.source === "action_type_default");
  const judgeable = forReviewer && input.autoReviewEnabled && input.checkerConfigured;
  // Explicit-approval tools reach here as ask with source require_approval or action_type_default;
  // the caller marks them mandatory before resolving, so a judge cannot clear them.
  if (resolved.decision === "ask") return judgeable ? "judge" : "ask";
  if (resolved.source === "always_allow") return "allow";
  // A call that would go to Auto Review asks a person when Auto Review is off or has no checker:
  // turning the reviewer off never lets it run unchecked.
  return judgeable ? "judge" : forReviewer ? "ask" : "allow";
}

/** Map a judge outcome onto ask/allow. Errors fail closed on consequential tools. */
export function applyJudgeDecision(input: {
  decision: AutoReviewJudgeDecision;
  consequential: boolean;
}): "ask" | "allow" {
  if (input.decision === "pass") return "allow";
  if (input.decision === "ask") return "ask";
  return input.consequential ? "ask" : "allow";
}

export function isSecretAskBlock(block: {
  kind: string;
  input?: string;
  approvalEffectId?: string;
}): boolean {
  return block.kind === "ask" && block.input === "secret" && !block.approvalEffectId;
}

export function isApprovalAskBlock(block: {
  kind: string;
  approvalEffectId?: string;
  /** A page source approval has no effect row; its card is still an approval card. */
  pageSource?: unknown;
  /** A reply batch card offers only Discard; Send selected is its own request. */
  mailBatch?: unknown;
  /** A list import card offers only Deny; Add is its own request. */
  pipelineImport?: unknown;
  actions?: Array<{ id: string; label: string }>;
}): boolean {
  if (block.kind !== "ask" || !(block.approvalEffectId || block.pageSource)) return false;
  if (!block.actions?.length) return false;
  const actionIds = new Set(block.actions.map((action) => action.id));
  if (
    (block.mailBatch || block.pipelineImport) &&
    block.actions.every((action) => action.id === "deny")
  ) {
    return true;
  }
  return (
    actionIds.has("allow") &&
    actionIds.has("deny") &&
    [...actionIds].every(
      (id) =>
        id === "allow" ||
        id === "always" ||
        id === "always_routine" ||
        id === ALL_SITES_ACTION_ID ||
        id === "deny",
    )
  );
}
