import { createHash, createHmac } from "node:crypto";
import type { AdapterContext, ManagedConnectorProvider } from "@rakazo/adapter-kit";
import { GOOGLE_DESKTOP_REDIRECT_URI } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import { createMailEmulator } from "./gmail-api-emulator.js";
import { GmailMailProvider } from "./gmail-mail-provider.js";
import { GoogleApiClient } from "./google-api-request.js";
import { GoogleConnector } from "./google-connector.js";
import { EncryptedSecretStore } from "./secrets.js";
import {
  assertMailChangesConformance,
  assertMailConformance,
  assertMailModifyConformance,
  assertMailWriteConformance,
} from "./testing/mail-conformance.js";

const CLIENT_SECRET = "fake-google-client-secret";
const IDENTITY = "fake-identity-secret";
const REDIRECT = "https://rakazo.example.test/integrations/google/callback";
const GMAIL_READONLY = "https://www.googleapis.com/auth/gmail.readonly";
const GMAIL_COMPOSE = "https://www.googleapis.com/auth/gmail.compose";
const GMAIL_MODIFY = "https://www.googleapis.com/auth/gmail.modify";

const context: AdapterContext = {
  operationId: "op",
  traceId: "trace",
  spaceId: "space-1",
  userId: "user-1",
  signal: new AbortController().signal,
};

type Row = Record<string, unknown>;
function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, want]) => {
    if (want && typeof want === "object" && "not" in want)
      return row[key] !== (want as { not: unknown }).not;
    return row[key] === want;
  });
}
/** In-memory stand-in for the two tables the connector touches. */
function fakePrisma(connections: Row[] = []) {
  const secrets: Row[] = [];
  const connectionFindMany = vi.fn(async ({ where }: { where: Row }) =>
    connections.filter((row) => matches(row, where)),
  );
  const prisma = {
    connection: {
      findFirst: async ({ where }: { where: Row }) =>
        connections.find((row) => matches(row, where)) ?? null,
      findMany: connectionFindMany,
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        const hit = connections.filter((row) => matches(row, where));
        for (const row of hit) Object.assign(row, data);
        return { count: hit.length };
      },
    },
    secret: {
      create: async ({ data }: { data: Row }) => {
        secrets.push({ ...data });
        return data;
      },
      findFirst: async ({ where }: { where: Row }) =>
        secrets.find((row) => matches(row, where)) ?? null,
      deleteMany: async ({ where }: { where: Row }) => {
        const before = secrets.length;
        for (let i = secrets.length - 1; i >= 0; i--)
          if (matches(secrets[i] as Row, where)) secrets.splice(i, 1);
        return { count: before - secrets.length };
      },
    },
  };
  return { prisma: prisma as never, connections, secrets, connectionFindMany };
}

const verifierFor = (state: string) =>
  createHmac("sha256", IDENTITY).update(`google-pkce:${state}`).digest("base64url");
const challengeFor = (verifier: string) =>
  createHash("sha256").update(verifier).digest("base64url");

interface FakeGoogle {
  fetch: typeof fetch;
  tokenCalls: URLSearchParams[];
  userinfoCalls: number;
  revokeCalls: string[];
  gmailUrls: string[];
  /** Every Gmail call as it reached Google. */
  gmailRequests: Array<{ url: string; method: string; body: unknown; contentType: string | null }>;
  /** Access tokens Gmail rejects once with 401, then accepts. */
  rejectOnce: Set<string>;
  scope: string;
  refreshToken: string | undefined;
  tokenError: { status: number; body: unknown } | undefined;
  revokeStatus: number;
  expiresIn: number;
  /** Maps an access token to the mailbox it opens. */
  mailboxByToken: Map<string, string>;
  gmail?: (
    accountRef: string,
    url: string,
    request: { method: string; body: unknown },
  ) => { status: number; data: unknown };
}
function fakeGoogle(): FakeGoogle {
  let issued = 0;
  const state: FakeGoogle = {
    tokenCalls: [],
    userinfoCalls: 0,
    revokeCalls: [],
    gmailUrls: [],
    gmailRequests: [],
    rejectOnce: new Set(),
    scope: `openid https://www.googleapis.com/auth/userinfo.email ${GMAIL_READONLY}`,
    refreshToken: "refresh-1",
    tokenError: undefined,
    revokeStatus: 200,
    expiresIn: 3600,
    mailboxByToken: new Map(),
    fetch: (async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input);
      const headers = new Headers(init?.headers);
      if (url === "https://oauth2.googleapis.com/token") {
        const form = new URLSearchParams(String(init?.body));
        state.tokenCalls.push(form);
        if (state.tokenError)
          return Response.json(state.tokenError.body, { status: state.tokenError.status });
        const access = `access-${++issued}`;
        const refreshToken = form.get("refresh_token");
        if (refreshToken) state.mailboxByToken.set(access, refreshToken.replace("refresh-", ""));
        return Response.json({
          access_token: access,
          expires_in: state.expiresIn,
          scope: state.scope,
          ...(form.get("grant_type") === "authorization_code" && state.refreshToken
            ? { refresh_token: state.refreshToken }
            : {}),
        });
      }
      if (url === "https://openidconnect.googleapis.com/v1/userinfo") {
        state.userinfoCalls++;
        return Response.json({ sub: "sub-1", email: "ann@example.test" });
      }
      if (url === "https://oauth2.googleapis.com/revoke") {
        state.revokeCalls.push(String(new URLSearchParams(String(init?.body)).get("token")));
        return Response.json({}, { status: state.revokeStatus });
      }
      state.gmailUrls.push(url);
      const method = init?.method ?? "GET";
      const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      state.gmailRequests.push({ url, method, body, contentType: headers.get("content-type") });
      const bearer = headers.get("authorization")?.replace("Bearer ", "") ?? "";
      if (state.rejectOnce.delete(bearer)) return Response.json({}, { status: 401 });
      const result = state.gmail?.(state.mailboxByToken.get(bearer) ?? "", url, {
        method,
        body,
      }) ?? {
        status: 200,
        data: { ok: true },
      };
      return result.status === 204
        ? new Response(null, { status: 204 })
        : Response.json(result.data, { status: result.status });
    }) as typeof fetch,
  };
  return state;
}

