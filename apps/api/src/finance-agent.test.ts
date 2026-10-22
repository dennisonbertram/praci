import { BUILTIN_AGENT_SKILLS } from "@rakazo/adapters";
import type { Actor, Bot } from "@rakazo/contracts";
import {
  CRYPTO_MCP_ENDPOINT,
  CRYPTO_READ_TOOLS,
  FINANCE_MCP_ENDPOINTS,
  FINANCE_READ_TOOLS,
  financeAgentSpawnKey,
} from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import { ensureFinanceAgent } from "./finance-agent.js";

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
  const prisma = { mcpServer: { findMany }, botMcpServer: { upsert } } as never;
  return { bot, createBot, findMany, upsert, deps: { prisma, repos: { createBot } } };
}

describe("ensureFinanceAgent", () => {
  it("creates the bot only through createBot, keyed by the helper and the session actor", async () => {
    const { bot, createBot, deps } = fakes([]);

    await expect(ensureFinanceAgent(deps, actor)).resolves.toBe(bot);

    expect(createBot).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({
        spawnKey: financeAgentSpawnKey("user-1"),
        name: "Finance agent",
        notifyOnFinish: true,
      }),
    );
    const input = (createBot.mock.calls[0] as unknown as [Actor, Record<string, unknown>])[1];
    expect(String(input.instructions)).toContain("can read but not move money");
    // Only a direct user chat sees the summary card; another agent needs the figures in text.
    expect(String(input.instructions)).toContain(
      "when another agent messaged you, include the figures",
    );
    // The intro covers statements and crypto, not only Mercury and Brex.
    expect(input.description).toBe(
      "Answers questions about your bank, card, statement and crypto accounts.",
    );
  });

  it("assigns each finance server with its explicit read-only tools, not all tools", async () => {
    const { upsert, findMany, deps } = fakes([
      { id: "srv-mercury", endpoint: FINANCE_MCP_ENDPOINTS.mercury },
      { id: "srv-brex", endpoint: FINANCE_MCP_ENDPOINTS.brex },
      { id: "srv-other", endpoint: "https://mcp.example.com/mcp" },
      { id: "srv-stdio", endpoint: null },
    ]);

    await ensureFinanceAgent(deps, actor);

    // Only the actor's own servers are read.
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { spaceId: "space-1", userId: "user-1", enabled: true },
      }),
    );
    expect(upsert).toHaveBeenCalledTimes(2);
    const byServer = new Map(
      upsert.mock.calls.map(([arg]) => {
        const call = arg as { create: Record<string, unknown>; update: Record<string, unknown> };
        return [call.create.serverId, call] as const;
      }),
    );
    for (const [serverId, provider] of [
      ["srv-mercury", "mercury"],
      ["srv-brex", "brex"],
    ] as const) {
      const call = byServer.get(serverId);
      expect(call?.create).toMatchObject({
        spaceId: "space-1",
        userId: "user-1",
        botId: "bot-1",
        allowAllTools: false,
        allowedTools: [...FINANCE_READ_TOOLS[provider]],
      });
      // A repeat call rewrites the list, so a wider one left behind is narrowed again.
      expect(call?.update).toEqual({
        allowAllTools: false,
        allowedTools: [...FINANCE_READ_TOOLS[provider]],
      });
    }
  });
});

describe("crypto server", () => {
  it("is assigned with only the crypto read tools", async () => {
    const { upsert, deps } = fakes([{ id: "srv-crypto", endpoint: CRYPTO_MCP_ENDPOINT }]);
    await ensureFinanceAgent(deps, actor);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect((upsert.mock.calls[0]![0] as { create: unknown }).create).toMatchObject({
      serverId: "srv-crypto",
      allowAllTools: false,
      allowedTools: [...CRYPTO_READ_TOOLS],
    });
  });
});

describe("FINANCE_READ_TOOLS", () => {
  // The live Mercury and Brex servers also offer these write tools; none may be allowed.
  const WRITE_TOOLS = [
    "createCategory",
    "editCategory",
    "requestSendMoney",
    "requestTransferMoney",
    "updateTransaction",
    "assign_limit_for_card_expenses",
    "assign_limit_to_card",
    "cancel_card",
    "create_employee_card",
    "create_purchasing_card",
    "lock_card",
    "unlock_card",
    "replace_attendees_for_card_expense",
    "replace_card",
    "ship_physical_card",
    "start_expense_download",
    "submit_feedback",
    "transfer_card",
    "update_employee_card",
    "update_expense_memo",
    "update_purchasing_card",
    "upload_card_expense_receipt_from_urls",
    "verify_shipping_address",
  ];

  it("lists only read tools", () => {
    const all: string[] = [...FINANCE_READ_TOOLS.mercury, ...FINANCE_READ_TOOLS.brex];
    for (const name of all) {
      expect(name).toMatch(/^(get|list|query)[A-Z_]/);
      expect(WRITE_TOOLS).not.toContain(name);
    }
    expect(new Set(all).size).toBe(all.length);
  });

  it("leaves out Mercury's cashflow summary, which counts Treasury moves as flows", () => {
    expect(FINANCE_READ_TOOLS.mercury).not.toContain("getCashflowSummary");
  });
});

describe("built-in finance skills", () => {
  const skills = BUILTIN_AGENT_SKILLS.filter((skill) => skill.name.startsWith("finance-"));
  const readTools = new Set<string>([
    ...FINANCE_READ_TOOLS.mercury,
    ...FINANCE_READ_TOOLS.brex,
    ...CRYPTO_READ_TOOLS,
  ]);

  it("ships the five skills with a short picker description", () => {
    expect(skills.map((skill) => skill.name).sort()).toEqual([
      "finance-categorize",
      "finance-cost-cutting",
      "finance-crypto",
      "finance-monthly-review",
      "finance-runway-scenarios",
    ]);
    for (const skill of skills) expect(skill.description.length).toBeLessThanOrEqual(72);
  });

  it("names only read tools of Mercury, Brex and Blockscout", () => {
    for (const skill of skills) {
      const named =
        skill.content.match(/\b(?:get|list|query)[A-Z]\w*|\b(?:get|list|query)_\w+/g) ?? [];
      expect(named.length).toBeGreaterThan(0);
      for (const name of named) expect(readTools.has(name), `${skill.name}: ${name}`).toBe(true);
    }
  });
});
