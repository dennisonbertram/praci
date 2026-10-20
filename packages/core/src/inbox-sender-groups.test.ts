import { describe, expect, it, vi } from "vitest";
import type { SenderGroupRow } from "./inbox-sender-groups.js";
import {
  archivableIds,
  bulkInChunks,
  digestRows,
  groupBySender,
  rowSummary,
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

  describe("one group per sender", () => {
    const research = (id: string, extra: Partial<SenderGroupRow> = {}) =>
      row(id, { from: "Research Weekly", fromAddress: "digest@research.example", ...extra });

    it("merges the same address across two connections (counts add)", () => {
      const [group, ...rest] = groupBySender([
        research("a1", { connectionId: "c1" }),
        research("a2", { connectionId: "c1" }),
        research("b1", { connectionId: "c2" }),
      ]);
      expect(rest).toEqual([]);
      expect(group?.count).toBe(3);
      expect(group?.rows.map((r) => r.connectionId).sort()).toEqual(["c1", "c1", "c2"]);
    });

    it("merges plus-tag variants of one address", () => {
      const groups = groupBySender([
        row("a", { fromAddress: "news+abc123@acme.example", from: "news+abc123@acme.example" }),
        row("b", { fromAddress: "news+def456@acme.example", from: "news+def456@acme.example" }),
        row("c", { fromAddress: "news@acme.example", from: "news@acme.example" }),
      ]);
      expect(groups).toHaveLength(1);
      expect(groups[0]?.count).toBe(3);
    });

    it("merges the same display name on different local parts and a subdomain of one domain", () => {
      const groups = groupBySender([
        ...["a1", "a2", "a3", "a4"].map((id) => research(id)),
        research("b1", { fromAddress: "bounce-77@mail.research.example" }),
        research("b2", {
          fromAddress: "bounce-78@mail.research.example",
          from: "RESEARCH  weekly",
        }),
        research("b3", { fromAddress: "weekly@research.example" }),
      ]);
      expect(groups).toHaveLength(1);
      expect(groups[0]?.count).toBe(7);
    });

    it("merges one name across a newsletter platform and the brand's own subdomain", () => {
      const named = (id: string, fromAddress: string) =>
        row(id, { from: "Example Research", fromAddress });
      const groups = groupBySender([
        named("a", "a@newsletters.example"),
        named("b", "b@newsletters.example"),
        named("c", "news@update.exampleresearch.test"),
      ]);
      expect(groups).toHaveLength(1);
      expect(groups[0]?.count).toBe(3);
    });

    it("keeps same-named people on a shared mailbox domain apart", () => {
      const groups = groupBySender([
        row("a", { from: "Sam Lee", fromAddress: "sam1@gmail.com" }),
        row("b", { from: "Sam Lee", fromAddress: "sam2@gmail.com" }),
      ]);
      expect(groups).toHaveLength(2);
    });

    it("keeps different display names on one domain apart", () => {
      const groups = groupBySender([
        research("a"),
        research("b", { from: "Research Jobs", fromAddress: "jobs@research.example" }),
      ]);
      expect(groups).toHaveLength(2);
    });

    it("merges the same display name on different domains", () => {
      const groups = groupBySender([
        research("a"),
        research("b", { fromAddress: "digest@other-research.example" }),
        research("c", { fromAddress: "digest@shop.co.uk" }),
        research("d", { fromAddress: "digest@other.co.uk" }),
      ]);
      expect(groups).toHaveLength(1);
    });

    it("keeps two people with one display name on a shared mailbox domain apart", () => {
      const groups = groupBySender([
        research("a", { from: "Alex Kim", fromAddress: "alex.kim@gmail.com" }),
        research("b", { from: "Alex Kim", fromAddress: "akim99@gmail.com" }),
      ]);
      expect(groups).toHaveLength(2);
    });

    it("groups rows without a display name by normalized address", () => {
      const bare = (id: string, address: string) =>
        row(id, { from: address, fromAddress: address });
      const groups = groupBySender([
        bare("a", "Alerts@Acme.example"),
        bare("b", "alerts+x@acme.example"),
        bare("c", "other@acme.example"),
      ]);
      expect(groups.map((g) => g.count).sort()).toEqual([1, 2]);
    });

    it("gives a group a key that does not change when a variant address arrives", () => {
      const before = groupBySender([research("a"), research("b")])[0]?.key;
      const after = groupBySender([
        research("a"),
        research("b"),
        research("c", { fromAddress: "zz+tag@mail.research.example" }),
      ])[0]?.key;
      expect(after).toBe(before);
    });
  });
});

describe("digestRows", () => {
  const now = new Date("2026-10-20T12:00:00.000Z");

  it("keeps rows from the last 7 days, newest first, ties by id", () => {
    const rows = [
      row("old", { receivedAt: "2026-10-13T11:59:59.000Z" }),
      row("edge", { receivedAt: "2026-10-13T12:00:00.000Z" }),
      row("tie-a", { receivedAt: "2026-10-19T12:00:00.000Z" }),
      row("tie-b", { receivedAt: "2026-10-19T12:00:00.000Z" }),
      row("new", { receivedAt: "2026-10-20T09:00:00.000Z" }),
    ];
    expect(digestRows(rows, now).map((r) => r.id)).toEqual(["new", "tie-b", "tie-a", "edge"]);
  });

  it("takes a different window and returns nothing when no row is recent", () => {
    const rows = [row("a", { receivedAt: "2026-10-18T12:00:00.000Z" })];
    expect(digestRows(rows, now, 1)).toEqual([]);
    expect(digestRows(rows, now, 3)).toHaveLength(1);
    expect(digestRows([], now)).toEqual([]);
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

describe("bulkInChunks", () => {
  it("sends 120 ids as slices of at most 50 in order and merges the results", async () => {
    const ids = Array.from({ length: 120 }, (_, i) => `m${i}`);
    const call = vi.fn(async (slice: string[]) => ({
      done: slice.filter((id) => id !== "m60"),
      failed: slice.includes("m60") ? [{ messageId: "m60", reason: "unavailable" as const }] : [],
    }));
    const result = await bulkInChunks(ids, call);
    expect(call.mock.calls.map(([slice]) => slice.length)).toEqual([50, 50, 20]);
    expect(result.done).toHaveLength(119);
    expect(result.failed).toEqual([{ messageId: "m60", reason: "unavailable" }]);
  });
});