function setup(options: { now?: () => number; redirectUri?: string | null } = {}) {
  const google = fakeGoogle();
  const db = fakePrisma([
    {
      id: "conn-1",
      spaceId: "space-1",
      userId: "user-1",
      connectorId: "google",
      provider: "gmail",
      providerRef: "sub-1",
      status: "connected",
      secretId: null,
    },
  ]);
  const secrets = new EncryptedSecretStore("fake-encryption-key");
  const connector = new GoogleConnector({
    clientId: "fake-client-id.apps.example.test",
    clientSecret: CLIENT_SECRET,
    identitySecret: IDENTITY,
    redirectUri: options.redirectUri === null ? undefined : (options.redirectUri ?? REDIRECT),
    prisma: db.prisma,
    secrets,
    fetch: google.fetch,
    now: options.now,
  });
  return { google, db, secrets, connector };
}

/** Connects sub-1 for real (begin, complete) and returns the secret id. */
async function connect(s: ReturnType<typeof setup>) {
  const begun = await s.connector.begin({ provider: "gmail", redirectUrl: "unused" }, context);
  const done = await s.connector.complete({ state: begun.state, code: "code-1" }, context);
  s.db.connections[0]!.secretId = done.secretId;
  return done;
}

describe("GoogleConnector.begin", () => {
  it("builds the authorization URL with PKCE derived from state and the deployment secret", async () => {
    const { connector, google } = setup();
    const { authorizationUrl, state } = await connector.begin(
      { provider: "gmail", redirectUrl: "https://ignored.example.test/app" },
      context,
    );
    const url = new URL(authorizationUrl as string);
    expect(`${url.origin}${url.pathname}`).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    const p = url.searchParams;
    expect(p.get("response_type")).toBe("code");
    expect(p.get("client_id")).toBe("fake-client-id.apps.example.test");
    expect(p.get("redirect_uri")).toBe(REDIRECT);
    expect(p.get("scope")).toBe(`openid email ${GMAIL_READONLY} ${GMAIL_COMPOSE} ${GMAIL_MODIFY}`);
    expect(p.get("access_type")).toBe("offline");
    expect(p.get("prompt")).toBe("consent");
    expect(p.get("include_granted_scopes")).toBe("true");
    expect(p.get("code_challenge_method")).toBe("S256");
    expect(p.get("state")).toBe(state);
    expect(state).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(p.get("code_challenge")).toBe(challengeFor(verifierFor(state)));
    expect(url.search).not.toContain(CLIENT_SECRET);
    expect(google.tokenCalls).toHaveLength(0);
  });

  it("uses a fresh state every time", async () => {
    const { connector } = setup();
    const a = await connector.begin({ provider: "gmail", redirectUrl: "" }, context);
    const b = await connector.begin({ provider: "gmail", redirectUrl: "" }, context);
    expect(a.state).not.toBe(b.state);
  });

  it("refuses apps other than Google's and a missing redirect URI", async () => {
    await expect(
      setup().connector.begin({ provider: "slack", redirectUrl: "" }, context),
    ).rejects.toThrow(/Gmail/i);
    await expect(
      setup({ redirectUri: null }).connector.begin({ provider: "gmail", redirectUrl: "" }, context),
    ).rejects.toThrow(/redirect/i);
  });
});

describe("GoogleConnector desktop redirect", () => {
  it("authorizes and exchanges with the fixed loopback redirect, even without a web redirect", async () => {
    const s = setup({ redirectUri: null });
    const { authorizationUrl, state } = await s.connector.begin(
      { provider: "gmail", redirectUrl: GOOGLE_DESKTOP_REDIRECT_URI },
      context,
    );
    expect(new URL(authorizationUrl as string).searchParams.get("redirect_uri")).toBe(
      GOOGLE_DESKTOP_REDIRECT_URI,
    );
    await s.connector.complete(
      { state, code: "code-1", redirectUrl: GOOGLE_DESKTOP_REDIRECT_URI },
      context,
    );
    expect(s.google.tokenCalls[0]!.get("redirect_uri")).toBe(GOOGLE_DESKTOP_REDIRECT_URI);
  });

  it("never lets a caller pick another redirect", async () => {
    const s = setup();
    const evil = "http://127.0.0.1:9999/integrations/google/callback";
    const { authorizationUrl, state } = await s.connector.begin(
      { provider: "gmail", redirectUrl: evil },
      context,
    );
    expect(new URL(authorizationUrl as string).searchParams.get("redirect_uri")).toBe(REDIRECT);
    await s.connector.complete({ state, code: "code-1", redirectUrl: evil }, context);
    expect(s.google.tokenCalls[0]!.get("redirect_uri")).toBe(REDIRECT);
  });
});

