import { cartaAgentSpawnKey } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import {
  buildApprovalAskBlock,
  buildConsentAskBlock,
  describeApprovalAction,
  isIntegrationAgentWrite,
  mailRequestIsValid,
  normalizeMailEdits,
  resolveMoneyNames,
} from "./approval-ask.js";

describe("buildApprovalAskBlock tool identity", () => {
  const ask = (id: string, serviceName?: string) => {
    const block = buildApprovalAskBlock("e1", id, { amount: "5" }, [], { serviceName });
    if (block.kind !== "ask") throw new Error("expected ask block");
    return block;
  };

  it("names the service, so two servers with the same tool get different titles", () => {
    const a = ask("mcp__finance-mercury__requestPayment", "Mercury");
    const b = ask("mcp__finance-other__requestPayment", "Other Bank");
    expect(a.text).toBe("Review before Mercury: Request payment → $5.00");
    expect(b.text).toBe("Review before Other Bank: Request payment → $5.00");
  });

  it("always shows the exact fully qualified tool id in the detail", () => {
    expect(ask("mcp__finance-mercury__requestPayment", "Mercury").detail).toContain(
      "tool: mcp__finance-mercury__requestPayment",
    );
    expect(ask("mcp__finance-other__requestPayment", "Other Bank").detail).toContain(
      "tool: mcp__finance-other__requestPayment",
    );
    expect(ask("gmail_send_email").detail).toContain("tool: gmail_send_email");
  });

  it("keeps hand-written built-in phrasing and the Always allow action", () => {
    const space = buildApprovalAskBlock("e1", "create_space", { name: "Ops" }, []);
    if (space.kind !== "ask") throw new Error("expected ask block");
    expect(space.detail ?? "").not.toContain("tool:");
    expect(ask("mcp__finance-mercury__requestPayment", "Mercury").actions).toContainEqual({
      id: "always",
      label: "Always allow this tool",
    });
  });
});

describe("describeApprovalAction money and generic tools", () => {
  it("shows an amount with its currency symbol", () => {
    expect(
      describeApprovalAction(
        "mcp__finance-mercury__requestSendMoney",
        { amount: 1200, accountId: "chk-1" },
        "Mercury",
      ),
    ).toBe("Send $1,200.00 to a recipient from an account");
    expect(describeApprovalAction("pay", { amount: "50", currency: "EUR" })).toContain("€50.00");
  });

  it("names the recipient and account on a send-money request, never their ids", () => {
    const args = { amount: 1200, recipientId: "rcp-9", accountId: "chk-1" };
    const block = buildApprovalAskBlock("e1", "mcp__finance-mercury__requestSendMoney", args, [], {
      moneyNames: { recipient: "Acme Supplies", account: "Operating" },
    });
    if (block.kind !== "ask") throw new Error("expected ask block");
    expect(block.text).toBe("Send $1,200.00 to Acme Supplies from Operating?");
    expect(block.text).not.toMatch(/rcp-9|chk-1|mcp__/);
    // Details lists labelled rows, with no tool id and no raw JSON.
    expect(block.detailFolded).toBe(true);
    expect(block.detail).toBe("Amount: $1,200.00\nTo: Acme Supplies\nFrom account: Operating");
  });

  it("keeps hand-written titles", () => {
    expect(describeApprovalAction("contacts_save", { name: "Ann" })).toBe("Save contact “Ann”");
  });

  it("folds raw integration arguments behind Details, but not a mail body", () => {
    const write = buildApprovalAskBlock("e1", "mcp__m__x", { amount: 1 }, [], {
      integrationWriteTool: "x",
    });
    const mail = buildApprovalAskBlock(
      "e1",
      "mail_send",
      { to: ["a@b.test"], subject: "s", body: "b" },
      [],
      { fullMail: true },
    );
    expect(write.kind === "ask" && write.detailFolded).toBe(true);
    expect(mail.kind === "ask" && mail.detailFolded).toBeFalsy();
  });
});

