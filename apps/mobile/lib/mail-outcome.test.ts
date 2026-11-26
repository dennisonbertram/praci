import type { MailApproval } from "@rakazo/contracts";
import { describe, expect, it } from "vitest";
import { mailOutcomeLabel } from "./mail-outcome";

const mail = (outcome?: MailApproval["outcome"], tool: MailApproval["tool"] = "mail_send") =>
  ({ tool, to: [], cc: [], bcc: [], subject: "s", body: "b", outcome }) as MailApproval;

describe("mailOutcomeLabel", () => {
  it("says how the mail ended, and nothing before it has", () => {
    expect(mailOutcomeLabel(mail("sent"))).toBe("Sent");
    expect(mailOutcomeLabel(mail("saved", "mail_draft"))).toBe("Draft saved");
    expect(mailOutcomeLabel(mail("failed"))).toBe("Not sent");
    expect(mailOutcomeLabel(mail("failed", "mail_draft"))).toBe("Draft not saved");
    expect(mailOutcomeLabel(mail("unknown"))).toBe("Not confirmed");
    expect(mailOutcomeLabel(mail())).toBeUndefined();
    expect(mailOutcomeLabel(undefined)).toBeUndefined();
  });
});
