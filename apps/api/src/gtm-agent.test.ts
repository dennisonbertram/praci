import type { Actor, Bot } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import { PAST_DEFAULTS } from "./agent-past-defaults.fixture.js";
import { ensureGtmBot, GTM_AGENT_INSTRUCTIONS } from "./gtm-agent.js";

const actor: Actor = {
  userId: "user-1",
  spaceId: "space-1",
  email: "user-1@rakazo.test",
  isDeploymentOwner: false,
};

describe("ensureGtmBot", () => {
  it("upgrades an earlier default, leaves edited text and the current text alone", async () => {
    const replaceBotInstructions = vi.fn(async () => undefined);
    const createBot = vi.fn();
    const prisma = {
      bot: { findFirst: vi.fn(async () => ({ id: "bot-1" })) },
      $transaction: vi.fn(async () => undefined),
    };
    const deps = { prisma, repos: { createBot, replaceBotInstructions } } as never;
    const current = GTM_AGENT_INSTRUCTIONS;
    const earlier = PAST_DEFAULTS.gtm![0]!;
    expect(earlier).not.toBe(current);
    const run = async (instructions: string) => {
      createBot.mockResolvedValueOnce({ id: "bot-1", instructions } as Bot);
      return ensureGtmBot(deps, actor);
    };
    expect((await run(earlier)).instructions).toBe(current);
    expect(replaceBotInstructions).toHaveBeenCalledWith(actor, "bot-1", {
      from: earlier,
      to: current,
    });
    replaceBotInstructions.mockClear();
    await run(`${earlier} Mine.`);
    await run(current);
    expect(replaceBotInstructions).not.toHaveBeenCalled();
  });
});
