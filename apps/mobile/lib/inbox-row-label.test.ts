import { describe, expect, it } from "vitest";
import { groupRowLabel, mailRowLabel } from "./inbox-row-label";

describe("mailRowLabel", () => {
  const base = {
    sender: "Ada",
    unreadText: "unread",
    suspiciousText: "Suspicious",
    labelName: "Needs attention",
    subject: "Review this",
    time: "09:30",
    summary: "Please respond",
  };

  it("includes unread status and all row content", () => {
    expect(mailRowLabel({ ...base, unread: true, suspicious: false })).toBe(
      "Ada, unread, Needs attention, Review this, 09:30, Please respond",
    );
  });

  it("omits unread status for read rows", () => {
    expect(mailRowLabel({ ...base, unread: false, suspicious: false })).toBe(
      "Ada, Needs attention, Review this, 09:30, Please respond",
    );
  });

  it("includes suspicious status", () => {
    expect(mailRowLabel({ ...base, unread: false, suspicious: true })).toContain(
      "Ada, Suspicious, Needs attention",
    );
  });

  it("skips an absent summary", () => {
    expect(mailRowLabel({ ...base, unread: false, suspicious: false, summary: "" })).toBe(
      "Ada, Needs attention, Review this, 09:30",
    );
  });
});

describe("groupRowLabel", () => {
  it("includes unread status when the group has unread mail", () => {
    expect(
      groupRowLabel({
        sender: "Ada",
        unreadCount: 2,
        unreadText: "unread",
        count: "4",
        subject: "Update",
        time: "09:30",
      }),
    ).toBe("Ada, unread, 4, Update, 09:30");
  });

  it("omits unread status when the group is read", () => {
    expect(
      groupRowLabel({
        sender: "Ada",
        unreadCount: 0,
        unreadText: "unread",
        count: "4",
        subject: "Update",
        time: "09:30",
      }),
    ).toBe("Ada, 4, Update, 09:30");
  });
});
