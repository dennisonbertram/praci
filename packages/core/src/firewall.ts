/**
 * Agent firewall tool profile. A firewalled agent is offered only the tools on these two closed
 * lists. Anything else (built-ins, company, MCP agent, voice, meeting and data room tools, connector
 * tools, tools added later) is dropped. See docs/agent-firewall/PLAN.md, section 3.
 */

/** Offered and called without a card. Some are narrowed further at call time (see the plan). */
export const FIREWALL_FREE_TOOLS: ReadonlySet<string> = new Set([
  // Tainted-run safe tools (EXTERNAL_TAINT_SAFE_TOOLS) except attach_file and list_secrets: the profile has no files and no secrets, not even names.
  "ask_user",
  "skill_read",
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
  "recall_memory",
  "task_catalog",
  "schedule_list",
  "schedule_runs",
  // Reads of its own pages and pins. Writes ask: page Markdown images are an outbound channel.
  "page_list",
  "page_read",
  "pins_read",
  // Mail reads, inside the support scope (the executor checks the scope).
  "mail_search",
  "mail_grep",
  "mail_get",
  "inbox_overview",
  "show_emails",
  // Its own thread.
  "read_history",
  "search_history",
  // Always a card (explicit approval), so offering it lets the agent ask without a free path.
  "request_access",
]);

/**
 * Offered, but every call asks on a card that cannot become a saved rule. The executor may lift
 * mail_draft, mail_modify and web_fetch to free under the conditions in the plan.
 */
export const FIREWALL_ASK_TOOLS: ReadonlySet<string> = new Set([
  "page_write",
  "page_create",
  "page_edit",
  "mail_send",
  "mail_reply_batch",
  "mail_draft",
  "mail_modify",
  "web_fetch",
  "save_memory",
  "remember",
  "skill_create",
  "skill_update",
  "schedule_create",
  "schedule_update",
  "watch_create",
  "message_bot",
  "ticket_create",
  "ticket_update",
  "ticket_comment",
]);

/**
 * Read-only queries an email thread's own agent may make. For that agent only (see
 * `firewallToolClass`) they ask on a card instead of being dropped. Writes stay dropped.
 */
export const FIREWALL_MAIL_THREAD_ASK_TOOLS: ReadonlySet<string> = new Set([
  "search_data_room",
  "read_data_room_item",
  "contacts_list",
]);

export type FirewallToolClass = "free" | "ask" | "dropped";

/**
 * `askExtra` holds the tools of capabilities the owner granted this agent through request_access
 * (see `firewallAccessTools`). They ask on every call; a grant never makes a tool free.
 */
export function firewallToolClass(
  name: string,
  mailThreadAgent = false,
  askExtra: ReadonlySet<string> = new Set(),
): FirewallToolClass {
  if (FIREWALL_FREE_TOOLS.has(name)) return "free";
  if (FIREWALL_ASK_TOOLS.has(name) || askExtra.has(name)) return "ask";
  if (mailThreadAgent && FIREWALL_MAIL_THREAD_ASK_TOOLS.has(name)) return "ask";
  return "dropped";
}

/** The reason line on a card the firewall forced. */
export const FIREWALL_CARD_REASON = "Firewall";

const bareAddress = (value: string) => value.trim().toLowerCase();

const htmlUrlEntities: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  sol: "/",
  bsol: "\\",
  colon: ":",
  period: ".",
  lpar: "(",
  rpar: ")",
  tab: "\t",
  newline: "\n",
  nbsp: " ",
};

/**
 * What can carry data out of a rendered page: an address or scheme, a markup attribute, a Markdown
 * link, image or reference definition (even to a relative path), an HTML tag, or a bare domain.
 * Matched on normalized text, each with the following non-space run so different targets differ.
 */
/**
 * Markers of anything that can point a rendered page somewhere: an address or scheme, a markup
 * attribute, any Markdown link, image or reference syntax, an HTML tag, or a bare domain.
 */
