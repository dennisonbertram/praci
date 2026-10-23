import { describe, expect, it, vi } from "vitest";
import { announceComposerSent, isSameDraft, onComposerSent } from "./composer-sent";

const mail = { connectionId: "c1", subject: "Re: Q3", to: ["Jana <jana@example.test>"] };

describe("composer sent", () => {
  it("recognises the same draft by account, subject and recipients", () => {
    const sent = { connectionId: "c1", subject: "Re: Q3", to: "JANA@example.test" };
    expect(isSameDraft(mail, sent)).toBe(true);
    expect(isSameDraft(mail, { ...sent, subject: "Other" })).toBe(false);
    expect(isSameDraft(mail, { ...sent, connectionId: "c2" })).toBe(false);
    expect(isSameDraft(mail, { ...sent, to: "bob@example.test" })).toBe(false);
  });

  it("tells listeners until they unsubscribe", () => {
    const listener = vi.fn();
    const off = onComposerSent(listener);
    const sent = { connectionId: "c1", subject: "s", to: "a@example.test" };
    announceComposerSent(sent);
    off();
    announceComposerSent(sent);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
