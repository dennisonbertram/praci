import { ORPCError } from "@orpc/server";
import type { Actor, ComposeFields } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import type { MailApprovalEditDeps } from "./mail-approval-edit.js";
import { answerEditedMailApproval } from "./mail-approval-edit.js";

const actor = { spaceId: "space-1", userId: "user-1" } as Actor;
const target = { threadId: "thread-1" };
const stored = {
  account: "me@example.test",
  to: ["Jana <jana@example.test>"],
  subject: "Friday",
  body: "Old text.",
};

/** A stand-in for the database's atomic claim: only one answer moves an "intended" effect. */
function setup(
  options: { kind?: "mail_send" | "mail_draft"; request?: object; write?: boolean } = {},
) {
  const effect = { status: "intended", result: undefined as unknown };
  const answers: Array<{ answer: string; mailDenial?: unknown }> = [];
  const outcomes: string[] = [];
  const events = {
    findMailApprovalForEdit: vi.fn(async (input: { answeredByUserId: string }) =>
      effect.status === "intended" && input.answeredByUserId === "user-1"
        ? {
            effectId: "effect-1",
            kind: options.kind ?? ("mail_send" as const),
            request: options.request ?? stored,
          }
        : null,
    ),
    answerRunInput: vi.fn(async (input: { answer: string; mailDenial?: { note: string } }) => {
      if (effect.status !== "intended") return false;
      effect.status = input.answer === "deny" ? "denied" : "approved";
      if (input.mailDenial) effect.result = { note: input.mailDenial.note };
      answers.push(input);
      return true;
    }),
    setMailApprovalOutcome: vi.fn(async (input: { outcome: string; note?: string }) => {
      outcomes.push(input.outcome);
      if (input.note) effect.result = { note: input.note };
    }),
  };
  const deps = {
    events,
    mailWritesDisabled: options.write === false,
    mail: { listAccounts: async () => [{ id: "conn-1", address: "me@example.test" }] },
    prisma: { cachedMailMessage: { findFirst: async () => null } },
  } as unknown as MailApprovalEditDeps;
  const sent: ComposeFields[] = [];
  const saved: ComposeFields[] = [];
  const compose = {
    send: vi.fn(async (_deps: unknown, _actor: unknown, input: ComposeFields) => {
      sent.push(input);
      return { status: "sent" as const };
    }),
    draftSave: vi.fn(async (_deps: unknown, _actor: unknown, input: ComposeFields) => {
      saved.push(input);
      return { status: "saved" as const };
    }),
  };
  const edit = (mail: object = { subject: "Monday" }, who: Actor = actor) =>
    answerEditedMailApproval(
      deps,
      who,
      target,
      { runId: "run-1", messageId: "message-1", mail },
      async () => undefined,
      compose,
    );
  const allow = () => events.answerRunInput({ answer: "allow" } as never);
  return { effect, answers, outcomes, events, compose, sent, saved, edit, allow, deps };
}

const code = (promise: Promise<unknown>) =>
  promise.then(
    () => "ok",
    (error: unknown) => (error instanceof ORPCError ? error.code : String(error)),
  );

