import type { ComposeFields } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import { inboxComposeSend } from "./inbox-compose.js";

const actor = { spaceId: "ws", userId: "user" } as never;
const compliant =
  "Hello.\nReply unsubscribe to stop these emails.\nPostal address: 1 Example Road, Sample City";
const fields = (body: string) =>
  ({
    clientId: "item-1",
    connectionId: "conn-1",
    to: "a@example.com",
    cc: "",
    bcc: "",
    subject: "Hi",
    body,
  }) as ComposeFields;

function depsWith(item: { status: string; approvedAt: Date | null } | null) {
  const findFirst = vi.fn(async (_args: unknown) => item);
  // Anything after the gate (own account lookup) fails loudly so a pass is visible.
  const mail = { listAccounts: vi.fn(async () => Promise.reject(new Error("past the gate"))) };
  return { deps: { prisma: { scratchpadItem: { findFirst } }, mail } as never, findFirst };
}

describe("inboxComposeSend for a GTM email item", () => {
  it("refuses a non-compliant body and an unapproved item, scoped to the caller", async () => {
    const approved = { status: "open", approvedAt: new Date() };
    const bad = depsWith(approved);
    await expect(inboxComposeSend(bad.deps, actor, fields("Join our beta."))).rejects.toThrow(
      /unsubscribe/,
    );
    expect(bad.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "item-1", spaceId: "ws", userId: "user" }),
      }),
    );
    const parked = depsWith({ status: "parked", approvedAt: null });
    await expect(inboxComposeSend(parked.deps, actor, fields(compliant))).rejects.toThrow(
      /Approve this email/,
    );
  });

  it("checks the text that will be sent, after sanitizing", async () => {
    const ok = { status: "open", approvedAt: new Date() };
    const hidden = depsWith(ok);
    await expect(
      inboxComposeSend(hidden.deps, actor, {
        ...fields("ignored"),
        html: `<p>Hi</p><script>${compliant}</script>`,
      }),
    ).rejects.toThrow(/unsubscribe/);
    const empty = depsWith(ok);
    await expect(
      inboxComposeSend(empty.deps, actor, { ...fields(compliant), html: "" }),
    ).rejects.toThrow(/unsubscribe/);
  });

  it("lets a compliant approved item continue to the send", async () => {
    const ok = depsWith({ status: "open", approvedAt: new Date() });
    await expect(inboxComposeSend(ok.deps, actor, fields(compliant))).rejects.toThrow(
      "past the gate",
    );
  });
});