describe("GoogleConnector.complete", () => {
  it("exchanges the code with the verifier recomputed from state and stores the refresh token encrypted", async () => {
    const s = setup();
    const { state } = await s.connector.begin({ provider: "gmail", redirectUrl: "" }, context);
    // A different instance stands in for another API process: nothing is kept in memory.
    const other = new GoogleConnector({
      clientId: "fake-client-id.apps.example.test",
      clientSecret: CLIENT_SECRET,
      identitySecret: IDENTITY,
      redirectUri: REDIRECT,
      prisma: s.db.prisma,
      secrets: s.secrets,
      fetch: s.google.fetch,
    });
    const result = await other.complete({ state, code: "code-1" }, context);

    const call = s.google.tokenCalls[0]!;
    expect(call.get("grant_type")).toBe("authorization_code");
    expect(call.get("code")).toBe("code-1");
    expect(call.get("code_verifier")).toBe(verifierFor(state));
    expect(call.get("redirect_uri")).toBe(REDIRECT);
    expect(call.get("client_secret")).toBe(CLIENT_SECRET);
    expect(result.connectionRef).toBe("sub-1");
    expect(s.db.secrets).toHaveLength(1);
    const row = s.db.secrets[0] as {
      id: string;
      userId: string;
      spaceId: string;
      kind: string;
      ciphertext: string;
    };
    expect(result.secretId).toBe(row.id);
    expect([row.userId, row.spaceId, row.kind]).toEqual(["user-1", "space-1", "google-oauth"]);
    expect(row.ciphertext).not.toContain("refresh-1");
    const stored = JSON.parse(await s.secrets.load(row.ciphertext, row.id));
    expect(stored).toMatchObject({
      refreshToken: "refresh-1",
      sub: "sub-1",
      email: "ann@example.test",
    });
  });

  it("rejects a grant without gmail.readonly, stores nothing, and revokes what Google issued", async () => {
    const s = setup();
    s.db.connections.length = 0; // no connected Google app that a revoke would also disconnect
    s.google.scope = "openid https://www.googleapis.com/auth/userinfo.email";
    const { state } = await s.connector.begin({ provider: "gmail", redirectUrl: "" }, context);
    await expect(s.connector.complete({ state, code: "code-1" }, context)).rejects.toThrow(
      /gmail/i,
    );
    expect(s.db.secrets).toHaveLength(0);
    expect(s.google.revokeCalls).toEqual(["refresh-1"]);
  });

  it("still connects when the user unticks the compose and modify permissions; writing then asks to reconnect", async () => {
    const s = setup();
    s.google.scope = `openid https://www.googleapis.com/auth/userinfo.email ${GMAIL_READONLY}`;
    const { state } = await s.connector.begin({ provider: "gmail", redirectUrl: "" }, context);
    await expect(s.connector.complete({ state, code: "code-1" }, context)).resolves.toMatchObject({
      connectionRef: "sub-1",
    });
  });

  it("rejects a response with no refresh token", async () => {
    const s = setup();
    s.google.refreshToken = undefined;
    const { state } = await s.connector.begin({ provider: "gmail", redirectUrl: "" }, context);
    await expect(s.connector.complete({ state, code: "code-1" }, context)).rejects.toThrow(
      /try connecting again/i,
    );
    expect(s.db.secrets).toHaveLength(0);
  });

  it("rejects a malformed state or missing code before any request", async () => {
    const s = setup();
    await expect(s.connector.complete({ state: "short", code: "c" }, context)).rejects.toThrow();
    const { state } = await s.connector.begin({ provider: "gmail", redirectUrl: "" }, context);
    await expect(s.connector.complete({ state }, context)).rejects.toThrow();
    expect(s.google.tokenCalls).toHaveLength(0);
  });

  it("keeps the client secret and the code out of error messages", async () => {
    const s = setup();
    s.google.tokenError = {
      status: 400,
      body: { error: "invalid_grant", error_description: `bad ${CLIENT_SECRET} and code-1` },
    };
    const { state } = await s.connector.begin({ provider: "gmail", redirectUrl: "" }, context);
    const error = await s.connector.complete({ state, code: "code-1" }, context).catch((e) => e);
    expect(error).toBeInstanceOf(Error);
    expect(String(error.message)).not.toContain(CLIENT_SECRET);
    expect(String(error.message)).not.toContain("code-1");
  });
});

