import { inboxAgentSpawnKey } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb, createRepos } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { upgradeBuiltInAgentInstructions } from "./agent-instruction-upgrades.js";
import { PAST_DEFAULTS } from "./agent-past-defaults.fixture.js";
import { INBOX_AGENT_INSTRUCTIONS } from "./inbox-agent.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("upgradeBuiltInAgentInstructions (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const id = (name: string) => `agent-upgrade-${name}-${suffix}`;
  const orgId = id("org");
  const spaces = [id("space-1"), id("space-2")];
  const users = ["old", "edited", "archived", "other"].map(id);
  const [oldUser, editedUser, archivedUser, otherSpaceUser] = users as [
    string,
    string,
    string,
    string,
  ];
  const previous = PAST_DEFAULTS.inbox![0] as string;
  const edited = `${INBOX_AGENT_INSTRUCTIONS} Always answer in French.`;

  let prisma: PrismaClient;
  let close: () => Promise<void>;
  const instructionsOf = async (userId: string) =>
    (await prisma.bot.findFirstOrThrow({ where: { spawnKey: inboxAgentSpawnKey(userId) } }))
      .instructions;

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await db.prisma.$disconnect();
      await db.pool.end();
    };
    const repos = createRepos(prisma);
    for (const userId of users) {
      await prisma.user.create({
        data: { id: userId, name: userId, email: `${userId}@rakazo.test`, emailVerified: false },
      });
    }
    await prisma.organization.create({
      data: { id: orgId, name: orgId, slug: orgId, createdAt: new Date() },
    });
    for (const [index, spaceId] of spaces.entries()) {
      await prisma.space.create({
        data: { id: spaceId, organizationId: orgId, name: `S${index}`, isDefault: index === 0 },
      });
    }
    const spaceOf = (userId: string) => spaces[userId === otherSpaceUser ? 1 : 0] as string;
    for (const userId of users) {
      await prisma.member.create({
        data: {
          id: id(`m-${userId}`),
          organizationId: orgId,
          userId,
          role: "member",
          createdAt: new Date(),
        },
      });
      await prisma.spaceMember.createMany({
        skipDuplicates: true, // the default space adds org members itself
        data: [
          {
            id: id(`sm-${userId}`),
            spaceId: spaceOf(userId),
            organizationId: orgId,
            userId,
            role: "member",
            createdAt: new Date(),
          },
        ],
      });
    }
    const make = (userId: string, spaceIndex: number, instructions: string) =>
      repos.createBot(
        {
          userId,
          spaceId: spaces[spaceIndex] as string,
          email: `${userId}@rakazo.test`,
          isDeploymentOwner: false,
        },
        {
          spawnKey: inboxAgentSpawnKey(userId),
          name: "Inbox agent",
          title: "",
          description: "",
          instructions,
          notifyOnFinish: true,
        },
      );
    await make(oldUser, 0, previous);
    await make(editedUser, 0, edited);
    const archived = await make(archivedUser, 0, previous);
    await prisma.bot.update({ where: { id: archived.id }, data: { archivedAt: new Date() } });
    await make(otherSpaceUser, 1, previous);
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.bot.deleteMany({ where: { spaceId: { in: spaces } } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await close();
  });

  it("upgrades unedited agents in every space, leaves edited and archived ones, and is idempotent", async () => {
    const first = await upgradeBuiltInAgentInstructions(prisma);
    expect(first.inbox).toBeGreaterThanOrEqual(2);
    expect(await instructionsOf(oldUser)).toBe(INBOX_AGENT_INSTRUCTIONS);
    expect(await instructionsOf(otherSpaceUser)).toBe(INBOX_AGENT_INSTRUCTIONS);
    expect(await instructionsOf(editedUser)).toBe(edited);
    expect(await instructionsOf(archivedUser)).toBe(previous);
    const second = await upgradeBuiltInAgentInstructions(prisma);
    expect(second.inbox).toBe(0);
  });
});
