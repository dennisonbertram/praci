import type { Actor } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import type { InboxDeps } from "./inbox.js";
import { inboxGet } from "./inbox.js";

const actor: Actor = {
  userId: "user-1",
  spaceId: "space-1",
  email: "user-1@rakazo.test",
  isDeploymentOwner: false,
};

type Row = Record<string, unknown> & { id: string; receivedAt: Date };
type Where = Record<string, unknown>;
type Order = Record<string, "asc" | "desc">;

const row = (n: number, extra: Partial<Row> = {}): Row => ({
  id: `msg-${String(n).padStart(3, "0")}`,
  spaceId: "space-1",
  userId: "user-1",
  connectionId: "conn-a",
  threadId: "thread-1",
  providerMessageId: `p-${n}`,
  isSpam: false,
  unread: false,
  inInbox: true,
  fromSelf: false,
  fromName: `Sender ${n}`,
  fromAddress: `sender${n}@example.test`,
  snippet: `Snippet ${n}`,
  receivedAt: new Date(Date.UTC(2026, 0, 1, 0, n)),
  ...extra,
});

function stub(rows: Row[]) {
  const matches = (r: Row, where: Where) =>
    Object.entries(where).every(([k, v]) => {
      if (k === "receivedAt") {
        const range = v as { gt?: Date; lte?: Date };
        return (!range.gt || r.receivedAt > range.gt) && (!range.lte || r.receivedAt <= range.lte);
      }
      if (v && typeof v === "object" && "not" in v) return r[k] !== (v as { not: unknown }).not;
      return r[k] === v;
    });
  const prisma = {
    cachedMailMessage: {
      findFirst: async ({ where }: { where: Where }) => rows.find((r) => matches(r, where)) ?? null,
      findMany: async ({
        where,
        orderBy,
        take,
      }: {
        where: Where;
        orderBy: Order[];
        take: number;
      }) => {
        const sorted = rows.filter((r) => matches(r, where));
        sorted.sort((a, b) => {
          for (const o of orderBy) {
            const [key, dir] = Object.entries(o)[0] as [string, "asc" | "desc"];
            const x = a[key] as Date | string;
            const y = b[key] as Date | string;
            if (x === y || +x === +y) continue;
            return (x < y ? -1 : 1) * (dir === "asc" ? 1 : -1);
          }
          return 0;
        });
        return sorted.slice(0, take);
      },
    },
  };
  const mail = {
    listAccounts: async () => [{ id: "conn-a", address: "me@example.test" }],
    getMessage: async () => ({
      from: { address: "ann@example.test" },
      to: [],
      cc: [],
      replyTo: [],
      date: "2026-01-01T00:00:00.000Z",
      subject: "Hi",
      html: null,
      text: "Hello",
      attachments: [],
    }),
  };
  return { prisma, mail } as unknown as InboxDeps;
}

describe("inboxGet thread", () => {
  it("shows the 50 messages before the opened one in a long thread", async () => {
    const rows = Array.from({ length: 61 }, (_, i) => row(i + 1));
    const result = await inboxGet(stub(rows), actor, { messageId: "msg-061" });
    const ids = result.thread.map((m) => m.id);
    expect(ids).toHaveLength(50);
    expect(ids[0]).toBe("msg-011");
    expect(ids.at(-1)).toBe("msg-060");
    expect(ids).toEqual([...ids].sort());
    expect(result.later).toEqual([]);
  });

  it("keeps earlier and later messages around a short thread", async () => {
    const rows = [row(1), row(2), row(3, { fromSelf: true })];
    const result = await inboxGet(stub(rows), actor, { messageId: "msg-002" });
    expect(result.thread.map((m) => m.id)).toEqual(["msg-001"]);
    expect(result.later).toEqual([
      {
        id: "msg-003",
        from: "Sender 3",
        receivedAt: "2026-01-01T00:03:00.000Z",
        snippet: "Snippet 3",
        fromSelf: true,
      },
    ]);
  });
});
