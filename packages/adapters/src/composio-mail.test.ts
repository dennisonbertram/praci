import type { AdapterContext, ConnectorProxyError } from "@rakazo/adapter-kit";
import { MailProviderError } from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ComposioConnector } from "./composio-connector.js";
import { ComposioEmulator } from "./composio-emulator.js";
import { createMailEmulator } from "./gmail-api-emulator.js";
import { createMailProvider } from "./gmail-mail-provider.js";
import { GoogleApiClient } from "./google-api-request.js";
import {
  assertMailChangesConformance,
  assertMailConformance,
  assertMailModifyConformance,
  assertMailSenderRuleConformance,
  assertMailSignalsConformance,
  assertMailWriteConformance,
} from "./testing/mail-conformance.js";

const sdk = vi.hoisted(() => ({
  proxyExecute:
    vi.fn<
      (body: Record<string, unknown>, options?: { signal?: AbortSignal }) => Promise<unknown>
    >(),
}));

vi.mock("@composio/core", () => ({
  Composio: class {
    readonly tools = {
      proxyExecute: (body: Record<string, unknown>, options?: { signal?: AbortSignal }) =>
        sdk.proxyExecute(body, options),
    };
  },
}));

const context: AdapterContext = {
  operationId: "composio-mail",
  traceId: "composio-mail",
  spaceId: "space-emulator",
  userId: "user-emulator",
  signal: new AbortController().signal,
};

/** A Composio connector whose mocked SDK forwards every proxy call to the Gmail emulator. */
function composioMailbox(sleeps: number[] = []) {
  const emulator = createMailEmulator();
  sdk.proxyExecute.mockImplementation(async (body) => {
    const response = emulator.gmail.handle(
      String(body.connectedAccountId),
      String(body.endpoint),
      body.method as "GET",
      body.body,
    );
    return {
      status: response.status,
      data: response.data,
      headers:
        response.retryAfterMs === undefined
          ? {}
          : { "Retry-After": String(response.retryAfterMs / 1000) },
    };
  });
  const rows = emulator.accounts.map((account) => ({
    id: account.id,
    connectorId: "composio",
    provider: "GMAIL",
    providerRef: account.accountRef,
    displayName: account.label,
    status: "connected",
    spaceId: account.spaceId,
    userId: account.userId,
    metadata: { mailAddress: account.address },
  }));
  const prisma = {
    connection: {
      findMany: async () => rows,
      updateMany: async () => ({ count: 0 }),
    },
  } as unknown as Pick<PrismaClient, "connection">;
  const connector = new ComposioConnector("test-key");
  const provider = createMailProvider({
    prisma,
    connectors: { managed: () => connector },
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });
  const accounts = emulator.accounts.map((account) => ({ ...account, connectorId: "composio" }));
  return { emulator, connector, provider, accounts };
}

