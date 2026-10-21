import {
  botCanReadDataRoom,
  CARTA_MCP_ENDPOINT,
  cartaAgentSpawnKey,
  inboxAgentSpawnKey,
  mailThreadAgentSpawnKey,
} from "@rakazo/contracts";
import { botCanReachConnection, botUsesConnectorTools } from "@rakazo/core";
import { describe, expect, it } from "vitest";
import { isCartaMailSend } from "./approval-ask.js";
import { financeToolsAllowed } from "./finance-tools.js";
import { assignmentAllowsTool } from "./mcp-connector.js";

const inbox = inboxAgentSpawnKey("u1");
const thread = mailThreadAgentSpawnKey("conn-1", "thread-1");
const threadBot = { id: "bot-thread", spawnKey: thread };

describe("an email's own agent has the Inbox agent's mail permissions", () => {
  it("gets no connector tools and reaches every Gmail account, as the Inbox agent does", () => {
    expect(botUsesConnectorTools(thread)).toBe(botUsesConnectorTools(inbox));
    expect(botUsesConnectorTools(thread)).toBe(false);
    const gmail = { id: "c1", connectorId: "composio", agentBotId: null, provider: "gmail" };
    expect(botCanReachConnection(threadBot, gmail)).toBe(true);
    expect(botCanReachConnection({ id: "bot-inbox", spawnKey: inbox }, gmail)).toBe(true);
  });

  it("asks for approval on every mail_send, whatever the saved rules say", () => {
    expect(isCartaMailSend(thread, "mail_send")).toBe(true);
    expect(isCartaMailSend(inbox, "mail_send")).toBe(true);
    expect(isCartaMailSend(thread, "mail_search")).toBe(false);
    expect(isCartaMailSend("onboarding:first", "mail_send")).toBe(false);
  });
});

describe("an email's own agent has no Carta or Finance tools of its own", () => {
  it("is refused the Finance and Carta built-ins", () => {
    expect(
      financeToolsAllowed({
        hasProvider: true,
        groupId: null,
        runUserId: "u1",
        botUserId: "u1",
        trigger: "user",
        messagingChannelRun: false,
        botSpawnKey: thread,
      }),
    ).toBe(false);
  });

  it("is refused Carta write tools, and holds no Carta assignment", () => {
    const assignment = {
      allowAllTools: true,
      allowedTools: [],
      server: {
        id: "server-1",
        endpoint: CARTA_MCP_ENDPOINT,
        spaceId: "w1",
        userId: "u1",
        agentBotId: "bot-carta",
        agentExclusive: false,
        agentBot: {
          id: "bot-carta",
          spawnKey: cartaAgentSpawnKey("u1"),
          spaceId: "w1",
          userId: "u1",
          archivedAt: null,
        },
      },
      bot: { ...threadBot, spaceId: "w1", userId: "u1", archivedAt: null },
    };
    expect(assignmentAllowsTool(assignment, "mutate")).toBe(false);
  });

  it("can read the Data room, as the Inbox agent can", () => {
    expect(botCanReadDataRoom(threadBot)).toBe(true);
    expect(botCanReadDataRoom({ spawnKey: inbox })).toBe(true);
  });
});
