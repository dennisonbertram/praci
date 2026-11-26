import { listPendingActions, pruneMcpCallLog } from "@rakazo/adapters";
import type { PrismaClient } from "@rakazo/db";
import { createDb, notifyNewMcpConnection, runAsSystem } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createToken } from "./mcp-connections.js";
import { clientIp, REGISTER_LIMIT, takeRegisterSlot } from "./mcp-register-limit.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describe("clientIp", () => {
  it("trusts the last X-Forwarded-For entry only from a local or private proxy", () => {
    expect(clientIp("127.0.0.1", "6.6.6.6, 203.0.113.9")).toBe("203.0.113.9");
    expect(clientIp("::ffff:127.0.0.1", "203.0.113.9")).toBe("203.0.113.9");
    expect(clientIp("172.18.0.5", "203.0.113.9")).toBe("203.0.113.9");
    expect(clientIp("10.0.0.2", "198.51.100.1, 203.0.113.9")).toBe("203.0.113.9");
    expect(clientIp("::ffff:192.168.1.4", "203.0.113.9")).toBe("203.0.113.9");
    expect(clientIp("fd00::1", "203.0.113.9")).toBe("203.0.113.9");
    // A direct client cannot choose its address by sending the header.
    expect(clientIp("198.51.100.4", "203.0.113.9")).toBe("198.51.100.4");
    expect(clientIp("172.32.0.1", "203.0.113.9")).toBe("172.32.0.1");
    expect(clientIp("127.0.0.1", undefined)).toBe("127.0.0.1");
    expect(clientIp("10.0.0.2", undefined)).toBe("10.0.0.2");
    expect(clientIp(undefined, undefined)).toBe("unknown");
  });
});

describePostgres("MCP hardening (PostgreSQL, runtime login)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `hard-org-${suffix}`;
  const spaceId = `hard-space-${suffix}`;
  const alice = `hard-alice-${suffix}`;
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let botId: string;

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.create({ data: { id: alice, name: alice, email: `${alice}@x.test` } });
    await prisma.organization.create({
      data: { id: organizationId, name: "Org", slug: organizationId, createdAt: new Date() },
    });
    await prisma.space.create({ data: { id: spaceId, organizationId, name: "Northwind" } });
    await prisma.member.create({
      data: {
        id: `m-${alice}`,
        organizationId,
        userId: alice,
        role: "member",
        createdAt: new Date(),
      },
    });
    await prisma.spaceMember.create({
      data: { id: `sm-${alice}`, organizationId, spaceId, userId: alice, createdAt: new Date() },
    });
    botId = await runAsSystem(
      "hardening test",
      async () =>
        (
          await prisma.bot.create({
            data: { spaceId, userId: alice, name: "Chief", color: "blue" },
          })
        ).id,
    );
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.rateLimit.deleteMany({ where: { key: { startsWith: `mcp-register:${suffix}` } } });
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: alice } });
    await close();
  });

  const notices = () =>
    runAsSystem("hardening test", () =>
      prisma.notification.findMany({
        where: { spaceId, userId: alice, surface: "mcp" },
        orderBy: { createdAt: "asc" },
      }),
    );

  it("notifies the member of a new token and of a new OAuth connection", async () => {
    await createToken(prisma, { userId: alice }, { spaceId, label: "Laptop", readOnly: false });
    const oauth = await runAsSystem("hardening test", () =>
      prisma.mcpConnection.create({
        data: { userId: alice, spaceId, kind: "oauth", label: "Claude", oauthClientId: "c1" },
      }),
    );
    await notifyNewMcpConnection(prisma, oauth);
    // The same connection does not notify twice.
    await notifyNewMcpConnection(prisma, oauth);
    const rows = await notices();
    expect(rows.map((n) => n.title)).toEqual([
      "New connection: Laptop in Northwind",
      "New connection: Claude in Northwind",
    ]);
    expect(rows[0]).toMatchObject({ link: "/app?settings=connections", kind: "new" });
  });

  it("allows 10 registrations per address per hour and blocks the 11th", async () => {
    const ip = `${suffix}-a`;
    const now = new Date("2026-10-29T10:00:00Z");
    for (let i = 0; i < REGISTER_LIMIT; i++) {
      expect(await takeRegisterSlot(prisma, ip, now)).toBeNull();
    }
    expect(await takeRegisterSlot(prisma, ip, now)).toBeGreaterThan(0);
    // Another address is not affected.
    expect(await takeRegisterSlot(prisma, `${suffix}-b`, now)).toBeNull();
    // The next hour starts a new window.
    expect(await takeRegisterSlot(prisma, ip, new Date("2026-10-29T11:00:01Z"))).toBeNull();
  });

  it("deletes only call log rows older than 30 days", async () => {
    const now = new Date("2026-10-29T10:00:00Z");
    const connection = await runAsSystem("hardening test", () =>
      prisma.mcpConnection.create({
        data: { userId: alice, spaceId, kind: "pat", label: "Old", tokenHash: `h-${suffix}` },
      }),
    );
    const day = 24 * 60 * 60 * 1000;
    await runAsSystem("hardening test", () =>
      prisma.mcpCallLog.createMany({
        data: [31, 29].map((days) => ({
          connectionId: connection.id,
          spaceId,
          tool: `t${days}`,
          outcome: "ok",
          durationMs: 1,
          createdAt: new Date(now.getTime() - days * day),
        })),
      }),
    );
    await pruneMcpCallLog(prisma, now);
    const left = await runAsSystem("hardening test", () =>
      prisma.mcpCallLog.findMany({ where: { connectionId: connection.id } }),
    );
    expect(left.map((row) => row.tool)).toEqual(["t29"]);
  });

  it("names the agent on pending actions", async () => {
    const connection = await runAsSystem("hardening test", () =>
      prisma.mcpConnection.create({
        data: { userId: alice, spaceId, kind: "pat", label: "Named", tokenHash: `n-${suffix}` },
      }),
    );
    await runAsSystem("hardening test", () =>
      prisma.externalAction.createMany({
        data: [
          {
            spaceId,
            userId: alice,
            connectionId: connection.id,
            tool: "agent_send",
            args: { botId, message: "hi" },
          },
          {
            spaceId,
            userId: alice,
            connectionId: connection.id,
            tool: "contacts_add",
            args: { name: "Wendy" },
          },
        ],
      }),
    );
    const pending = await runAsSystem("hardening test", () =>
      listPendingActions(prisma, { spaceId, userId: alice }),
    );
    expect(pending.map((a) => [a.tool, a.botName])).toEqual([
      ["agent_send", "Chief"],
      ["contacts_add", undefined],
    ]);
  });
});