describe("ComposioConnector.proxy", () => {
  beforeEach(() => {
    sdk.proxyExecute.mockReset();
  });

  it("passes mail conformance when proxyExecute reaches the Gmail emulator", async () => {
    const { emulator, provider, accounts } = composioMailbox();
    await assertMailConformance(provider, { gmail: emulator.gmail, accounts });
    await assertMailWriteConformance(provider, { gmail: emulator.gmail, accounts });
    await assertMailModifyConformance(provider, { gmail: emulator.gmail, accounts });
    await assertMailChangesConformance(provider, { gmail: emulator.gmail, accounts });
    await assertMailSenderRuleConformance(provider, { gmail: emulator.gmail, accounts });
    await assertMailSignalsConformance(provider, { gmail: emulator.gmail, accounts });
  });

  it("passes the method and JSON body of a write to proxyExecute", async () => {
    sdk.proxyExecute.mockResolvedValue({ status: 200, data: { id: "d1" }, headers: {} });
    const connector = new ComposioConnector("test-key");
    const url = "https://gmail.googleapis.com/gmail/v1/users/me/drafts";
    const body = { message: { raw: "Zm9v" } };
    await connector.proxy({ app: "GMAIL", accountRef: "ca-1", method: "POST", url, body }, context);
    await connector.proxy(
      { app: "GMAIL", accountRef: "ca-1", method: "DELETE", url: `${url}/d1` },
      context,
    );
    expect(sdk.proxyExecute.mock.calls[0]?.[0]).toEqual({
      endpoint: url,
      method: "POST",
      body,
      connectedAccountId: "ca-1",
    });
    expect(sdk.proxyExecute.mock.calls[1]?.[0]).toMatchObject({ method: "DELETE" });
    expect(sdk.proxyExecute.mock.calls[1]?.[0]).not.toHaveProperty("body");
  });

  it("marks a dropped write as not transient-retryable by the mail layer and sends once", async () => {
    const { provider, accounts } = composioMailbox();
    const account = accounts[0];
    if (!account) throw new Error("no account");
    sdk.proxyExecute.mockRejectedValue(Object.assign(new Error("fetch failed"), { status: 502 }));
    await expect(provider.sendDraft(account, "d1", context)).rejects.toMatchObject({
      kind: "unknown",
    });
    expect(sdk.proxyExecute).toHaveBeenCalledTimes(1);
  });

  it("sends a GET with connectedAccountId equal to the row's providerRef", async () => {
    const { provider, accounts } = composioMailbox();
    const account = accounts[0];
    if (!account) throw new Error("no account");
    await provider.listMessages(account, { query: "in:inbox", pageSize: 2 }, context);
    expect(sdk.proxyExecute.mock.calls.length).toBeGreaterThan(0);
    for (const [body] of sdk.proxyExecute.mock.calls) {
      expect(body.method).toBe("GET");
      expect(body.connectedAccountId).toBe(account.accountRef);
    }
  });

  it("keeps repeated metadataHeaders in the absolute endpoint instead of moving them to parameters", async () => {
    const { provider, accounts } = composioMailbox();
    const account = accounts[0];
    if (!account) throw new Error("no account");
    await provider.listMessages(account, { query: "", pageSize: 1 }, context);
    const hydrate = sdk.proxyExecute.mock.calls
      .map(([body]) => body)
      .find((body) => String(body.endpoint).includes("format=metadata"));
    expect(hydrate).toBeDefined();
    const url = new URL(String(hydrate?.endpoint));
    expect(url.origin).toBe("https://gmail.googleapis.com");
    expect(url.searchParams.getAll("metadataHeaders")).toEqual([
      "From",
      "To",
      "Cc",
      "Subject",
      "Date",
      "List-Unsubscribe",
      "List-Unsubscribe-Post",
      "List-Id",
      "Precedence",
      "Auto-Submitted",
      "Authentication-Results",
      "DKIM-Signature",
    ]);
    expect(hydrate).not.toHaveProperty("parameters");
  });

  it("returns upstream status codes and converts Retry-After seconds to milliseconds", async () => {
    sdk.proxyExecute.mockResolvedValue({
      status: 429,
      data: { error: { message: "slow down" } },
      headers: { "retry-after": "7" },
    });
    const response = await new ComposioConnector("test-key").proxy(
      {
        app: "GMAIL",
        accountRef: "ca-1",
        method: "GET",
        url: "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      },
      context,
    );
    expect(response).toEqual({
      status: 429,
      data: { error: { message: "slow down" } },
      retryAfterMs: 7000,
    });
  });

  it("omits retryAfterMs when the header is missing or not a number", async () => {
    sdk.proxyExecute.mockResolvedValue({
      status: 200,
      data: {},
      headers: { "Retry-After": "soon" },
    });
    const response = await new ComposioConnector("test-key").proxy(
      {
        app: "GMAIL",
        accountRef: "ca-1",
        method: "GET",
        url: "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      },
      context,
    );
    expect(response.retryAfterMs).toBeUndefined();
  });

  it("forwards the caller's abort signal to the SDK", async () => {
    sdk.proxyExecute.mockResolvedValue({ status: 200, data: {}, headers: {} });
    const controller = new AbortController();
    await new ComposioConnector("test-key").proxy(
      {
        app: "GMAIL",
        accountRef: "ca-1",
        method: "GET",
        url: "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      },
      { ...context, signal: controller.signal },
    );
    expect(sdk.proxyExecute.mock.calls[0]?.[1]?.signal).toBe(controller.signal);
  });

  it("does not leak secrets from SDK errors, and the mail provider maps the failure to unavailable", async () => {
    sdk.proxyExecute.mockRejectedValue(new Error("upstream failed apiKey=ck_live_supersecret"));
    const connector = new ComposioConnector("test-key");
    const failure = await connector
      .proxy(
        {
          app: "GMAIL",
          accountRef: "ca-1",
          method: "GET",
          url: "https://gmail.googleapis.com/gmail/v1/users/me/profile",
        },
        context,
      )
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).not.toContain("ck_live_supersecret");

    const { provider, accounts } = composioMailbox();
    sdk.proxyExecute.mockRejectedValue(new Error("boom apiKey=ck_live_supersecret"));
    const account = accounts[0];
    if (!account) throw new Error("no account");
    const mapped = await provider
      .listMessages(account, { query: "", pageSize: 1 }, context)
      .catch((error: unknown) => error);
    expect(mapped).toBeInstanceOf(MailProviderError);
    expect((mapped as MailProviderError).kind).toBe("unavailable");
    expect((mapped as MailProviderError).message).not.toContain("ck_live_supersecret");
  });

  describe("transport failures", () => {
    const request = {
      app: "GMAIL",
      accountRef: "ca-1",
      method: "GET" as const,
      url: "https://gmail.googleapis.com/gmail/v1/users/me/profile",
    };
    const sdkError = (name: string, message: string, extra: Record<string, unknown> = {}) =>
      Object.assign(new Error(message), { name, ...extra });
    const failure = async (connector = new ComposioConnector("test-key"), ctx = context) => {
      try {
        await connector.proxy(request, ctx);
      } catch (error) {
        return error as ConnectorProxyError;
      }
      throw new Error("proxy did not throw");
    };

    it("marks a Composio 5xx as transient and keeps its status and class", async () => {
      class InternalServerError extends Error {
        status = 502;
      }
      sdk.proxyExecute.mockRejectedValue(new InternalServerError("502 bad gateway"));
      expect(await failure()).toMatchObject({
        name: "ConnectorProxyError",
        transient: true,
        status: 502,
        code: "InternalServerError",
        message: "502 bad gateway",
      });
    });

    it("marks a network failure with no status as transient", async () => {
      sdk.proxyExecute.mockRejectedValue(sdkError("Error", "Connection error."));
      expect(await failure()).toMatchObject({ transient: true, status: undefined });
    });

    it("marks a Composio 4xx other than 429 as permanent", async () => {
      sdk.proxyExecute.mockRejectedValue(
        sdkError("Error", "401 invalid key apiKey=ck_live_supersecret", { status: 401 }),
      );
      const error = await failure();
      expect(error).toMatchObject({ transient: false, status: 401 });
      expect(error.message).not.toContain("ck_live_supersecret");
    });

    it("marks a request the caller cancelled as permanent", async () => {
      const controller = new AbortController();
      sdk.proxyExecute.mockImplementation(async () => {
        controller.abort();
        throw sdkError("Error", "Request was cancelled by the caller: Request was aborted.");
      });
      expect(
        await failure(new ComposioConnector("test-key"), { ...context, signal: controller.signal }),
      ).toMatchObject({
        transient: false,
      });
    });

    it("turns a thrown 429 into a response with the Retry-After delay", async () => {
      sdk.proxyExecute.mockRejectedValue(
        sdkError("Error", "429 slow down", {
          status: 429,
          headers: new Headers({ "retry-after": "2" }),
        }),
      );
      expect(await new ComposioConnector("test-key").proxy(request, context)).toMatchObject({
        status: 429,
        retryAfterMs: 2000,
      });
    });

    it("recovers a mail listing when the first proxy call hits a transient Composio error", async () => {
      const sleeps: number[] = [];
      const { provider, accounts } = composioMailbox(sleeps);
      const forward = sdk.proxyExecute.getMockImplementation();
      let calls = 0;
      sdk.proxyExecute.mockImplementation(async (body, options) => {
        if (++calls === 1) throw sdkError("Error", "Connection error.");
        return forward?.(body, options);
      });
      const account = accounts[0];
      if (!account) throw new Error("no account");
      const page = await provider.listMessages(account, { query: "", pageSize: 2 }, context);
      expect(page.messages.length).toBeGreaterThan(0);
      expect(sleeps.length).toBe(1);
    });
  });
});

describe("Gmail errors through the Composio proxy", () => {
  beforeEach(() => {
    sdk.proxyExecute.mockReset();
  });

  it("retries a Gmail 429 after the Retry-After delay and then returns the page", async () => {
    const sleeps: number[] = [];
    const { emulator, provider, accounts } = composioMailbox(sleeps);
    const account = accounts[0];
    if (!account) throw new Error("no account");
    emulator.gmail.failNext(429, { retryAfter: 3, urlIncludes: "/messages?" });
    const page = await provider.listMessages(account, { query: "in:inbox", pageSize: 2 }, context);
    expect(page.messages).toHaveLength(2);
    expect(sleeps).toEqual([3000]);
  });

  it("maps a Gmail 401 to an auth error so the UI can ask the user to reconnect", async () => {
    const { emulator, provider, accounts } = composioMailbox();
    const account = accounts[0];
    if (!account) throw new Error("no account");
    emulator.gmail.failNext(401, { reason: "authError", urlIncludes: "/messages?" });
    const failure = await provider
      .listMessages(account, { query: "", pageSize: 1 }, context)
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(MailProviderError);
    expect((failure as MailProviderError).kind).toBe("auth");
  });
});

describe("ComposioEmulator.proxy", () => {
  it("answers Gmail REST requests from the Gmail emulator", async () => {
    const response = await new ComposioEmulator().proxy({
      app: "GMAIL",
      accountRef: "acct-a",
      method: "GET",
      url: "https://gmail.googleapis.com/gmail/v1/users/me/profile",
    });
    expect(response.status).toBe(200);
    expect(response.data).toMatchObject({ emailAddress: "alice@example.test" });
  });

  it("answers 401 for an account the mailbox does not know", async () => {
    const response = await new ComposioEmulator().proxy({
      app: "GMAIL",
      accountRef: "GMAIL:99",
      method: "GET",
      url: "https://gmail.googleapis.com/gmail/v1/users/me/profile",
    });
    expect(response.status).toBe(401);
  });
});

describe("transient Composio failures during a mail listing", () => {
  beforeEach(() => {
    sdk.proxyExecute.mockReset();
  });
  const flaky = (failCall: number, error: Error) => {
    const { provider, accounts, emulator } = composioMailbox();
    const forward = sdk.proxyExecute.getMockImplementation();
    let calls = 0;
    sdk.proxyExecute.mockImplementation(async (body, options) => {
      if (++calls === failCall) throw error;
      return forward?.(body, options);
    });
    const account = accounts[0];
    if (!account) throw new Error("no account");
    return { provider, account, emulator };
  };

  it("retries one failed message fetch in the middle of a page and still hydrates every message", async () => {
    const intact = composioMailbox();
    const expected = await intact.provider.listMessages(
      intact.accounts[0] as never,
      { query: "", pageSize: 5 },
      context,
    );
    sdk.proxyExecute.mockReset();
    const { provider, account } = flaky(3, new Error("Connection error."));
    const page = await provider.listMessages(account, { query: "", pageSize: 5 }, context);
    expect(page.unhydratedIds ?? []).toEqual([]);
    expect(page.messages.map((m) => m.id)).toEqual(expected.messages.map((m) => m.id));
  });

  it("waits the Retry-After a thrown 429 carries before retrying", async () => {
    const sleeps: number[] = [];
    const { provider, accounts } = composioMailbox(sleeps);
    const forward = sdk.proxyExecute.getMockImplementation();
    let calls = 0;
    sdk.proxyExecute.mockImplementation(async (body, options) => {
      if (++calls === 1)
        throw Object.assign(new Error("429 slow down"), {
          status: 429,
          headers: new Headers({ "retry-after": "2" }),
        });
      return forward?.(body, options);
    });
    await provider.listMessages(accounts[0] as never, { query: "", pageSize: 1 }, context);
    expect(sleeps).toEqual([2000]);
  });

  it("keeps credentials out of the error detail", async () => {
    const { provider, accounts } = composioMailbox();
    const account = accounts[0];
    if (!account) throw new Error("no account");
    sdk.proxyExecute.mockRejectedValue(
      Object.assign(new Error("502 apiKey=ck_live_supersecret Bearer abc.def"), { status: 502 }),
    );
    const error = (await provider
      .listMessages(account, { query: "", pageSize: 1 }, context)
      .catch((e: unknown) => e)) as MailProviderError;
    expect(error.kind).toBe("unavailable");
    expect(error.detail).toContain("502");
    expect(error.detail).not.toContain("ck_live_supersecret");
    expect(error.detail).not.toContain("abc.def");
  });
});

describe("ComposioConnector cancellation", () => {
  beforeEach(() => {
    sdk.proxyExecute.mockReset();
  });
  const request = (signal: AbortSignal) =>
    new GoogleApiClient({ sleep: async () => undefined, random: () => 0, startGapMs: 0 }).request({
      connector: new ComposioConnector("test-key"),
      account: { connectorId: "composio", providerRef: "ca-1", app: "GMAIL" },
      method: "GET",
      url: "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      context: { ...context, signal },
    });

  it("reports a deadline abort in flight as an abort, not a transport failure", async () => {
    const controller = new AbortController();
    sdk.proxyExecute.mockImplementation(
      (_body, options) =>
        new Promise((_, reject) =>
          options?.signal?.addEventListener("abort", () => reject(new Error("Request failed")), {
            once: true,
          }),
        ),
    );
    const pending = request(controller.signal);
    setTimeout(() => controller.abort(), 10);
    await expect(pending).rejects.toMatchObject({ kind: "aborted" });
  });

  it("still reports a genuine upstream error as a transport failure", async () => {
    sdk.proxyExecute.mockRejectedValue(Object.assign(new Error("bad gateway"), { status: 503 }));
    await expect(request(new AbortController().signal)).rejects.toMatchObject({
      kind: "transport",
    });
  });
});
