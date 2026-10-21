import { readFileSync } from "node:fs";
import { DEVIN_MCP_ENDPOINT, devinSessionUrl } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { refreshDevinConnection } from "./devin-refresh.js";

// Every fixture is synthetic: invented data in the documented format (issue #516 replaces them).
const fixture = (name: string) =>
  readFileSync(new URL(`./__fixtures__/devin/${name}`, import.meta.url), "utf8");

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("refreshDevinConnection (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const org = `dv-org-${suffix}`;
  const spaceId = `dv-space-${suffix}`;
  const userId = `dv-user-${suffix}`;
  const serverId = `dv-srv-${suffix}`;
  let prisma: PrismaClient;
  let close: () => Promise<void>;

  /** A fake Devin that counts calls; `gate` holds the first search call until released. */
  function devin(gate?: Promise<void>, onFirstCall?: () => void) {
    const calls: string[] = [];
    const callTool = vi.fn(async (_id: string, name: string, args: Record<string, unknown>) => {
      calls.push(name);
      if (name === "devin_session_search") {
        onFirstCall?.();
        await gate;
        return fixture(args.after ? "search-page-2.txt" : "search-page-1.txt");
      }
      return fixture("messages-waiting.txt");
    });
    return {
      callTool,
      searches: () => calls.filter((name) => name === "devin_session_search").length,
      messages: () => calls.filter((name) => name === "devin_session_interact").length,
    };
  }
  const refresh = (fake: ReturnType<typeof devin>) =>
    refreshDevinConnection({ prisma, callTool: fake.callTool }, serverId);

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.create({
      data: { id: userId, name: userId, email: `${userId}@example.test` },
    });
    await prisma.organization.create({
      data: { id: org, name: "Devin Org", slug: org, createdAt: new Date() },
    });
    await prisma.space.create({ data: { id: spaceId, organizationId: org, name: spaceId } });
    await prisma.member.create({
      data: {
        id: `m-${suffix}`,
        organizationId: org,
        userId,
        role: "owner",
        createdAt: new Date(),
      },
    });
    await prisma.spaceMember.create({
      data: {
        id: `sm-${suffix}`,
        spaceId,
        userId,
        organizationId: org,
        role: "owner",
        createdAt: new Date(),
      },
    });
    await prisma.mcpServer.create({
      data: {
        id: serverId,
        spaceId,
        userId,
        slug: "devin",
        name: "Devin",
        transport: "http",
        endpoint: DEVIN_MCP_ENDPOINT,
      },
    });
    await prisma.devinConnectionState.create({ data: { serverId, spaceId } });
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: org } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await close();
  });

  it("overlapping refreshes run one listing, a late holder cannot commit, and an unchanged waiting session fetches no messages", async () => {
    // Two overlapping refreshes: one wins the lease, the loser reads and writes nothing.
    let release = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const first = devin(gate);
    const second = devin();
    const winner = refresh(first);
    await vi.waitFor(() => expect(first.searches()).toBe(1));
    expect(await refresh(second)).toBe("busy");
    expect(second.callTool).not.toHaveBeenCalled();
    release();
    expect(await winner).toBe("refreshed");
    // One listing: the fixture has two pages. The first refresh baselines the waiting session.
    expect(first.searches()).toBe(2);
    expect(first.messages()).toBe(1);
    expect(await prisma.devinSession.count({ where: { serverId } })).toBe(5);
    expect(
      await prisma.devinSession.findUnique({
        where: { serverId_sessionId: { serverId, sessionId: "devin-0001" } },
      }),
    ).toMatchObject({ lastMessageId: "ev-103", notifiedMessageId: "ev-103", spaceId });

    // A holder whose lease expired and was taken over cannot commit late.
    let releaseLate = () => {};
    const lateGate = new Promise<void>((resolve) => {
      releaseLate = resolve;
    });
    const late = devin(lateGate);
    const lateRun = refresh(late);
    await vi.waitFor(() => expect(late.searches()).toBe(1));
    await prisma.devinConnectionState.update({
      where: { serverId },
      data: { leaseUntil: new Date(Date.now() - 1000) },
    });
    const takeover = devin();
    expect(await refresh(takeover)).toBe("refreshed");
    await prisma.devinSession.updateMany({ where: { serverId }, data: { title: "from takeover" } });
    releaseLate();
    expect(await lateRun).toBe("discarded");
    expect(await prisma.devinSession.count({ where: { serverId, title: "from takeover" } })).toBe(
      5,
    );
    expect(
      (await prisma.devinConnectionState.findUniqueOrThrow({ where: { serverId } })).leaseToken,
    ).toBeNull();

    // An unchanged waiting session fetches no messages on later runs.
    expect(takeover.messages()).toBe(0);
    const again = devin();
    expect(await refresh(again)).toBe("refreshed");
    expect(again.messages()).toBe(0);
  });

  it("discards results when the server revision changes during the run and keeps rows of other servers out", async () => {
    await prisma.devinSession.deleteMany({ where: { serverId } });
    await prisma.devinConnectionState.update({
      where: { serverId },
      data: { lastSucceededAt: null },
    });
    const fake = devin();
    const callTool = vi.fn(async (...args: Parameters<typeof fake.callTool>) => {
      await prisma.mcpServer.update({
        where: { id: serverId },
        data: { revision: { increment: 1 } },
      });
      return fake.callTool(...args);
    });
    expect(await refreshDevinConnection({ prisma, callTool }, serverId)).toBe("discarded");
    expect(await prisma.devinSession.count({ where: { serverId } })).toBe(0);
    const state = await prisma.devinConnectionState.findUniqueOrThrow({ where: { serverId } });
    expect(state.lastSucceededAt).toBeNull();
    expect(state.leaseToken).toBeNull();
  });

  it("deletes a row unseen for 7 days after a complete listing and keeps one unseen for 1 day", async () => {
    const day = 24 * 60 * 60_000;
    const row = (sessionId: string, daysAgo: number) => ({
      serverId,
      spaceId,
      sessionId,
      title: sessionId,
      status: "finished",
      kind: "finished",
      origin: "api",
      devinUpdatedAt: new Date(),
      lastSeenAt: new Date(Date.now() - daysAgo * day),
    });
    await prisma.devinSession.createMany({ data: [row("old-week", 8), row("old-day", 1)] });
    expect(await refresh(devin())).toBe("refreshed");
    const ids = (await prisma.devinSession.findMany({ where: { serverId } })).map(
      (session) => session.sessionId,
    );
    expect(ids).toContain("old-day");
    expect(ids).not.toContain("old-week");
  });

  it("an unchanged waiting session never alerts, a new question alerts once with the session link, a session created and blocked between two refreshes alerts once, and a crash before recording does not alert twice", async () => {
    const errors = JSON.parse(fixture("errors.json")) as Record<string, string>;
    const reset = async () => {
      await prisma.devinSession.deleteMany({ where: { serverId } });
      await prisma.notification.deleteMany({ where: { spaceId } });
      await prisma.devinConnectionState.update({
        where: { serverId },
        data: { lastSucceededAt: null, backoffUntil: null, rejectedAt: null, lastError: null },
      });
    };
    const alerts = (extra: Record<string, unknown> = {}) =>
      prisma.notification.findMany({ where: { spaceId, ...extra }, orderBy: { createdAt: "asc" } });
    const line = (id: string, status: string, updated: number) =>
      `- id=${id} title="Session ${id}" status=${status} created_at=1759000000 updated_at=${updated} origin=api\n`;
    const message = (eventId: string, body: string) =>
      `- event_id=${eventId} source=devin created_at=1 body="${body}"\n`;
    const notify = vi.fn(async () => {});
    let listing = "";
    let reply = () => message("ev-1", "First question?");
    const reads: string[] = [];
    const callTool = vi.fn(async (_id: string, name: string, args: Record<string, unknown>) => {
      if (name === "devin_session_search") return listing;
      reads.push(String(args.session_id));
      return reply();
    });
    const run = () =>
      refreshDevinConnection(
        { prisma, callTool, notificationEvents: { notify } as never },
        serverId,
      );
    const bump = (minutes: number) =>
      prisma.devinConnectionState.update({
        where: { serverId },
        data: { lastSucceededAt: new Date(Date.now() - minutes * 60_000) },
      });

    // The first successful refresh alerts for nothing, even with a session already waiting.
    await reset();
    listing = line("a-1", "running", 100) + line("w-0", "blocked", 100);
    expect(await run()).toBe("refreshed");
    expect(await alerts()).toHaveLength(0);

    // A session turning to waiting alerts once, and two unchanged runs add nothing.
    listing = line("a-1", "blocked", 200) + line("w-0", "blocked", 100);
    expect(await run()).toBe("refreshed");
    expect(await run()).toBe("refreshed");
    expect(await run()).toBe("refreshed");
    const [first] = await alerts();
    expect(await alerts()).toHaveLength(1);
    expect(first).toMatchObject({
      userId,
      spaceId,
      surface: "devin",
      title: "Devin needs input",
      body: "Session a-1: First question?",
      link: devinSessionUrl("a-1"),
      kind: "needs_input",
      importance: "attention",
    });
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(
      { spaceId, userId },
      { id: first?.id, surface: "devin", importance: "attention" },
    );

    // A genuinely new message alerts again; a session created and blocked in between alerts once.
    reply = () => message("ev-2", "Second question?");
    listing =
      line("a-1", "blocked", 300) + line("b-1", "blocked", 300) + line("w-0", "blocked", 100);
    await run();
    await run();
    expect((await alerts()).map((n) => n.body)).toEqual([
      "Session a-1: First question?",
      "Session a-1: Second question?",
      "Session b-1: Second question?",
    ]);

    // Working again, then asking again, alerts again.
    listing = line("a-1", "running", 400) + line("b-1", "blocked", 300);
    await run();
    reply = () => message("ev-3", "Third question?");
    listing = line("a-1", "blocked", 500) + line("b-1", "blocked", 300);
    await run();
    expect(await alerts()).toHaveLength(4);

    // A failed read at the transition alerts with the fallback text; the later read adds no alert.
    reply = () => {
      throw new Error(errors["403"]);
    };
    listing = line("d-1", "blocked", 600) + line("b-1", "blocked", 300);
    await run();
    expect((await alerts()).at(-1)?.body).toBe("Session d-1 is waiting for your answer.");
    reply = () => message("ev-9", "Why?");
    await run();
    expect(await alerts()).toHaveLength(5);
    expect(
      await prisma.devinSession.findUnique({
        where: { serverId_sessionId: { serverId, sessionId: "d-1" } },
      }),
    ).toMatchObject({ lastMessageId: "ev-9", notifiedMessageId: "ev-9", question: "Why?" });

    // A crash after the notification was stored and before it was recorded alerts once.
    let crashed = false;
    const crashing = new Proxy(prisma, {
      get(target, key, receiver) {
        const value = Reflect.get(target, key, receiver);
        if (key !== "devinSession") return value;
        return new Proxy(value, {
          get(model, method, modelReceiver) {
            if (method === "updateMany" && !crashed) {
              crashed = true;
              return async () => {
                throw new Error("simulated crash");
              };
            }
            return Reflect.get(model, method, modelReceiver);
          },
        });
      },
    });
    reply = () => message("ev-20", "Crash?");
    listing =
      line("c-1", "blocked", 700) + line("b-1", "blocked", 300) + line("d-1", "blocked", 600);
    await refreshDevinConnection({ prisma: crashing, callTool }, serverId).catch(() => undefined);
    expect(crashed).toBe(true);
    await run();
    expect(await alerts({ body: { startsWith: "Session c-1" } })).toHaveLength(1);
    expect(
      (
        await prisma.devinSession.findUniqueOrThrow({
          where: { serverId_sessionId: { serverId, sessionId: "c-1" } },
        })
      ).notifiedMessageId,
    ).toBe("ev-20");

    // Help alerts switched off create nothing.
    await prisma.notificationPreference.create({ data: { spaceId, userId, help: false } });
    listing += line("e-1", "blocked", 800);
    await run();
    expect(await alerts({ body: { startsWith: "Session e-1" } })).toHaveLength(0);
    await prisma.notificationPreference.deleteMany({ where: { spaceId, userId } });

    // The first refresh after a key replacement is silent again.
    const before = (await alerts()).length;
    await prisma.devinSession.deleteMany({ where: { serverId } });
    await prisma.devinConnectionState.update({
      where: { serverId },
      data: { lastSucceededAt: null },
    });
    await run();
    expect(await alerts()).toHaveLength(before);

    // A connector who left the space is alerted nobody.
    await bump(5);
    const member = await prisma.spaceMember.findFirstOrThrow({ where: { spaceId, userId } });
    await prisma.spaceMember.delete({ where: { id: member.id } });
    listing += line("f-1", "blocked", 900);
    expect(await run()).toBe("connector_gone");
    expect(await alerts()).toHaveLength(before);
    await prisma.spaceMember.create({ data: { ...member } });
    await prisma.devinConnectionState.update({ where: { serverId }, data: { lastError: null } });
  });
});