const URL_LIKE_MARKERS = [
  /https?:|\/\/|www\.|\b(?:src|srcset|href|action|poster|formaction)\s*=|url\(|@import|data:|mailto:|ftp:|[a-z][a-z0-9+.-]*:\/\//i,
  /!\[|\]\(|\]\[|^\s{0,3}\[[^\]]+\]:/,
  /<\/?[a-z!]/i,
  // A code fence: adding or removing one turns code into live Markdown or back.
  /^\s*(?:```|~~~)/,
  /\b[\w-]+\.(?:com|org|net|io|ai|dev|app|co|me|ly|xyz|info|gg|sh|test)\b/i,
];

/** Normalize characters browsers and Markdown parsers decode before using URL destinations. */
function normalizeForUrlCheck(text: string): string {
  let normalized = text;
  for (let pass = 0; pass < 4; pass++) {
    const decoded = normalized.replace(
      /&(#(?:x[\da-f]+|\d+)|[a-z]+);?/gi,
      (entity, name: string) => {
        if (name[0] === "#") {
          const hexadecimal = name[1]?.toLowerCase() === "x";
          const codePoint = Number.parseInt(name.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
          if (!Number.isInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return entity;
          try {
            return String.fromCodePoint(codePoint);
          } catch {
            return entity;
          }
        }
        return htmlUrlEntities[name.toLowerCase()] ?? entity;
      },
    );
    if (decoded === normalized) break;
    normalized = decoded;
  }
  // Line breaks stay: a Markdown destination cannot cross one, and each line is compared whole.
  return normalized.replace(/[\t\r]/g, "").replace(/\\/g, "/");
}

/**
 * `to`, `cc`, `bcc` and `participants` are bare addresses: the caller splits each field with the
 * same parser the draft handler uses (`parseRecipients`), so one entry cannot hide a second
 * recipient. A draft is free when it names at least one recipient, every To, Cc and Bcc address is already a
 * participant in the thread being answered, and the body has no link (the site list that would
 * allow a link arrives with slice S3, so until then any link asks).
 */
export function firewallDraftIsFree(input: {
  to?: readonly string[];
  cc?: readonly string[];
  bcc?: readonly string[];
  body?: string;
  participants: readonly string[];
}): boolean {
  const recipients = [...(input.to ?? []), ...(input.cc ?? []), ...(input.bcc ?? [])];
  if (recipients.length === 0) return false;
  if (recipientsOffThread(recipients, input.participants).length > 0) return false;
  return !bodyHasLink(input.body ?? "");
}

/**
 * Every line that carries a URL-like marker, whole and exact (case can carry data), after normalizing. A line is the
 * unit because a destination can run past a marker (a title, a suffix after an encoded space): any
 * change to such a line, or a new one, counts as a new token.
 */
export function urlLikeTokens(text: string): string[] {
  return (
    normalizeForUrlCheck(text)
      .split("\n")
      // Not trimmed: indentation decides whether a line is code (four spaces) or live Markdown.
      .filter((line) =>
        URL_LIKE_MARKERS.some((marker) =>
          marker.test(line.replace(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, "")),
        ),
      )
  );
}

/** A page edit is free only when it does not add any URL-like token, including a duplicate. */
export function firewallPageTextIsFree(before: string, after: string): boolean {
  const counts = new Map<string, number>();
  for (const token of urlLikeTokens(before)) counts.set(token, (counts.get(token) ?? 0) + 1);
  for (const token of urlLikeTokens(after)) {
    const available = counts.get(token) ?? 0;
    if (available === 0) return false;
    counts.set(token, available - 1);
  }
  return true;
}

/** Memory content is free only when it contains no URL-like token. */
export function firewallMemoryIsFree(text: string): boolean {
  return urlLikeTokens(text).length === 0;
}

/** The bare addresses that are not participants of the thread. The caller splits each field first. */
export function recipientsOffThread(
  recipients: readonly string[],
  participants: readonly string[],
): string[] {
  const known = new Set(participants.map(bareAddress));
  return recipients.map(bareAddress).filter((address) => !known.has(address));
}

/** Any link in a mail body, until the firewall site list exists. */
export const bodyHasLink = (body: string) => /https?:\/\/|www\./i.test(body);
