import { describe, expect, it } from "vitest";
import { InboxListOutputSchema, inboxAgentSpawnKey } from "./inbox.js";

describe("inbox contracts", () => {
  it("builds the Inbox agent spawn key from the user id", () => {
    expect(inboxAgentSpawnKey("user-1")).toBe("inbox-agent:user-1");
  });

  it("accepts the empty state: no accounts, no agent, never synced", () => {
    expect(
      InboxListOutputSchema.parse({
        accounts: [],
        agent: null,
        rows: [],
        syncedAt: null,
        failedAccounts: [],
      }),
    ).toMatchObject({ accounts: [], agent: null });
  });

  it("rejects a row without the needsReply field, which item 5 fills in later", () => {
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
      }).success;
    expect(parse(row)).toBe(false);
    expect(parse({ ...row, needsReply: null })).toBe(true);
  });
});
