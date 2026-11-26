import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import { saveContact } from "./contacts.js";
import { getFundraisingOverview, saveProspect, undoAutoChange } from "./fundraising.js";
import { applyPipelineAutoChange, undoneAutoChanges } from "./pipeline-auto-status.js";
import { IsolationError } from "./scope.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("pipeline auto-status writes (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `pauto-org-${suffix}`;
  const space = `pauto-space-${suffix}`;
  const users = ["a", "b"].map((u) => `pauto-user-${u}-${suffix}`);
  const owner = { spaceId: space, userId: users[0] as string };
  const other = { spaceId: space, userId: users[1] as string };
  let prisma: PrismaClient;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.createMany({
      data: users.map((id) => ({ id, name: id, email: `${id}@example.test` })),
    });
    await prisma.organization.create({
      data: { id: organizationId, name: "Pauto Org", slug: organizationId, createdAt: new Date() },
    });
    await prisma.space.create({ data: { id: space, organizationId, name: space } });
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await close();
  });

  const add = (scope: typeof owner, name: string, extra: Record<string, unknown> = {}) =>
    saveContact(prisma, scope, { name, kind: "prospect", ...extra });
  const infoOf = async (scope: typeof owner, id: string) =>
    (await getFundraisingOverview(prisma, scope)).prospects.find((p) => p.id === id)
      ?.pipelineRecord;
  const recordOf = async (scope: typeof owner, contactId: string) =>
    (
      await prisma.pipelineRecordPerson.findFirstOrThrow({
        where: { ...scope, contactId },
        include: { record: true },
      })
    ).record;

  it("applies a decided change: record, status event, auto event and lastAuto", async () => {
    const p = await add(owner, "Auto Investor");
    await saveProspect(prisma, owner, { id: p.id, status: "not_reached" });
    const record = await recordOf(owner, p.id);
    const call = new Date("2027-01-10T15:00:00.000Z");
    const { applied } = await applyPipelineAutoChange(prisma, owner, {
      recordId: record.id,
      before: {
        status: record.status,
        nextCallAt: record.nextCallAt,
        nextCallHasTime: record.nextCallHasTime,
      },
      status: "reached_out",
      nextCall: { at: call, hasTime: true },
      evidence: {
        actor: "auto:mail",
        summary: "Intro to Auto Capital",
        at: new Date("2026-12-01T10:00:00.000Z"),
        id: "msg-1",
      },
    });
    expect(applied).toBe(true);
    const moved = await recordOf(owner, p.id);
    expect(moved).toMatchObject({
      status: "reached_out",
      nextCallAt: call,
      nextCallHasTime: true,
    });
    const events = await prisma.pipelineEvent.findMany({
      where: { recordId: record.id },
      orderBy: [{ at: "asc" }, { id: "asc" }],
    });
    const status = events.find((event) => event.kind === "status");
    expect(status?.payload).toMatchObject({ from: "not_reached", to: "reached_out" });
    const auto = events.find((event) => event.kind === "auto");
    expect(auto?.actor).toBe("auto:mail");
    expect(auto?.payload).toMatchObject({
      before: { status: "not_reached", nextCallAt: null, nextCallHasTime: false },
      set: { status: "reached_out", nextCallAt: call.toISOString(), nextCallHasTime: true },
      summary: "Intro to Auto Capital",
      evidenceId: "msg-1",
    });
    expect((await infoOf(owner, p.id))?.lastAuto).toMatchObject({
      eventId: auto?.id,
      source: "mail",
      status: "reached_out",
      summary: "Intro to Auto Capital",
    });
  });

  it("skips a write the read no longer matches: the user's own change wins", async () => {
    const p = await add(owner, "Auto Guarded");
    await saveProspect(prisma, owner, { id: p.id, status: "met" });
    const record = await recordOf(owner, p.id);
    // The job read not_reached before the user logged a meeting; its guarded write must miss.
    const { applied } = await applyPipelineAutoChange(prisma, owner, {
      recordId: record.id,
      before: { status: "not_reached", nextCallAt: null, nextCallHasTime: false },
      status: "reached_out",
      evidence: { actor: "auto:mail", summary: "stale", at: new Date(), id: "msg-2" },
    });
    expect(applied).toBe(false);
    expect((await recordOf(owner, p.id)).status).toBe("met");
    expect(await prisma.pipelineEvent.count({ where: { recordId: record.id, kind: "auto" } })).toBe(
      0,
    );
  });

  it("undo reverts each field only while it holds the set value, and marks the event undone", async () => {
    const p = await add(owner, "Auto Undo");
    await saveProspect(prisma, owner, { id: p.id, status: "not_reached" });
    const record = await recordOf(owner, p.id);
    const call = new Date("2027-02-05T09:00:00.000Z");
    await applyPipelineAutoChange(prisma, owner, {
      recordId: record.id,
      before: {
        status: record.status,
        nextCallAt: record.nextCallAt,
        nextCallHasTime: record.nextCallHasTime,
      },
      status: "reached_out",
      nextCall: { at: call, hasTime: true },
      evidence: {
        actor: "auto:calendar",
        summary: "Call with Auto Capital",
        at: call,
        id: "evt-1",
      },
    });
    const auto = await prisma.pipelineEvent.findFirstOrThrow({
      where: { recordId: record.id, kind: "auto" },
    });
    await undoAutoChange(prisma, owner, auto.id);
    const reverted = await recordOf(owner, p.id);
    expect(reverted).toMatchObject({
      status: "not_reached",
      nextCallAt: null,
      nextCallHasTime: false,
    });
    const undone = await prisma.pipelineEvent.findUniqueOrThrow({ where: { id: auto.id } });
    expect((undone.payload as { undoneAt?: string }).undoneAt).toBeTruthy();
    // Undone changes drop out of lastAuto and are remembered so the job never re-applies them.
    expect((await infoOf(owner, p.id))?.lastAuto).toBeNull();
    const sets = undoneAutoChanges(
      await prisma.pipelineEvent.findMany({
        where: { recordId: record.id, kind: "auto" },
        select: { recordId: true, payload: true },
      }),
    ).get(record.id);
    expect(sets?.statuses.has("reached_out")).toBe(true);
    expect(sets?.nextCalls.has(call.toISOString())).toBe(true);
    // A second undo is a no-op.
    await undoAutoChange(prisma, owner, auto.id);
    // An event of another user or kind is not theirs to undo.
    await expect(undoAutoChange(prisma, other, auto.id)).rejects.toBeInstanceOf(IsolationError);
    const callEvent = await prisma.pipelineEvent.create({
      data: { ...owner, recordId: record.id, kind: "call", payload: { outcome: "spoke" } },
    });
    await expect(undoAutoChange(prisma, owner, callEvent.id)).rejects.toBeInstanceOf(
      IsolationError,
    );
  });

  it("undo leaves a field the user changed after the job wrote it", async () => {
    const p = await add(owner, "Auto Touched");
    await saveProspect(prisma, owner, { id: p.id, status: "not_reached" });
    const record = await recordOf(owner, p.id);
    await applyPipelineAutoChange(prisma, owner, {
      recordId: record.id,
      before: {
        status: record.status,
        nextCallAt: record.nextCallAt,
        nextCallHasTime: record.nextCallHasTime,
      },
      status: "reached_out",
      evidence: {
        actor: "auto:mail",
        summary: "Intro to Auto Capital",
        at: new Date("2026-12-02T10:00:00.000Z"),
        id: "msg-3",
      },
    });
    // The user moved the record on by hand; the undo must not take it back.
    await saveProspect(prisma, owner, { id: p.id, status: "intro_made" });
    const auto = await prisma.pipelineEvent.findFirstOrThrow({
      where: { recordId: record.id, kind: "auto" },
    });
    await undoAutoChange(prisma, owner, auto.id);
    expect((await recordOf(owner, p.id)).status).toBe("intro_made");
    const undone = await prisma.pipelineEvent.findUniqueOrThrow({ where: { id: auto.id } });
    expect((undone.payload as { undoneAt?: string }).undoneAt).toBeTruthy();
  });

  it("a status set by hand counts as undoing the job's status change", async () => {
    const p = await add(owner, "Override Investor");
    await saveProspect(prisma, owner, { id: p.id, status: "not_reached" });
    const record = await recordOf(owner, p.id);
    await applyPipelineAutoChange(prisma, owner, {
      recordId: record.id,
      before: { status: "not_reached", nextCallAt: null, nextCallHasTime: false },
      status: "reached_out",
      evidence: { actor: "auto:mail", summary: "Hello", at: new Date(), id: "msg-o" },
    });
    await saveProspect(prisma, owner, { id: p.id, status: "not_reached" });
    const events = await prisma.pipelineEvent.findMany({
      where: { ...owner, recordId: record.id, kind: "auto" },
      select: { recordId: true, payload: true },
    });
    expect(undoneAutoChanges(events).get(record.id)?.statuses.has("reached_out")).toBe(true);
    expect((await infoOf(owner, p.id))?.lastAuto).toBeNull();
  });

  it("writes lastContactAt when newer, without an event", async () => {
    const p = await add(owner, "Auto Seen");
    await saveProspect(prisma, owner, { id: p.id, status: "not_reached" });
    const record = await recordOf(owner, p.id);
    const seen = new Date("2026-12-20T08:00:00.000Z");
    const before = {
      status: record.status,
      nextCallAt: record.nextCallAt,
      nextCallHasTime: record.nextCallHasTime,
    };
    const first = await applyPipelineAutoChange(prisma, owner, {
      recordId: record.id,
      before,
      lastContactAt: seen,
    });
    expect(first.applied).toBe(true);
    expect((await recordOf(owner, p.id)).lastContactAt).toEqual(seen);
    // An older sighting is not a change; a newer one is.
    const older = await applyPipelineAutoChange(prisma, owner, {
      recordId: record.id,
      before,
      lastContactAt: new Date("2026-12-01T08:00:00.000Z"),
    });
    expect(older.applied).toBe(false);
    expect((await recordOf(owner, p.id)).lastContactAt).toEqual(seen);
    expect(await prisma.pipelineEvent.count({ where: { recordId: record.id, kind: "auto" } })).toBe(
      0,
    );
    expect((await infoOf(owner, p.id))?.lastContactAt).toBe(seen.toISOString());
  });
});
