import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ownerTrustedRecipients } from "./mail-trusted-recipients.js";

const describePostgres =
  process.env.VERIFY_DATABASE && process.env.DATABASE_URL ? describe.sequential : describe.skip;

describePostgres("owner-trusted recipients (PostgreSQL)", () => {
  let db: ReturnType<typeof createDb>;
  let prisma: PrismaClient;
  const ids: string[] = [];

  beforeAll(() => {
    db = createDb(process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL!);
    prisma = db.prisma;
  });
  afterAll(async () => {
    if (!db) return;
    await prisma.space.deleteMany({ where: { id: { in: ids } } });
    await prisma.organization.deleteMany({ where: { id: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
    await db.pool.end();
  });

  async function tenant() {
    const id = randomUUID();
    ids.push(id);
    await prisma.user.create({
      data: { id, name: "T", email: `${id}@example.test`, emailVerified: true },
    });
    await prisma.organization.create({
      data: { id, name: "T", slug: id, createdAt: new Date() },
    });
    await prisma.space.create({ data: { id, organizationId: id, name: "T", isDefault: true } });
    const connection = await prisma.connection.create({
      data: {
        spaceId: id,
        userId: id,
        provider: "gmail",
        displayName: "Mailbox",
        status: "connected",
        providerRef: id,
        metadata: {},
      },
    });
    return { id, scope: { spaceId: id, userId: id }, connectionId: connection.id };
  }

  type Tenant = Awaited<ReturnType<typeof tenant>>;
  const message = (
    t: Tenant,
    input: { from: string; to: string[]; cc?: string[]; fromSelf: boolean; pid?: string },
  ) =>
    prisma.cachedMailMessage.create({
      data: {
        ...t.scope,
        connectionId: t.connectionId,
        providerMessageId: input.pid ?? `pm-${randomUUID()}`,
        threadId: "thread-1",
        fromAddress: input.from,
        toAddresses: input.to,
        ccAddresses: input.cc ?? [],
        subject: "S",
        snippet: "s",
        receivedAt: new Date(),
        unread: false,
        inInbox: !input.fromSelf,
        fromSelf: input.fromSelf,
        seenAt: new Date(),
      },
    });
  const agentSend = (t: Tenant, clientId: string, providerMessageId: string) =>
    prisma.composeSend.create({
      data: {
        ...t.scope,
        connectionId: t.connectionId,
        clientId,
        state: "sent",
        providerMessageId,
      },
    });

  it("does not trust an address that only emailed the owner, or was only on a thread", async () => {
    const t = await tenant();
    await message(t, {
      from: "attacker@example.test",
      to: ["me@example.test"],
      cc: ["bystander@example.test"],
      fromSelf: false,
    });
    const trusted = await ownerTrustedRecipients(prisma, t.scope, [
      "attacker@example.test",
      "bystander@example.test",
    ]);
    expect([...trusted]).toEqual([]);
  });

  it("trusts an address the owner mailed by hand, matching case-insensitively", async () => {
    const t = await tenant();
    await message(t, {
      from: "me@example.test",
      to: ["Pat@Example.test"],
      cc: ["sam@example.test"],
      fromSelf: true,
    });
    const trusted = await ownerTrustedRecipients(prisma, t.scope, [
      "pat@example.test",
      "SAM@example.test",
      "other@example.test",
    ]);
    expect([...trusted].sort()).toEqual(["pat@example.test", "sam@example.test"]);
  });

  it("does not trust an address only an agent sent to, until the owner sends to it by hand", async () => {
    const t = await tenant();
    await message(t, {
      from: "me@example.test",
      to: ["lead@example.test"],
      fromSelf: true,
      pid: "a1",
    });
    await agentSend(t, "agent:run-1:call-1", "a1");
    await message(t, {
      from: "me@example.test",
      to: ["edited@example.test"],
      fromSelf: true,
      pid: "a2",
    });
    await agentSend(t, "approval_effect-1", "a2");
    expect([
      ...(await ownerTrustedRecipients(prisma, t.scope, [
        "lead@example.test",
        "edited@example.test",
      ])),
    ]).toEqual([]);
    // The owner's own composer send (a browser client id) is by hand.
    await message(t, {
      from: "me@example.test",
      to: ["lead@example.test"],
      fromSelf: true,
      pid: "h1",
    });
    await agentSend(t, "browser-compose-1", "h1");
    expect([...(await ownerTrustedRecipients(prisma, t.scope, ["lead@example.test"]))]).toEqual([
      "lead@example.test",
    ]);
  });

  it("trusts the owner's own sign-in and mail account addresses", async () => {
    const t = await tenant();
    const trusted = await ownerTrustedRecipients(
      prisma,
      t.scope,
      [`${t.id}@EXAMPLE.test`, "Me@Example.test", "x@example.test"],
      ["me@example.test"],
    );
    expect([...trusted].sort()).toEqual([`${t.id}@example.test`, "me@example.test"].sort());
  });

  it("never uses another tenant's sent mail", async () => {
    const a = await tenant();
    const b = await tenant();
    await message(a, { from: "me@example.test", to: ["pat@example.test"], fromSelf: true });
    expect([...(await ownerTrustedRecipients(prisma, b.scope, ["pat@example.test"]))]).toEqual([]);
    expect([...(await ownerTrustedRecipients(prisma, a.scope, ["pat@example.test"]))]).toEqual([
      "pat@example.test",
    ]);
  });
});
