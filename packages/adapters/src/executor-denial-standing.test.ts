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
const typed = { blocks: [{ kind: "text", text: "pay it again" }] };
const delegateReply = { blocks: [{ kind: "bot_message_received", text: "done" }] };

function prisma(messages: { blocks: unknown }[] = [], denials = 1) {
  const effects = Array.from({ length: denials }, (_, index) => ({
    id: `old-${index}`,
    status: "denied",
    // Only the oldest denial matches.
    request: index === denials - 1 ? request : { to: "Other", amount: index },
    result: null,
    updatedAt: deniedAt,
  }));
  return {
    message: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        where.id === "src"
          ? { blocks: [{ kind: "bot_message_received", returnToMessageId: "sent" }] }
          : { threadId: "requester-thread" },
      findMany: async ({ skip, take }: { skip: number; take: number }) =>
        messages.slice(skip, skip + take),
    },
    externalEffect: {
      findMany: async ({ skip, take }: { skip: number; take: number }) =>
        effects.slice(skip, skip + take),
    },
  } as unknown as PrismaClient;
}

const ask = (client: PrismaClient, over = {}) =>
  priorDenialAwaitingOwner(client, { ...run, ...over }, "mercury_send", { ...request }, "new");

describe("priorDenialAwaitingOwner", () => {
  it("returns the denial when the owner has not written since", async () => {
    await expect(ask(prisma())).resolves.toMatchObject({ id: "old-0" });
  });

  it("allows a new card after a message the owner typed", async () => {
    await expect(ask(prisma([typed]))).resolves.toBeUndefined();
  });

  it("keeps the denial when only a delegate reply arrived", async () => {
    await expect(ask(prisma([delegateReply]))).resolves.toMatchObject({ id: "old-0" });
  });

  it("finds a matching denial behind more than 50 others", async () => {
    await expect(ask(prisma([], 60))).resolves.toMatchObject({ id: "old-59" });
  });

  it("ignores runs that are not delegated", async () => {
    await expect(ask(prisma(), { trigger: "user" })).resolves.toBeUndefined();
  });
});