describe("buildApprovalAskBlock schedule card", () => {
  it("shows the schedule in words and the whole prompt, uncut", () => {
    const prompt = `Summarize my mail. ${"x".repeat(5_000)}`;
    const block = buildApprovalAskBlock(
      "effect-1",
      "schedule_create",
      { name: "Digest", prompt, cron: "0 8 * * *" },
      [],
      {
        schedule: {
          summary: "creating the repeating schedule “Digest”",
          detail: `repeats: Every day at 8:00 AM (America/New_York)\nprompt: ${prompt}`,
        },
      },
    );
    if (block.kind !== "ask") throw new Error("expected an ask block");
    expect(block.text).toBe("Review before creating the repeating schedule “Digest”");
    expect(block.detail).toContain("repeats: Every day at 8:00 AM (America/New_York)");
    expect(block.detail).toContain(prompt);
    expect(block.actions?.map((action) => action.id)).toEqual(["allow", "always", "deny"]);
  });
});

describe("buildApprovalAskBlock", () => {
  it("binds the approval to its effect and redacts secrets", () => {
    const block = buildApprovalAskBlock(
      "effect-1",
      "gmail_send_email",
      { to: "person@example.test", body: "token-secret" },
      ["token-secret"],
    );

    expect(block).toMatchObject({
      kind: "ask",
      approvalEffectId: "effect-1",
      actions: [
        { id: "allow", label: "Allow once" },
        { id: "always", label: "Always allow this tool" },
        { id: "deny", label: "Deny" },
      ],
    });
    expect(JSON.stringify(block)).not.toContain("token-secret");
  });

  it("bounds model-controlled summaries and details", () => {
    const block = buildApprovalAskBlock(
      "effect-1",
      "destination.write",
      { title: "t".repeat(1_000), body: "b".repeat(10_000) },
      [],
    );

    expect(block.kind).toBe("ask");
    if (block.kind !== "ask") throw new Error("expected ask block");
    expect(block.text.length).toBeLessThanOrEqual(501);
    expect(block.detail?.length).toBeLessThanOrEqual(4_001);
  });

  it("includes an optional review reason as the first detail line", () => {
    const block = buildApprovalAskBlock(
      "effect-1",
      "gmail_send_email",
      { to: "person@example.test", subject: "Hi" },
      [],
      { reviewReason: "Sends email outside the draft-only task." },
    );

    expect(block.kind).toBe("ask");
    if (block.kind !== "ask") throw new Error("expected ask block");
    expect(block.detail?.startsWith("Sends email outside the draft-only task.")).toBe(true);
    expect(block.detail).toContain("to: person@example.test");
  });

  it("uses a one-time create or cancel choice for a new security boundary", () => {
    const block = buildApprovalAskBlock(
      "effect-1",
      "create_space",
      { name: "Customer support" },
      [],
    );

    expect(block).toMatchObject({
      kind: "ask",
      text: "Create space “Customer support”?",
      actions: [
        { id: "allow", label: "Create space", outcome: "created" },
        { id: "deny", label: "Cancel", outcome: "cancelled" },
      ],
    });
    if (block.kind !== "ask") throw new Error("expected ask block");
    expect(block.detail).toContain("stay separate from other spaces");
  });
});

describe("connected app integration-agent writes", () => {
  const spawnKey = "integration-agent:connection-1";

  it("requires mandatory approval for an app write with a trusted connection route", () => {
    expect(
      isIntegrationAgentWrite(
        spawnKey,
        { connectorId: "composio", connectionId: "connection-1" },
        false,
      ),
    ).toBe(true);
    expect(
      isIntegrationAgentWrite(
        spawnKey,
        { connectorId: "composio", connectionId: "connection-1" },
        undefined,
      ),
    ).toBe(true);
  });

  it("does not classify untrusted app routes or explicit reads as writes", () => {
    expect(isIntegrationAgentWrite(spawnKey, { connectorId: "composio" }, false)).toBe(false);
    expect(
      isIntegrationAgentWrite(
        spawnKey,
        { connectorId: "composio", connectionId: "connection-1" },
        true,
      ),
    ).toBe(false);
    expect(
      isIntegrationAgentWrite(
        "ordinary-bot",
        { connectorId: "composio", connectionId: "connection-1" },
        false,
      ),
    ).toBe(false);
  });
});

