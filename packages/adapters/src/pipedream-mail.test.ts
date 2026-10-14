import type { AdapterContext, ConnectorProxyRequest } from "@rakazo/adapter-kit";
import { describe, expect, it, vi } from "vitest";
import { createMailEmulator } from "./gmail-api-emulator.js";
import { createMailProvider } from "./gmail-mail-provider.js";
import { PipedreamConnector } from "./pipedream-connector.js";
import {
  assertMailChangesConformance,
  assertMailConformance,
  assertMailModifyConformance,
  assertMailWriteConformance,
} from "./testing/mail-conformance.js";

const NOW = new Date("2026-10-01T12:00:00Z");
const CONFIG = {
  clientId: "fake-client-id",
  clientSecret: "fake-client-secret",
  projectId: "proj_fake",
  environment: "development" as const,
  identitySecret: "fake-identity-secret",
};
const context: AdapterContext = {
  operationId: "op",
  traceId: "trace",
  spaceId: "space-emulator",
  userId: "user-emulator",
  signal: new AbortController().signal,
};
const PROFILE_URL = "https://gmail.googleapis.com/gmail/v1/users/me/profile";

type Account = { id: string; healthy?: boolean; dead?: boolean; app: { name_slug: string } };
const gmailAccount = (id: string, extra: Partial<Account> = {}): Account => ({
  id,
  app: { name_slug: "gmail" },
  ...extra,
});

/**
 * A fake Pipedream API: the token endpoint, the account list, and the Connect proxy, which
 * decodes the base64url target and answers from the Gmail emulator unless `respond` overrides.
 * Account ids look like `apn_<emulator account ref>`.
 */
function fakePipedream(
  options: { accounts?: Account[]; respond?: (target: string) => Response | undefined } = {},
) {
  const mail = createMailEmulator({ now: NOW, sleep: async () => {}, random: () => 0 });
  // Pipedream names accounts `apn_<id>`; the emulator serves the same mailbox under both names.
  for (const ref of mail.gmail.accountRefs()) mail.gmail.alias(`apn_${ref}`, ref);
  const proxied: Array<{
    url: URL;
    target: string;
    headers: Headers;
    method: string;
    body: unknown;
  }> = [];
  const fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = new URL(request.url);
    if (url.pathname === "/v1/oauth/token") {
      return Response.json({ access_token: "fake-access-token", expires_in: 3_600 });
    }
    if (url.pathname === "/v1/connect/proj_fake/accounts") {
      return Response.json({ data: options.accounts ?? [] });
    }
    const match = url.pathname.match(/^\/v1\/connect\/proj_fake\/proxy\/(.+)$/);
    if (!match) return new Response("not found", { status: 404 });
    const target = Buffer.from(match[1] as string, "base64url").toString("utf8");
    const bodyText = await request.clone().text();
    proxied.push({
      url,
      target,
      headers: request.headers,
      method: request.method,
      body: bodyText ? JSON.parse(bodyText) : undefined,
    });
    const override = options.respond?.(target);
    if (override) return override;
    const accountId = url.searchParams.get("account_id") ?? "";
    const text = await request.text();
    const answer = mail.gmail.handle(
      accountId,
      target,
      request.method as "GET",
      text ? JSON.parse(text) : undefined,
    );
    return answer.status === 204
      ? new Response(null, { status: 204 })
      : Response.json(answer.data, { status: answer.status });
  });
  const connector = new PipedreamConnector(CONFIG, {
    fetch: fetch as unknown as typeof globalThis.fetch,
  });
  return { mail, connector, fetch, proxied };
}

const proxyRequest = (accountRef: string, url = PROFILE_URL): ConnectorProxyRequest => ({
  app: "gmail",
  accountRef,
  method: "GET",
  url,
});

