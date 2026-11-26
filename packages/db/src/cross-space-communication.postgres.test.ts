import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import { crossSpaceCommunicationAllowed } from "./cross-space-communication.js";
import { runAsSystem, runAsTenant } from "./row-security.js";

// Needs DATABASE_URL as the runtime login and DATABASE_MIGRATION_URL as the owner.
const runtimeUrl = process.env.DATABASE_URL;
const ownerUrl = process.env.DATABASE_MIGRATION_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && runtimeUrl && ownerUrl && runtimeUrl !== ownerUrl
    ? describe.sequential
    : describe.skip;

describePostgres("cross-space bot communication under row-level security (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const org = `csc-org-${suffix}`;
  const spaces = ["a", "b"].map((n) => ({
    user: `csc-user-${n}-${suffix}`,
    space: `csc-space-${n}-${suffix}`,
    bot: `csc-bot-${n}-${suffix}`,
  })) as [
    { user: string; space: string; bot: string },
    { user: string; space: string; bot: string },
  ];
  let owner: ReturnType<typeof createDb>;
  let app: ReturnType<typeof createDb>;
  const prisma = () => app.prisma as unknown as PrismaClient;

  beforeAll(() => runAsSystem("test fixture", seed));
  async function seed() {
    owner = createDb(ownerUrl!);
    app = createDb(runtimeUrl!);
    await owner.prisma.organization.create({
      data: { id: org, name: "Csc", slug: org, createdAt: new Date() },
    });
    for (const s of spaces) {
      await owner.prisma.user.create({
        data: { id: s.user, name: s.user, email: `${s.user}@example.test`, emailVerified: true },
      });
      await owner.prisma.space.create({
        data: { id: s.space, organizationId: org, name: "S" },
      });
      await owner.prisma.bot.create({
        data: {
          id: s.bot,
          spaceId: s.space,
          userId: s.user,
          name: "Bot",
          color: "blue",
          crossSpaceCommunication: true,
        },
      });
    }
  }
  afterAll(() => runAsSystem("test cleanup", cleanup));
  async function cleanup() {
    await owner.prisma.organization.deleteMany({ where: { id: org } });
    for (const s of spaces) await owner.prisma.user.deleteMany({ where: { id: s.user } });
    await owner.prisma.$disconnect();
    await owner.pool.end();
    await app.prisma.$disconnect();
    await app.pool.end();
  }

  const [a, b] = spaces;
  const check = () => crossSpaceCommunicationAllowed(prisma(), a.bot, b.bot);

  it("allows two opted-in bots in different spaces when run as system", async () => {
    expect(await runAsSystem("cross-space test", check)).toBe(true);
  });

  it("cannot see the other space's bot as a caller of one space, so it refuses", async () => {
    expect(await runAsTenant({ spaceId: a.space, userId: a.user }, check)).toBe(false);
  });

  it("refuses when either bot has not opted in", async () => {
    await owner.prisma.bot.update({
      where: { id: b.bot },
      data: { crossSpaceCommunication: false },
    });
    expect(await runAsSystem("cross-space test", check)).toBe(false);
  });
});
