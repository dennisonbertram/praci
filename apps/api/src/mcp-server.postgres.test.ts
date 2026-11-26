import type { PrismaClient } from "@rakazo/db";
import { createDb, runAsSystem } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { handleMcpRequest, McpAccessError, resolveMcpCall } from "./mcp-server.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("MCP per-call checks (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `mcp-org-${suffix}`;
  const [spaceA, spaceB] = [`mcp-space-a-${suffix}`, `mcp-space-b-${suffix}`];
  const alice = `mcp-alice-${suffix}`;
  const bob = `mcp-bob-${suffix}`;
  const client = "mcp-client";
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  const claims = (sub: string, spaceId: string) => ({
    sub,
    azp: client,
    space_id: spaceId,
    iat: Math.floor(Date.now() / 1000),
  });
  const connect = (userId: string, spaceId: string, extra = {}) =>
    runAsSystem("mcp test", () =>
      prisma.mcpConnection.create({
        data: { userId, spaceId, kind: "oauth", label: "test", oauthClientId: client, ...extra },
      }),
    );
  const agents = async (userId: string, spaceId: string) => {
    const call = await resolveMcpCall(prisma, claims(userId, spaceId));
    const response = await handleMcpRequest(
      prisma,
      call,
      new Request("http://mcp.test/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "agents_list", arguments: {} },
        }),
      }),
    );
    const body = (await response.json()) as { result: { content: Array<{ text: string }> } };
    return (JSON.parse(body.result.content[0]!.text) as { agents: Array<{ name: string }> }).agents;
  };

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.createMany({
      data: [alice, bob].map((id) => ({ id, name: id, email: `${id}@x.test` })),
    });
    await prisma.organization.create({
      data: { id: organizationId, name: "MCP Org", slug: organizationId, createdAt: new Date() },
    });
    await prisma.space.createMany({
      data: [spaceA, spaceB].map((id) => ({ id, organizationId, name: id })),
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
    const memberships = [
      [alice, spaceA],
      [alice, spaceB],
      [bob, spaceA],
    ] as const;
    await prisma.spaceMember.createMany({
      data: memberships.map(([userId, spaceId]) => ({
        id: `sm-${userId}-${spaceId}`,
        organizationId,
        spaceId,
        userId,
        createdAt: new Date(),
      })),
    });
    await runAsSystem("mcp test", () =>
      prisma.bot.createMany({
        data: [
          {
            id: `b-a-${suffix}`,
            spaceId: spaceA,
            userId: alice,
            name: "Alpha",
            description: "In A",
          },
          { id: `b-b-${suffix}`, spaceId: spaceB, userId: alice, name: "Beta" },
          {
            id: `b-x-${suffix}`,
            spaceId: spaceA,
            userId: alice,
            name: "Gone",
            archivedAt: new Date(),
          },
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

  it("keeps two connections in two Spaces apart", async () => {
    await connect(alice, spaceA);
    await connect(alice, spaceB);
    expect(await agents(alice, spaceA)).toEqual([
      { id: `b-a-${suffix}`, name: "Alpha", description: "In A" },
    ]);
    expect(await agents(alice, spaceB)).toEqual([{ id: `b-b-${suffix}`, name: "Beta" }]);
  });

  it("rejects a token that names a Space without a connection", async () => {
    await expect(resolveMcpCall(prisma, claims(bob, spaceB))).rejects.toMatchObject({
      status: 401,
    });
    await expect(resolveMcpCall(prisma, { sub: alice })).rejects.toBeInstanceOf(McpAccessError);
  });

  it("rejects a revoked connection on the next call", async () => {
    const connection = await connect(bob, spaceA);
    await expect(resolveMcpCall(prisma, claims(bob, spaceA))).resolves.toMatchObject({
      connectionId: connection.id,
    });
    await runAsSystem("mcp test", () =>
      prisma.mcpConnection.update({
        where: { id: connection.id },
        data: { revokedAt: new Date() },
      }),
    );
    await expect(resolveMcpCall(prisma, claims(bob, spaceA))).rejects.toMatchObject({
      message: "This connection was revoked",
      status: 401,
    });
  });

  it("refuses an access token from a grant the member revoked, even after the client reconnects", async () => {
    const clientId = `rotated-${suffix}`;
    const oldIat = Math.floor(Date.now() / 1000) - 60;
    const first = await connect(alice, spaceA, { oauthClientId: clientId });
    await runAsSystem("mcp test", () =>
      prisma.mcpConnection.update({ where: { id: first.id }, data: { revokedAt: new Date() } }),
    );
    const second = await connect(alice, spaceA, { oauthClientId: clientId });
    // The pair now matches the new grant, but the token was issued under the revoked one.
    await expect(
      resolveMcpCall(prisma, { sub: alice, azp: clientId, space_id: spaceA, iat: oldIat }),
    ).rejects.toMatchObject({ message: "This connection was revoked", status: 401 });
    await expect(
      resolveMcpCall(prisma, {
        sub: alice,
        azp: clientId,
        space_id: spaceA,
        iat: Math.floor(Date.now() / 1000),
      }),
    ).resolves.toMatchObject({ connectionId: second.id });
  });

  it("refuses an access token that carries no issue time", async () => {
    await connect(alice, spaceA, { oauthClientId: `undated-${suffix}` });
    await expect(
      resolveMcpCall(prisma, { sub: alice, azp: `undated-${suffix}`, space_id: spaceA }),
    ).rejects.toMatchObject({ message: "This connection was revoked", status: 401 });
  });

  describe("grant-bound tokens", () => {
    const grantClaims = (sub: string, spaceId: string, clientId: string, grantId: string) => ({
      sub,
      azp: clientId,
      space_id: spaceId,
      grant_id: grantId,
      iat: Math.floor(Date.now() / 1000),
    });
    const revoke = (id: string) =>
      runAsSystem("mcp test", () =>
        prisma.mcpConnection.update({ where: { id }, data: { revokedAt: new Date() } }),
      );

    it("resolves the grant the token names", async () => {
      const clientId = `grant-ok-${suffix}`;
      const row = await connect(alice, spaceA, {
        oauthClientId: clientId,
        grantId: `g-ok-${suffix}`,
      });
      await expect(
        resolveMcpCall(prisma, grantClaims(alice, spaceA, clientId, `g-ok-${suffix}`)),
      ).resolves.toMatchObject({ connectionId: row.id });
    });

    it("refuses a revoked grant's token when the client reconnects within seconds", async () => {
      const clientId = `grant-fast-${suffix}`;
      const first = await connect(alice, spaceA, {
        oauthClientId: clientId,
        grantId: `g1-${suffix}`,
      });
      await revoke(first.id);
      const second = await connect(alice, spaceA, {
        oauthClientId: clientId,
        grantId: `g2-${suffix}`,
      });
      // Issued now, so an issue-time check alone cannot tell it from the new grant's tokens.
      await expect(
        resolveMcpCall(prisma, grantClaims(alice, spaceA, clientId, `g1-${suffix}`)),
      ).rejects.toMatchObject({ message: "This connection was revoked", status: 401 });
      await expect(
        resolveMcpCall(prisma, grantClaims(alice, spaceA, clientId, `g2-${suffix}`)),
      ).resolves.toMatchObject({ connectionId: second.id });
    });

    it("keeps one live grant per member, client and Space", async () => {
      const clientId = `grant-race-${suffix}`;
      const results = await Promise.allSettled([
        connect(alice, spaceA, { oauthClientId: clientId, grantId: `gr1-${suffix}` }),
        connect(alice, spaceA, { oauthClientId: clientId, grantId: `gr2-${suffix}` }),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      // The same client may still hold a second grant in another Space.
      await expect(
        connect(alice, spaceB, { oauthClientId: clientId, grantId: `gr3-${suffix}` }),
      ).resolves.toBeDefined();
    });

    it("refuses a token minted for a revoked grant after the client reconnected", async () => {
      // An authorization code from before the revoke, exchanged afterwards, names the old grant.
      const clientId = `grant-code-${suffix}`;
      const first = await connect(alice, spaceB, {
        oauthClientId: clientId,
        grantId: `gc1-${suffix}`,
      });
      await revoke(first.id);
      await connect(alice, spaceB, { oauthClientId: clientId, grantId: `gc2-${suffix}` });
      await new Promise((resolve) => setTimeout(resolve, 1100));
      await expect(
        resolveMcpCall(prisma, grantClaims(alice, spaceB, clientId, `gc1-${suffix}`)),
      ).rejects.toMatchObject({ status: 401 });
    });

    it("refuses a grant that belongs to another member, client or Space", async () => {
      const clientId = `grant-own-${suffix}`;
      await connect(alice, spaceA, { oauthClientId: clientId, grantId: `go-${suffix}` });
      for (const claims of [
        grantClaims(bob, spaceA, clientId, `go-${suffix}`),
        grantClaims(alice, spaceB, clientId, `go-${suffix}`),
        grantClaims(alice, spaceA, "other-client", `go-${suffix}`),
      ]) {
        await expect(resolveMcpCall(prisma, claims)).rejects.toMatchObject({ status: 401 });
      }
    });

    it("grants only mcp:read when the scope claim is missing or malformed", async () => {
      const clientId = `grant-scope-${suffix}`;
      await connect(alice, spaceA, { oauthClientId: clientId, grantId: `gs-${suffix}` });
      const scoped = (scope: unknown) => ({
        ...grantClaims(alice, spaceA, clientId, `gs-${suffix}`),
        scope,
      });
      for (const scope of [undefined, null, 7, ["mcp:write"], "mcp:writer"]) {
        await expect(resolveMcpCall(prisma, scoped(scope))).resolves.toMatchObject({
          scopes: ["mcp:read"],
        });
      }
      await expect(
        resolveMcpCall(prisma, scoped("offline_access mcp:read mcp:write")),
      ).resolves.toMatchObject({ scopes: ["mcp:read", "mcp:write"] });
    });
  });

  it("rejects a member who left the Space even though the connection is active", async () => {
    await connect(bob, spaceA);
    await expect(resolveMcpCall(prisma, claims(bob, spaceA))).resolves.toBeDefined();
    await prisma.spaceMember.deleteMany({ where: { userId: bob, spaceId: spaceA } });
    await expect(resolveMcpCall(prisma, claims(bob, spaceA))).rejects.toMatchObject({
      message: "No access to this space",
      status: 403,
    });
  });
});
