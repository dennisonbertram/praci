import type { ParsedUiArtifact } from "./openui.js";
import { blocksToSource, parseSource } from "./openui.js";
import type { UiArtifactInput } from "./vocabulary.js";
import { countBlocks, layoutDepth, UI_LIMITS, uiArtifactInputSchema } from "./vocabulary.js";

export type { ParsedUiArtifact } from "./openui.js";
export type { UiArtifactInput, UiBlock } from "./vocabulary.js";
export { UI_LIMITS, uiArtifactInputSchema } from "./vocabulary.js";

/** Extension of a stored UI artifact. */
export const UI_ARTIFACT_EXTENSION = ".rkui";

/** Parses a stored UI artifact for display. Never throws; see `ParsedUiArtifact`. */
export const parseUiArtifact = (source: string): ParsedUiArtifact => parseSource(source);

export type CreatedUiArtifact =
  | { ok: true; title: string; description?: string; source: string }
  | { ok: false; errors: string[] };

/**
 * Validates tool arguments and turns them into the stored source. The source is parsed back and
 * must give the same blocks, so what is stored is exactly what the model asked for.
 */
export function createUiArtifact(args: unknown): CreatedUiArtifact {
  const checked = uiArtifactInputSchema.safeParse(args);
  if (!checked.success) {
    return {
      ok: false,
      errors: checked.error.issues.slice(0, 8).map((issue) => {
        const where = issue.path.join(".");
        return where ? `${where}: ${issue.message}` : issue.message;
      }),
    };
  }
  const input: UiArtifactInput = checked.data;
  const total = countBlocks(input.blocks);
  if (total > UI_LIMITS.blocks) {
    return {
      ok: false,
      errors: [`blocks: at most ${UI_LIMITS.blocks} blocks in all, got ${total}`],
    };
  }
  if (layoutDepth(input.blocks) > UI_LIMITS.depth) {
    return {
      ok: false,
      errors: [`blocks: card, stack and grid blocks may be nested at most ${UI_LIMITS.depth} deep`],
    };
  }
  const source = blocksToSource(input.blocks);
  if (source.length > UI_LIMITS.sourceChars) {
    return {
      ok: false,
      errors: [
        `The artifact is too large (${source.length} characters, limit ${UI_LIMITS.sourceChars}). Use fewer rows or shorter text.`,
      ],
    };
  }
  const parsed = parseSource(source);
  if (parsed.problems.length || blocksToSource(parsed.blocks) !== source) {
    return {
      ok: false,
      errors: parsed.problems.length
        ? parsed.problems.slice(0, 8)
        : ["The artifact did not survive a parse round trip"],
    };
  }
  return { ok: true, title: input.title, description: input.description, source };
}
