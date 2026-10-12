import { describe, expect, it } from "vitest";
import { InboxListOutputSchema, inboxAgentSpawnKey, isInboxAgentSpawnKey } from "./inbox.js";

describe("inbox contracts", () => {
  it("builds the Inbox agent spawn key from the user id", () => {
    expect(inboxAgentSpawnKey("user-1")).toBe("inbox-agent:user-1");
  });

  it("recognizes only Inbox agent spawn keys, so ordinary bots keep their connector tools", () => {
    expect(isInboxAgentSpawnKey(inboxAgentSpawnKey("user-1"))).toBe(true);
    expect(isInboxAgentSpawnKey("onboarding:first")).toBe(false);
    expect(isInboxAgentSpawnKey("my-inbox-agent:user-1")).toBe(false);
    expect(isInboxAgentSpawnKey(null)).toBe(false);
    expect(isInboxAgentSpawnKey(undefined)).toBe(false);
  });

  it("accepts the empty state: no accounts, no agent, never synced", () => {
    expect(
      InboxListOutputSchema.parse({
        accounts: [],
        agent: null,
        rows: [],
        syncedAt: null,
        failedAccounts: [],
        enabled: false,
        triagePending: false,
      }),
    ).toMatchObject({ accounts: [], agent: null });
  });

  it("rejects a row without the triage fields (needsReply, priority, reason)", () => {
    const row = {
      id: "m1",
      connectionId: "c1",
      threadId: "t1",
      from: "Ann",
      subject: "Hi",
      snippet: "",
      receivedAt: "2026-10-01T00:00:00.000Z",
      unread: true,
    };
    const parse = (r: object) =>
      InboxListOutputSchema.safeParse({
        accounts: [],
        agent: null,
        rows: [r],
        syncedAt: null,
        failedAccounts: [],
        enabled: true,
        triagePending: false,
      }).success;
    expect(parse(row)).toBe(false);
    expect(parse({ ...row, needsReply: null })).toBe(false);
    expect(parse({ ...row, needsReply: null, priority: null, reason: null })).toBe(true);
    expect(parse({ ...row, needsReply: true, priority: "urgent", reason: null })).toBe(false);
  });
});
