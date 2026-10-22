import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it } from "vitest";
import { priorDenialAwaitingOwner } from "./executor.js";

const run = {
  spaceId: "s",
  userId: "u",
  botId: "bank",
  trigger: "bot_message",
  sourceMessageId: "src",
};
const request = { to: "Acme", amount: 300 };
const deniedAt = new Date("2026-01-01T10:00:00Z");

function prisma(ownerMessageAt?: Date) {
  return {
    message: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === "src"
          ? { blocks: [{ kind: "bot_message_received", returnToMessageId: "sent" }] }
          : { threadId: "requester-thread" },
      findFirst: async ({ where }: { where: { createdAt: { gt: Date } } }) =>
        ownerMessageAt && ownerMessageAt > where.createdAt.gt ? { id: "m" } : null,
    },
    externalEffect: {
      findMany: async () => [
        { id: "old", status: "denied", request, result: null, updatedAt: deniedAt },
      ],
    },
  } as unknown as PrismaClient;
}

describe("priorDenialAwaitingOwner", () => {
  it("returns the denial when the owner has not written since", async () => {
    await expect(
      priorDenialAwaitingOwner(prisma(), run, "mercury_send", { ...request }, "new"),
    ).resolves.toMatchObject({ id: "old" });
  });

  it("allows a new card after a newer owner message", async () => {
    const later = new Date("2026-01-01T11:00:00Z");
    await expect(
      priorDenialAwaitingOwner(prisma(later), run, "mercury_send", request, "new"),
    ).resolves.toBeUndefined();
  });

  it("ignores runs that are not delegated", async () => {
    await expect(
      priorDenialAwaitingOwner(
        prisma(),
        { ...run, trigger: "user" },
        "mercury_send",
        request,
        "new",
      ),
    ).resolves.toBeUndefined();
  });
});
