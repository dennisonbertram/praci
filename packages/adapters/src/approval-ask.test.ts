import { describe, expect, it } from "vitest";
import { buildApprovalAskBlock, mailRequestIsValid, normalizeMailEdits } from "./approval-ask.js";

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

  it("leaves the generic card for other tools, saved-draft sends and oversized bodies", () => {
    const mailOf = (tool: string, input: Record<string, unknown>) => {
      const block = buildApprovalAskBlock("effect-1", tool, input, []);
      return block.kind === "ask" ? block.mail : "not ask";
    };
    expect(mailOf("mail_modify", args)).toBeUndefined();
    expect(mailOf("mail_send", { draftId: "d1" })).toBeUndefined();
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
