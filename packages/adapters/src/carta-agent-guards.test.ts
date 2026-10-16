import {
  CARTA_READ_TOOLS,
  CARTA_WRITE_TOOLS,
  cartaAgentSpawnKey,
  financeAgentSpawnKey,
} from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import {
  buildApprovalAskBlock,
  cartaMailSendIsComplete,
  isCartaMailSend,
  isCartaWrite,
} from "./approval-ask.js";
import { selectBuiltinToolsForRun } from "./executor.js";
import { financeToolsAllowed } from "./finance-tools.js";
import { assignmentAllowsTool } from "./mcp-connector.js";

const carta = cartaAgentSpawnKey("u1");
const server = { endpoint: "https://mcp.app.carta.com/mcp" };

describe("assignmentAllowsTool for the Carta agent", () => {
  it("passes only read tools on a Carta server, even with allowAllTools", () => {
    const assignment = { allowAllTools: true, allowedTools: [], server, bot: { spawnKey: carta } };
    expect(assignmentAllowsTool(assignment, "write_something")).toBe(false);
    expect(assignmentAllowsTool(assignment, CARTA_READ_TOOLS[0])).toBe(true);
  });
  it("blocks every tool of a non-Carta server for the Carta agent", () => {
    expect(
      assignmentAllowsTool(
        {
          allowAllTools: true,
          allowedTools: [],
          server: { endpoint: "https://mail.example/mcp" },
          bot: { spawnKey: carta },
        },
        "send_email",
      ),
    ).toBe(false);
  });
  it("refuses write tools until the server's writes are on, checked on each call", () => {
    const assignment = (writesEnabled: boolean) => ({
      allowAllTools: false,
      allowedTools: [...CARTA_READ_TOOLS, ...CARTA_WRITE_TOOLS],
      server: { ...server, writesEnabled },
      bot: { spawnKey: carta },
    });
    expect(assignmentAllowsTool(assignment(false), "mutate")).toBe(false);
    expect(assignmentAllowsTool(assignment(true), "mutate")).toBe(true);
    expect(assignmentAllowsTool(assignment(true), "call_tool")).toBe(true);
    expect(assignmentAllowsTool(assignment(false), "fetch")).toBe(true);
  });
  it("refuses every Carta tool to a bot that is not the Carta agent", () => {
    for (const spawnKey of [null, financeAgentSpawnKey("u1")])
      expect(
        assignmentAllowsTool(
          {
            allowAllTools: true,
            allowedTools: [],
            server: { ...server, writesEnabled: true },
            bot: { spawnKey },
          },
          CARTA_READ_TOOLS[0],
        ),
      ).toBe(false);
  });
  it("leaves other bots and other servers unchanged", () => {
    expect(
      assignmentAllowsTool(
        {
          allowAllTools: true,
          allowedTools: [],
          server: { endpoint: "https://other.example/mcp" },
          bot: { spawnKey: null },
        },
        "write_something",
      ),
    ).toBe(true);
  });
});

describe("Carta agent mail_send", () => {
  it("is flagged for mandatory approval only for the Carta agent", () => {
    expect(isCartaMailSend(carta, "mail_send")).toBe(true);
    expect(isCartaMailSend(carta, "mail_draft")).toBe(false);
    expect(isCartaMailSend(null, "mail_send")).toBe(false);
    expect(isCartaMailSend(financeAgentSpawnKey("u1"), "mail_send")).toBe(false);
  });
  it("refuses a draft-id-only send", () => {
    expect(cartaMailSendIsComplete({ draftId: "d1" })).toBe(false);
    expect(
      cartaMailSendIsComplete({ draftId: "d1", to: ["a@x.test"], subject: "s", body: "b" }),
    ).toBe(false);
    expect(cartaMailSendIsComplete({ to: ["a@x.test"], subject: "s", body: "b" })).toBe(true);
  });
  it("shows Bcc and the whole body on the approval card", () => {
    const body = "x".repeat(6000);
    const args = {
      to: ["a@x.test"],
      cc: ["c@x.test"],
      bcc: ["hidden@x.test"],
      subject: "Q3",
      body,
    };
    const block = buildApprovalAskBlock("e1", "mail_send", args, [], { fullMail: true });
    if (block.kind !== "ask") throw new Error("expected ask block");
    expect(block.detail).toContain("bcc: hidden@x.test");
    expect(block.detail).toContain("cc: c@x.test");
    expect(block.detail).toContain(body);
    expect(block.actions?.map((a) => a.id)).toEqual(["allow", "deny"]);
    const other = buildApprovalAskBlock("e1", "mail_send", args, []);
    if (other.kind !== "ask") throw new Error("expected ask block");
    expect(other.detail).not.toContain("hidden@x.test");
  });
});

