import { describe, expect, it } from "vitest";
import {
  archivableIds,
  groupBySender,
  rowSummary,
  type SenderGroupRow,
} from "./inbox-sender-groups.js";

const row = (id: string, extra: Partial<SenderGroupRow> = {}): SenderGroupRow => ({
  id,
  connectionId: "c1",
  from: "Acme",
  fromAddress: "news@acme.example",
  subject: `Subject ${id}`,
  snippet: `Snippet ${id}`,
  reason: null,
  receivedAt: "2026-10-10T10:00:00.000Z",
  unread: false,
  inInbox: true,
  pile: "updates",
  ...extra,
});

describe("groupBySender", () => {
  it("groups rows by lowercased address across different display names, newest group first", () => {
    const groups = groupBySender([
      row("a1", { receivedAt: "2026-10-12T10:00:00.000Z", from: "Acme" }),
      row("b1", {
        fromAddress: "hello@other.example",
        from: "Other",
        receivedAt: "2026-10-13T10:00:00.000Z",
      }),
      row("a2", {
        fromAddress: "News@Acme.example",
        from: "Acme Team",
        receivedAt: "2026-10-11T10:00:00.000Z",
      }),
    ]);
    expect(groups.map((g) => g.key)).toEqual(["hello@other.example", "news@acme.example"]);
    expect(groups[1]?.rows.map((r) => r.id)).toEqual(["a1", "a2"]);
    expect(groups[1]?.sender).toBe("Acme");
    expect(groups[1]?.address).toBe("news@acme.example");
  });

  it("counts rows and unread rows per group and picks the newest by date, ties by id", () => {
    const [group] = groupBySender([
      row("a", { receivedAt: "2026-10-10T10:00:00.000Z", unread: true }),
      row("b", { receivedAt: "2026-10-12T10:00:00.000Z" }),
      row("c", { receivedAt: "2026-10-12T10:00:00.000Z", unread: true }),
    ]);
    expect(group?.count).toBe(3);
    expect(group?.unreadCount).toBe(2);
    expect(group?.newest.id).toBe("c");
    expect(group?.rows.map((r) => r.id)).toEqual(["c", "b", "a"]);
  });

  it("makes a single row its own group, and falls back to the display name without an address", () => {
    const groups = groupBySender([
      row("solo"),
      row("x", { fromAddress: undefined, from: "  Mystery Sender " }),
      row("y", {
        fromAddress: undefined,
        from: "mystery sender",
        receivedAt: "2026-10-09T10:00:00.000Z",
      }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.key === "news@acme.example")?.count).toBe(1);
    const mystery = groups.find((g) => g.key === "mystery sender");
    expect(mystery?.count).toBe(2);
    expect(mystery?.address).toBe("");
  });

  it("returns nothing for no rows", () => {
    expect(groupBySender([])).toEqual([]);
  });
});

describe("rowSummary", () => {
  it("prefers the reason and falls back to the snippet when it is null or blank", () => {
    expect(rowSummary({ reason: " Invoice for October ", snippet: "s" })).toBe(
      "Invoice for October",
    );
    expect(rowSummary({ reason: null, snippet: "s" })).toBe("s");
    expect(rowSummary({ reason: "   ", snippet: "s" })).toBe("s");
  });
});

describe("archivableIds", () => {
  const rows = [
    row("inbox"),
    row("gone", { inInbox: false }),
    row("spam", { pile: "spam" }),
    row("spam-gone", { pile: "spam", inInbox: false }),
  ];
  it("skips spam-pile rows and rows not in the inbox", () => {
    expect(archivableIds(rows, false)).toEqual(["inbox"]);
  });
  it("keeps the spam-pile inbox rows when allowSpam is set", () => {
    expect(archivableIds(rows, true)).toEqual(["inbox", "spam"]);
  });
});