describe("GoogleConnector.proxy", () => {
  const request = (url: string, accountRef = "sub-1") => ({
    app: "gmail",
    accountRef,
    method: "GET" as const,
    url,
  });
  const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me/profile";

  it("refreshes once, caches the access token, and refreshes again near expiry", async () => {
    let now = 1_000_000;
    const s = setup({ now: () => now });
    await connect(s);
    s.google.tokenCalls.length = 0;
    expect((await s.connector.proxy(request(GMAIL), context)).status).toBe(200);
    await s.connector.proxy(request(GMAIL), context);
    expect(s.google.tokenCalls.map((c) => c.get("grant_type"))).toEqual(["refresh_token"]);
    expect(s.google.tokenCalls[0]!.get("refresh_token")).toBe("refresh-1");
    now += 3600_000 - 30_000; // under 60 seconds left
    await s.connector.proxy(request(GMAIL), context);
    expect(s.google.tokenCalls).toHaveLength(2);
  });

  it("shares one refresh between concurrent requests", async () => {
    const s = setup();
    await connect(s);
    s.google.tokenCalls.length = 0;
    await Promise.all([1, 2, 3, 4].map(() => s.connector.proxy(request(GMAIL), context)));
    expect(s.google.tokenCalls).toHaveLength(1);
  });

  it("retries once with a fresh token after a 401", async () => {
    const s = setup();
    await connect(s);
    s.google.tokenCalls.length = 0;
    await s.connector.proxy(request(GMAIL), context);
    const first = [...s.google.mailboxByToken.keys()][0] as string;
    s.google.rejectOnce.add(first);
    s.google.gmailUrls.length = 0;
    const result = await s.connector.proxy(request(GMAIL), context);
    expect(result.status).toBe(200);
    expect(s.google.gmailUrls).toHaveLength(2);
    expect(s.google.tokenCalls).toHaveLength(2);
  });

  it("returns binary bodies byte for byte and enforces maxBytes while streaming", async () => {
    const s = setup();
    await connect(s);
    s.db.connections[0]!.provider = "googledrive";
    const pdf = new Uint8Array([
      ...Array.from({ length: 256 }, (_, i) => i),
      0xff,
      0xfe,
      0x25,
      0x50,
    ]);
    const realFetch = s.google.fetch;
    const drive = "https://www.googleapis.com/drive/v3/files/f1?alt=media";
    const connector = new GoogleConnector({
      clientId: "x",
      clientSecret: CLIENT_SECRET,
      identitySecret: IDENTITY,
      prisma: s.db.prisma,
      secrets: s.secrets,
      fetch: (async (input: string | URL | Request, init?: RequestInit) =>
        String(input) === drive
          ? new Response(pdf, { headers: { "content-type": "application/pdf" } })
          : realFetch(input, init)) as typeof fetch,
    });
    const call = (maxBytes: number) =>
      connector.proxy(
        {
          app: "googledrive",
          accountRef: "sub-1",
          method: "GET",
          url: drive,
          responseType: "bytes",
          maxBytes,
        },
        context,
      );
    const ok = await call(1024);
    expect(ok.status).toBe(200);
    expect(ok.contentType).toBe("application/pdf");
    expect(Array.from(ok.data as Uint8Array)).toEqual(Array.from(pdf));
    expect((await call(100)).status).toBe(413);
  });

  it("returns 401 without calling Gmail when Google reports invalid_grant", async () => {
    const s = setup();
    await connect(s);
    s.google.tokenError = { status: 400, body: { error: "invalid_grant" } };
    const result = await s.connector.proxy(request(GMAIL), context);
    expect(result.status).toBe(401);
    expect(s.google.gmailUrls).toHaveLength(0);
  });

  it.each([
    "https://evil.example.test/gmail/v1/users/me/profile",
    "http://gmail.googleapis.com/gmail/v1/users/me/profile",
    "https://gmail.googleapis.com.evil.example.test/gmail/v1/users/me/profile",
    "https://gmail.googleapis.com@evil.example.test/gmail/v1/users/me/profile",
    "https://www.googleapis.com/oauth2/v3/userinfo",
  ])("refuses %s before any request is sent", async (url) => {
    const s = setup();
    await connect(s);
    s.google.tokenCalls.length = 0;
    await expect(s.connector.proxy(request(url), context)).rejects.toThrow(/gmail/i);
    expect(s.google.tokenCalls).toHaveLength(0);
    expect(s.google.gmailUrls).toHaveLength(0);
  });

  it("answers 401 for another user's account and for a revoked row, with no request", async () => {
    const s = setup();
    await connect(s);
    s.google.tokenCalls.length = 0;
    const other = await s.connector.proxy(request(GMAIL), { ...context, userId: "user-2" });
    expect(other.status).toBe(401);
    s.db.connections[0]!.status = "revoked";
    expect((await s.connector.proxy(request(GMAIL), context)).status).toBe(401);
    expect(s.google.tokenCalls).toHaveLength(0);
    expect(s.google.gmailUrls).toHaveLength(0);
  });

  it("passes Gmail's error status through", async () => {
    const s = setup();
    await connect(s);
    s.google.gmail = () => ({ status: 429, data: { error: { message: "slow down" } } });
    const result = await s.connector.proxy(request(GMAIL), context);
    expect(result.status).toBe(429);
  });

  it("sends POST, PUT and DELETE to Gmail with a JSON body and the bearer token", async () => {
    const s = setup();
    await connect(s);
    const drafts = "https://gmail.googleapis.com/gmail/v1/users/me/drafts";
    s.google.gmailRequests.length = 0;
    await s.connector.proxy(
      { ...request(drafts), method: "POST", body: { message: { raw: "abc" } } },
      context,
    );
    await s.connector.proxy(
      { ...request(`${drafts}/d1`), method: "PUT", body: { message: { raw: "def" } } },
      context,
    );
    await s.connector.proxy({ ...request(`${drafts}/d1`), method: "DELETE" }, context);
    expect(s.google.gmailRequests).toEqual([
      {
        url: drafts,
        method: "POST",
        body: { message: { raw: "abc" } },
        contentType: "application/json",
      },
      {
        url: `${drafts}/d1`,
        method: "PUT",
        body: { message: { raw: "def" } },
        contentType: "application/json",
      },
      { url: `${drafts}/d1`, method: "DELETE", body: undefined, contentType: null },
    ]);
  });

  it("refuses to write anywhere but the Gmail API origin, before any request", async () => {
    const s = setup();
    await connect(s);
    s.google.tokenCalls.length = 0;
    s.google.gmailRequests.length = 0;
    for (const url of [
      "https://evil.example.test/gmail/v1/users/me/drafts",
      "https://gmail.googleapis.com.evil.example.test/gmail/v1/users/me/drafts",
      "http://gmail.googleapis.com/gmail/v1/users/me/drafts",
      "https://user:pw@gmail.googleapis.com/gmail/v1/users/me/drafts",
    ]) {
      await expect(
        s.connector.proxy({ ...request(url), method: "POST", body: {} }, context),
      ).rejects.toThrow(/Gmail API/);
    }
    await expect(
      s.connector.proxy({ ...request(GMAIL), method: "TRACE" as "POST", body: {} }, context),
    ).rejects.toThrow(/Gmail API/);
    expect(s.google.tokenCalls).toHaveLength(0);
    expect(s.google.gmailRequests).toHaveLength(0);
  });

  it("retries a write once with a fresh token after a 401, which proves it was not applied", async () => {
    const s = setup();
    await connect(s);
    await s.connector.proxy(request(GMAIL), context);
    s.google.rejectOnce.add("access-2");
    s.google.gmailRequests.length = 0;
    const drafts = "https://gmail.googleapis.com/gmail/v1/users/me/drafts";
    const result = await s.connector.proxy(
      { ...request(drafts), method: "POST", body: { a: 1 } },
      context,
    );
    expect(result.status).toBe(200);
    expect(s.google.gmailRequests.filter((r) => r.method === "POST")).toHaveLength(2);
  });

  it("does not repeat a write that Gmail answered with a server error", async () => {
    const s = setup();
    await connect(s);
    s.google.gmail = () => ({ status: 500, data: {} });
    s.google.gmailRequests.length = 0;
    const result = await s.connector.proxy(
      {
        ...request("https://gmail.googleapis.com/gmail/v1/users/me/drafts/send"),
        method: "POST",
        body: { id: "d" },
      },
      context,
    );
    expect(result.status).toBe(500);
    expect(s.google.gmailRequests).toHaveLength(1);
  });
});

