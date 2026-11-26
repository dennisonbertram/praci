import type { MessageBlock } from "@rakazo/contracts";
import { isToolActivityBlock } from "@rakazo/core";

/** Keep mid-turn progress beats short; prefer a few high-signal updates. */
export const USER_PROGRESS_MESSAGE_MAX_LENGTH = 500;

export function clampUserProgressMessage(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (trimmed.length <= USER_PROGRESS_MESSAGE_MAX_LENGTH) return trimmed;
  return `${trimmed.slice(0, USER_PROGRESS_MESSAGE_MAX_LENGTH - 1).trimEnd()}…`;
}

/**
 * True when the raw text a caller tried to post as a mid-turn progress update
 * would not fit and got cut off by clampUserProgressMessage. Callers should
 * surface this back to the model (it gets no other signal that its message
 * was mangled) rather than reporting a silent success.
 */
export function isProgressMessageTruncated(text: string): boolean {
  return text.trim().length > USER_PROGRESS_MESSAGE_MAX_LENGTH;
}

/**
 * Pull narration text out of the in-progress turn segments so it can be posted
 * as a durable mid-turn message. Tool/step blocks stay for the final publish.
 */

/** clientNonce prefix for mid-turn progress messages (reconciler uses this). */
export const USER_PROGRESS_CLIENT_NONCE_PREFIX = "user-progress:";

export function userProgressClientNonce(runId: string, index = 0): string {
  // Include entropy so a resumed executor turn cannot reuse an earlier nonce
  // (threadId + clientNonce is unique).
  return `${USER_PROGRESS_CLIENT_NONCE_PREFIX}${runId}:${index}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 10)}`;
}

export function isUserProgressClientNonce(clientNonce: string | null | undefined): boolean {
  return Boolean(clientNonce?.startsWith(USER_PROGRESS_CLIENT_NONCE_PREFIX));
}

export function extractNarrationText(
  segments: readonly MessageBlock[],
  currentText: string,
): { text: string; remaining: MessageBlock[] } {
  const parts: string[] = [];
  const remaining: MessageBlock[] = [];
  for (const block of segments) {
    if (block.kind === "text") {
      if (block.text) parts.push(block.text);
      continue;
    }
    remaining.push(block);
  }
  if (currentText) parts.push(currentText);
  return { text: parts.join(""), remaining };
}

/** Longer than this, a mid-turn line is a finding rather than a status, and stays. */
const SHORT_NARRATION_MAX = 200;
const LOOKUP_TOOL_NAME = /(^|_)(get|list|search|find|read|grep|catalog|overview|agenda)(_|$)/i;
/** These change nothing the owner would see, so a line before them is status too. */
const BOOKKEEPING_TOOLS = new Set([
  "shell",
  "scratchpad_add",
  "scratchpad_update",
  "scratchpad_complete",
  "scratchpad_remove",
]);

/** True for tools a run calls while finding its place: lookups and its own bookkeeping. */
export function toolIsQuietForNarration(name: string, readOnly?: boolean): boolean {
  return readOnly === true || BOOKKEEPING_TOOLS.has(name) || LOOKUP_TOOL_NAME.test(name);
}

function narrationKey(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Decides which mid-turn lines become chat messages: one before a group of lookups, the line that
 * goes with an action, and any long line. The live status line still shows the ones left out.
 * ponytail: repeats are exact after normalizing; near-repeats are held back only before lookups.
 */
export function createNarrationGate(earlierLines: readonly string[] = []) {
  const said = new Set(earlierLines.map(narrationKey));
  let groupHasLine = false;
  return {
    admit(text: string, nextToolIsQuiet: boolean): boolean {
      const key = narrationKey(text);
      if (said.has(key)) return false;
      if (groupHasLine && nextToolIsQuiet && text.length <= SHORT_NARRATION_MAX) return false;
      said.add(key);
      groupHasLine = true;
      return true;
    },
    /** A line posted another way, such as message_user. */
    notePosted(text: string) {
      said.add(narrationKey(text));
      groupHasLine = true;
    },
    /** After an action, the next line reports something new. */
    noteTool(quiet: boolean) {
      if (!quiet) groupHasLine = false;
    },
  };
}

/**
 * After mid-turn progress messages were already posted, skip a hollow final
 * message that would only carry hidden tool-activity blocks (or nothing).
 */
export function finalBlocksAfterMidTurnProgress(
  blocks: MessageBlock[],
  publishedMidTurn: boolean,
): MessageBlock[] {
  if (!publishedMidTurn || blocks.length === 0) return blocks;
  if (blocks.every((block) => isToolActivityBlock(block))) return [];
  return blocks;
}

/** Outcome to return for a bot_message run after mid-turn progress posts. */
export function botMessageOutcomeFromMidTurn(
  finalText: string,
  midTurnTexts: readonly string[],
): { text: string; intent: "result" | "status" } | null {
  const trimmed = finalText.trim();
  if (trimmed) return { text: trimmed, intent: "result" };
  const midTurn = midTurnTexts.map((part) => part.trim()).filter(Boolean);
  if (midTurn.length === 0) return null;
  return { text: midTurn.join("\n\n"), intent: "status" };
}
