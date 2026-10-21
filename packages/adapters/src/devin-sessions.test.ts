import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  devinKindOf,
  latestDevinMessage,
  parseDevinMessages,
  parseDevinSessionSearch,
} from "./devin-sessions.js";

// Every fixture is synthetic: invented data in the documented format (issue #516 replaces them).
const fixture = (name: string) =>
  readFileSync(new URL(`./__fixtures__/devin/${name}`, import.meta.url), "utf8");

describe("parseDevinSessionSearch", () => {
  it("parses the first page into rows and reads the cursor", () => {
    const page = parseDevinSessionSearch(fixture("search-page-1.txt"));
    expect(page.skipped).toBe(0);
    expect(page.nextCursor).toBe("cursor-page-2");
    expect(page.sessions).toEqual([
      {
        id: "devin-0001",
        title: "Fix login redirect loop",
        status: "running",
        statusDetail: "waiting_for_user",
        createdAt: 1760000000,
        updatedAt: 1760003600,
        origin: "webapp",
        prs: [{ url: "https://github.com/acme/web/pull/212", state: "open" }],
      },
      expect.objectContaining({
        id: "devin-0002",
        title: 'Add "export CSV" to the reports page',
        origin: "slack",
        prs: [],
      }),
      expect.objectContaining({ id: "devin-0003", status: "failed", statusDetail: null }),
    ]);
  });

  it("has no cursor on the last page, and turns missing fields into null", () => {
    const page = parseDevinSessionSearch(fixture("search-page-2.txt"));
    expect(page.nextCursor).toBeNull();
    expect(page.sessions[0]?.prs).toEqual([
      { url: "https://github.com/acme/api/pull/90", state: "merged" },
      { url: "https://github.com/acme/mobile/pull/14", state: "closed" },
    ]);
    expect(page.sessions[1]).toEqual({
      id: "devin-0005",
      title: null,
      status: null,
      statusDetail: null,
      createdAt: null,
      updatedAt: null,
      origin: null,
      prs: [],
    });
  });

  it("skips and counts lines that cannot be read, never throwing", () => {
    const text = [
      '- id=devin-1 title="ok" status=running',
      "- title=no-id status=running",
      '- id=bad/id title="x"',
      '- id=devin-2 title="unterminated',
      "- id=devin-3 updated_at=soon",
      "",
    ].join("\n");
    const page = parseDevinSessionSearch(text);
    expect(page.sessions.map((s) => s.id)).toEqual(["devin-1", "devin-3"]);
    expect(page.sessions[1]?.updatedAt).toBeNull();
    expect(page.skipped).toBe(3);
    expect(() => parseDevinSessionSearch("\u0000 garbage")).not.toThrow();
    expect(parseDevinSessionSearch("")).toEqual({ sessions: [], skipped: 0, nextCursor: null });
  });
});

describe("parseDevinMessages", () => {
  it("finds the latest Devin message and its event id in the documented order", () => {
    const { messages } = parseDevinMessages(fixture("messages-waiting.txt"));
    expect(messages).toHaveLength(3);
    expect(latestDevinMessage(messages)).toEqual({
      eventId: "ev-103",
      source: "devin",
      createdAt: 1760003600,
      body: "Which environment should I test against?\nStaging or production?",
    });
  });

  it("returns null when Devin has not written, and skips lines without an event id", () => {
    const { messages } = parseDevinMessages('- event_id=e1 source=user body="hi"\n- source=devin');
    expect(messages).toHaveLength(1);
    expect(latestDevinMessage(messages)).toBeNull();
  });
});

describe("devinKindOf", () => {
  it.each([
    ["running", "waiting_for_user", "needs_you"],
    ["running", "awaiting_user_input", "needs_you"],
    ["blocked", null, "needs_you"],
    ["failed", "waiting_for_user", "needs_you"],
    ["error", null, "error"],
    ["expired", null, "error"],
    ["terminated", null, "error"],
    ["running", "working", "working"],
    ["resume_requested", null, "working"],
    ["finished", null, "finished"],
    [null, "finish", "finished"],
    ["sleeping", null, "finished"],
    ["suspend_requested_frontend", null, "suspended"],
    [" RUNNING ", null, "working"],
    ["archived", null, "unknown"],
    ["", null, "unknown"],
    [null, null, "unknown"],
  ] as const)("maps %s / %s to %s", (status, detail, kind) => {
    expect(devinKindOf(status, detail)).toBe(kind);
  });
});
