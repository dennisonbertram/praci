import { describe, expect, it } from "vitest";
import {
  approvedMailOutcome,
  mailApprovalAgentNote,
  mailSendRefusal,
} from "./mail-approval-recovery.js";

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

describe("mailSendRefusal", () => {
  const reply = {
    to: ["Sam <sam@example.test>"],
    subject: "Re: Tuesday",
    body: "Hi Sam",
    replyToId: "m1",
  };
  const effect = (status: string, result: unknown, request: unknown = reply, runId = "r1") => ({
    runId,
    status,
    request,
    result,
  });

  it("allows a first send", () => {
    expect(mailSendRefusal(reply, [], "r1")).toBeUndefined();
  });

  it("refuses a second card after the user edited and sent the reply themselves", () => {
    const sent = effect("denied", { note: mailApprovalAgentNote(true, "sent"), outcome: "sent" });
    const again = { ...reply, body: "Hi Sam, 10am works. Best, Alex" };
    expect(mailSendRefusal(again, [sent], "r2")).toMatch(/already sent/);
  });

  it("refuses while the user's own send is still in flight", () => {
    const claimed = effect("denied", { note: mailApprovalAgentNote(true) });
    expect(mailSendRefusal(reply, [claimed], "r1")).toMatch(/already sent/);
  });

  it("refuses after an approved send went out, matching a new message by people and subject", () => {
    const newMail = { to: ["robin@example.test"], subject: "Pricing", body: "Hi" };
    const sent = effect("completed", { ok: true }, newMail);
    expect(mailSendRefusal({ ...newMail, subject: "Re: pricing" }, [sent], "r2")).toMatch(
      /already sent/,
    );
  });

  it("allows a retry after a failed send, and a different reply", () => {
    expect(mailSendRefusal(reply, [effect("completed", { error: "boom" })], "r1")).toBeUndefined();
    expect(
      mailSendRefusal({ ...reply, replyToId: "m2" }, [effect("completed", { ok: true })], "r1"),
    ).toBeUndefined();
  });

  it("refuses a discarded email again in the same run, but not after the user speaks again", () => {
    const discarded = effect("denied", { error: "denied" });
    expect(mailSendRefusal(reply, [discarded], "r1")).toMatch(/discarded/);
    expect(mailSendRefusal(reply, [discarded], "r2")).toBeUndefined();
  });

  it("refuses a placeholder signature", () => {
    expect(mailSendRefusal({ ...reply, body: "Thanks,\n[Your Name]" }, [], "r1")).toMatch(
      /\[Your Name\]/,
    );
  });
});