describe("GoogleConnector.revoke", () => {
  it("posts the refresh token to Google, deletes the secret and clears the row's reference", async () => {
    const s = setup();
    await connect(s);
    s.db.connections[0]!.status = "revoked"; // the router marks the row before calling revoke
    await s.connector.revoke("sub-1", context);
    expect(s.google.revokeCalls).toEqual(["refresh-1"]);
    expect(s.db.secrets).toHaveLength(0);
    expect(s.db.connections[0]!.secretId).toBeNull();
  });

  it("tolerates Google answering 400 (already revoked) but keeps the secret on a server error", async () => {
    const s = setup();
    await connect(s);
    s.google.revokeStatus = 500;
    await expect(s.connector.revoke("sub-1", context)).rejects.toThrow();
    expect(s.db.secrets).toHaveLength(1);
    s.google.revokeStatus = 400;
    await s.connector.revoke("sub-1", context);
    expect(s.db.secrets).toHaveLength(0);
  });

  it("does nothing for a pending state reference or another user's account", async () => {
    const s = setup();
    await connect(s);
    await s.connector.revoke("a-pending-state-value", context);
    await s.connector.revoke("sub-1", { ...context, userId: "user-2" });
    expect(s.google.revokeCalls).toHaveLength(0);
    expect(s.db.secrets).toHaveLength(1);
  });
});

describe("GoogleConnector catalog", () => {
  it("returns provider metadata without querying connected rows", async () => {
    const s = setup();
    await expect(s.connector.catalogDirectory()).resolves.toEqual([
      {
        connectorId: "google",
        slug: "gmail",
        name: "Gmail",
        logo: "https://cdn.simpleicons.org/gmail",
        noAuth: false,
      },
      {
        connectorId: "google",
        slug: "googlecalendar",
        name: "Google Calendar",
        logo: "https://cdn.simpleicons.org/googlecalendar",
        noAuth: false,
      },
      {
        connectorId: "google",
        slug: "googledrive",
        name: "Google Drive",
        logo: "https://cdn.simpleicons.org/googledrive",
        noAuth: false,
      },
    ]);
    expect(s.db.connectionFindMany).not.toHaveBeenCalled();
  });

  it("offers one Gmail entry, connected only when the user has a connected row", async () => {
    const s = setup();
    const [item] = await s.connector.catalog(context);
    expect(item).toMatchObject({
      connectorId: "google",
      slug: "gmail",
      name: "Gmail",
      connected: true,
    });
    expect(await s.connector.catalog(context, "slack")).toEqual([]);
    expect(await s.connector.listConnectedExternalIds({ ...context, userId: "user-2" })).toEqual(
      [],
    );
    expect(await s.connector.connectionReady()).toBe(false);
    expect(await s.connector.discoverTools()).toEqual([]);
  });
});

describe("GoogleConnector as a mail connector", () => {
  it("passes mail conformance with Gmail routed to the emulator", async () => {
    const emulator = createMailEmulator();
    const s = setup();
    const owner = { spaceId: emulator.accounts[0]!.spaceId, userId: emulator.accounts[0]!.userId };
    s.db.connections.length = 0;
    // Each mailbox has its own refresh token; the fake token endpoint tags access tokens with it.
    for (const account of emulator.accounts) {
      const { secretId } = await storeSecret(s, owner, account.accountRef);
      s.db.connections.push({
        id: account.id,
        ...owner,
        connectorId: "google",
        provider: "gmail",
        providerRef: account.accountRef,
        displayName: account.label,
        status: "connected",
        secretId,
        metadata: { mailAddress: account.address },
      });
    }
    s.google.gmail = (accountRef, url, request) =>
      emulator.gmail.handle(accountRef, url, request.method as "GET", request.body);
    const provider = new GmailMailProvider({
      prisma: s.db.prisma,
      connectors: { managed: () => s.connector as unknown as ManagedConnectorProvider },
    });
    // The connector retries a 401 once with a fresh token, so a lasting failure takes two.
    const gmail = Object.assign(Object.create(emulator.gmail), {
      failNext: (status: number, options?: object) =>
        emulator.gmail.failNext(status, { ...options, times: 2 }),
      clearFailures: () => emulator.gmail.clearFailures(),
    }) as typeof emulator.gmail;
    await assertMailConformance(provider, { gmail, accounts: emulator.accounts });
    await assertMailWriteConformance(provider, { gmail, accounts: emulator.accounts });
    await assertMailModifyConformance(provider, { gmail, accounts: emulator.accounts });
    await assertMailChangesConformance(provider, { gmail, accounts: emulator.accounts });
    const writes = s.google.gmailRequests.filter((r) => r.method !== "GET");
    expect(writes.map((r) => r.method)).toContain("POST");
    expect(writes.map((r) => r.method)).toContain("PUT");
    expect(writes.map((r) => r.method)).toContain("DELETE");
    expect(
      writes.filter((r) => r.body !== undefined).every((r) => r.contentType === "application/json"),
    ).toBe(true);
  });

  it("maps Google's insufficient-scope answer for an old read-only grant to a reconnect error", async () => {
    const emulator = createMailEmulator();
    const s = setup();
    const owner = { spaceId: "space-1", userId: "user-1" };
    const account = emulator.accounts[0]!;
    s.db.connections.length = 0;
    const { secretId } = await storeSecret(s, owner, account.accountRef);
    s.db.connections.push({
      id: account.id,
      ...owner,
      connectorId: "google",
      provider: "gmail",
      providerRef: account.accountRef,
      displayName: account.label,
      status: "connected",
      secretId,
      metadata: { mailAddress: account.address },
    });
    s.google.gmail = (_ref, url, request) =>
      request.method === "GET"
        ? emulator.gmail.handle(account.accountRef, url)
        : {
            status: 403,
            data: {
              error: {
                code: 403,
                message: "Request had insufficient authentication scopes.",
                errors: [{ reason: "insufficientPermissions", domain: "global", message: "x" }],
              },
            },
          };
    const provider = new GmailMailProvider({
      prisma: s.db.prisma,
      connectors: { managed: () => s.connector as unknown as ManagedConnectorProvider },
    });
    const ctx = { ...context, ...owner };
    expect(
      (
        await provider.listMessages(
          { ...account, ...owner },
          { query: "in:inbox", pageSize: 3 },
          ctx,
        )
      ).messages,
    ).toHaveLength(3);
    await expect(
      provider.createDraft(
        { ...account, ...owner },
        { to: [{ address: "p@example.test" }], cc: [], bcc: [], subject: "s", text: "t" },
        ctx,
      ),
    ).rejects.toMatchObject({ kind: "auth" });
    await expect(
      provider.modifyMessage({ ...account, ...owner }, "a-01", { removeLabelIds: ["UNREAD"] }, ctx),
    ).rejects.toMatchObject({ kind: "auth" });
  });
});

