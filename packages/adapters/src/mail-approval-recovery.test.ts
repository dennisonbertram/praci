import { expect, it } from "vitest";
import { approvedMailOutcome, failedMailToAgent } from "./mail-approval-recovery.js";

it("tells the agent the send failed and the draft is kept, not that the original is missing", () => {
  const { error } = failedMailToAgent("mail_send", "Message not found");
  expect(error).toContain("The send failed");
  expect(error).toContain("the draft is kept");
  expect(error).toContain("do not say the original message was missing");
  expect(approvedMailOutcome("mail_send", { error: "Message not found" }).outcome).toBe("failed");
});
