import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { McpOAuthBroker } from "./mcp-oauth.js";
import { EncryptedSecretStore } from "./secrets.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("MCP OAuth token renewal across processes (PostgreSQL)", () => {
  const run = randomUUID().slice(0, 8);
  const ids = { user: `mor-user-${run}`, org: `mor-org-${run}`, space: `mor-space-${run}` };
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  const secrets = new EncryptedSecretStore("test-key");
  const context = {
    operationId: "t",
    traceId: "t",
    spaceId: ids.space,
    userId: ids.user,
    botId: "mcp",
    signal: new AbortController().signal,
  };

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.create({
      data: { id: ids.user, name: "m", email: `${ids.user}@rakazo.test`, emailVerified: false },
    });
    await prisma.organization.create({
      data: { id: ids.org, name: "m", slug: ids.org, createdAt: new Date() },
    });
    await prisma.space.create({
      data: { id: ids.space, organizationId: ids.org, name: "m", isDefault: true },
    });
  });
  afterAll(async () => {
    await prisma.mcpServer.deleteMany({ where: { spaceId: ids.space } });
    await prisma.secret.deleteMany({ where: { spaceId: ids.space } });
    await prisma.space.deleteMany({ where: { id: ids.space } });
    await prisma.organization.deleteMany({ where: { id: ids.org } });
    await prisma.user.deleteMany({ where: { id: ids.user } });
    await close();
  });

  it("two processes with the same expired token spend the refresh token once", async () => {
    const material = {
      oauth: {
        tokens: {
          access_token: "old-access",
          refresh_token: "old-refresh",
          token_type: "Bearer",
          expires_in: 3600,
        },
        obtainedAt: Date.now() - 2 * 3600 * 1000,
        clientInformation: { client_id: "client-1" },
        discoveryState: {
          authorizationServerUrl: "https://auth.example.test",
          authorizationServerMetadata: {
            issuer: "https://auth.example.test",
            authorization_endpoint: "https://auth.example.test/authorize",
            token_endpoint: "https://auth.example.test/token",
            response_types_supported: ["code"],
          },
        },
      },
    };
    const stored = await secrets.put(JSON.stringify(material), context);
    await prisma.secret.create({
      data: {
        id: stored.id,
        spaceId: ids.space,
        userId: ids.user,
        kind: "mcp",
        ciphertext: stored.ciphertext,
      },
    });
    const server = await prisma.mcpServer.create({
      data: {
        spaceId: ids.space,
        userId: ids.user,
        slug: "box",
        name: "Box",
        transport: "http",
        endpoint: "https://mcp.example.test",
        secretId: stored.id,
      },
    });
    // Box refresh tokens work once: a second use of the old one is refused.
    let calls = 0;
    const network = {
      fetch: async (_input: string | URL | Request, init?: RequestInit) => {
        const body = new URLSearchParams(new TextDecoder().decode(init?.body as ArrayBuffer));
        calls++;
        await new Promise((done) => setTimeout(done, 100));
        return body.get("refresh_token") === "old-refresh" && calls === 1
          ? new Response(
              JSON.stringify({
                access_token: "new-access",
                refresh_token: "new-refresh",
                token_type: "Bearer",
                expires_in: 3600,
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            )
          : new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
      },
      resolveHostname: async () => [{ address: "203.0.113.10", family: 4 }],
    };
    const brokers = [1, 2].map(() => new McpOAuthBroker(prisma, secrets, network));
    const ref = { id: server.id, endpoint: server.endpoint, secretId: server.secretId };
    const providers = await Promise.all(
      brokers.map((broker) => broker.providerFor(ref, { spaceId: ids.space, userId: ids.user })),
    );
    const tokens = await Promise.all(providers.map((provider) => provider?.tokens()));

    expect(calls).toBe(1);
    expect(tokens.map((token) => token?.access_token)).toEqual(["new-access", "new-access"]);
    const row = await prisma.mcpServer.findUniqueOrThrow({ where: { id: server.id } });
    const saved = await prisma.secret.findUniqueOrThrow({ where: { id: row.secretId as string } });
    expect(JSON.parse(await secrets.load(saved.ciphertext, saved.id)).oauth.tokens).toMatchObject({
      access_token: "new-access",
      refresh_token: "new-refresh",
    });
  });
});
