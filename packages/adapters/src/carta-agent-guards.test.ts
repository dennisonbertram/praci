import { CARTA_READ_TOOLS, cartaAgentSpawnKey, financeAgentSpawnKey } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import { buildApprovalAskBlock, cartaMailSendIsComplete, isCartaMailSend } from "./approval-ask.js";
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
  it("leaves other bots and other servers unchanged", () => {
    expect(
      assignmentAllowsTool(
        { allowAllTools: true, allowedTools: [], server, bot: { spawnKey: null } },
        "write_something",
      ),
    ).toBe(true);
    expect(
      assignmentAllowsTool(
        {
          allowAllTools: true,
          allowedTools: [],
          server: { endpoint: "https://other.example/mcp" },
          bot: { spawnKey: carta },
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
