import type { MessageBlock } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import { appendToolCallSegment, attachToolNotes } from "./events.js";
import { isToolActivityBlock, reportedToolStep, workingActivity } from "./tool-activity.js";

describe("tool activity", () => {
  it.each<MessageBlock>([
    { kind: "steps", steps: [{ label: "Browser", count: 1 }] },
    { kind: "progress", text: "Using browser", activity: true },
    { kind: "progress", text: "Using brex: list_expenses", activity: true },
  ])("recognizes $kind activity", (block) => {
    expect(isToolActivityBlock(block)).toBe(true);
  });

  it("keeps assistant narration separate from tool activity", () => {
    expect(isToolActivityBlock({ kind: "progress", text: "I’m checking that now." })).toBe(false);
    expect(isToolActivityBlock({ kind: "progress", text: "Using browser" })).toBe(false);
    expect(
      isToolActivityBlock({
        kind: "progress",
        text: "Let me check",
        pendingToolNames: ["browser"],
      }),
    ).toBe(false);
    expect(
      isToolActivityBlock({ kind: "progress", text: "Using the search results, I found it." }),
    ).toBe(false);
    expect(
      isToolActivityBlock({
        kind: "progress",
        text: "Using the search results, I found…",
      }),
    ).toBe(false);
    expect(
      isToolActivityBlock({
        kind: "progress",
        text: "Using these notes, here is a summary.",
      }),
    ).toBe(false);
    expect(isToolActivityBlock({ kind: "text", text: "Done." })).toBe(false);
  });
});

describe("tool notes", () => {
  it("keeps what a finished call reported on its step", () => {
    const segments = appendToolCallSegment([], "mail_search");
    const noted = attachToolNotes(segments, "mail_search", {
      lines: [{ text: "Searching mail: from Kevin" }, { text: "Found 3 messages" }],
      summary: "Searched mail · 3 found",
    });
    expect(noted).toEqual([
      {
        kind: "steps",
        steps: [
          {
            label: "Mail search",
            count: 1,
            summary: "Searched mail · 3 found",
            lines: [{ text: "Searching mail: from Kevin" }, { text: "Found 3 messages" }],
          },
        ],
      },
    ]);
    // A repeat of the same tool joins the step and keeps the earlier lines.
    const again = appendToolCallSegment(noted, "mail_search");
    expect(again[0]).toMatchObject({ steps: [{ count: 2, lines: [{}, {}] }] });
  });

  it("leaves a step alone when nothing was reported or the tool has no step", () => {
    const segments = appendToolCallSegment([], "mail_search");
    expect(attachToolNotes(segments, "mail_search", { lines: [] })).toEqual(segments);
    expect(attachToolNotes(segments, "mail_get", { lines: [{ text: "x" }] })).toEqual(segments);
  });

  it("reads the latest step of a running Google tool, and only of those", () => {
    const block = (name: string): MessageBlock => ({
      kind: "progress",
      text: 'Searching Drive: "budget"',
      activity: true,
      pendingToolNames: [name],
    });
    expect(reportedToolStep([block("drive_search")])).toEqual({
      detail: 'Searching Drive: "budget"',
      service: "Google Drive",
    });
    expect(reportedToolStep([block("web_search")])).toBeNull();
    expect(reportedToolStep([{ kind: "text", text: "Hi" }])).toBeNull();
  });
});

describe("workingActivity", () => {
  const run = { id: "run-1", botId: "bot-1", status: "running" as const };
  const bot = (blocks: MessageBlock[]) => ({
    id: "m-1",
    threadId: "t-1",
    seq: 1,
    role: "bot" as const,
    botId: "bot-1",
    runId: "run-1",
    blocks,
    createdAt: "2026-10-11T00:00:00.000Z",
  });

  it("classifies by run status, phase and newest bot blocks", () => {
    const at = "2026-10-11T00:00:00.000Z";
    expect(workingActivity({ ...run, status: "queued" }, [])).toEqual({ kind: "starting" });
    expect(
      workingActivity({ ...run, status: "queued", phase: { kind: "computer_wait", at } }, []),
    ).toEqual({ kind: "phase", phase: { kind: "computer_wait", at } });
    expect(workingActivity(run, [])).toEqual({ kind: "thinking" });
    expect(workingActivity(run, [bot([{ kind: "text", text: "Hi" }])])).toEqual({
      kind: "writing",
    });
    expect(
      workingActivity(run, [bot([{ kind: "steps", steps: [{ label: "Mail search", count: 1 }] }])]),
    ).toEqual({ kind: "tool", label: "Mail search", action: "mail-search" });
  });
});