describe("financeToolsAllowed", () => {
  it("also allows the Carta agent", () => {
    const base = {
      hasProvider: true,
      groupId: null,
      runUserId: "u1",
      botUserId: "u1",
      trigger: "user",
      messagingChannelRun: false,
    };
    expect(financeToolsAllowed({ ...base, botSpawnKey: carta })).toBe(true);
    expect(financeToolsAllowed({ ...base, botSpawnKey: null })).toBe(false);
  });
});

describe("Carta agent delegation tools", () => {
  const base = {
    graphicalToolsAllowed: false,
    groupId: null,
    trigger: "user",
    semanticMemoryEnabled: false,
    messagingChannelRun: false,
  };
  const names = (cartaAgent: boolean) =>
    selectBuiltinToolsForRun({ ...base, cartaAgent }).map((tool) => tool.name);
  const delegation = ["spawn_bot", "message_bot", "handoff_to_bot"];
  it("are not offered to the Carta agent", () => {
    for (const name of delegation) expect(names(true)).not.toContain(name);
  });
  it("stay offered to other bots", () => {
    for (const name of ["spawn_bot", "message_bot"]) expect(names(false)).toContain(name);
  });
});

describe("contacts_save approval card", () => {
  it("shows the contact fields", () => {
    const block = buildApprovalAskBlock(
      "e1",
      "contacts_save",
      {
        name: "Ada Fund",
        email: "ada@example.test",
        organization: "Example Capital",
        kind: "auditor",
        notes: "Met at the audit kickoff",
      },
      [],
    );
    if (block.kind !== "ask") throw new Error("expected ask block");
    expect(block.text).toContain("Ada Fund");
    expect(block.detail).toBe(
      "name: Ada Fund\nemail: ada@example.test\norganization: Example Capital\nkind: auditor\nnotes: Met at the audit kickoff",
    );
  });
});

describe("Carta write approval", () => {
  const route = { toolName: "call_tool", endpoint: "https://mcp.app.carta.com/mcp" };
  it("recognises a write by server and raw tool, not by name", () => {
    expect(isCartaWrite(carta, route)).toBe(true);
    expect(isCartaWrite(carta, { ...route, endpoint: "https://mcp.example.test/mcp" })).toBe(false);
    expect(isCartaWrite(carta, { ...route, toolName: "search" })).toBe(false);
    expect(isCartaWrite(null, route)).toBe(false);
  });
  it("shows the raw tool and the full nested arguments, untruncated", () => {
    const args = {
      name: "issue_draft",
      arguments: { company_id: "c1", draft_set: { note: "x".repeat(5000), shares: 100 } },
    };
    const block = buildApprovalAskBlock("e1", "mcp__integration-1__call_tool", args, ["c1"], {
      cartaWriteTool: "call_tool",
    });
    if (block.kind !== "ask") throw new Error("expected ask block");
    expect(block.detail).toContain("tool: call_tool");
    expect(block.detail).toContain('"name": "issue_draft"');
    expect(block.detail).toContain('"shares": 100');
    expect(block.detail).toContain("x".repeat(5000));
    expect(block.detail).not.toContain('"c1"');
  });
});
