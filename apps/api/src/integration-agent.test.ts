import type { Actor } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import { ensureConnectedAppAgent, instructions } from "./integration-agent.js";

const actor = {
  userId: "user",
  spaceId: "space",
  email: "user@rakazo.test",
  isDeploymentOwner: false,
} as Actor;

describe("connected app agent description", () => {
  it("is a plain line for the user, with the routing hint left to the roster", async () => {
    const connection = {
      id: "c1",
      connectorId: "composio",
      provider: "SLACK",
      displayName: "Slack",
      status: "connected",
      metadata: {},
    };
    const createBot = vi.fn(async () => ({ id: "bot" }));
    const tx = {
      bot: { updateMany: vi.fn(async () => ({ count: 1 })) },
      connection: {
        findFirstOrThrow: vi.fn(async () => connection),
        updateMany: vi.fn(async () => ({ count: 1 })),
      },
      botConnectionAccess: { upsert: vi.fn(), deleteMany: vi.fn() },
    };
    const prisma = {
      connection: { findFirst: vi.fn(async () => connection), count: vi.fn(async () => 1) },
      bot: { findFirst: vi.fn(async () => null) },
      $transaction: vi.fn(async (fn: (t: unknown) => unknown) => fn(tx)),
    };
    await ensureConnectedAppAgent(
      { prisma, repos: { createBot }, archiveBot: vi.fn() } as never,
      actor,
      "c1",
    ).catch(() => undefined);
    const input = createBot.mock.calls[0]?.[1] as { description: string };
    expect(input.description).toBe("Your Slack account");
    expect(input.description).not.toContain("message_bot");
  });
});

describe("writer agent instructions on payment outcomes", () => {
  it("allows 'sent' only when the tool result shows acceptance and reports failures", () => {
    const text = instructions("Mercury");
    expect(text).toContain("only when the tool result shows Mercury accepted it");
    expect(text).toContain("error or refuses the call, report that failure");
    expect(text).not.toContain("say it was sent; never");
  });
});
