import { describe, expect, it } from "vitest";
import type { InboxLabel } from "./inbox-label.js";
import { inboxLabel } from "./inbox-label.js";

type Row = Parameters<typeof inboxLabel>[0];
const triaged = (extra: Partial<NonNullable<Row>> = {}) => ({
  needsReply: false,
  priority: "normal",
  category: "personal",
  feedback: null,
  ...extra,
});
const label = (extra: Partial<NonNullable<Row>>): InboxLabel | null => inboxLabel(triaged(extra));

describe("inboxLabel", () => {
  it("labels nothing until the row is triaged", () => {
    expect(
      inboxLabel({ needsReply: null, priority: null, category: null, feedback: null }),
    ).toBeNull();
    // A disabled triage reports every field null, even for a sender marked earlier.
    expect(
      inboxLabel({ needsReply: null, priority: null, category: null, feedback: "important" }),
    ).toBeNull();
  });

  it("calls mail that needs a reply, or is critical, important or an action, Needs attention", () => {
    expect(label({ needsReply: true })).toBe("attention");
    expect(label({ priority: "critical" })).toBe("attention");
    expect(label({ priority: "important" })).toBe("attention");
    expect(label({ category: "action" })).toBe("attention");
  });

  it("gives no label to ordinary triaged mail, and none when the thread was already answered", () => {
    expect(label({})).toBeNull();
    expect(label({ category: "reply", needsReply: false, priority: "low" })).toBeNull();
    expect(label({ category: "receipt", priority: "low" })).toBeNull();
  });

  it("drops Needs attention once the newest message is the user's own reply", () => {
    expect(label({ priority: "important", fromSelf: true })).toBeNull();
    expect(label({ category: "action", fromSelf: true })).toBeNull();
  });

  it("drops Needs attention for a sender marked noise", () => {
    expect(label({ needsReply: true, priority: "critical", feedback: "noise" })).toBeNull();
    expect(label({ category: "action", feedback: "noise" })).toBeNull();
    expect(label({ needsReply: true, feedback: "important" })).toBe("attention");
  });

  it("labels newsletters, bulk, spam and scam whichever classifier made the category", () => {
    expect(label({ category: "newsletter" })).toBe("newsletter");
    expect(label({ category: "spam" })).toBe("spam");
    expect(label({ category: "bulk" })).toBe("junk");
    expect(label({ category: "scam" })).toBe("junk");
  });

  it("puts Spam and Junk above Needs attention, and Needs attention above Newsletter", () => {
    expect(label({ category: "spam", needsReply: true, priority: "critical" })).toBe("spam");
    expect(label({ category: "scam", priority: "important" })).toBe("junk");
    expect(label({ category: "bulk", needsReply: true })).toBe("junk");
    expect(label({ category: "newsletter", priority: "important" })).toBe("attention");
    expect(label({ category: "newsletter", priority: "important", feedback: "noise" })).toBe(
      "newsletter",
    );
  });

  it("leaves suspicious mail to the warning icon, with no label of its own", () => {
    expect(label({ category: "suspicious" })).toBeNull();
    expect(label({ category: "suspicious", needsReply: true, priority: "critical" })).toBeNull();
  });

  it("still labels spam and junk from a sender marked noise", () => {
    expect(label({ category: "spam", feedback: "noise" })).toBe("spam");
    expect(label({ category: "bulk", feedback: "noise" })).toBe("junk");
  });
});
