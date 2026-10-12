import { type AdapterContext, ConnectorProxyError, MailProviderError } from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ComposioConnector } from "./composio-connector.js";
import { ComposioEmulator } from "./composio-emulator.js";
import { createMailEmulator } from "./gmail-api-emulator.js";
import { createMailProvider } from "./gmail-mail-provider.js";
import { assertMailConformance } from "./testing/mail-conformance.js";

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
    const response = emulator.gmail.handle(String(body.connectedAccountId), String(body.endpoint));
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
    const failure = (connector = new ComposioConnector("test-key"), ctx = context) =>
      connector.proxy(request, ctx).catch((error: unknown) => error as ConnectorProxyError);

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
