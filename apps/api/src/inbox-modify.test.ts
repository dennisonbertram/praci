import type { MailLabelChange } from "@rakazo/adapter-kit";
import { MailProviderError } from "@rakazo/adapter-kit";
import type { Actor } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import type { ModifyDeps } from "./inbox-modify.js";
import { inboxArchiveMany, inboxMarkReadMany, inboxMoveMany } from "./inbox-modify.js";

const actor: Actor = {
  userId: "user-1",
  spaceId: "space-1",
  email: "user-1@rakazo.test",
  isDeploymentOwner: false,
};

const account = {
  id: "conn-a",
  spaceId: "space-1",
  userId: "user-1",
  connectorId: "emulator",
  provider: "gmail",
  displayName: "box-a",
};

const row = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  connectionId: "conn-a",
  threadId: `t-${id}`,
  providerMessageId: `p-${id}`,
  fromAddress: "Ann@Example.test",
  inInbox: true,
  pile: null,
  isSpam: false,
  ...extra,
});

function makeDeps(
  rows: ReturnType<typeof row>[],
  overrides: Record<string, unknown> = {},
  mailOverrides: Record<string, unknown> = {},
) {
  const executed: unknown[] = [];
  const threadCalls: { connectionId: string; threadId: string; label: MailLabelChange }[] = [];
  const messageCalls: { connectionId: string; providerMessageId: string; label: MailLabelChange }[] =
    [];
  const reconnectFlags: string[] = [];
  const prisma = {
    cachedMailMessage: {
      findMany: async () => rows,
      findFirst: async ({ where }: { where: { id: string } }) =>
        rows.find((r) => r.id === where.id) ?? null,
      updateMany: async () => ({ count: 1 }),
    },
    inboxSenderFeedback: { upsert: async () => ({}) },
    mailActionLog: { deleteMany: async () => ({ count: 0 }) },
    mailSyncState: {
      upsert: async ({ where }: { where: { connectionId: string } }) => {
        reconnectFlags.push(where.connectionId);
        return {};
      },
    },
    $executeRaw: async (...args: unknown[]) => {
      executed.push(args);
      return 1;
    },
    ...overrides,
  };
  const mail = {
    listAccounts: async () => [account],
    modifyThread: async (
      acc: { id: string },
      threadId: string,
      label: MailLabelChange,
    ): Promise<void> => {
      threadCalls.push({ connectionId: acc.id, threadId, label });
    },
    modifyMessage: async (
      acc: { id: string },
      providerMessageId: string,
      label: MailLabelChange,
    ): Promise<void> => {
      messageCalls.push({ connectionId: acc.id, providerMessageId, label });
    },
    ...mailOverrides,
  };
  return {
    deps: { prisma, mail } as unknown as ModifyDeps,
    executed,
    threadCalls,
    messageCalls,
    reconnectFlags,
  };
}

describe("inbox bulk modify", () => {
  it("keeps finished ids when a later one hits an unexpected error", async () => {
    const rows = [row("m1"), row("m2")];
    const { deps } = makeDeps(rows, {
      cachedMailMessage: {
        findMany: async () => rows,
        findFirst: async ({ where }: { where: { id: string } }) => row(where.id),
        updateMany: async ({ where }: { where: { threadId?: string } }) => {
          if (where.threadId === "t-m2") throw new Error("db down");
          return { count: 1 };
        },
      },
    });
    const result = await inboxArchiveMany(deps, actor, { messageIds: ["m1", "m2"] });
    expect(result.done).toEqual(["m1"]);
    expect(result.failed).toEqual([{ messageId: "m2", reason: "unavailable" }]);
  });

  it("still logs the undo batch when marking the sender fails after a not-spam move", async () => {
    const { deps, executed } = makeDeps([row("m1", { isSpam: false, pile: "spam" })], {
      inboxSenderFeedback: {
        upsert: async () => {
          throw new Error("db down");
        },
      },
    });
    const result = await inboxMoveMany(deps, actor, { op: "notSpam", messageIds: ["m1"] });
    expect(result.done).toEqual(["m1"]);
    expect(result.batchId).toEqual(expect.any(String));
    expect(executed.length).toBeGreaterThan(0);
  });
});

describe("inboxMarkReadMany", () => {
  it("marks each found thread read and reports an id that is not the user's as not_found", async () => {
    const { deps, threadCalls, messageCalls } = makeDeps([row("m1"), row("m2")]);
    const result = await inboxMarkReadMany(deps, actor, {
      messageIds: ["m1", "m2", "m3"],
      read: true,
    });
    expect(threadCalls).toHaveLength(2);
    expect(threadCalls.map((call) => call.threadId).sort()).toEqual(["t-m1", "t-m2"]);
    for (const call of threadCalls)
      expect(call.label).toEqual({ removeLabelIds: ["UNREAD"] });
    expect(messageCalls).toHaveLength(0);
    expect(result.done.sort()).toEqual(["m1", "m2"]);
    expect(result.failed).toEqual([{ messageId: "m3", reason: "not_found" }]);
  });

  it("marks only each message unread when read is false", async () => {
    const { deps, threadCalls, messageCalls } = makeDeps([row("m1"), row("m2")]);
    const result = await inboxMarkReadMany(deps, actor, {
      messageIds: ["m1", "m2"],
      read: false,
    });
    expect(threadCalls).toHaveLength(0);
    expect(messageCalls).toHaveLength(2);
    for (const call of messageCalls) expect(call.label).toEqual({ addLabelIds: ["UNREAD"] });
    expect(result.done.sort()).toEqual(["m1", "m2"]);
    expect(result.failed).toEqual([]);
  });

  it("refuses when mail writes are off and never calls the provider", async () => {
    const { deps, threadCalls, messageCalls } = makeDeps([row("m1")]);
    deps.mailWritesDisabled = true;
    await expect(
      inboxMarkReadMany(deps, actor, { messageIds: ["m1"], read: true }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(threadCalls).toHaveLength(0);
    expect(messageCalls).toHaveLength(0);
  });

  it("flags reconnect and reports reconnect for only the id whose account needs a new login", async () => {
    const { deps, reconnectFlags } = makeDeps(
      [row("m1"), row("m2")],
      {},
      {
        modifyThread: async (_acc: { id: string }, threadId: string): Promise<void> => {
          if (threadId === "t-m2") throw new MailProviderError("auth", "revoked");
        },
      },
    );
    const result = await inboxMarkReadMany(deps, actor, {
      messageIds: ["m1", "m2"],
      read: true,
    });
    expect(result.done).toEqual(["m1"]);
    expect(result.failed).toEqual([{ messageId: "m2", reason: "reconnect" }]);
    expect(reconnectFlags).toEqual(["conn-a"]);
  });
});
