import {
  type AdapterContext,
  type ConnectorProxyRequest,
  MailProviderError,
  type ManagedConnectorProvider,
} from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it } from "vitest";
import { createMailEmulator } from "./gmail-api-emulator.js";
import { createMailProvider } from "./gmail-mail-provider.js";
import { parseRawMime } from "./mime-parse.js";
import {
  assertMailModifyConformance,
  assertMailWriteConformance,
} from "./testing/mail-conformance.js";

const NOW = new Date("2026-10-01T12:00:00Z");
const to = [{ name: "Priya Shah", address: "priya@example.test" }];
const draft = { to, cc: [], bcc: [], subject: "Hello", text: "Hi Priya" };

function setup() {
  const sleeps: number[] = [];
  const mail = createMailEmulator({ now: NOW });
  const [a, b] = mail.accounts;
  if (!a || !b) throw new Error("seed has two accounts");
  const context = (over: Partial<AdapterContext> = {}): AdapterContext => ({
    operationId: "op",
    traceId: "trace",
    spaceId: a.spaceId,
    userId: a.userId,
    signal: new AbortController().signal,
    ...over,
  });
  /** A provider whose connector counts requests and can throw like a dropped connection. */
  const calls: ConnectorProxyRequest[] = [];
  let drop: ((request: ConnectorProxyRequest) => boolean) | undefined;
  const rows = mail.accounts.map((account) => ({
    id: account.id,
    connectorId: "emulator",
    provider: "gmail",
    providerRef: account.accountRef,
    displayName: account.label,
    status: "connected",
    spaceId: account.spaceId,
    userId: account.userId,
    metadata: { mailAddress: account.address },
  }));
  const connector = {
    proxy: async (request: ConnectorProxyRequest) => {
      calls.push(request);
      if (drop?.(request)) throw new Error("socket hang up");
      return mail.gmail.handle(request.accountRef, request.url, request.method, request.body);
    },
  } as unknown as ManagedConnectorProvider;
  const provider = createMailProvider({
    prisma: {
      connection: { findMany: async () => rows, updateMany: async () => ({ count: 0 }) },
    } as unknown as Pick<PrismaClient, "connection">,
    connectors: { managed: () => connector },
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    random: () => 0,
  });
  return {
    mail,
    a,
    b,
    provider,
    context,
    calls,
    sleeps,
    dropWhen: (match: (request: ConnectorProxyRequest) => boolean) => {
      drop = match;
    },
  };
}

const kindOf = async (run: Promise<unknown>) => {
  try {
    await run;
  } catch (error) {
    if (error instanceof MailProviderError) return error.kind;
    throw error;
  }
  return "ok";
};

describe("GmailMailProvider drafts", () => {
  it("passes the shared write conformance suite", async () => {
    const { provider, mail } = setup();
    await assertMailWriteConformance(provider, mail);
  });

  it("passes the shared label conformance suite", async () => {
    const { provider, mail } = setup();
    await assertMailModifyConformance(provider, mail);
  });

  it("saves a new draft without sending, then replaces it in place", async () => {
    const { provider, mail, a, context } = setup();
    const created = await provider.createDraft(a, draft, context());
    const [saved] = mail.gmail.draftsOf(a.accountRef);
    expect(saved?.id).toBe(created.draftId);
    const mime = parseRawMime(saved?.raw ?? "");
    expect(mime.header("To")).toBe("Priya Shah <priya@example.test>");
    expect(mime.header("Subject")).toBe("Hello");
    expect(mime.text).toBe("Hi Priya");
    expect(mail.gmail.sentOf(a.accountRef)).toHaveLength(0);

    await provider.updateDraft(
      a,
      created.draftId,
      { ...draft, subject: "Hello again", text: "Edited" },
      context(),
    );
    const after = mail.gmail.draftsOf(a.accountRef);
    expect(after).toHaveLength(1);
    expect(parseRawMime(after[0]?.raw ?? "").header("Subject")).toBe("Hello again");
  });

  it("puts a reply in the original thread with In-Reply-To and the full References chain", async () => {
    const { provider, mail, a, context } = setup();
    // a-02 is itself a reply: it already carries References.
    const created = await provider.createDraft(
      a,
      { ...draft, subject: "Re: Contract renewal", inReplyTo: "a-02" },
      context(),
    );
    expect(created.threadId).toBe("t-contract");
    await provider.sendDraft(a, created.draftId, context());
    const [sent] = mail.gmail.sentOf(a.accountRef);
    expect(sent?.threadId).toBe("t-contract");
    const mime = parseRawMime(sent?.raw ?? "");
    expect(mime.header("In-Reply-To")).toBe("<a-02@mail.example.test>");
    expect(mime.header("References")).toBe("<a-01@mail.example.test> <a-02@mail.example.test>");
    expect(mime.header("Bcc")).toBeUndefined();
  });

  it("starts a new thread when nothing is replied to, and rejects an unknown original", async () => {
    const { provider, mail, a, context } = setup();
    const created = await provider.createDraft(a, draft, context());
    await provider.sendDraft(a, created.draftId, context());
    const [sent] = mail.gmail.sentOf(a.accountRef);
    expect(sent?.threadId).not.toBe("t-contract");
    expect(parseRawMime(sent?.raw ?? "").header("In-Reply-To")).toBeUndefined();
    expect(await kindOf(provider.createDraft(a, { ...draft, inReplyTo: "nope" }, context()))).toBe(
      "not_found",
    );
  });

  it("rejects header injection before any request leaves", async () => {
    const { provider, a, context, calls } = setup();
    expect(
      await kindOf(
        provider.createDraft(a, { ...draft, subject: "x\r\nBcc: evil@example.test" }, context()),
      ),
    ).toBe("invalid");
    expect(
      await kindOf(
        provider.createDraft(
          a,
          { ...draft, to: [{ address: "a@example.test\nBcc: e@example.test" }] },
          context(),
        ),
      ),
    ).toBe("invalid");
    expect(calls).toHaveLength(0);
  });

  it("never sends for another user's account", async () => {
    const { provider, mail, a, context } = setup();
    const created = await provider.createDraft(a, draft, context());
    const stranger = context({ userId: "someone-else" });
    expect(await kindOf(provider.sendDraft(a, created.draftId, stranger))).toBe("auth");
    expect(mail.gmail.sentOf(a.accountRef)).toHaveLength(0);
  });

  it("maps a missing draft to not_found and a bad request to invalid", async () => {
    const { provider, mail, a, context } = setup();
    expect(await kindOf(provider.sendDraft(a, "gone", context()))).toBe("not_found");
    mail.gmail.failNext(400, { urlIncludes: "/drafts", reason: "invalidArgument" });
    expect(await kindOf(provider.createDraft(a, draft, context()))).toBe("invalid");
  });

  it("maps 403 insufficientPermissions and 401 to a reconnect error", async () => {
    const { provider, mail, a, context } = setup();
    mail.gmail.failNext(403, { urlIncludes: "/drafts", reason: "insufficientPermissions" });
    expect(await kindOf(provider.createDraft(a, draft, context()))).toBe("auth");
    mail.gmail.failNext(401, { urlIncludes: "/drafts" });
    expect(await kindOf(provider.createDraft(a, draft, context()))).toBe("auth");
  });
});

