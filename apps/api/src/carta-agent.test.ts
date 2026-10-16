import type { Actor, Bot } from "@rakazo/contracts";
import { CARTA_MCP_ENDPOINT, CARTA_READ_TOOLS, cartaAgentSpawnKey } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import { assignToExistingCartaAgent, ensureCartaAgent } from "./carta-agent.js";

const actor: Actor = {
  userId: "user-1",
  spaceId: "space-1",
  email: "user-1@rakazo.test",
  isDeploymentOwner: false,
};

function fakes(servers: Array<{ id: string; endpoint: string | null }>) {
  const bot = { id: "bot-1" } as Bot;
  const createBot = vi.fn(async () => bot);
  const findMany = vi.fn(async () => servers);
  const upsert = vi.fn(async () => ({}));
  const prisma = {
    mcpServer: { findMany },
    botMcpServer: { upsert },
    bot: { findFirst: vi.fn(async () => bot) },
  } as never;
  return { createBot, findMany, upsert, prisma, deps: { prisma, repos: { createBot } } };
}

describe("ensureCartaAgent", () => {
  it("creates the bot by spawn key and names the contact tools and skills", async () => {
    const { createBot, deps } = fakes([]);
    await ensureCartaAgent(deps, actor);
    const input = (createBot.mock.calls[0] as unknown as [Actor, Record<string, unknown>])[1];
    expect(input.spawnKey).toBe(cartaAgentSpawnKey("user-1"));
    expect(input.name).toBe("Carta agent");
    for (const word of ["contacts_save", "carta-investor-update", "carta-audit-response", "TBD"])
      expect(String(input.instructions)).toContain(word);
  });

  it("assigns only the actor's enabled Carta servers with the read tools, every call", async () => {
    const { upsert, findMany, deps } = fakes([
      { id: "srv-carta", endpoint: CARTA_MCP_ENDPOINT },
      { id: "srv-other", endpoint: "https://mcp.example.com/mcp" },
      { id: "srv-stdio", endpoint: null },
    ]);
    await ensureCartaAgent(deps, actor);
    await ensureCartaAgent(deps, actor);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { spaceId: "space-1", userId: "user-1", enabled: true } }),
    );
    expect(upsert).toHaveBeenCalledTimes(2);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { allowAllTools: false, allowedTools: [...CARTA_READ_TOOLS] },
        create: expect.objectContaining({ serverId: "srv-carta", allowAllTools: false }),
      }),
    );
  });

  it("assignToExistingCartaAgent narrows an existing agent's assignment", async () => {
    const { upsert, prisma } = fakes([{ id: "srv-carta", endpoint: CARTA_MCP_ENDPOINT }]);
    await assignToExistingCartaAgent(prisma, actor);
    expect(upsert).toHaveBeenCalledTimes(1);
  });
});
