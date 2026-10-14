import { describe, expect, it } from "vitest";
import { dueTone, groupInbox, localDaysUntil } from "./inbox-groups.js";

// Local-time constructors keep these tests independent of the runner's time zone.
const now = new Date(2026, 9, 12, 15, 0);
const row = (
  id: string,
  receivedAt: Date,
  needsReply: boolean | null = null,
  priority: string | null = null,
) => ({
  id,
  receivedAt: receivedAt.toISOString(),
  needsReply,
  priority,
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
    expect(groups.needsReply.map((r) => r.id)).toEqual(["today-ask", "old-ask"]);
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

describe("groupInbox Needs reply order", () => {
  it("sorts by priority first, then newest, whatever the input order", () => {
    const groups = groupInbox(
      [
        row("normal-new", new Date(2026, 9, 12, 9, 0), true, "normal"),
        row("critical-old", new Date(2026, 9, 2, 9, 0), true, "critical"),
        row("important-new", new Date(2026, 9, 12, 8, 0), true, "important"),
        row("important-old", new Date(2026, 9, 10, 8, 0), true, "important"),
        row("unranked", new Date(2026, 9, 12, 10, 0), true, null),
      ],
      now,
    );
    expect(groups.needsReply.map((r) => r.id)).toEqual([
      "critical-old",
      "important-new",
      "important-old",
      "normal-new",
      "unranked",
    ]);
  });
});

describe("localDaysUntil and dueTone", () => {
  it("counts whole local days from today to a YYYY-MM-DD date, negative once past", () => {
    expect(localDaysUntil("2026-10-12", now)).toBe(0);
    expect(localDaysUntil("2026-10-13", now)).toBe(1);
    expect(localDaysUntil("2026-10-18", now)).toBe(6);
    expect(localDaysUntil("2026-10-11", now)).toBe(-1);
    // 00:30 and 23:30 on the same local day are the same distance away.
    expect(localDaysUntil("2026-10-13", new Date(2026, 9, 12, 0, 30))).toBe(1);
    expect(localDaysUntil("2026-10-13", new Date(2026, 9, 12, 23, 30))).toBe(1);
  });

  it("is critical when due today, past due or critical priority, warning within 2 days", () => {
    expect(dueTone(0, "normal")).toBe("crit");
    expect(dueTone(-3, null)).toBe("crit");
    expect(dueTone(5, "critical")).toBe("crit");
    expect(dueTone(1, "important")).toBe("warn");
    expect(dueTone(2, null)).toBe("warn");
    expect(dueTone(3, "important")).toBe("none");
    expect(dueTone(null, "important")).toBe("none");
    expect(dueTone(null, "critical")).toBe("crit");
  });
});
