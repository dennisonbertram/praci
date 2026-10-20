import { describe, expect, it } from "vitest";
import {
  CleanupArchiveInputSchema,
  InboxFeedbackInputSchema,
  InboxFilterSchema,
  InboxListInputSchema,
  InboxListOutputSchema,
  InboxMoveInputSchema,
  inboxAgentSpawnKey,
  isInboxAgentSpawnKey,
  UnsubscribeOutputSchema,
} from "./inbox.js";

describe("inbox contracts", () => {
  it("accepts the eight Gmail filters, a bounded search query and a page token on inbox.list", () => {
    for (const filter of InboxFilterSchema.options) {
      expect(
        InboxListInputSchema.parse({ filter, query: "from:ann", pageToken: "t" }),
      ).toMatchObject({ filter });
    }
    expect(InboxFilterSchema.options).toHaveLength(8);
    expect(InboxListInputSchema.parse({})).toEqual({});
  });

  it("rejects an unknown filter, an over-long query and an over-long page token", () => {
    expect(InboxListInputSchema.safeParse({ filter: "spam" }).success).toBe(false);
    expect(InboxListInputSchema.safeParse({ query: "x".repeat(501) }).success).toBe(false);
    expect(InboxListInputSchema.safeParse({ pageToken: "x".repeat(4097) }).success).toBe(false);
  });

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
        reconnectAccounts: [],
        enabled: false,
        triageBlocked: { reason: "no_model" },
        triagePending: false,
      }),
    ).toMatchObject({ accounts: [], agent: null, triageBlocked: { reason: "no_model" } });
  });

  it("says why triage is off: no model, or consent needed for one exact recipient", () => {
    const list = (triageBlocked: unknown) =>
      InboxListOutputSchema.safeParse({
        accounts: [],
        agent: null,
        rows: [],
        syncedAt: null,
        failedAccounts: [],
        reconnectAccounts: [],
        enabled: false,
        triageBlocked,
        triagePending: false,
      });
    const recipient = { key: "abc123", name: "OpenRouter" };
    expect(list(null).success).toBe(true);
    expect(list({ reason: "needs_consent", recipient })).toMatchObject({
      success: true,
      data: { triageBlocked: { reason: "needs_consent", recipient } },
    });
    expect(list({ reason: "needs_consent" }).success).toBe(false);
    expect(list({ reason: "billing" }).success).toBe(false);
    // A response from before this field existed is no longer valid output.
    const { triageBlocked: _omitted, ...without } = {
      accounts: [],
      agent: null,
      rows: [],
      syncedAt: null,
      failedAccounts: [],
      reconnectAccounts: [],
      enabled: false,
      triageBlocked: null,
      triagePending: false,
    };
    expect(InboxListOutputSchema.safeParse(without).success).toBe(false);
  });

  it("requires reconnectAccounts, the accounts whose failed sync needs a reconnect", () => {
    const list = (reconnectAccounts?: unknown) =>
      InboxListOutputSchema.safeParse({
        accounts: [],
        agent: null,
        rows: [],
        syncedAt: null,
        failedAccounts: ["c1"],
        ...(reconnectAccounts === undefined ? {} : { reconnectAccounts }),
        enabled: false,
        triageBlocked: null,
        triagePending: false,
      });
    expect(list(["c1"])).toMatchObject({ success: true, data: { reconnectAccounts: ["c1"] } });
    expect(list().success).toBe(false);
  });

  it("rejects a row without the triage fields (needsReply, priority, reason, category, feedback)", () => {
    const row = {
      id: "m1",
      connectionId: "c1",
      threadId: "t1",
      from: "Ann",
      subject: "Hi",
      snippet: "",
      receivedAt: "2026-10-01T00:00:00.000Z",
      unread: true,
      inInbox: true,
    };
    const parse = (r: object) =>
      InboxListOutputSchema.safeParse({
        accounts: [],
        agent: null,
        rows: [r],
        syncedAt: null,
        failedAccounts: [],
        reconnectAccounts: [],
        enabled: true,
        triageBlocked: null,
        triagePending: false,
      }).success;
    expect(parse(row)).toBe(false);
    expect(parse({ ...row, needsReply: null })).toBe(false);
    const triage = { needsReply: null, priority: null, reason: null };
    expect(parse({ ...row, ...triage })).toBe(false);
    expect(parse({ ...row, ...triage, category: null, feedback: null })).toBe(true);
    expect(parse({ ...row, ...triage, category: "scam", feedback: "noise" })).toBe(true);
    expect(parse({ ...row, ...triage, category: "invoice", feedback: null })).toBe(false);
    expect(parse({ ...row, ...triage, category: null, feedback: "spam" })).toBe(false);
    expect(
      parse({
        ...row,
        needsReply: true,
        priority: "urgent",
        reason: null,
        category: null,
        feedback: null,
      }),
    ).toBe(false);
  });

  it("accepts the Important view and the seven category views, and nothing else", () => {
    expect(InboxListInputSchema.parse({ view: "important", category: "billing" })).toEqual({
      view: "important",
      category: "billing",
    });
    expect(InboxListInputSchema.safeParse({ view: "starred" }).success).toBe(false);
    // Spam and scam stay visible in the list but have no view of their own.
    expect(InboxListInputSchema.safeParse({ category: "spam" }).success).toBe(false);
  });

  it("takes a mark or null to remove it, and no other mark", () => {
    expect(InboxFeedbackInputSchema.parse({ messageId: "m1", mark: "noise" }).mark).toBe("noise");
    expect(InboxFeedbackInputSchema.parse({ messageId: "m1", mark: null }).mark).toBeNull();
    expect(InboxFeedbackInputSchema.safeParse({ messageId: "m1", mark: "spam" }).success).toBe(
      false,
    );
    expect(InboxFeedbackInputSchema.safeParse({ messageId: "m1" }).success).toBe(false);
  });
});

describe("cleanup contracts", () => {
  it("takes one of four choices for one sender, with an optional batch to continue", () => {
    const base = { connectionId: "c1", address: "news@lists.example.test" };
    for (const kind of ["archive", "skip_inbox", "unsubscribe", "spam"])
      expect(CleanupArchiveInputSchema.parse({ ...base, kind })).toMatchObject({ kind });
    expect(CleanupArchiveInputSchema.safeParse({ ...base, kind: "trash" }).success).toBe(false);
    expect(
      CleanupArchiveInputSchema.parse({ ...base, kind: "archive", batchId: "b1" }).batchId,
    ).toBe("b1");
  });

  it("moves 1 to 50 messages to spam, not spam or trash", () => {
    const ids = (n: number) => Array.from({ length: n }, (_, i) => `m${i}`);
    expect(InboxMoveInputSchema.safeParse({ op: "spam", messageIds: ids(50) }).success).toBe(true);
    expect(InboxMoveInputSchema.safeParse({ op: "trash", messageIds: ids(51) }).success).toBe(
      false,
    );
    expect(InboxMoveInputSchema.safeParse({ op: "notSpam", messageIds: [] }).success).toBe(false);
    expect(InboxMoveInputSchema.safeParse({ op: "delete", messageIds: ids(1) }).success).toBe(
      false,
    );
  });

  it("answers an unsubscribe with a status, a method and where to go", () => {
    expect(
      UnsubscribeOutputSchema.parse({
        status: "opened",
        method: "link",
        openUrl: "https://x.example.test/u",
      }),
    ).toMatchObject({ status: "opened" });
    expect(UnsubscribeOutputSchema.safeParse({ status: "sent-ish", method: null }).success).toBe(
      false,
    );
  });
});
