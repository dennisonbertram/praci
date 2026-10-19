import type { MessageBlock } from "@rakazo/contracts";
import {
  ACTIVE_RUN_STATUSES,
  BACKGROUND_RUN_TRIGGERS,
  isToolActivityBlock,
  plainTextFromMarkdown,
  toolStepsSummary,
} from "@rakazo/core";

export const activeRunStatuses = [...ACTIVE_RUN_STATUSES];
const backgroundRunTriggers = [...BACKGROUND_RUN_TRIGGERS];
const userVisibleBotRunTriggers = ["bot_message", ...BACKGROUND_RUN_TRIGGERS];
const latestBotRunOrderBy = [{ createdAt: "desc" as const }, { id: "desc" as const }];

/**
 * The newest conversational/foreground run for a bot's sidebar status. Background
 * ticket runs keep working silently, so they must not make the avatar spin.
 */
export const activeRunSelection = {
  where: {
    status: { in: activeRunStatuses },
    trigger: { notIn: backgroundRunTriggers },
  },
  orderBy: { createdAt: "desc" as const },
  take: 1,
  select: { status: true },
} as const;

/** Latest user-visible run for a bot roster error signal; later success clears an older failure. */
export const latestBotRunSelection = {
  where: { trigger: { notIn: userVisibleBotRunTriggers } },
  orderBy: latestBotRunOrderBy,
  take: 1,
  select: { id: true, status: true },
} as const;

/** Tool ids run together ("get_active_integration get_banking_tr…") are not words a person wrote. */
const TOOL_ID_LIST = /^\s*[a-z\d]+(?:_[a-z\d]+)+(?:\s+[a-z\d]+(?:_[a-z\d]+)+)*…?\s*$/;

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
      const text = previewText((block as { text: string }).text);
      if (!TOOL_ID_LIST.test(text)) return text;
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
