import type { BackgroundJob, JobPublisher, MeetingSource, SecretStore } from "@rakazo/adapter-kit";
import { MeetingSourceError } from "@rakazo/adapter-kit";
import type { SourceMeeting } from "@rakazo/contracts";
import type { MeetingSourceRef, PrismaClient } from "@rakazo/db";
import { createDb, deleteMeeting } from "@rakazo/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { GranolaApiEmulator } from "./granola-api-emulator.js";
import { createMeetingSourceRegistry } from "./meeting-source-registry.js";
import type { MeetingSourceRegistry } from "./meeting-sync-job.js";
import {
  reconcileMeetingSyncs,
  requestMeetingSync,
  runMeetingSyncJob,
} from "./meeting-sync-job.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const DAY = 86_400_000;
const daysAgo = (days: number) => new Date(Date.now() - days * DAY).toISOString();
const meeting = (id: string, startedDaysAgo: number, updatedDaysAgo = startedDaysAgo) =>
  ({
    externalId: id,
    title: `Meeting ${id}`,
    startedAt: daysAgo(startedDaysAgo),
    endedAt: null,
    attendees: [],
    organizerEmail: null,
    sourceUrl: null,
    folders: [],
    summary: `Summary ${id}`,
    privateNotes: "",
    transcript: [{ speaker: "Ada", text: `Words in ${id}` }],
    updatedAt: daysAgo(updatedDaysAgo),
  }) satisfies SourceMeeting;

/** Mutable in-memory source: list order is oldest update first, paged, and records every call. */
class TestSource implements MeetingSource {
  provider = "granola";
  meetings: SourceMeeting[] = [];
  listCalls: Array<{ cursor?: string; updatedAfter?: Date; createdAfter?: Date }> = [];
  getCalls: string[] = [];
  /** Throws on the n-th list call (1-based) once. */
  failListAt: { call: number; error: Error } | undefined;
  failAll: Error | undefined;
  gate: Promise<void> | undefined;
  beforeList: (() => Promise<void>) | undefined;
  beforeGet: ((id: string) => Promise<void>) | undefined;
  pageSize = 2;
  /** A provider owes no order; this one lists by id, so an edited meeting keeps its place. */
  sortById = false;
  async list(filter: { updatedAfter?: Date; createdAfter?: Date; cursor?: string }) {
    this.listCalls.push(filter);
    if (this.gate) await this.gate;
    await this.beforeList?.();
    if (this.failAll) throw this.failAll;
    if (this.failListAt?.call === this.listCalls.length) {
      const { error } = this.failListAt;
      this.failListAt = undefined;
      throw error;
    }
    const matching = this.meetings
      .filter(
        (m) =>
          (!filter.updatedAfter || new Date(m.updatedAt) > filter.updatedAfter) &&
          (!filter.createdAfter || new Date(m.startedAt) >= filter.createdAfter),
      )
      .sort((a, b) =>
        this.sortById
          ? a.externalId.localeCompare(b.externalId)
          : Date.parse(a.updatedAt) - Date.parse(b.updatedAt),
      );
    const start = Number(filter.cursor ?? 0);
    const next = start + this.pageSize;
    return {
      items: matching
        .slice(start, next)
        .map((m) => ({ externalId: m.externalId, updatedAt: m.updatedAt })),
      ...(next < matching.length ? { nextCursor: String(next) } : {}),
    };
  }
  async get(externalId: string) {
    this.getCalls.push(externalId);
    await this.beforeGet?.(externalId);
    const found = this.meetings.find((m) => m.externalId === externalId);
    if (!found) throw new MeetingSourceError("not_found", "No such meeting");
    return found;
  }
}

