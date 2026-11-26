import { describe, expect, it } from "vitest";
import { normalizeStretches, parseOmiTranscript } from "./omi-sort-split.js";

const seg = (
  start: number,
  end: number,
  kind: "meeting" | "note" | "trash" = "note",
  title = "t",
) => ({
  start,
  end,
  kind,
  title,
});

describe("normalizeStretches", () => {
  it("sorts, drops overlaps, closes gaps and clamps to the recording", () => {
    const out = normalizeStretches(
      [
        seg(300, 500, "note", "  Third\n one "),
        seg(10, 100, "meeting", "First"),
        seg(50, 120, "trash", "Overlaps the first"),
        seg(200, 280, "trash", "Second"),
        seg(130, 130, "note", "Empty"),
      ],
      600,
      "Recording",
    );
    expect(out).toEqual([
      { start: 0, end: 200, kind: "meeting", title: "First" },
      { start: 200, end: 300, kind: "trash", title: "Second" },
      { start: 300, end: 600, kind: "note", title: "Third one" },
    ]);
  });

  it("falls back to one note when nothing usable remains, and caps titles at 80 characters", () => {
    expect(normalizeStretches([seg(5, 5)], 60, "Recording 1")).toEqual([
      { start: 0, end: 60, kind: "note", title: "Recording 1" },
    ]);
    const [one] = normalizeStretches([seg(0, 60, "note", "x".repeat(200))], 60, "R");
    expect(one?.title).toHaveLength(80);
    expect(normalizeStretches([seg(0, 60, "note", "   ")], 60, "Named")[0]?.title).toBe("Named");
  });
});

describe("parseOmiTranscript", () => {
  it("reads the paragraphs omi.transcribe writes, keeping blank lines inside a paragraph", () => {
    expect(parseOmiTranscript("[00:00] hello\n\nthere\n\n[10:05] second")).toEqual([
      { at: 0, text: "hello\n\nthere" },
      { at: 605, text: "second" },
    ]);
    expect(parseOmiTranscript("")).toEqual([]);
  });
});
