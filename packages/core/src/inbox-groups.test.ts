import { describe, expect, it } from "vitest";
import { groupInbox } from "./inbox-groups.js";

// Local-time constructors keep these tests independent of the runner's time zone.
const now = new Date(2026, 9, 12, 15, 0);
const row = (id: string, receivedAt: Date, needsReply: boolean | null = null) => ({
  id,
  receivedAt: receivedAt.toISOString(),
  needsReply,
});

describe("groupInbox", () => {
  it("splits Today and Earlier at the viewer's local midnight", () => {
    const groups = groupInbox(
      [
        row("just-after-midnight", new Date(2026, 9, 12, 0, 1)),
        row("just-before-midnight", new Date(2026, 9, 11, 23, 59)),
        row("last-week", new Date(2026, 9, 5, 9, 0)),
      ],
      now,
    );
    expect(groups.today.map((r) => r.id)).toEqual(["just-after-midnight"]);
    expect(groups.earlier.map((r) => r.id)).toEqual(["just-before-midnight", "last-week"]);
    expect(groups.needsReply).toEqual([]);
  });

  it("puts needsReply === true threads in Needs reply whatever their date, and not in the other groups", () => {
    const groups = groupInbox(
      [
        row("old-ask", new Date(2026, 9, 3, 9, 0), true),
        row("today-ask", new Date(2026, 9, 12, 8, 0), true),
        row("handled", new Date(2026, 9, 12, 7, 0), false),
        row("untriaged", new Date(2026, 9, 12, 6, 0), null),
      ],
      now,
    );
    expect(groups.needsReply.map((r) => r.id)).toEqual(["old-ask", "today-ask"]);
    expect(groups.today.map((r) => r.id)).toEqual(["handled", "untriaged"]);
    expect(groups.earlier).toEqual([]);
  });

  it("leaves Needs reply empty when no row has been triaged, and keeps input order", () => {
    const groups = groupInbox(
      [row("b", new Date(2026, 9, 12, 9, 0)), row("a", new Date(2026, 9, 12, 8, 0))],
      now,
    );
    expect(groups.needsReply).toEqual([]);
    expect(groups.today.map((r) => r.id)).toEqual(["b", "a"]);
  });

  it("treats a message dated slightly in the future as Today", () => {
    const groups = groupInbox([row("skewed", new Date(2026, 9, 12, 15, 5))], now);
    expect(groups.today.map((r) => r.id)).toEqual(["skewed"]);
  });
});
