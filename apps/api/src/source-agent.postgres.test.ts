import { createRouterClient } from "@orpc/server";
import { InstalledConnectorProvider } from "@rakazo/adapters";
import type { Actor, CapabilityInstall } from "@rakazo/contracts";
import { integrationAgentSpawnKey } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("sources have their own agent and access list (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const id = (name: string) => `sa-${name}-${suffix}`;
  const orgId = id("org");
  const spaceId = id("space");
  const userId = id("user");
  const otherUserId = id("other-user");
  const actor = (user: string): Actor => ({
    userId: user,
    spaceId,
    email: `${user}@rakazo.test`,
    isDeploymentOwner: false,
  });
  let prisma: PrismaClient;
  let close: () => Promise<void>;

  type Api = {
    capabilities: {
      list(): Promise<CapabilityInstall[]>;
      createAgent(i: { id: string }): Promise<{ botId: string }>;
      rename(i: { id: string; name: string }): Promise<CapabilityInstall>;
      setWrites(i: { id: string; enabled: boolean }): Promise<CapabilityInstall>;
      setExclusive(i: { id: string; exclusive: boolean }): Promise<CapabilityInstall>;
      setAllAgents(i: { id: string; on: boolean }): Promise<CapabilityInstall>;
      setAgentAccess(i: {
        id: string;
        botId: string;
        on: boolean;
        canWrite?: boolean;
      }): Promise<CapabilityInstall>;
    };
  };
  const api = (who = actor(userId)) =>
    createRouterClient(
      createRouter({ prisma, env: { mailWritesDisabled: false } } as unknown as RouterDeps),
      { context: { actor: who } as never },
    ) as unknown as Api;
  const makeBot = (name: string, extra: Record<string, unknown> = {}, user = userId) =>
    prisma.bot.create({
      data: { id: id(name), name, color: "#000", spaceId, userId: user, ...extra } as never,
    });
  const makeSource = (name: string, extra: Record<string, unknown> = {}, user = userId) =>
    prisma.capabilityInstall.create({
      data: {
        spaceId,
        userId: user,
        kind: "api",
        name,
        source: "https://api.example.test/v1",
        config: {
          auth: { type: "none" },
          operations: [
            { id: "list_contacts", method: "GET", path: "/contacts", readOnly: true },
            { id: "add_contact", method: "POST", path: "/contacts", readOnly: false },
          ],
        },
        ...extra,
      },
    });
  const toolsFor = async (botId: string | undefined, user = userId) =>
    (
      await new InstalledConnectorProvider(prisma, {} as never).discoverTools({
        spaceId,
        userId: user,
        botId,
        signal: new AbortController().signal,
      } as never)
    ).map((tool) => tool.name);
  const spawnedAgents = () =>
    prisma.bot.count({ where: { spaceId, spawnKey: { startsWith: "integration-agent:" } } });

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await db.prisma.$disconnect();
      await db.pool.end();
    };
    for (const user of [userId, otherUserId])
      await prisma.user.create({
        data: { id: user, name: user, email: `${user}@rakazo.test`, emailVerified: false },
      });
    await prisma.organization.create({
      data: { id: orgId, name: orgId, slug: orgId, createdAt: new Date() },
    });
    await prisma.space.create({
      data: { id: spaceId, organizationId: orgId, name: "General", isDefault: true },
    });
    for (const user of [userId, otherUserId])
      await prisma.member.create({
        data: {
          id: id(`member-${user}`),
          organizationId: orgId,
          userId: user,
          role: "member",
          createdAt: new Date(),
        },
      });
  });

  // Open sources of one test would show their tools to every bot of the next.
  beforeEach(async () => {
    await prisma.capabilityInstall.deleteMany({ where: { spaceId } });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.capabilityInstall.deleteMany({ where: { spaceId } });
    await prisma.bot.deleteMany({ where: { spaceId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await close();
  });

  it("backfills existing open sources with an agent once and leaves their use unbroken", async () => {
    const legacy = await makeSource("Legacy tools", {
      allAgents: true,
      agentShared: true,
      writesEnabled: true,
    });
    const bystander = await makeBot("bystander");
    expect(await toolsFor(bystander.id)).toEqual(["list_contacts", "add_contact"]);
    const before = await spawnedAgents();
    const listed = (await api().capabilities.list()).find((entry) => entry.id === legacy.id)!;
    expect(listed.agentBotId).toBeTruthy();
    expect(listed.allAgents).toBe(true);
    const after = await spawnedAgents();
    expect(after).toBe(before + 1);
    // A second run changes nothing: no second agent, same link, same use.
    const again = (await api().capabilities.list()).find((entry) => entry.id === legacy.id)!;
    expect(again.agentBotId).toBe(listed.agentBotId);
    expect(await spawnedAgents()).toBe(after);
    expect(await toolsFor(bystander.id)).toEqual(["list_contacts", "add_contact"]);
    expect(await toolsFor(listed.agentBotId as string)).toEqual(["list_contacts", "add_contact"]);
  });

  it("does not bring back an agent its owner archived", async () => {
    const source = await makeSource("Retired tools");
    const { botId } = await api().capabilities.createAgent({ id: source.id });
    await prisma.bot.update({ where: { id: botId }, data: { archivedAt: new Date() } });
    await prisma.capabilityInstall.update({ where: { id: source.id }, data: { agentBotId: null } });
    const before = await spawnedAgents();
    await api().capabilities.list();
    expect(await spawnedAgents()).toBe(before);
    expect(
      (await prisma.capabilityInstall.findUniqueOrThrow({ where: { id: source.id } })).agentBotId,
    ).toBeNull();
  });

  it("creates the agent once however often Create agent is pressed", async () => {
    const source = await makeSource("Pressed twice");
    const [first, second] = await Promise.all([
      api().capabilities.createAgent({ id: source.id }),
      api().capabilities.createAgent({ id: source.id }),
    ]);
    expect(second.botId).toBe(first.botId);
    const bot = await prisma.bot.findUniqueOrThrow({ where: { id: first.botId } });
    expect(bot.spawnKey).toBe(integrationAgentSpawnKey(source.id));
    expect(bot.name).toBe("Pressed twice agent");
  });

  it("starts a new source private and read-only, then follows the grants", async () => {
    const source = await makeSource("Private tools");
    const { botId: owner } = await api().capabilities.createAgent({ id: source.id });
    const friend = await makeBot("friend");
    const stranger = await makeBot("other-agent");
    // Private: the owner reads; changes are off; nobody else sees the source.
    expect(await toolsFor(owner)).toEqual(["list_contacts"]);
    expect(await toolsFor(friend.id)).toEqual([]);
    // Allow changes turns the owner's change tool on.
    await api().capabilities.setWrites({ id: source.id, enabled: true });
    expect(await toolsFor(owner)).toEqual(["list_contacts", "add_contact"]);
    // One grant: read only, then with Allow changes for that agent.
    await api().capabilities.setAgentAccess({ id: source.id, botId: friend.id, on: true });
    expect(await toolsFor(friend.id)).toEqual(["list_contacts"]);
    expect(await toolsFor(stranger.id)).toEqual([]);
    await api().capabilities.setAgentAccess({
      id: source.id,
      botId: friend.id,
      on: true,
      canWrite: true,
    });
    expect(await toolsFor(friend.id)).toEqual(["list_contacts", "add_contact"]);
    // All opens it to everyone; None closes it again; Only this agent drops the grants.
    await api().capabilities.setAllAgents({ id: source.id, on: true });
    expect(await toolsFor(stranger.id)).toEqual(["list_contacts", "add_contact"]);
    const none = await api().capabilities.setAllAgents({ id: source.id, on: false });
    expect(none.usableBotIds).toEqual([owner]);
    expect(await toolsFor(friend.id)).toEqual([]);
    await api().capabilities.setAgentAccess({ id: source.id, botId: friend.id, on: true });
    await api().capabilities.setExclusive({ id: source.id, exclusive: true });
    expect(await toolsFor(friend.id)).toEqual([]);
    // The owner switching changes off removes the change tool for every agent.
    await api().capabilities.setWrites({ id: source.id, enabled: false });
    expect(await toolsFor(owner)).toEqual(["list_contacts"]);
  });

  it("turning one agent off under All keeps the rest on", async () => {
    const source = await makeSource("All but one");
    await api().capabilities.createAgent({ id: source.id });
    const a = await makeBot("all-a");
    const b = await makeBot("all-b");
    await api().capabilities.setAllAgents({ id: source.id, on: true });
    const next = await api().capabilities.setAgentAccess({ id: source.id, botId: a.id, on: false });
    expect(next.allAgents).toBe(false);
    expect(await toolsFor(a.id)).toEqual([]);
    expect(await toolsFor(b.id)).toEqual(["list_contacts"]);
  });

  it("gives a firewalled or external agent nothing, even from All or a grant", async () => {
    const source = await makeSource("Firewalled out", { allAgents: true, writesEnabled: true });
    const { botId: owner } = await api().capabilities.createAgent({ id: source.id });
    const walled = await makeBot("walled", { firewall: true });
    const external = await makeBot("outsider", { audience: "external" });
    await prisma.botSourceAccess.createMany({
      data: [walled.id, external.id].map((botId) => ({
        installId: source.id,
        botId,
        spaceId,
        userId,
        canWrite: true,
      })),
    });
    expect(await toolsFor(walled.id)).toEqual([]);
    expect(await toolsFor(external.id)).toEqual([]);
    expect(await toolsFor(owner)).toEqual(["list_contacts", "add_contact"]);
    await expect(
      api().capabilities.setAgentAccess({ id: source.id, botId: walled.id, on: true }),
    ).rejects.toThrow();
  });

  it("refuses another user's source, agent and tools", async () => {
    const mine = await makeSource("Mine only");
    const { botId } = await api().capabilities.createAgent({ id: mine.id });
    const stranger = actor(otherUserId);
    await expect(api(stranger).capabilities.createAgent({ id: mine.id })).rejects.toThrow();
    await expect(
      api(stranger).capabilities.setWrites({ id: mine.id, enabled: true }),
    ).rejects.toThrow();
    const theirBot = await makeBot("their-bot", {}, otherUserId);
    await expect(
      api().capabilities.setAgentAccess({ id: mine.id, botId: theirBot.id, on: true }),
    ).rejects.toThrow();
    expect((await api(stranger).capabilities.list()).map((entry) => entry.id)).not.toContain(
      mine.id,
    );
    // Another user's bot (even holding the owner's id) reaches nothing; neither does a run with no bot.
    expect(await toolsFor(botId, otherUserId)).toEqual([]);
    expect(await toolsFor(theirBot.id)).toEqual([]);
    expect(await toolsFor(undefined)).toEqual([]);
  });

  it("renames the source and its agent together", async () => {
    const source = await makeSource("Old name");
    const { botId } = await api().capabilities.createAgent({ id: source.id });
    const renamed = await api().capabilities.rename({ id: source.id, name: "New name" });
    expect(renamed.name).toBe("New name");
    expect((await prisma.bot.findUniqueOrThrow({ where: { id: botId } })).name).toBe(
      "New name agent",
    );
  });

  it("backfills a source even when more than ten retired ones come first", async () => {
    for (let n = 0; n < 11; n += 1) {
      const retired = await makeSource(`Retired ${n}`);
      await prisma.bot.create({
        data: {
          id: id(`retired-${n}`),
          name: "old",
          color: "#000",
          spaceId,
          userId,
          spawnKey: integrationAgentSpawnKey(retired.id),
          archivedAt: new Date(),
        } as never,
      });
    }
    const live = await makeSource("Needs an agent");
    const listed = (await api().capabilities.list()).find((entry) => entry.id === live.id)!;
    expect(listed.agentBotId).toBeTruthy();
  });

  it("keeps the agent's name in step with a rename and archives it on remove", async () => {
    const source = await makeSource("Before");
    const { botId } = await api().capabilities.createAgent({ id: source.id });
    await api().capabilities.rename({ id: source.id, name: "After" });
    expect((await prisma.bot.findUniqueOrThrow({ where: { id: botId } })).name).toBe("After agent");
    await api().capabilities.setWrites({ id: source.id, enabled: true });
    await expect(
      Promise.all([
        api().capabilities.rename({ id: source.id, name: "Third" }),
        api().capabilities.setWrites({ id: source.id, enabled: false }),
      ]),
    ).resolves.toBeDefined();
  });
});
