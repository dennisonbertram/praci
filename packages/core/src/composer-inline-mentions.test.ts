import { describe, expect, it } from "vitest";

import type { MentionSpan } from "./composer-inline-mentions.js";
import {
  findMentionQueryAtCaret,
  insertInlineMention,
  liveSpans,
  mentionDeletionAtCaret,
  shiftSpans,
} from "./composer-inline-mentions.js";
import { serializeComposerPrompt } from "./composer-slash.js";
import { findMentionRanges } from "./group-mentions.js";

const inv = { kind: "bot", id: "b1", name: "Investors agent" } as const;
const ada = { kind: "bot", id: "b2", name: "Ada" } as const;

describe("findMentionQueryAtCaret", () => {
  it("finds the query before the caret mid-sentence", () => {
    const text = "share with @inv and put it";
    expect(findMentionQueryAtCaret(text, "share with @inv".length)).toEqual({
      start: 11,
      query: "inv",
    });
  });
  it("works at the start and for a bare @", () => {
    expect(findMentionQueryAtCaret("@", 1)).toEqual({ start: 0, query: "" });
  });
  it("ignores an @ inside a word or after the caret", () => {
    expect(findMentionQueryAtCaret("mail me@x", 9)).toBeNull();
    expect(findMentionQueryAtCaret("hi @ada", 2)).toBeNull();
  });
  it("opens after an opening bracket or quote", () => {
    expect(findMentionQueryAtCaret("see (@Inv", 9)).toEqual({ start: 5, query: "Inv" });
    expect(findMentionQueryAtCaret('say "@Inv', 9)).toEqual({ start: 5, query: "Inv" });
    expect(findMentionQueryAtCaret("see \u201c@Inv", 9)).toEqual({ start: 5, query: "Inv" });
    expect(findMentionQueryAtCaret("(@Inv", 5)).toEqual({ start: 1, query: "Inv" });
    expect(findMentionQueryAtCaret("[@Inv", 5)).toEqual({ start: 1, query: "Inv" });
  });
  it("never opens on an email address", () => {
    expect(findMentionQueryAtCaret("a@b", 3)).toBeNull();
    expect(findMentionQueryAtCaret('"alice"@example', 15)).toBeNull();
    expect(findMentionQueryAtCaret("'bob'@x", 7)).toBeNull();
  });
});

describe("insertInlineMention", () => {
  it("inserts after an opening bracket", () => {
    expect(insertInlineMention("(@In", 4, inv).text).toBe("(@Investors agent ");
  });
  it("replaces the query at the caret and moves the caret after the name", () => {
    const text = "share with @inv and put it";
    const out = insertInlineMention(text, "share with @inv".length, inv);
    expect(out.text).toBe("share with @Investors agent and put it");
    expect(out.caret).toBe("share with @Investors agent".length);
  });
  it("adds a space at the end of the text", () => {
    const out = insertInlineMention("hi @a", 5, ada);
    expect(out.text).toBe("hi @Ada ");
    expect(out.caret).toBe(out.text.length);
  });
  it("adds no space and does not skip a newline that follows", () => {
    const out = insertInlineMention("hi @a\nnext", 5, ada);
    expect(out.text).toBe("hi @Ada\nnext");
    expect(out.caret).toBe(7);
  });
  it("works at the start", () => {
    expect(insertInlineMention("@a rest", 2, ada).text).toBe("@Ada rest");
  });
});

describe("findMentionRanges", () => {
  it("finds two mentions in order", () => {
    const text = "@Ada ask @Investors agent now";
    const ranges = findMentionRanges(text, [inv, ada]);
    expect(ranges.map((r) => [r.start, r.end, r.mention.name])).toEqual([
      [0, 4, "Ada"],
      [9, 25, "Investors agent"],
    ]);
  });
});

describe("mention spans follow edits per occurrence", () => {
  const first = { kind: "routine", id: "r1", name: "Weekly report" } as const;
  const second = { kind: "routine", id: "r2", name: "Weekly report" } as const;
  const text = "@Weekly report then @Weekly report";
  const spans: MentionSpan<typeof first | typeof second>[] = [
    { mention: first, start: 0, end: 14 },
    { mention: second, start: 20, end: 34 },
  ];

  it("deleting the first same-name mention leaves the second with its own id", () => {
    const next = shiftSpans(spans, text, text.slice(14));
    expect(next).toEqual([{ mention: second, start: 6, end: 20 }]);
  });
  it("typing inside the second drops only the second", () => {
    const edited = `${text.slice(0, 25)}X${text.slice(25)}`;
    expect(shiftSpans(spans, text, edited)).toEqual([spans[0]]);
  });
  it("text typed before shifts every span, text after changes none", () => {
    expect(shiftSpans(spans, text, `ab ${text}`).map((s) => s.start)).toEqual([3, 23]);
    expect(shiftSpans(spans, text, `${text} more`)).toEqual(spans);
  });
  it("a span whose text no longer matches is dropped", () => {
    expect(liveSpans("@Weekly repor then", spans)).toEqual([]);
    expect(liveSpans(text, spans)).toEqual(spans);
    expect(liveSpans("@Weekly reportx then", spans.slice(0, 1))).toEqual([]);
  });
  it("Backspace removes only the occurrence at the caret", () => {
    const out = mentionDeletionAtCaret(text, 34, spans);
    expect(out?.text).toBe("@Weekly report then ");
    expect(out?.spans).toEqual([spans[0]]);
  });
});

describe("mentionDeletionAtCaret", () => {
  it("removes the whole mention when the caret is at its end", () => {
    const text = "with @Investors agent and";
    const spans = [{ mention: inv, start: 5, end: 21 }];
    expect(mentionDeletionAtCaret(text, 21, spans)).toEqual({
      text: "with  and",
      caret: 5,
      spans: [],
    });
  });
  it("does nothing elsewhere", () => {
    const spans = [{ mention: ada, start: 5, end: 9 }];
    expect(mentionDeletionAtCaret("with @Ada and", 3, spans)).toBeNull();
  });
});

describe("serializeComposerPrompt with inline mentions", () => {
  it("does not prefix a mention already in the text", () => {
    expect(serializeComposerPrompt("share with @Investors agent and go", null, [inv])).toBe(
      "share with @Investors agent and go",
    );
  });
  it("still prefixes a mention that is not in the text", () => {
    expect(serializeComposerPrompt("go", null, [ada])).toBe("@Ada go");
  });
});