describePostgres("meetings.sync job (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const userId = `ms-user-${suffix}`;
  const otherUserId = `ms-other-${suffix}`;
  const spaceId = `ms-space-${suffix}`;
  const organizationId = `ms-org-${suffix}`;
  const scope = { spaceId, userId };
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let source: TestSource;
  let enqueued: BackgroundJob[] = [];
  let created = 0;
  const loaded: string[] = [];
  const jobs: JobPublisher = {
    enqueue: async (job) => {
      enqueued.push(job);
    },
    cancel: async () => {},
    close: async () => {},
  };
  // The stored "ciphertext" is the key itself.
  const secrets = {
    load: async (ref: string) => {
      loaded.push(ref);
      return ref;
    },
  } as unknown as SecretStore;
  const registry = (): MeetingSourceRegistry => ({
    granola: { connectorId: "granola-api", create: () => source },
    wispr: { create: () => source },
  });
  const deps = (pagesPerRun = 2) => ({
    prisma,
    jobs,
    secrets,
    registry: registry(),
    pagesPerRun,
  });

  async function connect(owner = scope, status = "connected") {
    const secret = await prisma.secret.create({
      data: { ...owner, kind: "api-key", ciphertext: `grn_key_${++created}` },
    });
    const row = await prisma.connection.create({
      data: {
        ...owner,
        connectorId: "granola-api",
        provider: "granola",
        displayName: "Granola",
        status,
        secretId: secret.id,
      },
    });
    return {
      connectionId: row.id,
      payload: { ...owner, provider: "granola", connectionId: row.id },
    };
  }
  const state = (ref: MeetingSourceRef) =>
    prisma.meetingSyncState.findUniqueOrThrow({
      where:
        "connectionId" in ref
          ? { connectionId: ref.connectionId }
          : { mcpServerId: ref.mcpServerId },
    });
  /** Makes the last sync old enough to pass the minimum interval and the scheduler's idle test. */
  const age = (id: string) =>
    prisma.$executeRaw`UPDATE meeting_sync_states SET "lastSyncedAt" = now() - interval '10 minutes', "updatedAt" = now() - interval '10 minutes' WHERE "connectionId" = ${id} OR "mcpServerId" = ${id}`;
  const stored = (provider = "granola") =>
    prisma.meeting.findMany({ where: { ...scope, provider }, orderBy: { externalId: "asc" } });

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await db.prisma.$disconnect();
      await db.pool.end();
    };
    for (const id of [userId, otherUserId])
      await prisma.user.create({
        data: { id, name: id, email: `${id}@rakazo.test`, emailVerified: false },
      });
    await prisma.organization.create({
      data: {
        id: organizationId,
        name: "Meetings Org",
        slug: organizationId,
        createdAt: new Date(),
      },
    });
    await prisma.space.create({
      data: { id: spaceId, organizationId, name: spaceId, isDefault: true },
    });
  });
  beforeEach(async () => {
    enqueued = [];
    loaded.length = 0;
    source = new TestSource();
    await prisma.meeting.deleteMany({ where: { spaceId } });
    await prisma.meetingTombstone.deleteMany({ where: { spaceId } });
  });
  afterAll(async () => {
    await prisma.space.deleteMany({ where: { id: spaceId } });
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await close();
  });

  it("first sync backfills 90 days in batches and moves the checkpoint only when the pass completes", async () => {
    source.meetings = [
      meeting("m1", 5),
      meeting("m2", 4),
      meeting("m3", 3),
      meeting("m4", 2),
      meeting("m5", 1),
      meeting("old", 120),
    ];
    const { payload, connectionId } = await connect();
    const startedBefore = Date.now();
    await runMeetingSyncJob(deps(1), payload);
    let s = await state({ connectionId });
    expect(await stored()).toHaveLength(2);
    expect(s.cursor).not.toBeNull();
    expect(s.syncedThrough).toBeNull();
    expect(s.claimToken).toBeNull();
    // Each stored meeting without a digest is queued for one; the pass queues itself again.
    expect(enqueued.map((j) => j.name).sort()).toEqual([
      "meetings.digest",
      "meetings.digest",
      "meetings.sync",
    ]);
    expect(enqueued.find((j) => j.name === "meetings.sync")?.availableAt).toBeInstanceOf(Date);
    const [firstStored] = await stored();
    expect(enqueued.find((j) => j.name === "meetings.digest")?.payload).toMatchObject({
      spaceId,
      userId,
      meetingId: expect.any(String),
    });
    expect(firstStored?.digestStatus).toBeNull();

    await runMeetingSyncJob(deps(1), payload);
    s = await state({ connectionId });
    expect(await stored()).toHaveLength(4);
    expect(s.syncedThrough).toBeNull();
    await runMeetingSyncJob(deps(1), payload);
    s = await state({ connectionId });
    expect((await stored()).map((m) => m.externalId)).toEqual(["m1", "m2", "m3", "m4", "m5"]);
    expect(s.cursor).toBeNull();
    expect(s.syncedThrough?.getTime()).toBeGreaterThanOrEqual(startedBefore);
    expect(s.syncedThrough?.getTime()).toBeLessThanOrEqual(Date.now());
    expect(s.lastSyncedAt).not.toBeNull();
    expect(source.listCalls[0]?.createdAfter).toBeInstanceOf(Date);
    expect(source.listCalls[0]?.updatedAfter).toBeUndefined();
    expect(enqueued.filter((j) => j.name === "meetings.sync")).toHaveLength(2);
    expect(enqueued.filter((j) => j.name === "meetings.digest")).toHaveLength(5);
  });

  it("the second sync is incremental, sees a late-summarized note and an old meeting edited later", async () => {
    source.meetings = [meeting("a", 10), meeting("b", 9), meeting("c", 8)];
    const { payload, connectionId } = await connect();
    await runMeetingSyncJob(deps(), payload);
    expect(await stored()).toHaveLength(3);
    const checkpoint = (await state({ connectionId })).syncedThrough as Date;

    // "late" started long ago but only got its summary now; "a" is edited now.
    source.meetings.push(meeting("late", 30, 0));
    source.meetings[0] = { ...meeting("a", 10, 0), summary: "Edited summary" };
    source.getCalls = [];
    source.listCalls = [];
    await runMeetingSyncJob(deps(), payload); // inside the minimum interval
    expect(source.listCalls).toHaveLength(0);

    await age(connectionId);
    await runMeetingSyncJob(deps(), payload);
    expect(source.listCalls[0]?.updatedAfter?.getTime()).toBeLessThan(checkpoint.getTime());
    expect(source.listCalls[0]?.createdAfter).toBeUndefined();
    expect(source.getCalls.sort()).toEqual(["a", "late"]);
    const rows = await stored();
    expect(rows.map((m) => m.externalId)).toEqual(["a", "b", "c", "late"]);
    expect(rows[0]?.summary).toBe("Edited summary");
    expect((await state({ connectionId })).syncedThrough?.getTime()).toBeGreaterThan(
      checkpoint.getTime(),
    );
  });

  it("an interrupted pass keeps its cursor, leaves the checkpoint alone and resumes", async () => {
    source.meetings = [meeting("a", 10)];
    const { payload, connectionId } = await connect();
    await runMeetingSyncJob(deps(), payload);
    const checkpoint = (await state({ connectionId })).syncedThrough as Date;

    const soon = (id: string, seconds: number) => ({
      ...meeting(id, 0, 0),
      updatedAt: new Date(Date.now() + seconds * 1000).toISOString(),
    });
    source.meetings.push(soon("n1", 1), soon("n2", 2), soon("n3", 3));
    await age(connectionId);
    // Page 1 is read and saved, then the source fails on page 2.
    source.failListAt = {
      call: source.listCalls.length + 2,
      error: new MeetingSourceError("unavailable", "Granola is unavailable"),
    };
    await runMeetingSyncJob(deps(), payload);
    let s = await state({ connectionId });
    expect(s.cursor).not.toBeNull();
    expect(s.syncedThrough?.getTime()).toBe(checkpoint.getTime());
    expect(s.error).toBe("Granola is unavailable");
    expect(s.claimToken).toBeNull();
    expect((await stored()).map((m) => m.externalId)).toEqual(["a", "n1", "n2"]);

    await runMeetingSyncJob(deps(), payload); // cursor present: no throttle
    s = await state({ connectionId });
    expect(s.cursor).toBeNull();
    expect(s.error).toBeNull();
    expect(s.syncedThrough?.getTime()).toBeGreaterThan(checkpoint.getTime());
    expect(source.listCalls.at(-1)?.cursor).toBe("2");
    expect(await stored()).toHaveLength(4);
  });

  it("two concurrent syncs of one source write each meeting once", async () => {
    source.meetings = [meeting("a", 3), meeting("b", 2), meeting("c", 1)];
    let open!: () => void;
    source.gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    const { payload, connectionId } = await connect();
    const first = runMeetingSyncJob(deps(), payload);
    await new Promise((r) => setTimeout(r, 100));
    const second = runMeetingSyncJob(deps(), payload);
    await second; // returns at once: the claim is held
    expect(source.listCalls).toHaveLength(1);
    open();
    await first;
    expect([...source.getCalls].sort()).toEqual(["a", "b", "c"]);
    expect(await stored()).toHaveLength(3);
    expect((await state({ connectionId })).claimToken).toBeNull();
  });

  it("two workers racing for a new source still run one sync", async () => {
    source.meetings = [meeting("a", 3), meeting("b", 2)];
    const { payload } = await connect();
    await Promise.all([runMeetingSyncJob(deps(), payload), runMeetingSyncJob(deps(), payload)]);
    expect(source.getCalls.sort()).toEqual(["a", "b"]);
    expect(await stored()).toHaveLength(2);
  });

  it("a rejected key sets needs_reconnect and stops retrying", async () => {
    source.failAll = new MeetingSourceError("auth", "Granola rejected the API key");
    const { payload, connectionId } = await connect();
    await runMeetingSyncJob(deps(), payload);
    const row = await prisma.connection.findUniqueOrThrow({ where: { id: connectionId } });
    expect(row.status).toBe("needs_reconnect");
    expect((await state({ connectionId })).error).toBe("Key rejected");
    expect(enqueued).toHaveLength(0);

    const calls = source.listCalls.length;
    await age(connectionId);
    await runMeetingSyncJob(deps(), payload);
    expect(source.listCalls).toHaveLength(calls);
    expect(await reconcileMeetingSyncs({ prisma, jobs })).toBe(0);
  });

  it("a rate limit backs off with a delayed retry", async () => {
    source.failAll = new MeetingSourceError("rate_limit", "Granola rate limit", 5_000);
    const { payload, connectionId } = await connect();
    await runMeetingSyncJob(deps(), payload);
    expect((await state({ connectionId })).error).toMatch(/^Rate limited until /);
    expect(enqueued).toHaveLength(1);
    expect((enqueued[0]?.availableAt?.getTime() ?? 0) - Date.now()).toBeGreaterThan(30_000);
  });

  it("refuses a job for a source of another user before reading any secret", async () => {
    source.meetings = [meeting("a", 1)];
    const other = await connect({ spaceId, userId: otherUserId });
    await runMeetingSyncJob(deps(), { ...other.payload, userId: userId });
    await runMeetingSyncJob(deps(), { ...other.payload, spaceId: "someone-elses-space" });
    expect(loaded).toEqual([]);
    expect(source.listCalls).toHaveLength(0);
    expect(
      await prisma.meetingSyncState.count({ where: { connectionId: other.connectionId } }),
    ).toBe(0);
    // A key from another connector is not sent to the provider either.
    const secret = await prisma.secret.create({
      data: { ...scope, kind: "api-key", ciphertext: "not-granola" },
    });
    const mail = await prisma.connection.create({
      data: {
        ...scope,
        connectorId: "emulator",
        provider: "granola",
        displayName: "x",
        status: "connected",
        secretId: secret.id,
      },
    });
    await runMeetingSyncJob(deps(), { ...scope, provider: "granola", connectionId: mail.id });
    expect(source.listCalls).toHaveLength(0);
    expect(loaded).toEqual([]);
  });

  it("a source bound by mcpServerId syncs through the same job", async () => {
    source.provider = "wispr";
    source.meetings = [meeting("w1", 2), meeting("w2", 1)];
    const server = await prisma.mcpServer.create({
      data: {
        ...scope,
        slug: `wispr-${suffix}`,
        name: "Flow",
        transport: "http",
        endpoint: "https://flow.example.test/mcp",
      },
    });
    await runMeetingSyncJob(deps(), { ...scope, provider: "wispr", mcpServerId: server.id });
    const rows = await stored("wispr");
    expect(rows.map((m) => m.externalId)).toEqual(["w1", "w2"]);
    expect(rows.every((m) => m.mcpServerId === server.id && m.connectionId === null)).toBe(true);
    expect((await state({ mcpServerId: server.id })).syncedThrough).not.toBeNull();
    // Another user's server is refused.
    await runMeetingSyncJob(deps(), {
      spaceId,
      userId: otherUserId,
      provider: "wispr",
      mcpServerId: server.id,
    });
    expect(await prisma.meetingSyncState.count({ where: { mcpServerId: server.id } })).toBe(1);
    await prisma.mcpServer.delete({ where: { id: server.id } });
  });

  it("does not recreate or fetch a meeting the user deleted", async () => {
    source.meetings = [meeting("a", 3), meeting("b", 2)];
    const { payload, connectionId } = await connect();
    await runMeetingSyncJob(deps(), payload);
    const gone = (await stored()).find((m) => m.externalId === "a");
    await deleteMeeting(prisma, scope, gone?.id as string);
    source.meetings[0] = meeting("a", 3, 0);
    source.getCalls = [];
    await age(connectionId);
    await runMeetingSyncJob(deps(), payload);
    expect(source.getCalls).toEqual([]);
    expect((await stored()).map((m) => m.externalId)).toEqual(["b"]);
  });

  it("an edit made mid-pass is read by the next pass even if a later page has newer meetings", async () => {
    source.sortById = true;
    source.meetings = [meeting("a", 3), meeting("x", 2), meeting("y", 1)];
    const { payload, connectionId } = await connect();
    await runMeetingSyncJob(deps(1), payload); // page 1 (a, x) of a two-page pass
    expect((await state({ connectionId })).cursor).not.toBeNull();
    // "a" is edited after it was read, and a newer meeting sorts onto the last page.
    source.meetings[0] = { ...meeting("a", 3, 0), summary: "Edited mid-pass" };
    source.meetings.push({
      ...meeting("z", 0, 0),
      updatedAt: new Date(Date.now() + 5_000).toISOString(),
    });
    await runMeetingSyncJob(deps(1), payload);
    expect((await state({ connectionId })).cursor).toBeNull();
    expect((await stored()).map((m) => m.externalId)).toEqual(["a", "x", "y", "z"]);
    await age(connectionId);
    await runMeetingSyncJob(deps(), payload);
    expect((await stored()).find((m) => m.externalId === "a")?.summary).toBe("Edited mid-pass");
  });

  it("a failed first page keeps the backfill window for the retry", async () => {
    source.meetings = [meeting("a", 3)];
    source.failAll = new MeetingSourceError("unavailable", "Granola is unavailable");
    const { payload, connectionId } = await connect();
    await runMeetingSyncJob(deps(), payload);
    const saved = JSON.parse((await state({ connectionId })).cursor as string);
    expect(saved.createdAfter).toBe(source.listCalls[0]?.createdAfter?.toISOString());
    expect(saved.startedAt).toEqual(expect.any(String));
    source.failAll = undefined;
    await new Promise((r) => setTimeout(r, 20));
    await runMeetingSyncJob(deps(), payload);
    expect(source.listCalls[1]?.createdAfter).toEqual(source.listCalls[0]?.createdAfter);
    expect(await stored()).toHaveLength(1);
  });

  it("a rejection from a replaced key does not mark the reconnected connection", async () => {
    source.failAll = new MeetingSourceError("auth", "Granola rejected the API key");
    const { payload, connectionId } = await connect();
    source.beforeList = async () => {
      const fresh = await prisma.secret.create({
        data: { ...scope, kind: "api-key", ciphertext: "grn_new" },
      });
      await prisma.connection.update({ where: { id: connectionId }, data: { secretId: fresh.id } });
    };
    await runMeetingSyncJob(deps(), payload);
    expect(
      (await prisma.connection.findUniqueOrThrow({ where: { id: connectionId } })).status,
    ).toBe("connected");
  });

  it("a worker that lost its claim cannot mark the connection needs_reconnect", async () => {
    source.failAll = new MeetingSourceError("auth", "Granola rejected the API key");
    const { payload, connectionId } = await connect();
    source.beforeList = async () => {
      await prisma.meetingSyncState.update({
        where: { connectionId },
        data: { claimToken: "someone-else" },
      });
    };
    await runMeetingSyncJob(deps(), payload);
    expect(
      (await prisma.connection.findUniqueOrThrow({ where: { id: connectionId } })).status,
    ).toBe("connected");
  });

  it("an in-flight read past the deadline is aborted and nothing is written after it", async () => {
    source.meetings = [meeting("a", 2), meeting("b", 1)];
    const controller = new AbortController();
    let given: AbortSignal | undefined;
    const reg: MeetingSourceRegistry = {
      granola: {
        create: (_input, signal) => {
          given = signal;
          return source;
        },
      },
    };
    source.beforeGet = (id) =>
      new Promise<void>((_, reject) => {
        if (id !== "a") return;
        given?.addEventListener("abort", () =>
          reject(new MeetingSourceError("unavailable", "aborted")),
        );
        setTimeout(() => controller.abort(), 20);
      });
    const { payload, connectionId } = await connect();
    await runMeetingSyncJob({ ...deps(), registry: reg }, payload, controller.signal);
    expect(given).toBe(controller.signal);
    expect(await stored()).toHaveLength(0);
    expect(source.getCalls).toEqual(["a"]);
    const s = await state({ connectionId });
    expect(s.claimToken).toBeNull();
    expect(s.error).toBeNull();
    expect(enqueued.map((j) => j.name)).toEqual(["meetings.sync"]);
  });

  it("an agent refresh keeps a queued retry and waits out a rate-limit backoff", async () => {
    const { connectionId } = await connect();
    await age(connectionId);
    enqueued = [];
    await requestMeetingSync({ prisma, jobs }, scope, { connectionId }, "granola");
    expect(enqueued[0]?.keepExisting).toBe(true);
    await prisma.meetingSyncState.upsert({
      where: { connectionId },
      create: { ...scope, connectionId, provider: "granola" },
      update: {},
    });
    await prisma.meetingSyncState.update({
      where: { connectionId },
      data: { error: `Rate limited until ${new Date(Date.now() + 60_000).toISOString()}` },
    });
    await age(connectionId);
    enqueued = [];
    expect(await requestMeetingSync({ prisma, jobs }, scope, { connectionId }, "granola")).toEqual({
      syncing: false,
    });
    expect(enqueued).toHaveLength(0);
  });

  it("syncs a Granola emulator through the real registry", async () => {
    const emulator = new GranolaApiEmulator({
      meetings: [meeting("e1", 3), meeting("e2", 2), meeting("e3", 1)],
      apiKey: "grn_emulator_key",
      maxPageSize: 2,
    });
    const baseUrl = await emulator.start();
    try {
      const { payload } = await connect();
      await prisma.secret.updateMany({
        where: { ...scope, ciphertext: { startsWith: "grn_key_" } },
        data: { ciphertext: "grn_emulator_key" },
      });
      await runMeetingSyncJob(
        {
          prisma,
          jobs,
          secrets,
          registry: createMeetingSourceRegistry({ granolaBaseUrl: baseUrl }),
        },
        payload,
      );
      expect((await stored()).map((m) => m.externalId)).toEqual(["e1", "e2", "e3"]);
      expect(emulator.requests.every((r) => r.authorization === "Bearer grn_emulator_key")).toBe(
        true,
      );
    } finally {
      await emulator.stop();
    }
  });

  it("the scheduler queues idle connected Granola keys, and an agent refresh respects the interval", async () => {
    const { payload, connectionId } = await connect();
    await reconcileMeetingSyncs({ prisma, jobs });
    const queuedFor = () =>
      enqueued.filter(
        (j) => "connectionId" in j.payload && j.payload.connectionId === connectionId,
      );
    expect(queuedFor().map((j) => j.payload)).toEqual([payload]);
    expect(queuedFor()[0]?.keepExisting).toBe(true);
    await runMeetingSyncJob(deps(), payload); // no meetings: pass completes
    enqueued = [];
    await reconcileMeetingSyncs({ prisma, jobs });
    expect(queuedFor()).toHaveLength(0);

    enqueued = [];
    expect(await requestMeetingSync({ prisma, jobs }, scope, { connectionId }, "granola")).toEqual({
      syncing: false,
    });
    expect(enqueued).toHaveLength(0);
    await age(connectionId);
    expect(await requestMeetingSync({ prisma, jobs }, scope, { connectionId }, "granola")).toEqual({
      syncing: true,
    });
    expect(enqueued).toHaveLength(1);
    expect(
      await requestMeetingSync(
        { prisma, jobs },
        { spaceId, userId: otherUserId },
        { connectionId },
        "granola",
      ),
    ).toEqual({ syncing: false });
  });
});
