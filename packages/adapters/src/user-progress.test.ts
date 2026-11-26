import type { MessageBlock } from "@rakazo/contracts";
import { isToolActivityBlock } from "@rakazo/core";
import { describe, expect, it } from "vitest";
import {
  botMessageOutcomeFromMidTurn,
  clampUserProgressMessage,
  createNarrationGate,
  extractNarrationText,
  finalBlocksAfterMidTurnProgress,
  isProgressMessageTruncated,
  isUserProgressClientNonce,
  toolIsQuietForNarration,
  USER_PROGRESS_MESSAGE_MAX_LENGTH,
  userProgressClientNonce,
} from "./user-progress.js";

describe("clampUserProgressMessage", () => {
  it("trims and rejects empty text", () => {
    expect(clampUserProgressMessage("  hello  ")).toBe("hello");
    expect(clampUserProgressMessage("   ")).toBe("");
  });

  it("clamps long progress beats", () => {
    const clamped = clampUserProgressMessage("x".repeat(USER_PROGRESS_MESSAGE_MAX_LENGTH + 40));
    expect(clamped).toHaveLength(USER_PROGRESS_MESSAGE_MAX_LENGTH);
    expect(clamped.endsWith("…")).toBe(true);
  });
});

describe("isProgressMessageTruncated", () => {
  it("is false for text that fits", () => {
    expect(isProgressMessageTruncated("short update")).toBe(false);
    expect(isProgressMessageTruncated("x".repeat(USER_PROGRESS_MESSAGE_MAX_LENGTH))).toBe(false);
  });

  it("is true for text that would be cut off by clampUserProgressMessage", () => {
    const long = "x".repeat(USER_PROGRESS_MESSAGE_MAX_LENGTH + 1);
    expect(isProgressMessageTruncated(long)).toBe(true);
    expect(clampUserProgressMessage(long).endsWith("…")).toBe(true);
  });
});

describe("extractNarrationText", () => {
  it("pulls text blocks and current text while keeping tool activity", () => {
    const { text, remaining } = extractNarrationText(
      [
        { kind: "text", text: "Checking calendars. " },
        { kind: "steps", steps: [{ label: "Web search", count: 1 }] },
        { kind: "text", text: "Found three options." },
      ],
      " Still looking.",
    );
    expect(text).toBe("Checking calendars. Found three options. Still looking.");
    expect(remaining).toEqual([{ kind: "steps", steps: [{ label: "Web search", count: 1 }] }]);
  });
});

describe("finalBlocksAfterMidTurnProgress", () => {
  it("drops a hollow final message that is only hidden tool activity", () => {
    const steps: MessageBlock = { kind: "steps", steps: [{ label: "Shell", count: 2 }] };
    expect(finalBlocksAfterMidTurnProgress([steps], true)).toEqual([]);
    expect(finalBlocksAfterMidTurnProgress([steps], false)).toEqual([steps]);
  });

  it("keeps a final answer alongside tool activity", () => {
    const blocks: MessageBlock[] = [
      { kind: "steps", steps: [{ label: "Web search", count: 1 }] },
      { kind: "text", text: "You are free Tuesday afternoon." },
    ];
    expect(finalBlocksAfterMidTurnProgress(blocks, true)).toEqual(blocks);
    expect(isToolActivityBlock(blocks[0]!)).toBe(true);
  });
});

describe("botMessageOutcomeFromMidTurn", () => {
  it("prefers the final reply as a result", () => {
    expect(botMessageOutcomeFromMidTurn("All set.", ["Checking calendars…"])).toEqual({
      text: "All set.",
      intent: "result",
    });
  });

  it("returns mid-turn progress as status when there is no final reply", () => {
    expect(
      botMessageOutcomeFromMidTurn("", ["Checking calendars…", "Found three free slots."]),
    ).toEqual({
      text: "Checking calendars…\n\nFound three free slots.",
      intent: "status",
    });
  });

  it("returns null when nothing was posted", () => {
    expect(botMessageOutcomeFromMidTurn("  ", [])).toBeNull();
  });
});

describe("userProgressClientNonce", () => {
  it("tags mid-turn progress messages for reconciler detection", () => {
    const nonce = userProgressClientNonce("run-1", 0);
    expect(nonce.startsWith("user-progress:run-1:0:")).toBe(true);
    expect(isUserProgressClientNonce(nonce)).toBe(true);
    expect(userProgressClientNonce("run-1", 0)).not.toBe(nonce);
    expect(isUserProgressClientNonce(null)).toBe(false);
    expect(isUserProgressClientNonce("other")).toBe(false);
  });
});

describe("createNarrationGate", () => {
  const LOOKUP = true;
  const ACTION = false;

  it("keeps one line for a group of lookups", () => {
    const gate = createNarrationGate();
    expect(gate.admit("Pulling your list.", LOOKUP)).toBe(true);
    expect(gate.admit("I'll pull the list now.", LOOKUP)).toBe(false);
    expect(gate.admit("Checking the sent folder.", LOOKUP)).toBe(false);
  });

  it("keeps the line attached to an action and the next line after it", () => {
    const gate = createNarrationGate();
    gate.admit("Reading the sheet.", LOOKUP);
    expect(gate.admit("Sending the first batch.", ACTION)).toBe(true);
    gate.noteTool(ACTION);
    expect(gate.admit("Batch sent; checking what is left.", LOOKUP)).toBe(true);
    expect(gate.admit("Still checking.", LOOKUP)).toBe(false);
  });

  it("drops a repeat even before an action", () => {
    const gate = createNarrationGate();
    gate.admit("Sending the batch.", ACTION);
    gate.noteTool(ACTION);
    expect(gate.admit("  sending   the BATCH. ", ACTION)).toBe(false);
  });

  it("keeps a long line, which is a finding rather than a status", () => {
    const gate = createNarrationGate();
    gate.admit("Reading.", LOOKUP);
    expect(gate.admit("x".repeat(240), LOOKUP)).toBe(true);
  });

  it("counts a line posted earlier in the run as said, but still allows the first new line", () => {
    const gate = createNarrationGate(["Reading the sheet."]);
    expect(gate.admit("Reading the sheet.", LOOKUP)).toBe(false);
    expect(gate.admit("Picking up where I stopped.", LOOKUP)).toBe(true);
  });

  it("counts a message_user update as the line for this group", () => {
    const gate = createNarrationGate();
    gate.notePosted("Working through the list.");
    expect(gate.admit("Looking at the list.", LOOKUP)).toBe(false);
  });
});

describe("toolIsQuietForNarration", () => {
  it.each([
    ["mail_search", undefined, true],
    ["search_history", undefined, true],
    ["read_history", undefined, true],
    ["list_files", undefined, true],
    ["task_catalog", true, true],
    ["inbox_overview", true, true],
    ["shell", undefined, true],
    ["scratchpad_update", undefined, true],
    ["mail_send", undefined, false],
    ["mail_reply_batch", undefined, false],
    ["schedule_create", undefined, false],
    ["ask_user", undefined, false],
  ])("%s", (name, readOnly, quiet) => {
    expect(toolIsQuietForNarration(name, readOnly)).toBe(quiet);
  });
});