async function storeSecret(
  s: ReturnType<typeof setup>,
  owner: { spaceId: string; userId: string },
  accountRef: string,
) {
  const stored = await s.secrets.put(
    JSON.stringify({
      refreshToken: `refresh-${accountRef}`,
      scope: GMAIL_READONLY,
      sub: accountRef,
      email: "x@example.test",
    }),
    { operationId: "t", traceId: "t", ...owner, signal: new AbortController().signal },
  );
  s.db.secrets.push({
    id: stored.id,
    ...owner,
    kind: "google-oauth",
    ciphertext: stored.ciphertext,
  });
  return { secretId: stored.id };
}

const CALENDAR_EVENTS = "https://www.googleapis.com/auth/calendar.events";
const DRIVE = "https://www.googleapis.com/auth/drive";
const EMAIL = "https://www.googleapis.com/auth/userinfo.email";
const CAL_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const DRIVE_URL = "https://www.googleapis.com/drive/v3/files";
const GMAIL_URL = "https://gmail.googleapis.com/gmail/v1/users/me/profile";

const row = (id: string, provider: string, secretId: string | null, status = "connected") => ({
  id,
  spaceId: "space-1",
  userId: "user-1",
  connectorId: "google",
  provider,
  providerRef: "sub-1",
  status,
  secretId,
});

/** Runs begin and complete for one provider and files the resulting Connection row. */
async function connectApp(s: ReturnType<typeof setup>, provider: string, scope: string) {
  s.google.scope = scope;
  const begun = await s.connector.begin({ provider, redirectUrl: "unused" }, context);
  const done = await s.connector.complete(
    { state: begun.state, code: "code-1", provider },
    context,
  );
  s.db.connections.push(row(`conn-${provider}`, provider, done.secretId));
  return done;
}

