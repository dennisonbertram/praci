import type { Actor, Bot } from "@rakazo/contracts";
import {
  INVESTORS_AGENT_BUILTIN_TOOLS,
  investorsAgentSpawnKey,
  isInvestorsAgentSpawnKey,
  pageAgentColor,
} from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import { ensureInvestorsAgent } from "./investors-agent.js";

const actor: Actor = {
  userId: "user-1",
  spaceId: "space-1",
  email: "user-1@rakazo.test",
  isDeploymentOwner: false,
};

describe("ensureInvestorsAgent", () => {
  it("creates the bot only through createBot, keyed by the user's spawn key, and returns the same bot again", async () => {
    const bot = { id: "bot-1" } as Bot;
    const createBot = vi.fn(async () => bot);

    await expect(ensureInvestorsAgent({ repos: { createBot } }, actor)).resolves.toBe(bot);
    await expect(ensureInvestorsAgent({ repos: { createBot } }, actor)).resolves.toBe(bot);

    expect(investorsAgentSpawnKey("user-1")).toBe("investors-agent:user-1");
    expect(isInvestorsAgentSpawnKey("investors-agent:other")).toBe(true);
    expect(isInvestorsAgentSpawnKey("carta-agent:user-1")).toBe(false);
    expect(createBot).toHaveBeenCalledTimes(2);
    for (const call of createBot.mock.calls) {
      expect(call).toEqual([
        actor,
        expect.objectContaining({
          spawnKey: "investors-agent:user-1",
          name: "Investors agent",
          color: pageAgentColor("investors"),
        }),
      ]);
    }
  });

  it("offers read tools only: no mail_send, no cap_table_update, nothing that deletes", () => {
    expect(INVESTORS_AGENT_BUILTIN_TOOLS).toEqual(
      expect.arrayContaining(["cap_table_read", "search_data_room", "finance_overview"]),
    );
    expect(INVESTORS_AGENT_BUILTIN_TOOLS).not.toContain("mail_send");
    expect(INVESTORS_AGENT_BUILTIN_TOOLS).not.toContain("cap_table_update");
    for (const name of INVESTORS_AGENT_BUILTIN_TOOLS) {
      expect(name).not.toMatch(/delete|remove|trash|^mcp__/);
    }
  });
});
