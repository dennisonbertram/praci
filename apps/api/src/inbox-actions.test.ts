import type { Actor } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import { inboxActionsUndo } from "./inbox-actions.js";

const actor: Actor = {
  userId: "user-1",
  spaceId: "space-1",
  email: "user-1@rakazo.test",
  isDeploymentOwner: false,
};
const account = { id: "conn-a", spaceId: "space-1", userId: "user-1" };

function setup(kind: string, claimed: number, effectId: string | null = null) {
  const cacheWrites: unknown[] = [];
  const approvalReads = vi.fn(async () => null);
  const logRow = {
    id: "log-1",
    kind,
    connectionId: "conn-a",
    threadIds: ["t1"],
    senderAddresses: ["ann@example.test"],
    source: "user",
    effectId,
  };
  const prisma = {
    mailActionLog: {
      findMany: async () => [logRow],
      updateMany: async () => ({ count: claimed }),
    },
    cachedMailMessage: {
      updateMany: async ({ data }: { data: unknown }) => {
        cacheWrites.push(data);
        return { count: 1 };
      },
    },
    mailSenderDecision: { findMany: async () => [], deleteMany: vi.fn(), updateMany: vi.fn() },
    approvalDecision: { findFirst: approvalReads, create: vi.fn(), updateMany: vi.fn() },
  };
  const deps = {
    prisma,
    mail: { listAccounts: async () => [account], modifyThread: async () => undefined },
  };
  return { deps, cacheWrites, approvalReads };
}

describe("inboxActionsUndo", () => {
  it("forgets the not-spam choice when undoing Not spam", async () => {
    const { deps, cacheWrites } = setup("not_spam", 1);
    await inboxActionsUndo(deps as any, actor, { batchId: "b1" });
    expect(cacheWrites).toEqual([{ inInbox: false, isSpam: true, notSpamAt: null }]);
  });

  it("records the approval undo only when this request marked the row undone", async () => {
    const lost = setup("archive", 0, "effect-1");
    await inboxActionsUndo(lost.deps as any, actor, { batchId: "b1" });
    expect(lost.approvalReads).not.toHaveBeenCalled();

    const won = setup("archive", 1, "effect-1");
    await inboxActionsUndo(won.deps as any, actor, { batchId: "b1" });
    expect(won.approvalReads).toHaveBeenCalled();
  });
});
