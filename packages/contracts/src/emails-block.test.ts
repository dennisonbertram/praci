import { describe, expect, it } from "vitest";
import { MAX_EMAIL_CARDS, MessageBlock } from "./events.js";

const email = {
  id: "cm0abc",
  urgency: "today",
  from: "Sam Rivera",
  subject: "Offsite dates",
  snippet: "Can you do the 14th or the 21st?",
  receivedAt: "2026-10-12T09:00:00.000Z",
};

describe("emails message block", () => {
  it("parses a list of cited messages and keeps the optional attachment count", () => {
    const block = MessageBlock.parse({
      kind: "emails",
      emails: [email, { ...email, id: "cm0abd", urgency: "later", attachments: 2 }],
    });
    expect(block).toMatchObject({ kind: "emails" });
    expect(block.kind === "emails" && block.emails[1]?.attachments).toBe(2);
  });

  it.each([
    ["no emails", { emails: [] }],
    ["an unknown urgency", { emails: [{ ...email, urgency: "asap" }] }],
    ["a negative attachment count", { emails: [{ ...email, attachments: -1 }] }],
    [
      "more than the card limit",
      { emails: Array.from({ length: MAX_EMAIL_CARDS + 1 }, () => email) },
    ],
  ])("rejects %s", (_name, body) => {
    expect(MessageBlock.safeParse({ kind: "emails", ...body }).success).toBe(false);
  });
});