describe("GoogleConnector providers", () => {
  it("asks for each provider's own scopes and normalizes the slug", async () => {
    const { connector } = setup();
    const scopeOf = async (provider: string) =>
      new URL(
        (await connector.begin({ provider, redirectUrl: "" }, context)).authorizationUrl as string,
      ).searchParams.get("scope");
    expect(await scopeOf(" GoogleCalendar ")).toBe(`openid email ${CALENDAR_EVENTS}`);
    expect(await scopeOf("googledrive")).toBe(`openid email ${DRIVE}`);
    expect(await scopeOf("gmail")).toBe(
      `openid email ${GMAIL_READONLY} ${GMAIL_COMPOSE} ${GMAIL_MODIFY}`,
    );
  });

  it("requires the scope of the provider being connected", async () => {
    const s = setup();
    s.db.connections.length = 0;
    for (const [provider, wrongScope, label] of [
      ["googlecalendar", `openid ${EMAIL} ${GMAIL_READONLY}`, /Google Calendar/],
      ["googledrive", `openid ${EMAIL} ${CALENDAR_EVENTS}`, /Google Drive/],
      ["gmail", `openid ${EMAIL} ${DRIVE}`, /Gmail/],
    ] as const) {
      s.google.scope = wrongScope;
      const { state } = await s.connector.begin({ provider, redirectUrl: "" }, context);
      await expect(
        s.connector.complete({ state, code: "code-1", provider }, context),
      ).rejects.toThrow(label);
    }
    expect(s.db.secrets).toHaveLength(0);
    // Each of the three rejected grants was alone, so each was revoked at Google.
    expect(s.google.revokeCalls).toHaveLength(3);
    s.google.scope = `openid ${EMAIL} ${CALENDAR_EVENTS}`;
    const { state } = await s.connector.begin(
      { provider: "googlecalendar", redirectUrl: "" },
      context,
    );
    await expect(
      s.connector.complete({ state, code: "code-1", provider: "googlecalendar" }, context),
    ).resolves.toMatchObject({ connectionRef: "sub-1" });
  });

  it("does not revoke at Google when a rejected grant shares an account with a connected app", async () => {
    const s = setup(); // conn-1 is a connected Gmail row for sub-1
    s.google.scope = `openid ${EMAIL}`;
    const { state } = await s.connector.begin(
      { provider: "googledrive", redirectUrl: "" },
      context,
    );
    await expect(
      s.connector.complete({ state, code: "code-1", provider: "googledrive" }, context),
    ).rejects.toThrow(/Google Drive/);
    expect(s.google.revokeCalls).toEqual([]);
    expect(s.db.secrets).toHaveLength(0);
  });

  it("revokes at Google only when the last app of the account is disconnected", async () => {
    const s = setup();
    s.db.connections.length = 0;
    await connectApp(s, "gmail", `openid ${EMAIL} ${GMAIL_READONLY}`);
    await connectApp(s, "googlecalendar", `openid ${EMAIL} ${CALENDAR_EVENTS}`);
    expect(s.db.secrets).toHaveLength(2);
    const [gmailRow, calendarRow] = s.db.connections;

    calendarRow!.status = "revoked";
    await s.connector.revoke("sub-1", context, { provider: "googlecalendar" });
    expect(s.google.revokeCalls).toEqual([]);
    expect(s.db.secrets).toHaveLength(1);
    expect(calendarRow!.secretId).toBeNull();
    expect(gmailRow!.secretId).not.toBeNull();

    gmailRow!.status = "revoked";
    await s.connector.revoke("sub-1", context, { provider: "gmail" });
    expect(s.google.revokeCalls).toEqual(["refresh-1"]);
    expect(s.db.secrets).toHaveLength(0);
  });

  it("revokes the row of the named provider, not a neighbour that is in error", async () => {
    const s = setup();
    s.db.connections.length = 0;
    const gmail = await connectApp(s, "gmail", `openid ${EMAIL} ${GMAIL_READONLY}`);
    const calendar = await connectApp(s, "googlecalendar", `openid ${EMAIL} ${CALENDAR_EVENTS}`);
    s.db.connections[0]!.status = "error"; // Gmail keeps its secret but is not connected
    s.db.connections[1]!.status = "revoked";
    await s.connector.revoke("sub-1", context, { provider: "googlecalendar" });
    expect(s.db.connections[1]!.secretId).toBeNull();
    expect(s.db.connections[0]!.secretId).toBe(gmail.secretId);
    expect(s.db.secrets.map((secret) => secret.id)).toEqual([gmail.secretId]);
    expect(calendar.secretId).not.toBe(gmail.secretId);
    // No connected app is left, so this was the last live grant.
    expect(s.google.revokeCalls).toHaveLength(1);
  });

  it("keeps Google's grant when the revoked app has a connected neighbour", async () => {
    const s = setup();
    s.db.connections.length = 0;
    const gmail = await connectApp(s, "gmail", `openid ${EMAIL} ${GMAIL_READONLY}`);
    await connectApp(s, "googlecalendar", `openid ${EMAIL} ${CALENDAR_EVENTS}`);
    s.db.connections[1]!.status = "revoked";
    await s.connector.revoke("sub-1", context, { provider: "googlecalendar" });
    expect(s.google.revokeCalls).toEqual([]);
    expect(s.db.connections[0]!.secretId).toBe(gmail.secretId);
    expect(s.db.secrets.map((secret) => secret.id)).toEqual([gmail.secretId]);
  });

  it.each([
    ["another space", { spaceId: "space-2" }],
    ["another Rakazo user", { userId: "user-2" }],
  ])(
    "keeps Google's grant when the same Google account is connected in %s",
    async (_name, other) => {
      const s = setup();
      s.db.connections.length = 0;
      await connectApp(s, "googlecalendar", `openid ${EMAIL} ${CALENDAR_EVENTS}`);
      s.db.connections[0]!.status = "revoked";
      s.db.connections.push({ ...row("elsewhere", "gmail", "secret-x"), ...other });
      await s.connector.revoke("sub-1", context, { provider: "googlecalendar" });
      expect(s.google.revokeCalls).toEqual([]);
      expect(s.db.secrets).toHaveLength(0); // only the target's secret is deleted
      expect(s.db.connections[1]!.secretId).toBe("secret-x");
    },
  );

  it("does not revoke a rejected grant that another space has connected", async () => {
    const s = setup();
    s.db.connections.length = 0;
    s.db.connections.push({ ...row("elsewhere", "gmail", "secret-x"), spaceId: "space-2" });
    s.google.scope = `openid ${EMAIL}`;
    const { state } = await s.connector.begin(
      { provider: "googledrive", redirectUrl: "" },
      context,
    );
    await expect(
      s.connector.complete({ state, code: "code-1", provider: "googledrive" }, context),
    ).rejects.toThrow(/Google Drive/);
    expect(s.google.revokeCalls).toEqual([]);
  });

  it("returns text bodies untouched when asked: empty stays empty, big integers keep every digit", async () => {
    const s = setup();
    s.db.connections.length = 0;
    await connectApp(s, "googledrive", `openid ${EMAIL} ${DRIVE}`);
    const asText = (url: string) =>
      s.connector.proxy(
        { app: "googledrive", accountRef: "sub-1", method: "GET", url, responseType: "text" },
        context,
      );
    s.google.gmail = () => ({ status: 200, data: null });
    const realFetch = s.google.fetch;
    let reply = new Response("", { headers: { "content-type": "application/json" } });
    const connector = new GoogleConnector({
      clientId: "id",
      clientSecret: CLIENT_SECRET,
      identitySecret: IDENTITY,
      redirectUri: REDIRECT,
      prisma: s.db.prisma,
      secrets: s.secrets,
      fetch: (async (input: string | URL | Request, init?: RequestInit) =>
        String(input).startsWith("https://www.googleapis.com/drive")
          ? reply.clone()
          : realFetch(input, init)) as typeof fetch,
    });
    s.connector = connector;
    expect((await asText(`${DRIVE_URL}/f1?alt=media`)).data).toBe("");
    const big = '{"amount":9007199254740993}';
    reply = new Response(big, { headers: { "content-type": "application/json" } });
    expect((await asText(`${DRIVE_URL}/f2?alt=media`)).data).toBe(big);
  });

  it("sends each request with the token of the row for its own app", async () => {
    const s = setup();
    s.db.connections.length = 0;
    await connectApp(s, "gmail", `openid ${EMAIL} ${GMAIL_READONLY}`);
    await connectApp(s, "googlecalendar", `openid ${EMAIL} ${CALENDAR_EVENTS}`);
    const call = (app: string, url: string) =>
      s.connector.proxy({ app, accountRef: "sub-1", method: "GET", url }, context);
    s.google.tokenCalls.length = 0;
    await call("googlecalendar", CAL_URL);
    await call("gmail", GMAIL_URL);
    expect(s.google.tokenCalls).toHaveLength(2); // two rows, two refreshes
    // A Drive app was never connected, so its request has no row to use.
    expect((await call("googledrive", DRIVE_URL)).status).toBe(401);
  });

  it("limits each app to its own API paths", async () => {
    const s = setup();
    s.db.connections.length = 0;
    await connectApp(s, "googledrive", `openid ${EMAIL} ${DRIVE}`);
    s.google.gmailRequests.length = 0;
    const send = (app: string, url: string, method: "GET" | "PATCH" = "GET") =>
      s.connector.proxy({ app, accountRef: "sub-1", method, url }, context);
    for (const [app, url] of [
      ["gmail", CAL_URL],
      ["gmail", DRIVE_URL],
      ["googlecalendar", GMAIL_URL],
      ["googlecalendar", DRIVE_URL],
      ["googledrive", CAL_URL],
      ["googledrive", "https://www.googleapis.com/oauth2/v3/userinfo"],
      ["googledrive", "https://www.googleapis.com.evil.example.test/drive/v3/files"],
      ["googledrive", "https://www.googleapis.com/drive/v3evil"],
      ["slack", DRIVE_URL],
    ] as const)
      await expect(send(app, url)).rejects.toThrow(/only calls/);
    expect(s.google.gmailRequests).toHaveLength(0);
    await expect(send("googledrive", `${DRIVE_URL}/f1`, "PATCH")).resolves.toMatchObject({
      status: 200,
    });
    await expect(
      send("googledrive", "https://www.googleapis.com/upload/drive/v3/files?uploadType=media"),
    ).resolves.toMatchObject({ status: 200 });
  });

  it("returns non-JSON bodies as text and still caps their size", async () => {
    const s = setup();
    s.db.connections.length = 0;
    await connectApp(s, "googledrive", `openid ${EMAIL} ${DRIVE}`);
    const realFetch = s.google.fetch;
    let reply = () => new Response("a,b\n1,2", { headers: { "content-type": "text/plain" } });
    s.connector = new GoogleConnector({
      clientId: "id",
      clientSecret: CLIENT_SECRET,
      identitySecret: IDENTITY,
      redirectUri: REDIRECT,
      prisma: s.db.prisma,
      secrets: s.secrets,
      fetch: (async (input: string | URL | Request, init?: RequestInit) =>
        String(input).startsWith("https://www.googleapis.com/drive")
          ? reply()
          : realFetch(input, init)) as typeof fetch,
    });
    const export_ = `${DRIVE_URL}/f1/export?mimeType=text/csv`;
    await expect(
      s.connector.proxy(
        { app: "googledrive", accountRef: "sub-1", method: "GET", url: export_ },
        context,
      ),
    ).resolves.toEqual({ status: 200, data: "a,b\n1,2" });
    reply = () =>
      new Response("x".repeat(10 * 1024 * 1024 + 1), { headers: { "content-type": "text/plain" } });
    await expect(
      s.connector.proxy(
        { app: "googledrive", accountRef: "sub-1", method: "GET", url: export_ },
        context,
      ),
    ).resolves.toEqual({ status: 502, data: {} });
  });

  it("sends a string body as is with its contentType, and JSON by default", async () => {
    const s = setup();
    s.db.connections.length = 0;
    await connectApp(s, "googledrive", `openid ${EMAIL} ${DRIVE}`);
    const realFetch = s.google.fetch;
    const sent: Array<{ type: string | null; body: unknown }> = [];
    s.connector = new GoogleConnector({
      clientId: "id",
      clientSecret: CLIENT_SECRET,
      identitySecret: IDENTITY,
      redirectUri: REDIRECT,
      prisma: s.db.prisma,
      secrets: s.secrets,
      fetch: (async (input: string | URL | Request, init?: RequestInit) => {
        if (!String(input).startsWith("https://www.googleapis.com/")) return realFetch(input, init);
        sent.push({ type: new Headers(init?.headers).get("content-type"), body: init?.body });
        return Response.json({ id: "f1" });
      }) as typeof fetch,
    });
    const upload = "https://www.googleapis.com/upload/drive/v3/files/f1?uploadType=media";
    const call = (body: unknown, contentType?: string) =>
      s.connector.proxy(
        {
          app: "googledrive",
          accountRef: "sub-1",
          method: "PATCH",
          url: upload,
          body,
          ...(contentType ? { contentType } : {}),
        },
        context,
      );
    await call('line 1\n"quoted"', "text/plain");
    await call("json text");
    await call({ name: "n" });
    expect(sent).toEqual([
      { type: "text/plain", body: 'line 1\n"quoted"' },
      { type: "application/json", body: '"json text"' },
      { type: "application/json", body: '{"name":"n"}' },
    ]);
  });

  it("lists all three apps and flags the connected ones", async () => {
    const s = setup();
    s.db.connections.push(row("c2", "googledrive", "secret-2"));
    const items = await s.connector.catalog(context);
    expect(items.map((i) => i.logo)).toEqual([
      "https://cdn.simpleicons.org/gmail",
      "https://cdn.simpleicons.org/googlecalendar",
      "https://cdn.simpleicons.org/googledrive",
    ]);
    expect(items.map((i) => [i.slug, i.name, i.connected])).toEqual([
      ["gmail", "Gmail", true],
      ["googlecalendar", "Google Calendar", false],
      ["googledrive", "Google Drive", true],
    ]);
    expect((await s.connector.listConnectedExternalIds(context)).sort()).toEqual([
      "gmail",
      "googledrive",
    ]);
  });
});