describe("Carta integration-agent write classification", () => {
  const carta = cartaAgentSpawnKey("user-1");
  const route = {
    connectorId: "mcp",
    endpoint: "https://mcp.app.carta.com/mcp",
  };

  it("uses the shared Carta preset and forces writes despite misleading read-only annotations", () => {
    expect(isIntegrationAgentWrite(carta, { ...route, toolName: "mutate" }, true)).toBe(true);
    expect(isIntegrationAgentWrite(carta, { ...route, toolName: "call_tool" }, false)).toBe(true);
    expect(isIntegrationAgentWrite(carta, { ...route, toolName: "fetch" }, false)).toBe(false);
    expect(
      isIntegrationAgentWrite(carta, { ...route, toolName: "unknownAnnotatedRead" }, true),
    ).toBe(true);
  });

  it("does not gate Carta writes on a different endpoint", () => {
    expect(
      isIntegrationAgentWrite(
        carta,
        { connectorId: "mcp", endpoint: "https://mcp.example.test", toolName: "mutate" },
        false,
      ),
    ).toBe(false);
  });
});

describe("mail approval payload", () => {
  const args = {
    account: "me@example.test",
    to: ["Jana <jana@example.test>"],
    cc: ["lee@example.test"],
    subject: "Friday",
    body: "See you with token-secret.",
    replyToId: "m1",
  };

  it("carries the fields of a mail_send or mail_draft call, redacted", () => {
    for (const tool of ["mail_send", "mail_draft"] as const) {
      const block = buildApprovalAskBlock("effect-1", tool, args, ["token-secret"]);
      if (block.kind !== "ask") throw new Error("expected ask block");
      expect(block.mail).toEqual({
        tool,
        account: "me@example.test",
        to: ["Jana <jana@example.test>"],
        cc: ["lee@example.test"],
        bcc: [],
        subject: "Friday",
        body: expect.not.stringContaining("token-secret"),
        reply: true,
      });
    }
  });

  it("shows the From account the call will use when it named none", () => {
    const { account: _named, ...unnamed } = args;
    const block = buildApprovalAskBlock("effect-1", "mail_send", unnamed, [], {
      mailAccount: "sales@example.test",
    });
    expect(block.kind === "ask" && block.mail?.account).toBe("sales@example.test");
    const named = buildApprovalAskBlock("effect-1", "mail_send", args, [], {
      mailAccount: "sales@example.test",
    });
    expect(named.kind === "ask" && named.mail?.account).toBe("me@example.test");
  });

  it("names a mail approval in words, not by its tool name", () => {
    const text = (tool: string) => {
      const block = buildApprovalAskBlock("effect-1", tool, args, []);
      return block.kind === "ask" ? block.text : "";
    };
    expect(text("mail_send")).toBe("Review before sending email to Jana <jana@example.test>");
    expect(text("mcp__finance-mercury__requestTransferMoney")).toBe(
      "Review before Request transfer money → Jana <jana@example.test>",
    );
    expect(text("mail_draft")).toBe("Review before saving a draft to Jana <jana@example.test>");
  });

  it("leaves the generic card for other tools, saved-draft sends and oversized bodies", () => {
    const mailOf = (tool: string, input: Record<string, unknown>) => {
      const block = buildApprovalAskBlock("effect-1", tool, input, []);
      return block.kind === "ask" ? block.mail : "not ask";
    };
    expect(mailOf("mail_modify", args)).toBeUndefined();
    expect(mailOf("mail_send", { draftId: "d1" })).toMatchObject({
      tool: "mail_send",
      locked: true,
    });
    expect(mailOf("mail_draft", { ...args, body: "x".repeat(150_001) })).toBeUndefined();
    expect(mailOf("mail_draft", { draftId: "d1", subject: "s", body: "b" })).toMatchObject({
      tool: "mail_draft",
      locked: true,
    });
    expect(mailOf("mail_draft", { ...args, subject: "s" })).not.toHaveProperty("locked");
  });
});