describe("PipedreamConnector.proxy", () => {
  it("passes the shared mail conformance suite through the Connect proxy", async () => {
    const fake = fakePipedream();
    const accounts = fake.mail.accounts.map((a) => ({ ...a, accountRef: `apn_${a.accountRef}` }));
    const provider = createMailProvider({
      prisma: {
        connection: {
          findMany: async () =>
            accounts.map((a) => ({
              id: a.id,
              provider: "gmail",
              providerRef: a.accountRef,
              displayName: a.label,
              status: "connected",
              spaceId: a.spaceId,
              userId: a.userId,
              metadata: { mailAddress: a.address },
            })),
          updateMany: async () => ({ count: 0 }),
        },
      } as never,
      connectors: { managed: () => fake.connector },
      sleep: async () => {},
      random: () => 0,
    });
    await assertMailConformance(provider, { gmail: fake.mail.gmail, accounts });
    await assertMailWriteConformance(provider, { gmail: fake.mail.gmail, accounts });
    await assertMailModifyConformance(provider, { gmail: fake.mail.gmail, accounts });
    await assertMailChangesConformance(provider, { gmail: fake.mail.gmail, accounts });
    expect(fake.proxied.length).toBeGreaterThan(0);
  });

  it("forwards POST, PUT and DELETE with the method and the JSON body to the Connect proxy", async () => {
    const fake = fakePipedream();
    const drafts = "https://gmail.googleapis.com/gmail/v1/users/me/drafts";
    const body = { message: { raw: "Zm9v", threadId: "t-contract" } };
    const created = await fake.connector.proxy(
      { ...proxyRequest("apn_acct-a", drafts), method: "POST", body },
      context,
    );
    const id = (created.data as { id: string }).id;
    await fake.connector.proxy(
      { ...proxyRequest("apn_acct-a", `${drafts}/${id}`), method: "PUT", body },
      context,
    );
    await fake.connector.proxy(
      { ...proxyRequest("apn_acct-a", `${drafts}/${id}`), method: "DELETE" },
      context,
    );
    expect(fake.proxied.map((p) => [p.method, p.target, p.body])).toEqual([
      ["POST", drafts, body],
      ["PUT", `${drafts}/${id}`, body],
      ["DELETE", `${drafts}/${id}`, undefined],
    ]);
    expect(fake.proxied[0]?.headers.get("content-type")).toBe("application/json");
  });

  it("sends a GET with the base64url target, account_id, hashed external_user_id and bearer token", async () => {
    const fake = fakePipedream();
    const target = `${PROFILE_URL}?fields=emailAddress&metadataHeaders=From&metadataHeaders=To`;
    const response = await fake.connector.proxy(proxyRequest("apn_acct-a", target), context);
    expect(response.status).toBe(200);
    const [sent] = fake.proxied;
    expect(sent?.target).toBe(target);
    expect(sent?.url.searchParams.get("account_id")).toBe("apn_acct-a");
    const externalUserId = sent?.url.searchParams.get("external_user_id") ?? "";
    expect(externalUserId).toMatch(/^rkz_[0-9a-f]{64}$/);
    expect(externalUserId).not.toContain(context.userId);
    expect(sent?.headers.get("authorization")).toBe("Bearer fake-access-token");
    expect(sent?.headers.get("x-pd-environment")).toBe("development");
    // No account lookup is needed for a concrete account id.
    expect(
      fake.fetch.mock.calls.filter(([input]) => String(input).includes("/accounts")),
    ).toHaveLength(0);
  });

  it("returns upstream error statuses and Retry-After instead of throwing", async () => {
    const fake = fakePipedream({
      respond: () =>
        Response.json(
          { error: { errors: [{ reason: "rateLimitExceeded" }] } },
          { status: 429, headers: { "retry-after": "7" } },
        ),
    });
    await expect(fake.connector.proxy(proxyRequest("apn_acct-a"), context)).resolves.toMatchObject({
      status: 429,
      retryAfterMs: 7_000,
      data: { error: { errors: [{ reason: "rateLimitExceeded" }] } },
    });
  });

  it("returns a 401 and refreshes the access token on the next call", async () => {
    let calls = 0;
    const fake = fakePipedream({
      respond: () => (calls++ === 0 ? new Response("denied", { status: 401 }) : undefined),
    });
    await expect(fake.connector.proxy(proxyRequest("apn_acct-a"), context)).resolves.toMatchObject({
      status: 401,
      data: "denied",
    });
    await expect(fake.connector.proxy(proxyRequest("apn_acct-a"), context)).resolves.toMatchObject({
      status: 200,
    });
    const tokenCalls = fake.fetch.mock.calls.filter(([input]) =>
      String(input).endsWith("/v1/oauth/token"),
    );
    expect(tokenCalls).toHaveLength(2);
  });

  it("uses the only healthy account when the ref is still the app slug", async () => {
    const fake = fakePipedream({
      accounts: [
        gmailAccount("apn_acct-a"),
        gmailAccount("apn_dead", { dead: true }),
        gmailAccount("apn_sick", { healthy: false }),
        { id: "apn_other-app", app: { name_slug: "slack" } },
      ],
    });
    const response = await fake.connector.proxy(proxyRequest("gmail"), context);
    expect(response.status).toBe(200);
    expect(fake.proxied[0]?.url.searchParams.get("account_id")).toBe("apn_acct-a");
  });

  it("gives 401 without calling the proxy when a slug ref is ambiguous or has no account", async () => {
    for (const accounts of [[gmailAccount("apn_acct-a"), gmailAccount("apn_acct-b")], []]) {
      const fake = fakePipedream({ accounts });
      const response = await fake.connector.proxy(proxyRequest("gmail"), context);
      expect(response.status).toBe(401);
      expect(fake.proxied).toHaveLength(0);
    }
  });

  it("rejects an oversized upstream response with a message free of credentials", async () => {
    const fake = fakePipedream({
      respond: () =>
        new Response("x", { status: 200, headers: { "content-length": String(3 * 1024 * 1024) } }),
    });
    const error = await fake.connector.proxy(proxyRequest("apn_acct-a"), context).catch((e) => e);
    expect(String(error)).toContain("too large");
    expect(String(error)).not.toContain("fake-client-secret");
    expect(String(error)).not.toContain("fake-access-token");
  });

  it("still throws a credential-free error when the account lookup itself fails", async () => {
    const fake = fakePipedream();
    fake.fetch.mockImplementation(async (input: string | URL | Request) => {
      const path = new URL(String(input)).pathname;
      if (path === "/v1/oauth/token")
        return Response.json({ access_token: "fake-access-token", expires_in: 3_600 });
      return new Response("boom fake-access-token", { status: 500 });
    });
    const error = await fake.connector.proxy(proxyRequest("gmail"), context).catch((e) => e);
    expect(error).toBeInstanceOf(Error);
    expect(String(error)).toContain("HTTP 500");
    expect(String(error)).not.toContain("fake-access-token");
  });
});
