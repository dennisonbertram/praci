import type { MessageBlock, RunPhase } from "@rakazo/contracts";
import { RunPhaseSchema } from "@rakazo/contracts";
import {
  ACTIVE_RUN_STATUSES,
  BACKGROUND_RUN_TRIGGERS,
  isToolActivityBlock,
  plainTextFromMarkdown,
  splitDataRoomReferences,
  toolStepLabel,
  toolStepsSummary,
} from "@rakazo/core";

export const activeRunStatuses = [...ACTIVE_RUN_STATUSES];
const backgroundRunTriggers = [...BACKGROUND_RUN_TRIGGERS];
const userVisibleBotRunTriggers = ["bot_message", ...BACKGROUND_RUN_TRIGGERS];
const activeRunOrderBy = [{ status: "desc" as const }, { createdAt: "desc" as const }];
const latestBotRunOrderBy = [{ createdAt: "desc" as const }, { id: "desc" as const }];

/**
 * The newest conversational/foreground run for a bot's sidebar status. Background
 * ticket runs keep working silently, so they must not make the avatar spin. A run waiting on
 * the owner (an approval or question card) outranks a newer one that is working: statuses sort
 * waiting_takeover, waiting_input, running, queued, leased in descending text order.
 */
export const activeRunSelection = {
  where: {
    status: { in: activeRunStatuses },
    trigger: { notIn: backgroundRunTriggers },
  },
  orderBy: activeRunOrderBy,
  take: 1,
  select: { status: true, phase: true },
} as const;

/** A stored run phase, or null when the column holds nothing usable. */
export function storedRunPhase(phase: unknown): RunPhase | null {
  const parsed = RunPhaseSchema.safeParse(phase);
  return parsed.success ? parsed.data : null;
}

/** Latest user-visible run for a bot roster error signal; later success clears an older failure. */
export const latestBotRunSelection = {
  where: { trigger: { notIn: userVisibleBotRunTriggers } },
  orderBy: latestBotRunOrderBy,
  take: 1,
  select: { id: true, status: true },
} as const;

/** Tool ids run together ("get_active_integration get_banking_tr…") are not words a person wrote. */
const TOOL_ID_LIST = /^\s*[a-z\d]+(?:_[a-z\d]+)+(?:\s+[a-z\d]+(?:_[a-z\d]+)+)*…?\s*$/;

const LEADING_TOOL_IDS = /^(?:[a-z\d]+(?:_[a-z\d]+)+\s+){3,}/;

/** A reply that opens with a run of three or more tool ids (a capability list) reads them as words. */
function humanizedIdRun(text: string): string {
  const run = LEADING_TOOL_IDS.exec(text)?.[0];
  if (!run) return text;
  const words = run.trim().split(/\s+/).map(toolStepLabel).join(", ");
  return `${words}, ${text.slice(run.length)}`.replace(/,\s*$/, "");
}

/** A message with no words whose only tool calls hand work to another agent: its row text would be "Message bot". */
export function isHandOffOnly(blocks: unknown): boolean {
  const rows = Array.isArray(blocks) ? (blocks as MessageBlock[]) : [];
  if (rows.some((block) => block?.kind === "text" && block.text.trim())) return false;
  const steps = rows.flatMap((block) => (block?.kind === "steps" ? block.steps : []));
  return steps.length > 0 && steps.every((step) => toolStepLabel(step.label) === "Message bot");
}

/** The words of a message, else one line about its tool calls. Live tool activity never counts as words. */
export function previewFromBlocks(blocks: unknown): string {
  const rows = Array.isArray(blocks) ? blocks : [];
  for (const block of rows) {
    if (
      block &&
      typeof block === "object" &&
      "text" in block &&
      typeof (block as { text?: unknown }).text === "string" &&
      !isToolActivityBlock(block as MessageBlock)
    ) {
      // A Data room file sent with the message is shown by its name, never as its raw line.
      const { body, refs } = splitDataRoomReferences((block as { text: string }).text);
      const text = previewText(body || refs.map((ref) => ref.name).join(", "));
      if (!TOOL_ID_LIST.test(text)) return humanizedIdRun(text);
    }
  }
  const steps = rows.flatMap((block) =>
    block && typeof block === "object" && (block as MessageBlock).kind === "steps"
      ? (block as Extract<MessageBlock, { kind: "steps" }>).steps
      : [],
  );
  return toolStepsSummary(steps);
}

const TABLE_ROW = /^\s*\|.*\|\s*$/;
const TABLE_SEPARATOR = /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/;

/**
 * A Markdown table flattened into a preview reads as "Vendor, Amount Northstar Paper Co., $4…",
 * so tables are left out; a reply that is only a table reads "Table, 3 rows".
 */
function previewText(markdown: string): string {
  const lines = markdown.split("\n");
  const tableLines = lines.filter((line) => TABLE_ROW.test(line));
  if (tableLines.length < 2) return plainTextFromMarkdown(markdown);
  const words = plainTextFromMarkdown(lines.filter((line) => !TABLE_ROW.test(line)).join("\n"));
  if (words) return words;
  const rows = tableLines.filter((line) => !TABLE_SEPARATOR.test(line)).length - 1;
  return `Table, ${rows} ${rows === 1 ? "row" : "rows"}`;
}
