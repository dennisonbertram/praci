import { describe, expect, it } from "vitest";
import { GmailApiEmulator } from "./gmail-api-emulator.js";

const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const NOW = new Date("2026-10-01T12:00:00Z");

interface Listed {
  messages?: Array<{ id: string; threadId: string }>;
  nextPageToken?: string;
  resultSizeEstimate?: number;
}
interface Part {
  mimeType: string;
  filename?: string;
  headers: Array<{ name: string; value: string }>;
  body?: { data?: string; size?: number };
  parts?: Part[];
}
interface Msg {
  id: string;
  threadId: string;
  internalDate: string;
  labelIds: string[];
  snippet: string;
  payload: Part;
}

function list(gmail: GmailApiEmulator, account: string, params: Record<string, string> = {}) {
  const url = new URL(`${BASE}/messages`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return gmail.handle(account, url.toString());
}
function ids(gmail: GmailApiEmulator, account: string, q: string, maxResults = "500") {
  const res = list(gmail, account, { q, maxResults });
  expect(res.status).toBe(200);
  return ((res.data as Listed).messages ?? []).map((m) => m.id);
}
function get(gmail: GmailApiEmulator, account: string, id: string, format = "full") {
  return gmail.handle(account, `${BASE}/messages/${id}?format=${format}`);
}
function header(part: Part, name: string) {
  return part.headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value;
}
function walk(part: Part): Part[] {
  return [part, ...(part.parts ?? []).flatMap(walk)];
}

describe("GmailApiEmulator", () => {
  it("serves deterministic pages in newest-first order with an offset page token", () => {
    const a = new GmailApiEmulator({ now: NOW });
    const b = new GmailApiEmulator({ now: NOW });
    const first = list(a, "acct-a", { maxResults: "4" });
    expect(first).toEqual(list(b, "acct-a", { maxResults: "4" }));
    const page1 = first.data as Listed;
    expect(page1.messages).toHaveLength(4);
    expect(page1.nextPageToken).toEqual(expect.any(String));
    const page2 = list(a, "acct-a", { maxResults: "4", pageToken: page1.nextPageToken as string })
      .data as Listed;
    const all = ids(a, "acct-a", "");
    expect([...(page1.messages ?? []), ...(page2.messages ?? [])].map((m) => m.id)).toEqual(
      all.slice(0, 8),
    );
    const dates = all.map((id) => Number((get(a, "acct-a", id).data as Msg).internalDate));
    expect(dates).toEqual([...dates].sort((x, y) => y - x));
    expect(all.length).toBeGreaterThanOrEqual(20);
    expect(ids(a, "acct-b", "").length).toBeGreaterThanOrEqual(8);
  });

  it("seeds inbound and sent mail, including a reply and an unanswered recent message", () => {
    const gmail = new GmailApiEmulator({ now: NOW });
    const messages = (q: string) =>
      ids(gmail, "acct-a", q).map((id) => get(gmail, "acct-a", id, "metadata").data as Msg);
    const inbox = messages("in:inbox");
    const sent = messages("in:sent");
    expect(inbox.length).toBeGreaterThan(0);
    expect(sent.length).toBeGreaterThan(0);
    expect(inbox.every((m) => m.labelIds.includes("INBOX") && !m.labelIds.includes("SENT"))).toBe(
      true,
    );
    expect(sent.every((m) => m.labelIds.includes("SENT") && !m.labelIds.includes("INBOX"))).toBe(
      true,
    );

    const cutoff = NOW.getTime() - 14 * 86_400_000;
    const recentInbox = inbox.filter((m) => Number(m.internalDate) >= cutoff);
    const replied = recentInbox.filter((m) =>
      sent.some(
        (s) => s.threadId === m.threadId && Number(s.internalDate) > Number(m.internalDate),
      ),
    );
    const unanswered = recentInbox.filter((m) => !sent.some((s) => s.threadId === m.threadId));
    expect(replied.length).toBeGreaterThanOrEqual(1);
    expect(unanswered.length).toBeGreaterThanOrEqual(1);
    const oldest = Math.min(...inbox.map((m) => Number(m.internalDate)));
    expect(NOW.getTime() - oldest).toBeGreaterThan(3 * 365 * 86_400_000);
  });

  it("seeds the message shapes the provider must parse", () => {
    const gmail = new GmailApiEmulator({ now: NOW });
    const full = ["acct-a", "acct-b"].flatMap((account) =>
      ids(gmail, account, "").map((id) => get(gmail, account, id).data as Msg),
    );
    const parts = (m: Msg) => walk(m.payload);
    expect(full.some((m) => m.payload.mimeType === "multipart/alternative")).toBe(true);
    expect(
      full.some(
        (m) =>
          m.payload.mimeType === "text/html" && !parts(m).some((p) => p.mimeType === "text/plain"),
      ),
    ).toBe(true);
    expect(
      full.some((m) =>
        parts(m).some((p) => /charset="?iso-8859-1/i.test(header(p, "Content-Type") ?? "")),
      ),
    ).toBe(true);
    expect(full.some((m) => parts(m).some((p) => p.filename))).toBe(true);
  });

  it("filters by in:, is:unread, from:, bare words, dates and OR groups", () => {
    const gmail = new GmailApiEmulator({
      now: NOW,
      mailboxes: {
        x: {
          address: "x@example.test",
          messages: [
            {
              id: "m1",
              date: "2026-09-01T10:00:00Z",
              labels: ["INBOX", "UNREAD"],
              from: "Ann <ann@example.test>",
              to: "x@example.test",
              subject: "Quarterly Budget",
              snippet: "numbers",
            },
            {
              id: "m2",
              date: "2026-09-02T10:00:00Z",
              labels: ["INBOX"],
              from: "bob@example.test",
              to: "x@example.test",
              subject: "Lunch",
              snippet: "pizza budget",
            },
            {
              id: "m3",
              date: "2026-09-03T10:00:00Z",
              labels: ["SENT"],
              from: "x@example.test",
              to: "ann@example.test",
              subject: "Re: Quarterly Budget",
              snippet: "ok",
            },
            {
              id: "m4",
              date: "2026-09-04T00:00:00Z",
              labels: ["INBOX"],
              from: "cy@example.test",
              to: "x@example.test",
              subject: "Travel",
              snippet: "flights",
            },
          ],
        },
      },
    });
    const q = (query: string) => ids(gmail, "x", query);
    expect(q("")).toEqual(["m4", "m3", "m2", "m1"]);
    expect(q("in:sent")).toEqual(["m3"]);
    expect(q("in:inbox")).toEqual(["m4", "m2", "m1"]);
    expect(q("is:unread")).toEqual(["m1"]);
    expect(q("from:ann")).toEqual(["m1"]);
    expect(q("BUDGET")).toEqual(["m3", "m2", "m1"]);
    expect(q("budget in:inbox")).toEqual(["m2", "m1"]);
    expect(q("after:2026/09/02 before:2026/09/04")).toEqual(["m3", "m2"]);
    expect(q("(from:ann OR from:cy) in:inbox")).toEqual(["m4", "m1"]);
    expect(q("(lunch OR travel) after:2026/09/04")).toEqual(["m4"]);
  });

  it("filters by is:starred, is:important, has:attachment and category:", () => {
    const base = { to: "x@example.test", from: "ann@example.test", snippet: "s" };
    const gmail = new GmailApiEmulator({
      now: NOW,
      mailboxes: {
        x: {
          address: "x@example.test",
          messages: [
            {
              ...base,
              id: "s1",
              date: "2026-09-01T10:00:00Z",
              labels: ["INBOX", "STARRED"],
              subject: "Starred",
            },
            {
              ...base,
              id: "i1",
              date: "2026-09-02T10:00:00Z",
              labels: ["INBOX", "IMPORTANT"],
              subject: "Important",
            },
            {
              ...base,
              id: "f1",
              date: "2026-09-03T10:00:00Z",
              labels: ["INBOX"],
              subject: "File",
              attachments: [{ filename: "a.pdf", mimeType: "application/pdf", size: 10 }],
            },
            {
              ...base,
              id: "p1",
              date: "2026-09-04T10:00:00Z",
              labels: ["INBOX", "CATEGORY_PROMOTIONS"],
              subject: "Sale",
            },
            {
              ...base,
              id: "u1",
              date: "2026-09-05T10:00:00Z",
              labels: ["INBOX", "CATEGORY_UPDATES"],
              subject: "Receipt",
            },
            {
              ...base,
              id: "n1",
              date: "2026-09-06T10:00:00Z",
              labels: ["INBOX"],
              subject: "Plain",
            },
            {
              ...base,
              id: "o1",
              date: "2026-09-07T10:00:00Z",
              labels: ["CATEGORY_SOCIAL"],
              subject: "Archived social",
            },
          ],
        },
      },
    });
    const q = (query: string) => ids(gmail, "x", query);
    expect(q("is:starred")).toEqual(["s1"]);
    expect(q("is:important")).toEqual(["i1"]);
    expect(q("has:attachment")).toEqual(["f1"]);
    expect(q("category:promotions")).toEqual(["p1"]);
    expect(q("category:updates")).toEqual(["u1"]);
    expect(q("category:social")).toEqual(["o1"]);
    expect(q("category:primary")).toEqual(["n1", "f1", "i1", "s1"]);
    expect(q("is:starred (plain OR starred)")).toEqual(["s1"]);
  });

  it("rejects unknown operators, bad page sizes and bad tokens with 400", () => {
    const gmail = new GmailApiEmulator({ now: NOW });
    expect(list(gmail, "acct-a", { q: "has:drive" }).status).toBe(400);
    expect(list(gmail, "acct-a", { q: "is:snoozed" }).status).toBe(400);
    expect(list(gmail, "acct-a", { q: "category:forums" }).status).toBe(400);
    expect(list(gmail, "acct-a", { q: "in:trash" }).status).toBe(400);
    expect(list(gmail, "acct-a", { q: "after:yesterday" }).status).toBe(400);
    expect(list(gmail, "acct-a", { maxResults: "501" }).status).toBe(400);
    expect(list(gmail, "acct-a", { maxResults: "0" }).status).toBe(400);
    expect(list(gmail, "acct-a", { pageToken: "nope" }).status).toBe(400);
    expect(list(gmail, "acct-a", { maxResults: "500" }).status).toBe(200);
  });

  it("returns metadata without bodies, full with bodies, and the profile", () => {
    const gmail = new GmailApiEmulator({ now: NOW });
    const id = ids(gmail, "acct-a", "")[0] as string;
    const meta = get(gmail, "acct-a", id, "metadata").data as Msg;
    expect(meta.payload.body?.data).toBeUndefined();
    expect(meta.payload.parts).toBeUndefined();
    expect(header(meta.payload, "Subject")).toEqual(expect.any(String));
    const only = gmail.handle(
      "acct-a",
      `${BASE}/messages/${id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
    ).data as Msg;
    expect(only.payload.headers.map((h) => h.name).sort()).toEqual(["From", "Subject"]);
    expect(gmail.handle("acct-a", `${BASE}/profile`).data).toMatchObject({
      emailAddress: "alice@example.test",
    });
    expect(get(gmail, "acct-a", id, "raw").status).toBe(400);
  });

  it("keeps mailboxes apart and rejects unknown accounts and other hosts", () => {
    const gmail = new GmailApiEmulator({ now: NOW });
    const aId = ids(gmail, "acct-a", "")[0] as string;
    expect(get(gmail, "acct-b", aId).status).toBe(404);
    expect(get(gmail, "acct-missing", aId).status).toBe(401);
    expect(
      gmail.handle("acct-a", "https://evil.example.test/gmail/v1/users/me/profile").status,
    ).toBe(404);
    expect(get(gmail, "acct-a", "does-not-exist").status).toBe(404);
  });

  it("fails the next requests with the requested status, reason and retry delay", () => {
    const gmail = new GmailApiEmulator({ now: NOW });
    gmail.failNext(429, { times: 2, reason: "rateLimitExceeded", retryAfter: 3 });
    const first = list(gmail, "acct-a");
    expect(first).toMatchObject({ status: 429, retryAfterMs: 3000 });
    expect(JSON.stringify(first.data)).toContain("rateLimitExceeded");
    expect(list(gmail, "acct-a").status).toBe(429);
    expect(list(gmail, "acct-a").status).toBe(200);
  });

  it("can target message gets, skip requests and be cleared", () => {
    const gmail = new GmailApiEmulator({ now: NOW });
    const [first, second] = ids(gmail, "acct-a", "") as [string, string];
    gmail.failNext(500, { times: 5, urlIncludes: "/messages/", skip: 1 });
    expect(list(gmail, "acct-a").status).toBe(200);
    expect(get(gmail, "acct-a", first).status).toBe(200);
    expect(get(gmail, "acct-a", second).status).toBe(500);
    gmail.clearFailures();
    expect(get(gmail, "acct-a", second).status).toBe(200);
  });
});

describe("alias", () => {
  it("serves a late-minted account ref from a seeded mailbox, and rejects an unknown seed", () => {
    const gmail = new GmailApiEmulator({
      now: NOW,
      mailboxes: {
        seeded: {
          address: "me@example.test",
          messages: [
            {
              id: "m1",
              date: NOW.toISOString(),
              labels: ["INBOX"],
              from: "a@example.test",
              to: "me@example.test",
              subject: "Hi",
            },
          ],
        },
      },
    });
    expect(list(gmail, "GMAIL:9").status).toBe(401);
    gmail.alias("GMAIL:9", "seeded");
    expect(ids(gmail, "GMAIL:9", "in:inbox")).toEqual(["m1"]);
    expect(() => gmail.alias("GMAIL:10", "missing")).toThrow("No seeded mailbox missing");
  });
});

describe("isolate", () => {
  it("gives each account its own copy of the mail, so a change stays with that account", () => {
    const seed = {
      address: "me@example.test",
      messages: [
        {
          id: "m1",
          date: NOW.toISOString(),
          labels: ["INBOX", "UNREAD"],
          from: "a@example.test",
          to: "me@example.test",
          subject: "Hi",
        },
      ],
    };
    const gmail = new GmailApiEmulator({ now: NOW, mailboxes: { seeded: seed } });
    gmail.isolate("GMAIL:1", "seeded", seed);
    gmail.isolate("GMAIL:2", "seeded", seed);
    const read = gmail.handle("GMAIL:1", `${BASE}/messages/m1/modify`, "POST", {
      removeLabelIds: ["UNREAD"],
    });
    expect(read.status).toBe(200);
    expect(ids(gmail, "GMAIL:1", "is:unread")).toEqual([]);
    expect(ids(gmail, "GMAIL:2", "is:unread")).toEqual(["m1"]);
    expect(() => gmail.isolate("GMAIL:3", "missing", seed)).toThrow("No seeded mailbox missing");
  });
});