describe("GmailMailProvider sending is never retried when the outcome is unclear", () => {
  it("reports unknown after a provider 5xx and makes exactly one send request", async () => {
    const { provider, mail, a, context, calls, sleeps } = setup();
    const created = await provider.createDraft(a, draft, context());
    mail.gmail.failNext(500, { urlIncludes: "drafts/send", times: 5 });
    expect(await kindOf(provider.sendDraft(a, created.draftId, context()))).toBe("unknown");
    expect(calls.filter((c) => c.url.endsWith("/drafts/send"))).toHaveLength(1);
    expect(sleeps).toEqual([]);
  });

  it("reports unknown after a dropped connection and makes exactly one send request", async () => {
    const { provider, a, context, calls, dropWhen } = setup();
    const created = await provider.createDraft(a, draft, context());
    dropWhen((request) => request.url.endsWith("/drafts/send"));
    expect(await kindOf(provider.sendDraft(a, created.draftId, context()))).toBe("unknown");
    expect(calls.filter((c) => c.url.endsWith("/drafts/send"))).toHaveLength(1);
  });

  it("reports unknown when the caller aborts the request", async () => {
    const { provider, a, context } = setup();
    const created = await provider.createDraft(a, draft, context());
    const controller = new AbortController();
    controller.abort();
    expect(
      await kindOf(provider.sendDraft(a, created.draftId, context({ signal: controller.signal }))),
    ).toBe("unknown");
  });

  it("retries after a rate limit, which proves nothing was sent, and sends once", async () => {
    const { provider, mail, a, context, sleeps } = setup();
    const created = await provider.createDraft(a, draft, context());
    mail.gmail.failNext(429, { urlIncludes: "drafts/send", retryAfter: 2 });
    await provider.sendDraft(a, created.draftId, context());
    expect(sleeps).toEqual([2000]);
    expect(mail.gmail.sentOf(a.accountRef)).toHaveLength(1);
  });

  it("does not retry creating a draft after a 5xx, so a retry cannot leave two drafts", async () => {
    const { provider, mail, a, context, calls } = setup();
    mail.gmail.failNext(500, { urlIncludes: "/drafts", times: 5 });
    expect(await kindOf(provider.createDraft(a, draft, context()))).toBe("unavailable");
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(1);
    expect(mail.gmail.draftsOf(a.accountRef)).toHaveLength(0);
  });

  it("does retry an update and a delete, which are safe to repeat", async () => {
    const { provider, mail, a, context } = setup();
    const created = await provider.createDraft(a, draft, context());
    mail.gmail.failNext(500, { urlIncludes: `/drafts/${created.draftId}`, times: 1 });
    await provider.updateDraft(a, created.draftId, { ...draft, text: "v2" }, context());
    mail.gmail.failNext(503, { urlIncludes: `/drafts/${created.draftId}`, times: 1 });
    await provider.deleteDraft(a, created.draftId, context());
    expect(mail.gmail.draftsOf(a.accountRef)).toHaveLength(0);
  });
});
