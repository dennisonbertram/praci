import { integrationAgentSpawnKey } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import { isIntegrationAgentWrite } from "./approval-ask.js";
import { selectBuiltinToolsForRun } from "./executor.js";

const agent = integrationAgentSpawnKey("server-1");
const route = { connectorId: "mcp" };

describe("integration agent write approval", () => {
  it("requires approval for any MCP tool not marked read, never for a read", () => {
    expect(isIntegrationAgentWrite(agent, route, false)).toBe(true);
    expect(isIntegrationAgentWrite(agent, route, undefined)).toBe(true);
    expect(isIntegrationAgentWrite(agent, route, true)).toBe(false);
  });
  it("leaves other bots and non-MCP routes alone", () => {
    expect(isIntegrationAgentWrite(null, route, false)).toBe(false);
    expect(isIntegrationAgentWrite("carta-agent:u1", route, false)).toBe(false);
    expect(isIntegrationAgentWrite(agent, { connectorId: "composio" }, false)).toBe(false);
    expect(isIntegrationAgentWrite(agent, undefined, false)).toBe(false);
  });
});

describe("integration agent built-in tools", () => {
  const base = {
    graphicalToolsAllowed: false,
    groupId: null,
    trigger: "user",
    semanticMemoryEnabled: false,
    messagingChannelRun: false,
    mailEnabled: true,
    calendarEnabled: true,
    driveEnabled: true,
    dataRoomEnabled: true,
    financeEnabled: true,
    contactsEnabled: true,
  };
  const names = (integrationAgent: boolean) =>
    selectBuiltinToolsForRun({ ...base, integrationAgent }).map((tool) => tool.name);
  it("drops mail, Drive, Data room, finance and contact tools but keeps messaging", () => {
    expect(names(false)).toContain("mail_send");
    expect(names(false)).toContain("drive_search");
    const own = names(true);
    expect(own).not.toContain("mail_send");
    expect(own).not.toContain("drive_search");
    expect(own.some((n) => n.startsWith("finance_"))).toBe(false);
    expect(own).toContain("message_bot");
  });
});
