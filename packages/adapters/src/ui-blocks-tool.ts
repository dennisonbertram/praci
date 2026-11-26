import type { UiBlock } from "@rakazo/contracts";
import { UiBlockSchema } from "@rakazo/contracts";
import { z } from "zod";

export const MAX_UI_BLOCKS_PER_CALL = 5;

export const uiBlocksInputSchema = z.object({
  blocks: z.array(UiBlockSchema).min(1).max(MAX_UI_BLOCKS_PER_CALL),
});

export const UI_BLOCKS_GUIDANCE =
  "In a chat reply, show tabular data, multi-part summaries, key metrics, lists of items and warnings with render_ui (table, sections, summary, stats, cards, callout) instead of Markdown tables or headings. Call it at the point in the reply where the block belongs, and keep ordinary prose in normal text.";

/** Checks the model's arguments; the problems come back to it as plain strings so it can retry. */
export function parseUiBlocks(
  args: unknown,
): { ok: true; blocks: UiBlock[] } | { ok: false; problems: string[] } {
  const parsed = uiBlocksInputSchema.safeParse(args);
  if (parsed.success) return { ok: true, blocks: parsed.data.blocks };
  return {
    ok: false,
    problems: parsed.error.issues
      .slice(0, 10)
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`),
  };
}
