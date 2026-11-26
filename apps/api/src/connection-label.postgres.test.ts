import { createRouterClient } from "@orpc/server";
import type { Actor } from "@rakazo/contracts";
import { createDb, runAsSystem, runAsTenant } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

const runtimeUrl = process.env.DATABASE_URL;
const ownerUrl = process.env.DATABASE_MIGRATION_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && runtimeUrl && ownerUrl && runtimeUrl !== ownerUrl
    ? describe.sequential
    : describe.skip;

describePostgres("a firewalled agent's support label (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const id = (name: string) => `lbl-${name}-${suffix}`;
  const orgId = id("org");
  const spaceId = id("space");
  const userId = id("user");
  const otherUserId = id("other");
  const actor: Actor = {
    userId,
    spaceId,
    email: `${userId}@example.test`,
    isDeploymentOwner: false,
  };
  let admin: ReturnType<typeof createDb>;
  let app: ReturnType<typeof createDb>;

  type Access = { botIds: string[]; supportLabels: Record<string, string> };
  const api = (who: Actor = actor) =>
    createRouterClient(
      createRouter({
        prisma: app.prisma,
        env: { mailWritesDisabled: false },
      } as unknown as RouterDeps),
      { context: { actor: who } as never },
    ).connections as unknown as {
      access(i: { connectionId: string }): Promise<Access>;
      accessAll(): Promise<Record<string, Access>>;
      setAgentAccess(i: {
        connectionId: string;
        botId: string;
        on: boolean;
        supportLabel?: string | null;
      }): Promise<Access>;
    };
  /** Every API call runs as its caller's tenant, so row-level security applies too. */
  const as = <T>(fn: () => Promise<T>) =>
    runAsTenant({ spaceId: actor.spaceId, userId: actor.userId }, fn);

  const connection = (extra: Record<string, unknown> = {}, who = userId) =>
    admin.prisma.connection.create({
      data: {
        spaceId,
        userId: who,
        connectorId: "google",
        provider: "gmail",
        providerRef: `acct-${Math.random()}`,
        displayName: "Gmail",
        status: "connected",
        ...extra,
      } as never,
    });
  const storedLabel = (connectionId: string, botId: string) =>
    runAsSystem("label read", () =>
      admin.prisma.botConnectionAccess
        .findFirst({ where: { connectionId, botId }, select: { supportLabel: true } })
        .then((row) => row?.supportLabel ?? null),
    );

  let firewallBot = "";
  let plainBot = "";
  let mail = "";
  let slack = "";

  beforeAll(() =>
    runAsSystem("label fixture", async () => {
      admin = createDb(ownerUrl as string);
      app = createDb(runtimeUrl as string);
      for (const user of [userId, otherUserId])
        await admin.prisma.user.create({
          data: { id: user, name: user, email: `${user}@example.test`, emailVerified: false },
        });
      await admin.prisma.organization.create({
        data: { id: orgId, name: orgId, slug: orgId, createdAt: new Date() },
      });
      await admin.prisma.space.create({ data: { id: spaceId, organizationId: orgId, name: "S" } });
      for (const user of [userId, otherUserId])
        await admin.prisma.member.create({
          data: {
            id: id(`m-${user}`),
            organizationId: orgId,
            userId: user,
            role: "member",
            createdAt: new Date(),
          },
        });
      const makeBot = async (name: string, firewall: boolean) => {
        const bot = await admin.prisma.bot.create({
          data: { id: id(name), name, color: "#000", spaceId, userId, firewall },
        });
        await admin.prisma.thread.create({ data: { spaceId, userId, botId: bot.id } });
        return bot.id;
      };
      firewallBot = await makeBot("supported", true);
      plainBot = await makeBot("plain", false);
      mail = (await connection()).id;
      slack = (await connection({ connectorId: "composio", provider: "slack" })).id;
    }),
  );

  afterAll(() =>
    runAsSystem("label cleanup", async () => {
      await admin.prisma.connection.deleteMany({ where: { spaceId } });
      await admin.prisma.bot.deleteMany({ where: { spaceId } });
      await admin.prisma.organization.deleteMany({ where: { id: orgId } });
      await admin.prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
      await admin.prisma.$disconnect();
      await admin.pool.end();
      await app.prisma.$disconnect();
      await app.pool.end();
    }),
  );

  const setLabel = (
    connectionId: string,
    botId: string,
    on: boolean,
    supportLabel?: string | null,
  ) =>
    as(() =>
      api().setAgentAccess({
        connectionId,
        botId,
        on,
        ...(supportLabel !== undefined ? { supportLabel } : {}),
      }),
    );

  it("stores, keeps and clears the label on the caller's own grant", async () => {
    const saved = await setLabel(mail, firewallBot, true, "Support");
    expect(saved.supportLabels[firewallBot]).toBe("Support");
    expect(await storedLabel(mail, firewallBot)).toBe("Support");

    // Omitting it keeps the stored label; turning the agent on again does not clear it.
    const kept = await setLabel(mail, firewallBot, true);
    expect(kept.supportLabels[firewallBot]).toBe("Support");
    expect(await storedLabel(mail, firewallBot)).toBe("Support");
    expect((await as(() => api().accessAll()))[mail]?.supportLabels[firewallBot]).toBe("Support");
    expect((await as(() => api().access({ connectionId: mail }))).supportLabels[firewallBot]).toBe(
      "Support",
    );

    // Null clears it.
    const cleared = await setLabel(mail, firewallBot, true, null);
    expect(cleared.supportLabels[firewallBot]).toBeUndefined();
    expect(await storedLabel(mail, firewallBot)).toBeNull();
  });

  it("refuses a label on an agent without the firewall, or on a connection that is not mail", async () => {
    const plain = await setLabel(mail, plainBot, true, "Support").catch(
      (reason: unknown) => reason as Error,
    );
    expect(plain?.message).toContain("firewalled");
    const other = await setLabel(slack, firewallBot, true, "Support").catch(
      (reason: unknown) => reason as Error,
    );
    expect(other?.message).toContain("mail");
    expect(await storedLabel(mail, plainBot)).toBeNull();
  });

  it("labels only the connection it edits, not its grouped siblings", async () => {
    const sibling = (await connection()).id;
    await setLabel(mail, firewallBot, true, "Support");
    await setLabel(sibling, firewallBot, true, "Support");

    // Clearing one mailbox's scope leaves the other mailbox's scope alone.
    await setLabel(mail, firewallBot, true, null);
    expect(await storedLabel(mail, firewallBot)).toBeNull();
    expect(await storedLabel(sibling, firewallBot)).toBe("Support");

    // Setting a label on one mailbox does not write it on the other.
    await setLabel(mail, firewallBot, true, "Billing");
    expect(await storedLabel(mail, firewallBot)).toBe("Billing");
    expect(await storedLabel(sibling, firewallBot)).toBe("Support");
  });

  it("refuses a label on a connection that belongs to another user", async () => {
    const theirs = await connection({}, otherUserId);
    const error = await setLabel(theirs.id, firewallBot, true, "Support").catch(
      (reason: unknown) => reason as Error,
    );
    expect(error).toBeDefined();
    expect(await storedLabel(theirs.id, firewallBot)).toBeNull();
  });
});