describe("GoogleConnector cancellation", () => {
  async function call(fail: (signal: AbortSignal, abort: () => void) => Promise<never>) {
    const s = setup();
    const controller = new AbortController();
    await connect(s);
    const base = s.google.fetch;
    const connector = new GoogleConnector({
      clientId: "fake-client-id.apps.example.test",
      clientSecret: CLIENT_SECRET,
      identitySecret: IDENTITY,
      redirectUri: REDIRECT,
      prisma: s.db.prisma,
      secrets: s.secrets,
      fetch: (async (input: string | URL | Request, init?: RequestInit) =>
        String(input).startsWith("https://gmail.googleapis.com")
          ? fail(init?.signal as AbortSignal, () => controller.abort())
          : base(input, init)) as typeof fetch,
    });
    return {
      request: () =>
        new GoogleApiClient({
          sleep: async () => undefined,
          random: () => 0,
          startGapMs: 0,
        }).request({
          connector,
          account: { connectorId: "google", providerRef: "sub-1", app: "gmail" },
          method: "GET",
          url: GMAIL_URL,
          context: { ...context, signal: controller.signal },
        }),
    };
  }

  it("reports a deadline abort in flight as an abort, not a transport failure", async () => {
    const { request } = await call(
      (signal, abort) =>
        new Promise<never>((_, reject) => {
          signal.addEventListener("abort", () => reject(new TypeError("fetch failed")), {
            once: true,
          });
          abort();
        }),
    );
    await expect(request()).rejects.toMatchObject({ kind: "aborted" });
  });

  it("still reports a genuine network error as a transport failure", async () => {
    const { request } = await call(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(request()).rejects.toMatchObject({ kind: "transport" });
  });
});
