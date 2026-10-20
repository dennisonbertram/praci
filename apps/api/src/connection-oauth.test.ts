import { describe, expect, it, vi } from "vitest";
import { completeNativeOAuth } from "./connection-oauth.js";

const actor = { spaceId: "s1", userId: "u1" };

/** A small in-memory store with just the calls completeNativeOAuth makes. */
function setup(replacesConnectionId?: string) {
  const rows: Record<string, Record<string, unknown>> = {
    old: {
      id: "old",
      status: "connected",
      providerRef: "acct-1",
      secretId: "sec-old",
      metadata: {},
    },
    pending: {
      id: "pending",
      status: "pending",
      providerRef: "state-1",
      secretId: null,
      metadata: replacesConnectionId ? { replacesConnectionId } : {},
      connectorId: "google",
      provider: "gmail",
      displayName: "Gmail",
      createdAt: new Date(),
    },
  };
  const owner = { connectorId: "google", provider: "gmail" };
  for (const row of Object.values(rows)) Object.assign(row, owner);
  const todos = [{ id: "t1", connectionId: "old" }];
  const messages = [{ id: "m1", connectionId: "old" }];
  const stats = [{ id: "s1", connectionId: "old" }];
  const decisions = [{ id: "d1", connectionId: "old", ruleId: "filter-1" }];
  const actionLogs = [{ id: "l1", connectionId: "old" }];
  const secrets = new Set(["sec-old", "sec-new"]);
  const move = (list: { connectionId: string }[]) =>
    vi.fn(
      async ({
        where,
        data,
      }: {
        where: { connectionId: string };
        data: { connectionId: string };
      }) => {
        for (const item of list)
          if (item.connectionId === where.connectionId) item.connectionId = data.connectionId;
        return { count: 1 };
      },
    );
  const tx = {
    $queryRaw: vi.fn(async () => []),
    connection: {
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        if (where.id === "pending") return rows.pending;
        if (where.id === "old") return rows.old ?? null;
        if (where.providerRef === "acct-1") return rows.old ?? null;
        return null;
      }),
      update: vi.fn(
        async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) =>
          Object.assign(rows[where.id]!, data),
      ),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        delete rows[where.id];
      }),
    },
    cachedMailMessage: { updateMany: move(messages) },
    mailSenderStat: { updateMany: move(stats), deleteMany: vi.fn(async () => ({ count: 0 })) },
    mailSenderDecision: {
      updateMany: move(decisions),
      deleteMany: vi.fn(async () => ({ count: 0 })),
    },
    mailActionLog: { updateMany: move(actionLogs) },
    inboxTodo: { updateMany: move(todos) },
    composeSend: { updateMany: vi.fn(async () => ({ count: 0 })) },
    botConnectionAccess: {
      findMany: vi.fn(async () => []),
      deleteMany: vi.fn(async () => ({ count: 0 })),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    bot: { updateMany: vi.fn(async () => ({ count: 0 })) },
    secret: {
      deleteMany: vi.fn(async ({ where }: { where: { id: string } }) => {
        secrets.delete(where.id);
        return { count: 1 };
      }),
    },
  };
  const prisma = {
    connection: { findFirst: vi.fn(async () => rows.pending) },
    secret: { deleteMany: vi.fn(async () => ({ count: 1 })) },
    $transaction: async (fn: (t: typeof tx) => unknown) => fn(tx),
  };
  const run = () =>
    completeNativeOAuth({
      prisma: prisma as never,
      actor,
      connector: {
        prepare: undefined,
        complete: async () => ({
          connectionRef: "acct-1",
          secretId: "sec-new",
          scope: "openid email gmail.readonly",
        }),
      } as never,
      connectorId: "google",
      state: "state-1",
      code: "c",
      context: {} as never,
      lock: async () => undefined,
    });
  return { rows, todos, messages, stats, decisions, actionLogs, tx, secrets, run, prisma };
}

describe("completeNativeOAuth, after the commit", () => {
  it("keeps the committed credential when the follow-up read fails", async () => {
    const f = setup();
    f.rows.old = undefined as never;
    delete f.rows.old;
    f.prisma.connection.findFirst
      .mockResolvedValueOnce(f.rows.pending as never)
      .mockRejectedValue(new Error("db down"));
    const done = await f.run();
    expect(done.status).toBe("connected");
    expect(f.prisma.secret.deleteMany).not.toHaveBeenCalled();
  });
});

describe("completeNativeOAuth, same account again", () => {
  it("rejects a second sign-in of an account that is already connected", async () => {
    const f = setup();
    await expect(f.run()).rejects.toMatchObject({ code: "CONFLICT" });
    expect(f.todos[0]?.connectionId).toBe("old");
  });

  it("lets a reconnect replace the old connection and keeps its to-dos and cached mail", async () => {
    const f = setup("old");
    const done = await f.run();
    expect(done.id).toBe("pending");
    expect(done.status).toBe("connected");
    expect(f.todos[0]?.connectionId).toBe("pending");
    expect(f.messages[0]?.connectionId).toBe("pending");
    expect(f.rows.old).toBeUndefined();
    expect(f.secrets.has("sec-old")).toBe(false);
  });

  it("moves sender stats to the new connection on reconnect", async () => {
    const f = setup("old");
    await f.run();
    expect(f.stats[0]?.connectionId).toBe("pending");
    // The new connection's own rows are cleared first, so the move cannot hit the unique key.
    expect(f.tx.mailSenderStat.deleteMany).toHaveBeenCalledWith({
      where: { connectionId: "pending" },
    });
  });

  it("moves skip decisions and action logs to the new connection, keeping the Gmail filter id", async () => {
    const f = setup("old");
    await f.run();
    // The old row is deleted and both tables cascade on it, so they must move first.
    expect(f.decisions[0]).toMatchObject({ connectionId: "pending", ruleId: "filter-1" });
    expect(f.actionLogs[0]?.connectionId).toBe("pending");
    expect(f.tx.mailSenderDecision.deleteMany).toHaveBeenCalledWith({
      where: { connectionId: "pending" },
    });
  });

  it("stores the scope Google granted on the connection", async () => {
    const f = setup("old");
    await f.run();
    expect(f.rows.pending?.metadata).toEqual({ scope: "openid email gmail.readonly" });
  });
});
