import type { Run, ThreadMessage } from "@rakazo/contracts";
import { humanizeToolName } from "@rakazo/core";

export type WorkingActivity =
  | { kind: "starting" }
  | { kind: "thinking" }
  | { kind: "writing" }
  | { kind: "tool"; label: string; action?: ToolAction };

/** Tools a founder sees often, named by what they do so the progress line reads as plain words. */
export type ToolAction =
  | "contact-add"
  | "contact-save"
  | "contacts-read"
  | "cap-table-read"
  | "cap-table-update"
  | "carta-cap-table"
  | "carta-company"
  | "connected-app"
  | "mail-search"
  | "mail-open"
  | "mail-draft"
  | "mail-show"
  | "finance";

const TOOL_ACTIONS: Record<string, ToolAction> = {
  contacts_add: "contact-add",
  contacts_save: "contact-save",
  contacts_list: "contacts-read",
  cap_table_read: "cap-table-read",
  cap_table_update: "cap-table-update",
  cap_table_chart: "carta-cap-table",
  set_context: "carta-company",
  list_accounts: "carta-company",
  read_tool: "connected-app",
  fetch: "connected-app",
  discover: "connected-app",
  search_tools: "connected-app",
  mail_search: "mail-search",
  mail_grep: "mail-search",
  mail_get: "mail-open",
  mail_draft: "mail-draft",
  show_emails: "mail-show",
  finance_overview: "finance",
  finance_breakdown: "finance",
};

// Steps keep only the humanized label, so match on it; MCP and built-in names humanize the same way.
const ACTION_BY_LABEL = new Map(
  Object.entries(TOOL_ACTIONS).map(([name, action]) => [
    humanizeToolName(`mcp__s__${name}`),
    action,
  ]),
);

function toolActivity(label: string): WorkingActivity {
  const action = ACTION_BY_LABEL.get(label);
  return action ? { kind: "tool", label, action } : { kind: "tool", label };
}

/** What a live run is doing now, read from its status and the newest bot message. */
export function workingActivity(
  run: Pick<Run, "id" | "botId" | "status">,
  messages: readonly ThreadMessage[],
): WorkingActivity {
  if (run.status === "queued" || run.status === "leased") return { kind: "starting" };
  const last = messages.at(-1);
  if (last?.role !== "bot" || last.botId !== run.botId) return { kind: "thinking" };
  if (last.runId && last.runId !== run.id) return { kind: "thinking" };
  const tail = last.blocks.at(-1);
  const pending = tail?.kind === "progress" ? tail.pendingToolNames?.at(-1) : undefined;
  if (pending) return toolActivity(humanizeToolName(pending));
  if (tail?.kind === "steps") {
    const step = tail.steps.at(-1);
    if (step) return toolActivity(step.label);
  }
  if (tail?.kind === "progress" && tail.activity) return { kind: "thinking" };
  if ((tail?.kind === "text" || tail?.kind === "progress") && tail.text.trim()) {
    return { kind: "writing" };
  }
  return { kind: "thinking" };
}
