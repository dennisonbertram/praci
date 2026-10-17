import { describe, expect, it } from "vitest";
import { approvedMailOutcome } from "./mail-approval-recovery.js";

describe("approvedMailOutcome", () => {
  it("is sent or saved when the tool succeeded", () => {
    expect(approvedMailOutcome("mail_send", { ok: true })).toEqual({ outcome: "sent" });
    expect(approvedMailOutcome("mail_draft", { ok: true, draftId: "d1" })).toEqual({
      outcome: "saved",
    });
  });

  it("is not sent, with the reason, when the tool failed before sending", () => {
    expect(approvedMailOutcome("mail_send", { error: "No connected mail account" })).toEqual({
      outcome: "failed",
      error: "No connected mail account",
    });
  });

  it("is unknown when the send may have gone out", () => {
    expect(
      approvedMailOutcome("mail_send", {
        error: "The send may or may not have gone out. Check the Sent folder before trying again.",
      }),
    ).toEqual({ outcome: "unknown" });
  });
});
