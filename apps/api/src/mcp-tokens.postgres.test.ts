import type { PrismaClient } from "@rakazo/db";
import { createDb, runAsSystem } from "@rakazo/db";
import { Hono } from "hono";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createToken,
  listConnections,
  McpConnectionNotFound,
  McpSpaceForbidden,
  revokeConnection,
  updateConnection,
} from "./mcp-connections.js";
import { mountMcpServer, resolveMcpCall, resolvePatCall } from "./mcp-server.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("MCP personal access tokens (PostgreSQL, runtime login)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `pat-org-${suffix}`;
  const [spaceA, spaceB, spaceC] = ["a", "b", "c"].map((k) => `pat-space-${k}-${suffix}`) as [
    string,
    string,
    string,
  ];
  const [alice, bob] = [`pat-alice-${suffix}`, `pat-bob-${suffix}`];
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  const app = new Hono();

  const call = async (token: string | null, method = "tools/list", name?: string) =>
    app.request("/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method,
        ...(name ? { params: { name, arguments: {} } } : {}),
      }),
    });
  const agentNames = async (token: string) => {
    const response = await call(token, "tools/call", "agents_list");
    expect(response.status).toBe(200);
    const body = (await response.json()) as { result: { content: Array<{ text: string }> } };
    return (
      JSON.parse(body.result.content[0]!.text) as { agents: Array<{ name: string }> }
    ).agents.map((a) => a.name);
  };
  const lastUsed = (id: string) =>
    runAsSystem("pat test", () =>
      prisma.mcpConnection.findUniqueOrThrow({ where: { id } }).then((row) => row.lastUsedAt),
    );

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    mountMcpServer(app, {
      prisma,
      auth: {} as never,
      baseUrl: "http://127.0.0.1:3200",
      jwksUrl: "x",
    });
    await prisma.user.createMany({
      data: [alice, bob].map((id) => ({ id, name: id, email: `${id}@x.test` })),
    });
    await prisma.organization.create({
      data: { id: organizationId, name: "PAT Org", slug: organizationId, createdAt: new Date() },
    });
    await prisma.space.createMany({
      data: [spaceA, spaceB, spaceC].map((id) => ({
        id,
        organizationId,
        name: `Name ${id.slice(10, 17)}`,
      })),
    });
    await prisma.member.createMany({
      data: [alice, bob].map((userId) => ({
        id: `m-${userId}`,
        organizationId,
        userId,
        role: "member",
        createdAt: new Date(),
      })),
    });
    await prisma.spaceMember.createMany({
      data: (
        [
          [alice, spaceA],
          [alice, spaceB],
          [bob, spaceA],
          [bob, spaceC],
        ] as const
      ).map(([userId, spaceId]) => ({
        id: `sm-${userId}-${spaceId}`,
        organizationId,
        spaceId,
        userId,
        createdAt: new Date(),
      })),
    });
    await runAsSystem("pat test", () =>
      prisma.bot.createMany({
        data: [
          { id: `pb-a-${suffix}`, spaceId: spaceA, userId: alice, name: "Alpha" },
          { id: `pb-b-${suffix}`, spaceId: spaceB, userId: alice, name: "Beta" },
        ].map((bot) => ({ color: "#000", ...bot })),
      }),
    );
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [alice, bob] } } });
    await close();
  });

  it("serves a PAT call, then refuses it with 401 after revoke", async () => {
    const { connection, token } = await createToken(
      prisma,
      { userId: alice },
      {
        spaceId: spaceA,
        label: "laptop",
        readOnly: true,
      },
    );
    expect(await agentNames(token)).toEqual(["Alpha"]);
    await revokeConnection(prisma, { userId: alice }, connection.id);
    const after = await call(token);
    expect(after.status).toBe(401);
    expect(after.headers.get("www-authenticate")).toContain("resource_metadata");
  });

  it("refuses an unknown token", async () => {
    expect((await call("praci_pat_nope")).status).toBe(401);
  });

  it("refuses with 403 after the member leaves the Space", async () => {
    const { token } = await createToken(
      prisma,
      { userId: bob },
      {
        spaceId: spaceC,
        label: "bob",
        readOnly: false,
      },
    );
    expect((await call(token)).status).toBe(200);
    await prisma.spaceMember.deleteMany({ where: { userId: bob, spaceId: spaceC } });
    expect((await call(token)).status).toBe(403);
  });

  it("keeps two tokens in two Spaces apart", async () => {
    const mk = (spaceId: string) =>
      createToken(prisma, { userId: alice }, { spaceId, label: spaceId, readOnly: true });
    const [a, b] = await Promise.all([mk(spaceA), mk(spaceB)]);
    expect(await agentNames(a.token)).toEqual(["Alpha"]);
    expect(await agentNames(b.token)).toEqual(["Beta"]);
  });

  it("gives a read-only token mcp:read only, and a write token both", async () => {
    const make = (readOnly: boolean) =>
      createToken(prisma, { userId: alice }, { spaceId: spaceA, label: "scopes", readOnly });
    const ro = await make(true);
    const rw = await make(false);
    expect((await resolvePatCall(prisma, ro.token)).scopes).toEqual(["mcp:read"]);
    expect((await resolvePatCall(prisma, rw.token)).scopes).toEqual(["mcp:read", "mcp:write"]);
    await updateConnection(prisma, { userId: alice }, { id: rw.connection.id, readOnly: true });
    expect((await resolvePatCall(prisma, rw.token)).scopes).toEqual(["mcp:read"]);
  });

  it("refuses a token for a Space the member is not in", async () => {
    await expect(
      createToken(prisma, { userId: alice }, { spaceId: spaceC, label: "x", readOnly: true }),
    ).rejects.toBeInstanceOf(McpSpaceForbidden);
  });

  it("lists, changes and revokes only the caller's own connections", async () => {
    const mine = await createToken(
      prisma,
      { userId: alice },
      {
        spaceId: spaceB,
        label: "mine",
        readOnly: true,
      },
    );
    const listed = await listConnections(prisma, { userId: bob, spaceId: spaceA }, "http://x/mcp");
    expect(listed.connections.map((c) => c.id)).not.toContain(mine.connection.id);
    const own = await listConnections(prisma, { userId: alice, spaceId: spaceA }, "http://x/mcp");
    expect(own.connections.find((c) => c.id === mine.connection.id)).toMatchObject({
      label: "mine",
      kind: "pat",
      spaceId: spaceB,
      readOnly: true,
    });
    expect(own.spaces.map((s) => s.id).sort()).toEqual([spaceA, spaceB].sort());
    expect(own.spaces.find((s) => s.current)?.id).toBe(spaceA);
    expect(JSON.stringify(own)).not.toContain(mine.token);
    await expect(
      updateConnection(prisma, { userId: bob }, { id: mine.connection.id, readOnly: false }),
    ).rejects.toBeInstanceOf(McpConnectionNotFound);
    await expect(
      revokeConnection(prisma, { userId: bob }, mine.connection.id),
    ).rejects.toBeInstanceOf(McpConnectionNotFound);
    expect((await call(mine.token)).status).toBe(200);
  });

  it("writes lastUsedAt as the tenant, at most once a minute", async () => {
    const { connection, token } = await createToken(
      prisma,
      { userId: alice },
      {
        spaceId: spaceA,
        label: "used",
        readOnly: true,
      },
    );
    expect(await lastUsed(connection.id)).toBeNull();
    const t0 = new Date();
    await resolvePatCall(prisma, token, t0);
    expect(await lastUsed(connection.id)).toEqual(t0);
    await resolvePatCall(prisma, token, new Date(t0.getTime() + 30_000));
    expect(await lastUsed(connection.id)).toEqual(t0);
    const t2 = new Date(t0.getTime() + 61_000);
    await resolvePatCall(prisma, token, t2);
    expect(await lastUsed(connection.id)).toEqual(t2);
  });

  it("updates lastUsedAt on the OAuth path too, and revoke removes its refresh tokens", async () => {
    const clientId = `pat-client-${suffix}`;
    await runAsSystem("pat test", async () => {
      await prisma.oauthClient.create({ data: { id: clientId, clientId, name: "Test client" } });
      await prisma.oauthRefreshToken.create({
        data: {
          id: `rt-${suffix}`,
          token: `rt-token-${suffix}`,
          clientId,
          userId: alice,
          referenceId: spaceA,
          expiresAt: new Date(Date.now() + 1e7),
          createdAt: new Date(),
        },
      });
      await prisma.oauthRefreshToken.create({
        data: {
          id: `rt2-${suffix}`,
          token: `rt2-token-${suffix}`,
          clientId,
          userId: alice,
          referenceId: spaceB,
          expiresAt: new Date(Date.now() + 1e7),
          createdAt: new Date(),
        },
      });
    });
    const connection = await runAsSystem("pat test", () =>
      prisma.mcpConnection.create({
        data: {
          userId: alice,
          spaceId: spaceA,
          kind: "oauth",
          label: "c",
          oauthClientId: clientId,
        },
      }),
    );
    const now = new Date();
    const iat = Math.floor(now.getTime() / 1000);
    await resolveMcpCall(prisma, { sub: alice, azp: clientId, space_id: spaceA, iat }, now);
    expect(await lastUsed(connection.id)).toEqual(now);
    await revokeConnection(prisma, { userId: alice }, connection.id);
    const left = await runAsSystem("pat test", () =>
      prisma.oauthRefreshToken.findMany({ where: { clientId }, select: { id: true } }),
    );
    expect(left.map((r) => r.id)).toEqual([`rt2-${suffix}`]);
    await expect(
      resolveMcpCall(prisma, { sub: alice, azp: clientId, space_id: spaceA, iat }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it("refuses an access token from a revoked grant after the same client reconnects", async () => {
    const clientId = `pat-client-rot-${suffix}`;
    const grant = () =>
      runAsSystem("pat test", () =>
        prisma.mcpConnection.create({
          data: {
            userId: alice,
            spaceId: spaceB,
            kind: "oauth",
            label: "rotating client",
            oauthClientId: clientId,
          },
        }),
      );
    const first = await grant();
    await revokeConnection(prisma, { userId: alice }, first.id);
    const second = await grant();
    const oldIat = Math.floor((first.createdAt.getTime() - 60_000) / 1000);
    await expect(
      resolveMcpCall(prisma, { sub: alice, azp: clientId, space_id: spaceB, iat: oldIat }),
    ).rejects.toMatchObject({ message: "This connection was revoked", status: 401 });
    await expect(
      resolveMcpCall(prisma, {
        sub: alice,
        azp: clientId,
        space_id: spaceB,
        iat: Math.floor(Date.now() / 1000),
      }),
    ).resolves.toMatchObject({ connectionId: second.id });
  });
});