describe("normalizeMailEdits", () => {
  it("parses recipients into the address lists the mail tools take", () => {
    expect(
      normalizeMailEdits({ to: "Jana <jana@example.test>, lee@example.test", subject: "Hi" }),
    ).toEqual({
      ok: true,
      edits: { to: ["Jana <jana@example.test>", "lee@example.test"], subject: "Hi" },
    });
    expect(normalizeMailEdits({ cc: "" })).toEqual({ ok: true, edits: { cc: [] } });
  });

  it.each([
    ["an invalid address", { to: "not-an-address" }],
    ["a line break in the subject", { subject: "Hi\r\nBcc: x@example.test" }],
    [
      "too many recipients",
      { bcc: Array.from({ length: 101 }, (_, i) => `u${i}@example.test`).join(",") },
    ],
  ])("rejects %s", (_name, edits) => {
    expect(normalizeMailEdits(edits)).toMatchObject({ ok: false });
  });
});

describe("mail approval hardening", () => {
  it("redacts run secrets in the account", () => {
    const block = buildApprovalAskBlock(
      "effect-1",
      "mail_send",
      { account: "me-token-secret@example.test", to: ["a@example.test"], subject: "s", body: "b" },
      ["token-secret"],
    );
    expect(JSON.stringify(block)).not.toContain("token-secret");
  });

  it("checks the whole merged message, not only the changed fields", () => {
    const many = Array.from({ length: 100 }, (_, i) => `u${i}@example.test`);
    const stored = { to: many, subject: "s", body: "b" };
    expect(mailRequestIsValid("mail_send", stored)).toBe(true);
    expect(mailRequestIsValid("mail_send", { ...stored, cc: ["extra@example.test"] })).toBe(false);
    expect(mailRequestIsValid("mail_send", { subject: "s", body: "b" })).toBe(false);
    expect(mailRequestIsValid("mail_draft", { subject: "s", body: "b" })).toBe(true);
  });
});

describe("resolveMoneyNames", () => {
  const send = "mcp__finance-mercury__requestSendMoney";
  const args = { amount: 5, recipientId: "rcp-9", accountId: "chk-1" };

  it("reads the payee's name and the account's nickname", async () => {
    const read = vi.fn(async (tool: string) =>
      tool === "getRecipient"
        ? { name: "Acme Supplies", nickname: "acme" }
        : { name: "Mercury Checking ••1234", nickname: "Operating" },
    );
    expect(await resolveMoneyNames(send, args, read)).toEqual({
      recipient: "Acme Supplies",
      account: "Operating",
    });
    expect(read).toHaveBeenCalledWith("getRecipient", { recipientId: "rcp-9" });
    expect(read).toHaveBeenCalledWith("getAccount", { accountId: "chk-1" });
  });

  it("leaves a name out when its lookup fails, so the title never shows the id", async () => {
    const names = await resolveMoneyNames(send, args, async (tool) => {
      if (tool === "getRecipient") throw new Error("not found");
      return { nickname: "Operating" };
    });
    expect(names).toEqual({ recipient: undefined, account: "Operating" });
    expect(describeApprovalAction(send, args, "Mercury", names)).toBe(
      "Send $5.00 to a recipient from Operating",
    );
  });

  it("does not look anything up for other tools", async () => {
    const read = vi.fn();
    expect(await resolveMoneyNames("mcp__x__updateTransaction", args, read)).toBeUndefined();
    expect(read).not.toHaveBeenCalled();
  });
});

describe("buildConsentAskBlock", () => {
  it("names the model and router in words, never the raw model id", () => {
    const block = buildConsentAskBlock("e1", {
      name: "OpenRouter",
      detail: "openai/gpt-6-luna, forwarded to its provider",
    });
    expect(block).toMatchObject({
      text: "Allow your mail to be sent to GPT-6 Luna (via OpenRouter)?",
    });
    expect(JSON.stringify(block)).not.toMatch(/openai\/|forwarded to its provider/);
  });
});
