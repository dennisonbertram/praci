import { FINANCE_MCP_ENDPOINTS } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import { assignmentAllowsTool } from "./mcp-connector.js";

// A bank server whose integration agent was archived: archive releases it with no agent, not exclusive, writes off.
const ordinaryBot = { id: "bot-1", spawnKey: null, spaceId: "w1", userId: "u1", archivedAt: null };
const released = (endpoint: string) => ({
  botId: ordinaryBot.id,
  allowAllTools: true,
  allowedTools: [],
  server: {
    id: "s1",
    spaceId: "w1",
    userId: "u1",
    endpoint,
    writesEnabled: false,
    agentBotId: null,
    agentExclusive: false,
    agentBot: null,
  },
  bot: ordinaryBot,
});

describe("a released bank server", () => {
  it.each([
    ["mercury", "requestSendMoney", "getAccounts"],
    ["mercury", "requestTransferMoney", "getAccounts"],
    ["brex", "transfer_card", "get_card_by_id"],
  ] as const)("gives an ordinary bot reads only on %s (%s denied)", (provider, write, read) => {
    const assignment = released(FINANCE_MCP_ENDPOINTS[provider]);
    expect(assignmentAllowsTool(assignment, write)).toBe(false);
    expect(assignmentAllowsTool(assignment, write, { readOnlyHint: false })).toBe(false);
    expect(assignmentAllowsTool(assignment, read)).toBe(true);
  });
});
