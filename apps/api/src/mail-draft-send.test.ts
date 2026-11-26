import { ORPCError } from "@orpc/server";
import type { Actor } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import type { MailDraftSendDeps } from "./mail-draft-send.js";
import { sendSavedMailDraft } from "./mail-draft-send.js";

const actor = { spaceId: "space-1", userId: "user-1" } as Actor;
const target = { threadId: "thread-1" };
const ids = { runId: "run-1", messageId: "message-1" };

type Row = { id: string; connectionId: string; draftId: string | null; state: string };

/** In-memory stand-ins for the database rows and the Gmail provider. */
function setup(
  options: {
    effect?: object;
    record?: Partial<Row> | null;
    disabledTools?: string[];
    write?: boolean;
    tool?: "mail_draft" | "mail_send";
    laterUpdates?: object[];
  } = {},
) {
  let row: Row | null = options.record
    ? { id: "row-1", connectionId: "conn-1", draftId: null, state: "draft", ...options.record }
    : null;
  const card = {
    kind: "ask",
    text: "Save draft?",
    status: "answered",
    approvalEffectId: "effect-1",
    mail: {
      tool: options.tool ?? "mail_draft",
      to: [],
      cc: [],
      bcc: [],
      subject: "s",
      body: "b",
      outcome: "saved",
    },
  };
  const sendDraft = vi.fn(async () => ({ messageId: "gm-1", threadId: "gt-1" }));
  const outcomes: Array<{ outcome: string; tool?: string }> = [];
  const deps = {
    mailWritesDisabled: options.write === false,
    mail: {
      listAccounts: async () => [{ id: "conn-1", address: "me@example.test" }],
      sendDraft,
    },
    events: {
      setMailApprovalOutcome: vi.fn(async (input: { outcome: string; tool?: string }) => {
        outcomes.push(input);
      }),
    },
    prisma: {
      run: {
        findFirst: async (args: { where: { userId: string } }) =>
          args.where.userId === "user-1"
            ? { bot: { disabledBuiltinTools: options.disabledTools ?? [] } }
            : null,
      },
      message: { findFirst: async () => ({ blocks: [card] }) },
      externalEffect: {
        findMany: async () => options.laterUpdates ?? [],
        findFirst: async () => ({
          id: "effect-1",
          status: "completed",
          result: { ok: true, draftId: "draft-9", account: "me@example.test" },
          ...options.effect,
        }),
      },
      composeSend: {
        findUnique: async (args: { where: { id?: string } }) =>
          args.where.id ? row && { state: row.state, updatedAt: new Date() } : row,
        upsert: async (args: { create: { connectionId: string } }) => {
          row ??= {
            id: "row-1",
            connectionId: args.create.connectionId,
            draftId: null,
            state: "draft",
          };
          return row;
        },
        updateMany: async (args: { data: { state: string } }) => {
          if (!row || !["draft", "failed"].includes(row.state)) return { count: 0 };
          row.state = args.data.state;
          return { count: 1 };
        },
        update: async (args: { data: Partial<Row> }) => {
          Object.assign(row ?? {}, args.data);
          return row;
        },
      },
    },
  } as unknown as MailDraftSendDeps;
  const send = (who: Actor = actor) => sendSavedMailDraft(deps, who, target, ids);
  return { deps, send, sendDraft, outcomes, row: () => row };
}

const code = (promise: Promise<unknown>) =>
  promise.then(
    () => "ok",
    (error: unknown) => (error instanceof ORPCError ? error.code : String(error)),
  );

describe("sendSavedMailDraft", () => {
  it("sends the draft recorded in the tool call's result, once, and marks the card sent", async () => {
    const t = setup();
    expect(await t.send()).toEqual({ status: "sent" });
    expect(t.sendDraft).toHaveBeenCalledTimes(1);
    expect(t.sendDraft.mock.calls[0]?.[0]).toMatchObject({ id: "conn-1" });
    expect(t.sendDraft.mock.calls[0]?.[1]).toBe("draft-9");
    expect(t.outcomes).toEqual([
      expect.objectContaining({
        outcome: "sent",
        tool: "mail_send",
        providerIds: { threadId: "gt-1", messageId: "gm-1", draftId: "draft-9" },
      }),
    ]);
    expect(t.row()).toMatchObject({ state: "sent", draftId: "draft-9" });
  });

  it("still resolves sent when recording the outcome fails after the send", async () => {
    const t = setup();
    vi.mocked(t.deps.events.setMailApprovalOutcome).mockRejectedValueOnce(new Error("db down"));
    expect(await t.send()).toEqual({ status: "sent" });
    expect(t.sendDraft).toHaveBeenCalledTimes(1);
  });

  it("refuses to send a draft that a later mail_draft changed since the card", async () => {
    const t = setup({ laterUpdates: [{ id: "effect-2" }] });
    expect(await code(t.send())).toBe("CONFLICT");
    await expect(t.send()).rejects.toMatchObject({
      message: "This draft changed since you approved it",
    });
    expect(t.sendDraft).not.toHaveBeenCalled();
  });

  it("does not send again on a second click or a retry", async () => {
    const t = setup();
    await t.send();
    expect(await t.send()).toEqual({ status: "sent" });
    expect(t.sendDraft).toHaveBeenCalledTimes(1);
  });

  it("uses the draft the person's own edited save recorded", async () => {
    const t = setup({
      effect: { status: "denied", result: { note: "n" } },
      record: { draftId: "draft-saved-by-card", connectionId: "conn-1" },
    });
    await t.send();
    expect(t.sendDraft.mock.calls[0]?.[1]).toBe("draft-saved-by-card");
  });

  it("records an unclear send and does not retry it", async () => {
    const t = setup();
    t.sendDraft.mockRejectedValueOnce(new Error("socket hang up"));
    expect(await t.send()).toEqual({ status: "unknown" });
    expect(t.outcomes[0]).toMatchObject({ outcome: "unknown" });
    expect(await t.send()).toEqual({ status: "unknown" });
    expect(t.sendDraft).toHaveBeenCalledTimes(1);
  });

  it("rejects another user's tool call", async () => {
    const t = setup();
    expect(await code(t.send({ ...actor, userId: "user-2" }))).toBe("NOT_FOUND");
    expect(t.sendDraft).not.toHaveBeenCalled();
  });

  it("rejects sending when mail_send is off for the bot or mail writes are off", async () => {
    const off = setup({ disabledTools: ["mail_send"] });
    expect(await code(off.send())).toBe("PRECONDITION_FAILED");
    const writes = setup({ write: false });
    expect(await code(writes.send())).toBe("PRECONDITION_FAILED");
    expect(off.sendDraft).not.toHaveBeenCalled();
    expect(writes.sendDraft).not.toHaveBeenCalled();
  });

  it("sends nothing when the call saved no draft or the card is not a draft", async () => {
    const pending = setup({ effect: { status: "intended", result: null } });
    expect(await code(pending.send())).toBe("CONFLICT");
    const failed = setup({ effect: { result: { error: "Changing mail is turned off." } } });
    expect(await code(failed.send())).toBe("CONFLICT");
    const sendCard = setup({ tool: "mail_send" });
    expect(await code(sendCard.send())).toBe("NOT_FOUND");
    for (const t of [pending, failed, sendCard]) expect(t.sendDraft).not.toHaveBeenCalled();
  });
});
