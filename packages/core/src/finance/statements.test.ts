import { describe, expect, it } from "vitest";
import { nextMonthEnd, nextStatementDue, statementReminders } from "./statements.js";

const acct = (coveredThrough: string | null) => [
  { accountId: "a", accountName: "Bank ••1234", coveredThrough },
];

describe("statement reminders", () => {
  it("finds the first month-end after a day", () => {
    expect(nextMonthEnd("2026-10-30")).toBe("2026-10-31");
    expect(nextMonthEnd("2026-10-31")).toBe("2026-11-30");
    expect(nextMonthEnd("2026-12-31")).toBe("2027-01-31");
    expect(nextMonthEnd("2028-01-31")).toBe("2028-02-29");
  });
  it("waits five days past the due month-end", () => {
    // covered through Oct 31 -> due Nov 30; remind only after Dec 5
    expect(statementReminders(acct("2026-10-31"), "2026-12-05")).toEqual([]);
    expect(statementReminders(acct("2026-10-31"), "2026-12-06")).toEqual([
      {
        accountId: "a",
        accountName: "Bank ••1234",
        coveredThrough: "2026-10-31",
        dueFor: "2026-11-30",
      },
    ]);
  });
  it("does not ask again for the month a mid-month statement just covered", () => {
    // A September CSV whose lines run Sep 5 - Sep 20, checked on Oct 16.
    expect(statementReminders(acct("2026-09-20"), "2026-10-16")).toEqual([]);
    expect(nextStatementDue("2026-09-20")).toBe("2026-10-20");
    expect(nextStatementDue("2026-01-30")).toBe("2026-02-28");
    expect(statementReminders(acct("2026-09-20"), "2026-10-26")).toEqual([
      {
        accountId: "a",
        accountName: "Bank ••1234",
        coveredThrough: "2026-09-20",
        dueFor: "2026-10-20",
      },
    ]);
  });
  it("is quiet for a current account and an account with no statements", () => {
    expect(statementReminders(acct("2026-11-30"), "2026-12-20")).toEqual([]);
    expect(statementReminders(acct(null), "2030-01-01")).toEqual([]);
  });
});