describe("answerEditedMailApproval", () => {
  it("denies the call with a note, then sends once with the merged fields under the effect's client id", async () => {
    const t = setup();
    await t.edit({ subject: "Monday", cc: "lee@example.test" });
    expect(t.effect.status).toBe("denied");
    expect(t.effect.result).toMatchObject({ note: expect.stringContaining("sent it themselves") });
    expect(t.answers[0]?.mailDenial).toMatchObject({
      note: expect.stringContaining("not known yet"),
    });
    expect(t.compose.send).toHaveBeenCalledTimes(1);
    expect(t.sent[0]).toEqual({
      clientId: "approval_effect-1",
      connectionId: "conn-1",
      to: "Jana <jana@example.test>",
      cc: "lee@example.test",
      bcc: "",
      subject: "Monday",
      body: "Old text.",
    });
    expect(t.outcomes).toEqual(["sent"]);
  });

  it("sends a reply from the account the email came to when the agent named none", async () => {
    const { account: _named, ...unnamed } = stored;
    const t = setup({ request: { ...unnamed, replyToId: "gm-1" } });
    Object.assign(t.deps, {
      mail: {
        listAccounts: async () => [
          { id: "conn-1", address: "me@example.test" },
          { id: "conn-2", address: "sales@example.test" },
        ],
      },
      prisma: {
        cachedMailMessage: {
          findMany: async () => [{ connectionId: "conn-2" }],
          findFirst: async () => ({ id: "cached-1" }),
        },
      },
    });
    await t.edit({ subject: "Monday" });
    expect(t.sent[0]).toMatchObject({ connectionId: "conn-2", replyToMessageId: "cached-1" });
  });

  it("sends from the account the person picked on the card when the agent named none", async () => {
    const { account: _named, ...unnamed } = stored;
    const t = setup({ request: unnamed });
    Object.assign(t.deps, {
      mail: {
        listAccounts: async () => [
          { id: "conn-1", address: "me@example.test" },
          { id: "conn-2", address: "sales@example.test" },
        ],
      },
    });
    await t.edit({ account: "sales@example.test" });
    expect(t.sent[0]).toMatchObject({ connectionId: "conn-2" });
  });

  it("publishes only what the person typed, never the stored call's unredacted fields", async () => {
    const t = setup({ request: { ...stored, body: "Key is sk-live-123. Old text." } });
    await t.edit({ subject: "Monday" });
    // The stored body still has the secret the card hid; it must not reach the card.
    expect(t.answers[0]?.mailDenial).toMatchObject({
      mail: { subject: "Monday", connectionId: "conn-1" },
    });
    const published = (t.answers[0] as unknown as { mailDenial: { mail: Record<string, unknown> } })
      .mailDenial.mail;
    expect(JSON.stringify(published)).not.toContain("sk-live-123");
    expect(published).not.toHaveProperty("body");
    expect(published).not.toHaveProperty("to");
    // What is sent is still the whole stored message, with the edit.
    expect(t.sent[0]?.body).toContain("sk-live-123");
  });

  it("saves a draft for mail_draft", async () => {
    const t = setup({ kind: "mail_draft" });
    await t.edit();
    expect(t.compose.draftSave).toHaveBeenCalledTimes(1);
    expect(t.compose.send).not.toHaveBeenCalled();
    expect(t.outcomes).toEqual(["saved"]);
  });

  it("does not send again when the same answer is repeated", async () => {
    const t = setup();
    await t.edit();
    expect(await code(t.edit())).toBe("CONFLICT");
    expect(t.compose.send).toHaveBeenCalledTimes(1);
  });

  it("lets exactly one of a plain allow and an edited send win", async () => {
    // Edit wins: the allow finds the effect already denied, so the agent never sends.
    const first = setup();
    await first.edit();
    expect(await first.allow()).toBe(false);
    expect(first.effect.status).toBe("denied");
    expect(first.compose.send).toHaveBeenCalledTimes(1);

    // Allow wins between the edit's check and its claim: nothing is sent by the edit.
    const second = setup();
    const find = second.events.findMailApprovalForEdit;
    find.mockImplementationOnce(async () => {
      const pending = { effectId: "effect-1", kind: "mail_send" as const, request: stored };
      await second.allow();
      return pending;
    });
    expect(await code(second.edit())).toBe("CONFLICT");
    expect(second.effect.status).toBe("approved");
    expect(second.compose.send).not.toHaveBeenCalled();
  });

  it("records an unknown or failed outcome and does not retry", async () => {
    const unknown = setup();
    unknown.compose.send.mockResolvedValueOnce({ status: "unknown" } as never);
    await unknown.edit();
    expect(unknown.outcomes).toEqual(["unknown"]);
    expect(unknown.compose.send).toHaveBeenCalledTimes(1);
    const unknownNote = (unknown.effect.result as { note: string }).note;
    expect(unknownNote).toContain("unknown");
    expect(unknownNote).toContain("Do not send it again");
    expect(unknownNote).toContain("check Sent");

    const failed = setup();
    failed.compose.send.mockResolvedValueOnce({ status: "failed" } as never);
    await failed.edit();
    expect(failed.outcomes).toEqual(["failed"]);
    const failedNote = (failed.effect.result as { note: string }).note;
    expect(failedNote).toContain("failed and nothing was sent");
    expect(failedNote).not.toContain("sent it themselves");
    expect(failed.compose.send).toHaveBeenCalledTimes(1);
    expect(failed.effect.status).toBe("denied");
  });

  it("tells the agent a rejection before the provider was reached failed and nothing went out", async () => {
    const t = setup();
    t.compose.send.mockRejectedValueOnce(new ORPCError("BAD_REQUEST", { message: "bad" }));
    await t.edit();
    expect(t.outcomes).toEqual(["failed"]);
    expect((t.effect.result as { note: string }).note).toContain("nothing was sent");
  });

  it.each([
    ["mail_send", "send", "sent", "Sent"],
    ["mail_draft", "draftSave", "saved", "Drafts"],
  ] as const)(
    "treats an error after the provider acted as unknown for %s, not as nothing happened",
    async (kind, method, _done, folder) => {
      const t = setup({ kind });
      // The provider call succeeded, then the database bookkeeping threw.
      t.compose[method].mockRejectedValueOnce(new Error("database write failed"));
      await t.edit();
      expect(t.outcomes).toEqual(["unknown"]);
      const note = (t.effect.result as { note: string }).note;
      expect(note).not.toContain("nothing was");
      expect(note).toContain("unknown");
      expect(note).toContain(`check ${folder}`);
      expect(t.compose[method]).toHaveBeenCalledTimes(1);
    },
  );

  it("sends a reply in the original's thread, and fails without sending when it is not cached", async () => {
    const found = setup({ request: { ...stored, replyToId: "provider-1" } });
    (
      found.deps.prisma as { cachedMailMessage: { findFirst: unknown } }
    ).cachedMailMessage.findFirst = async () => ({ id: "cached-1" });
    await found.edit();
    expect(found.sent[0]).toMatchObject({ replyToMessageId: "cached-1" });

    const missing = setup({ request: { ...stored, replyToId: "provider-1" } });
    await missing.edit();
    expect(missing.compose.send).not.toHaveBeenCalled();
    expect(missing.outcomes).toEqual(["failed"]);
    expect((missing.effect.result as { note: string }).note).toContain("nothing was sent");
  });

  it("rejects without claiming for another user, invalid edits and a merged message over the limit", async () => {
    const other = setup();
    expect(await code(other.edit({ subject: "x" }, { ...actor, userId: "user-2" }))).toBe(
      "CONFLICT",
    );
    const invalid = setup();
    expect(await code(invalid.edit({ to: "nope" }))).toBe("BAD_REQUEST");
    const many = setup({
      request: { ...stored, to: Array.from({ length: 100 }, (_, i) => `u${i}@example.test`) },
    });
    expect(await code(many.edit({ cc: "extra@example.test" }))).toBe("BAD_REQUEST");
    const draftId = setup({ request: { ...stored, draftId: "d1" } });
    expect(await code(draftId.edit())).toBe("BAD_REQUEST");
    for (const t of [other, invalid, many, draftId]) {
      expect(t.effect.status).toBe("intended");
      expect(t.compose.send).not.toHaveBeenCalled();
    }
  });

  it("claims nothing and sends nothing while mail writes are off", async () => {
    const t = setup({ write: false });
    expect(await code(t.edit())).toBe("PRECONDITION_FAILED");
    expect(t.effect.status).toBe("intended");
    expect(t.compose.send).not.toHaveBeenCalled();
  });

  it("rejects an account the person has not connected", async () => {
    const t = setup({ request: { ...stored, account: "other@example.test" } });
    expect(await code(t.edit())).toBe("BAD_REQUEST");
    expect(t.effect.status).toBe("intended");
  });
});
