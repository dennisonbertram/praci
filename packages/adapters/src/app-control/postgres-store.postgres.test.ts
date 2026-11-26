import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@rakazo/db";
import { createDb, PostgresAppControlStore } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { appControlStoreContract } from "./app-control-store.test-support.js";

// Needs DATABASE_MIGRATION_URL (the owner), as `pnpm test:integration` provides.
const url = process.env.DATABASE_MIGRATION_URL;
const describePostgres = process.env.VERIFY_DATABASE && url ? describe.sequential : describe.skip;

describePostgres("PostgresAppControlStore (PostgreSQL)", () => {
  const sfx = randomUUID().slice(0, 8);
  const ids = {
    org: `ac-org-${sfx}`,
    user: `ac-user-${sfx}`,
    space: `ac-space-${sfx}`,
    otherSpace: `ac-space2-${sfx}`,
    bot: `ac-bot-${sfx}`,
    otherBot: `ac-bot2-${sfx}`,
  };
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  const store = () => new PostgresAppControlStore(prisma);
  const scope = (runId = "run1") => ({
    spaceId: ids.space,
    userId: ids.user,
    botId: ids.bot,
    runId,
  });
  const row = { snapshotId: "s1", appId: "app", surface: "window" as const, sensitive: false };

  beforeAll(async () => {
    const handle = createDb(url!);
    prisma = handle.prisma as unknown as PrismaClient;
    close = async () => {
      await handle.prisma.$disconnect();
    };
    await prisma.organization.create({
      data: { id: ids.org, name: "AC", slug: ids.org, createdAt: new Date() },
    });
    await prisma.user.create({
      data: { id: ids.user, name: "u", email: `${ids.user}@rakazo.test`, emailVerified: true },
    });
    for (const space of [ids.space, ids.otherSpace]) {
      await prisma.space.create({ data: { id: space, organizationId: ids.org, name: "s" } });
    }
    for (const bot of [ids.bot, ids.otherBot]) {
      await prisma.bot.create({
        data: { id: bot, spaceId: ids.space, userId: ids.user, name: "b", color: "#000" },
      });
    }
  });

  afterAll(async () => {
    await prisma.organization.delete({ where: { id: ids.org } }).catch(() => undefined);
    await close();
  });

  // Each contract case reuses the same ids, so start every case from an empty table.
  appControlStoreContract(
    "PostgresAppControlStore",
    async () => {
      await prisma.appControlSnapshot.deleteMany({
        where: { spaceId: { in: [ids.space, ids.otherSpace] } },
      });
      return store();
    },
    { space: ids.space, otherSpace: ids.otherSpace, user: ids.user, bot: ids.bot },
  );

  it("does not read or change another bot's rows", async () => {
    await prisma.appControlSnapshot.deleteMany({ where: { spaceId: ids.space } });
    await store().record(scope(), row);
    const other = { ...scope(), botId: ids.otherBot };
    expect(await store().get(other, "s1")).toBeUndefined();
    expect(await store().latest(other, "app")).toBeUndefined();
    await store().markSpent(other, "s1");
    await store().clearRun(other);
    expect(await store().get(scope(), "s1")).toMatchObject({ spent: false });
    expect(await store().get({ ...scope(), userId: "someone-else" }, "s1")).toBeUndefined();
  });

  it("deletes this bot's rows older than 24 hours when recording", async () => {
    await prisma.appControlSnapshot.deleteMany({ where: { spaceId: ids.space } });
    await store().record(scope("old"), row);
    await store().record({ ...scope("old"), botId: ids.otherBot }, row);
    await prisma.appControlSnapshot.updateMany({
      where: { spaceId: ids.space },
      data: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    });
    await store().record(scope("new"), row);
    expect(await store().get(scope("old"), "s1")).toBeUndefined();
    expect(await prisma.appControlSnapshot.count({ where: { botId: ids.otherBot } })).toBe(1);
  });
});
