import { createHash, randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ServerType } from "@hono/node-server";
import { serve } from "@hono/node-server";
import { runAsSystem } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sessionCookieHeader } from "../../../packages/testkit/src/index.js";
import type { AppHandles } from "./app.js";
import { createApp } from "./app.js";
import { revokeConnection } from "./mcp-connections.js";

const describePostgres =
  process.env.VERIFY_DATABASE === "1" && process.env.DATABASE_URL
    ? describe.sequential
    : describe.skip;

const REDIRECT_URI = "http://127.0.0.1:9/callback";

const freePort = () =>
  new Promise<number>((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address() as AddressInfo;
      probe.close(() => resolve(port));
    });
  });

const payloadOf = (jwt: string) =>
  JSON.parse(Buffer.from(jwt.split(".")[1]!, "base64url").toString()) as Record<string, unknown>;

/** The whole OAuth path an MCP client takes, over real HTTP against the API. */
describePostgres("MCP OAuth grants (PostgreSQL, real HTTP)", () => {
  let handles: AppHandles;
  let server: ServerType;
  let dataDir: string;
  let api: string;
  let webOrigin: string;
  let cookie: string;
  let userId: string;
  let spaceId: string;
  let registered = 0;
  const run = randomBytes(2).toString("hex");

  const auth = (path: string, init: RequestInit = {}) =>
    fetch(`${api}/api/auth${path}`, {
      redirect: "manual",
      ...init,
      headers: { origin: webOrigin, cookie, ...(init.headers ?? {}) },
    });
  const json = (path: string, body: unknown) =>
    auth(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  // Without `resource` Better Auth issues an opaque access token instead of a JWT.
  /** Client secrets of confidential clients, which authenticate with HTTP Basic. */
  const secrets = new Map<string, string>();
  const basic = (clientId: string | undefined): Record<string, string> => {
    const secret = clientId ? secrets.get(clientId) : undefined;
    return secret
      ? { authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}` }
      : {};
  };
  const token = (
    form: Record<string, string>,
    { resource = true, basicAs = form.client_id }: { resource?: boolean; basicAs?: string } = {},
  ) =>
    fetch(`${api}/api/auth/oauth2/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", ...basic(basicAs) },
      body: new URLSearchParams({ ...form, ...(resource ? { resource: `${api}/mcp` } : {}) }),
    });
  const revokeToken = (clientId: string, form: Record<string, string>) =>
    fetch(`${api}/api/auth/oauth2/revoke`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", ...basic(clientId) },
      body: new URLSearchParams({ client_id: clientId, ...form }),
    });
  const toolsList = (accessToken: string) =>
    fetch(`${api}/mcp`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
  const liveRows = (clientId: string) =>
    runAsSystem("mcp oauth test", () =>
      handles.prisma.mcpConnection.findMany({
        where: { userId, oauthClientId: clientId, kind: "oauth", revokedAt: null },
      }),
    );

  async function register({ confidential = false } = {}) {
    registered += 1;
    const response = await fetch(`${api}/api/auth/oauth2/register`, {
      method: "POST",
      // Each client registers from its own documentation address, under the per-address limit.
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": `2001:db8::${run}:${registered}`,
      },
      body: JSON.stringify({
        client_name: "Grant test client",
        redirect_uris: [REDIRECT_URI],
        token_endpoint_auth_method: confidential ? "client_secret_basic" : "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
      }),
    });
    expect(response.status).toBeLessThan(300);
    const client = (await response.json()) as { client_id: string; client_secret?: string };
    if (client.client_secret) secrets.set(client.client_id, client.client_secret);
    return client.client_id;
  }

  /** Authorize and approve on the consent page; the code is not exchanged yet. */
  type Resource = { resource?: boolean };

  async function approve(clientId: string, { resource = true }: Resource = {}) {
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    const query = new URLSearchParams({
      response_type: "code",
      client_id: clientId,
      redirect_uri: REDIRECT_URI,
      scope: "offline_access mcp:read mcp:write",
      code_challenge: challenge,
      code_challenge_method: "S256",
      state: randomBytes(8).toString("hex"),
      ...(resource ? { resource: `${api}/mcp` } : {}),
    });
    const authorize = await auth(`/oauth2/authorize?${query}`);
    // A browser request is answered with JSON naming the next page.
    const { url } = (await authorize.json()) as { url: string };
    const page = new URL(url);
    expect(page.pathname).toBe("/oauth/consent");
    const oauthQuery = page.search.slice(1);
    expect((await json("/mcp/space", { spaceId, oauth_query: oauthQuery })).status).toBe(200);
    return { oauthQuery, verifier };
  }

  async function consent({ oauthQuery }: { oauthQuery: string }) {
    const response = await json("/oauth2/consent", { accept: true, oauth_query: oauthQuery });
    // The loser of two racing approvals may find the pick already spent by the winner.
    if (response.status !== 200) return undefined;
    const { url } = (await response.json()) as { url: string };
    return new URL(url).searchParams.get("code") ?? undefined;
  }

  async function exchange(clientId: string, code: string, verifier: string, options?: Resource) {
    const response = await token(
      {
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        client_id: clientId,
        code_verifier: verifier,
      },
      options,
    );
    expect(response.status).toBe(200);
    return (await response.json()) as { access_token: string; refresh_token: string };
  }

  async function connect(clientId: string, options?: Resource) {
    const approval = await approve(clientId, options);
    const code = await consent(approval);
    expect(code).toBeDefined();
    return exchange(clientId, code!, approval.verifier, options);
  }

  const refresh = (clientId: string, refreshToken: string, options?: Resource) =>
    token(
      { grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientId },
      options,
    );
  const renew = async (clientId: string, refreshToken: string) => {
    const response = await refresh(clientId, refreshToken);
    expect(response.status).toBe(200);
    return (await response.json()) as { access_token: string; refresh_token: string };
  };
  /** Rotated long enough ago that presenting it again counts as reuse, not a retry. */
  const pastReplayWindow = (clientId: string) =>
    runAsSystem("mcp oauth test", () =>
      handles.prisma.oauthRefreshToken.updateMany({
        where: { clientId, userId, revoked: { not: null } },
        data: { rotationReplayExpiresAt: new Date(Date.now() - 60_000) },
      }),
    );

  const published: { topic: string; payload: string }[] = [];

  beforeAll(async () => {
    const port = await freePort();
    api = `http://127.0.0.1:${port}`;
    webOrigin = "http://127.0.0.1:5173";
    dataDir = await mkdtemp(join(tmpdir(), "rakazo-mcp-grant-"));
    handles = await createApp({
      realtime: {
        describe: () => ({
          id: "fake",
          contractVersion: "1",
          adapterVersion: "0",
          capabilities: {},
        }),
        publish: async (topic: string, payload: string) => {
          published.push({ topic, payload });
        },
        subscribe: async () => async () => {},
        close: async () => {},
      } as never,
      databaseUrl: process.env.DATABASE_URL!,
      dataDir,
      sandboxProvider: "fake",
      agentRuntime: "scripted",
      wakeupDriver: "memory",
      signupsEnabled: "true",
      webOrigin,
      authUrl: api,
      apiUrl: api,
    });
    server = serve({ fetch: handles.app.fetch, port, hostname: "127.0.0.1" });
    cookie = "";
    const signup = await json("/sign-up/email", {
      email: `mcp-grant-${Date.now()}@rakazo.test`,
      password: "test-password-123",
      name: "Grant tester",
    });
    expect(signup.status).toBeLessThan(400);
    cookie = sessionCookieHeader(signup);
    userId = ((await signup.json()) as { user: { id: string } }).user.id;
    const spaces = (await (await auth("/mcp/spaces")).json()) as { spaces: Array<{ id: string }> };
    spaceId = spaces.spaces[0]!.id;
  });

  afterAll(async () => {
    server?.close();
    await handles?.stop();
    if (dataDir) await rm(dataDir, { recursive: true, force: true });
  });

  it("tells the open app about a new connection right away", async () => {
    published.length = 0;
    const clientId = await register();
    await connect(clientId);
    const signals = published
      .filter((p) => p.topic === `notifications:${spaceId}:${userId}`)
      .map((p) => JSON.parse(p.payload) as { surface: string; importance: string });
    expect(signals).toContainEqual(
      expect.objectContaining({ surface: "mcp", importance: "attention" }),
    );
  });

  it("binds the tokens of a connection to its grant", async () => {
    const clientId = await register();
    const tokens = await connect(clientId);
    expect((await toolsList(tokens.access_token)).status).toBe(200);
    const [row] = await liveRows(clientId);
    expect(row?.grantId).toEqual(expect.any(String));
    expect(payloadOf(tokens.access_token)).toMatchObject({
      space_id: spaceId,
      grant_id: row!.grantId,
    });
    const renewed = await refresh(clientId, tokens.refresh_token);
    expect(renewed.status).toBe(200);
    const { access_token } = (await renewed.json()) as { access_token: string };
    expect(payloadOf(access_token)).toMatchObject({ grant_id: row!.grantId });
    expect((await toolsList(access_token)).status).toBe(200);
  });

  it("refuses the old token after a revoke and an immediate reconnect", async () => {
    const clientId = await register();
    const old = await connect(clientId);
    const [first] = await liveRows(clientId);
    await revokeConnection(handles.prisma, { userId }, first!.id);
    const fresh = await connect(clientId);
    expect((await toolsList(old.access_token)).status).toBe(401);
    expect((await toolsList(fresh.access_token)).status).toBe(200);
    expect((await refresh(clientId, old.refresh_token)).status).toBe(400);
  });

  it("refuses a token from a code issued before the revoke and exchanged after a reconnect", async () => {
    const clientId = await register();
    await connect(clientId);
    const early = await approve(clientId);
    const code = await consent(early);
    expect(code).toBeDefined();
    const [first] = await liveRows(clientId);
    await revokeConnection(handles.prisma, { userId }, first!.id);
    const fresh = await connect(clientId);
    // Better Auth does not void codes on revoke, but a code for a revoked grant mints nothing,
    // whether the client asks for a JWT or an opaque access token.
    const late = await token({
      grant_type: "authorization_code",
      code: code!,
      redirect_uri: REDIRECT_URI,
      client_id: clientId,
      code_verifier: early.verifier,
    });
    expect(late.status).toBe(400);
    expect(await late.json()).toMatchObject({ error: "invalid_grant" });
    expect((await toolsList(fresh.access_token)).status).toBe(200);
  });

  it("issues nothing for a revoked grant's code exchanged without a resource", async () => {
    const clientId = await register();
    await connect(clientId, { resource: false });
    const early = await approve(clientId, { resource: false });
    const code = await consent(early);
    const [first] = await liveRows(clientId);
    await revokeConnection(handles.prisma, { userId }, first!.id);
    const late = await token(
      {
        grant_type: "authorization_code",
        code: code!,
        redirect_uri: REDIRECT_URI,
        client_id: clientId,
        code_verifier: early.verifier,
      },
      { resource: false },
    );
    expect(late.status).toBe(400);
    expect(await late.json()).toMatchObject({ error: "invalid_grant" });
    const left = await runAsSystem("mcp oauth test", () =>
      handles.prisma.oauthRefreshToken.count({ where: { clientId, userId } }),
    );
    expect(left).toBe(0);
  });

  it("keeps the live connection's tokens when a revoked legacy grant's refresh token is replayed", async () => {
    const clientId = await register();
    const old = await connect(clientId);
    await renew(clientId, old.refresh_token);
    // Refresh tokens from before grants had ids name only the Space.
    await runAsSystem("mcp oauth test", () =>
      handles.prisma.oauthRefreshToken.updateMany({
        where: { clientId, userId },
        data: { referenceId: spaceId },
      }),
    );
    await pastReplayWindow(clientId);
    const [first] = await liveRows(clientId);
    await revokeConnection(handles.prisma, { userId }, first!.id);
    const legacyLeft = await runAsSystem("mcp oauth test", () =>
      handles.prisma.oauthRefreshToken.count({ where: { clientId, userId, referenceId: spaceId } }),
    );
    expect(legacyLeft).toBe(0);
    const fresh = await connect(clientId);
    expect((await refresh(clientId, old.refresh_token)).status).toBe(400);
    expect((await refresh(clientId, fresh.refresh_token)).status).toBe(200);
  });

  /**
   * A grant revoked while its rotated refresh token survives, as when a rotation or code
   * exchange races the revoke, and the same client reconnected since. Presenting the old token
   * again must not reach Better Auth's reuse handling, which deletes every refresh token of the
   * member and client, the live grant's included.
   */
  async function survivingRefreshToken(options?: { confidential?: boolean }) {
    const clientId = await register(options);
    const old = await connect(clientId);
    await renew(clientId, old.refresh_token);
    await pastReplayWindow(clientId);
    const [first] = await liveRows(clientId);
    await runAsSystem("mcp oauth test", () =>
      handles.prisma.mcpConnection.update({
        where: { id: first!.id },
        data: { revokedAt: new Date() },
      }),
    );
    const fresh = await connect(clientId);
    const deadTokens = () =>
      runAsSystem("mcp oauth test", () =>
        handles.prisma.oauthRefreshToken.count({
          where: { clientId, userId, referenceId: `${spaceId}:${first!.grantId}` },
        }),
      );
    return { clientId, old, fresh, deadTokens };
  }

  it.each(["refresh_token", " refresh_token ", "\trefresh_token\n"])(
    "refuses a surviving refresh token of a revoked grant (grant_type %j)",
    async (grantType) => {
      const { clientId, old, fresh } = await survivingRefreshToken();
      const replay = await token({
        grant_type: grantType,
        refresh_token: old.refresh_token,
        client_id: clientId,
      });
      expect(replay.status).toBe(400);
      expect(await replay.json()).toMatchObject({ error: "invalid_grant" });
      expect((await refresh(clientId, fresh.refresh_token)).status).toBe(200);
    },
  );

  it("refuses a surviving refresh token whatever client_id the body names beside Basic credentials", async () => {
    const { clientId, old, fresh } = await survivingRefreshToken({ confidential: true });
    const replay = await token(
      { grant_type: "refresh_token", refresh_token: old.refresh_token, client_id: "someone-else" },
      { basicAs: clientId },
    );
    expect(replay.status).toBe(400);
    expect(await replay.json()).toMatchObject({ error: "invalid_grant" });
    expect((await refresh(clientId, fresh.refresh_token)).status).toBe(200);
  });

  it.each([
    ["no hint", (t: string) => ({ token: t })],
    ["a refresh_token hint", (t: string) => ({ token: t, token_type_hint: "refresh_token" })],
    ["a Bearer prefix", (t: string) => ({ token: `Bearer ${t}` })],
  ])("revokes a dead grant's refresh token as if it were unknown (%s)", async (_, form) => {
    const { clientId, old, fresh, deadTokens } = await survivingRefreshToken();
    const unknown = await revokeToken(clientId, form(randomBytes(24).toString("base64url")));
    const revoked = await revokeToken(clientId, form(old.refresh_token));
    expect([revoked.status, await revoked.json()]).toEqual([unknown.status, await unknown.json()]);
    expect(await deadTokens()).toBe(0);
    expect((await refresh(clientId, fresh.refresh_token)).status).toBe(200);
  });

  it("refuses a refresh token written after its grant's revoke committed", async () => {
    // A code exchange can pass the grant check, lose the race to the revoke and still store its
    // refresh token. Marking the grant revoked under its live tokens stands for that.
    const clientId = await register();
    const late = await connect(clientId);
    const [first] = await liveRows(clientId);
    await runAsSystem("mcp oauth test", () =>
      handles.prisma.mcpConnection.update({
        where: { id: first!.id },
        data: { revokedAt: new Date() },
      }),
    );
    expect((await toolsList(late.access_token)).status).toBe(401);
    const renewed = await refresh(clientId, late.refresh_token);
    expect(renewed.status).toBe(400);
    expect(await renewed.json()).toMatchObject({ error: "invalid_grant" });
  });

  it("keeps one grant when two approvals of the same client race", async () => {
    const clientId = await register();
    const approvals = [await approve(clientId), await approve(clientId)];
    const codes = await Promise.all(approvals.map((approval) => consent(approval)));
    const rows = await liveRows(clientId);
    expect(rows).toHaveLength(1);
    const tokens = await Promise.all(
      codes.flatMap((code, i) => (code ? [exchange(clientId, code, approvals[i]!.verifier)] : [])),
    );
    expect(tokens.length).toBeGreaterThan(0);
    for (const { access_token } of tokens) {
      expect(payloadOf(access_token).grant_id).toBe(rows[0]!.grantId);
      expect((await toolsList(access_token)).status).toBe(200);
    }
    await revokeConnection(handles.prisma, { userId }, rows[0]!.id);
    const fresh = await connect(clientId);
    for (const { access_token } of tokens) {
      expect((await toolsList(access_token)).status).toBe(401);
    }
    expect((await toolsList(fresh.access_token)).status).toBe(200);
  });

  it.each([
    ["a JWT", true],
    ["an opaque access token", false],
  ])("refuses to renew a refresh token that names no grant into %s", async (_, resource) => {
    const clientId = await register();
    const tokens = await connect(clientId, { resource });
    expect(tokens.access_token.split(".")).toHaveLength(resource ? 3 : 1);
    // A refresh token from before grants carried an id holds only the Space.
    await runAsSystem("mcp oauth test", () =>
      handles.prisma.oauthRefreshToken.updateMany({
        where: { clientId, userId },
        data: { referenceId: spaceId },
      }),
    );
    const renewed = await refresh(clientId, tokens.refresh_token, { resource });
    expect(renewed.status).toBe(400);
    expect(await renewed.json()).toMatchObject({ error: "invalid_grant" });
  });
});
