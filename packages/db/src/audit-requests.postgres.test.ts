import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AUDIT_DRAFTS_PER_DAY,
  claimAuditDraft,
  closeAuditRequest,
  fileAuditRequestFromMail,
  listAuditRequests,
  upsertAuditRequest,
} from "./audit-requests.js";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("audit requests (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `ar-org-${suffix}`;
  const mine = { spaceId: `ar-space-a-${suffix}`, userId: `ar-user-a-${suffix}` };
  const otherUser = { spaceId: mine.spaceId, userId: `ar-user-b-${suffix}` };
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let n = 0;

  const mail = (over: Partial<Parameters<typeof fileAuditRequestFromMail>[2]> = {}) => ({
    fund: "Example Fund I",
    mailThreadId: `thread-${++n}`,
    connectionId: "conn-1",
    senderKnown: true,
    dataRoomItemId: null,
    receivedAt: new Date("2026-10-20T10:00:00Z"),
    ...over,
  });

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    await prisma.user.createMany({
      data: [mine.userId, otherUser.userId].map((id) => ({
        id,
        name: id,
        email: `${id}@example.test`,
      })),
    });
    await prisma.organization.create({
      data: { id: organizationId, name: "AR Org", slug: organizationId, createdAt: new Date() },
    });
    await prisma.space.create({
      data: { id: mine.spaceId, organizationId, name: "Acme Test Co" },
    });
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [mine.userId, otherUser.userId] } } });
    await close();
  });

  it("files a thread once: a second message only moves lastMailAt", async () => {
    const first = mail();
    const a = await fileAuditRequestFromMail(prisma, mine, first);
    const b = await fileAuditRequestFromMail(prisma, mine, {
      ...first,
      receivedAt: new Date("2026-10-21T10:00:00Z"),
    });
    expect(a.created).toBe(true);
    expect(b).toEqual({ id: a.id, created: false });
    const row = await prisma.auditRequest.findUniqueOrThrow({ where: { id: a.id } });
    expect(row.lastMailAt.toISOString()).toBe("2026-10-21T10:00:00.000Z");
    expect(await prisma.auditRequest.count({ where: { mailThreadId: first.mailThreadId } })).toBe(
      1,
    );
  });

  it("two messages of one thread filed at once leave one row", async () => {
    const input = mail();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => fileAuditRequestFromMail(prisma, mine, input)),
    );
    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect(await prisma.auditRequest.count({ where: { mailThreadId: input.mailThreadId } })).toBe(
      1,
    );
  });

  it("a dismissed request stays dismissed when mail arrives in its thread", async () => {
    const input = mail();
    const { id } = await fileAuditRequestFromMail(prisma, mine, input);
    await closeAuditRequest(prisma, mine, id, "dismissed");
    await fileAuditRequestFromMail(prisma, mine, { ...input, receivedAt: new Date() });
    const row = await prisma.auditRequest.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe("dismissed");
    expect((await listAuditRequests(prisma, mine, true)).some((r) => r.id === id)).toBe(false);
    // Closed is final: Mark done does not turn a dismissed row into a done one.
    expect((await closeAuditRequest(prisma, mine, id, "done")).status).toBe("dismissed");
  });

  it("never lets one user read or close another user's row", async () => {
    const { id } = await fileAuditRequestFromMail(prisma, mine, mail());
    expect((await listAuditRequests(prisma, otherUser)).some((r) => r.id === id)).toBe(false);
    await expect(closeAuditRequest(prisma, otherUser, id, "done")).rejects.toThrow();
    expect(await claimAuditDraft(prisma, otherUser, id, null)).toBe(false);
  });

  it("concurrent intakes never start more than the daily limit of drafts", async () => {
    const user = { spaceId: mine.spaceId, userId: otherUser.userId };
    const ids = await Promise.all(
      Array.from(
        { length: AUDIT_DRAFTS_PER_DAY + 5 },
        async () => (await fileAuditRequestFromMail(prisma, user, mail())).id,
      ),
    );
    const claims = await Promise.all(
      ids.map((id) => claimAuditDraft(prisma, user, id, AUDIT_DRAFTS_PER_DAY)),
    );
    expect(claims.filter(Boolean)).toHaveLength(AUDIT_DRAFTS_PER_DAY);
    // The button is not capped: a row that was left waiting can still be drafted by hand.
    const waiting = ids[claims.findIndex((c) => !c)] as string;
    expect(await claimAuditDraft(prisma, user, waiting, null)).toBe(true);
  });

  it("a row is claimed once while its run is going", async () => {
    const { id } = await fileAuditRequestFromMail(prisma, mine, mail());
    expect(await claimAuditDraft(prisma, mine, id, null)).toBe(true);
    expect(await claimAuditDraft(prisma, mine, id, null)).toBe(false);
  });

  it("the agent's upsert returns the open row with the same fund and as-of date", async () => {
    const first = await upsertAuditRequest(prisma, mine, {
      fund: "Birch Audit LLP",
      asOf: "2026-09-30",
    });
    const again = await upsertAuditRequest(prisma, mine, {
      fund: "  birch  audit llp ",
      asOf: "2026-09-30",
    });
    expect(first.created).toBe(true);
    expect(again).toMatchObject({ created: false, request: { id: first.request.id } });
    const other = await upsertAuditRequest(prisma, mine, {
      fund: "Birch Audit LLP",
      asOf: "2026-12-31",
    });
    expect(other.created).toBe(true);
  });

  it("state only moves forward: drafted never goes back to open and done is not changed", async () => {
    const { id } = await fileAuditRequestFromMail(prisma, mine, mail());
    const drafted = await upsertAuditRequest(prisma, mine, {
      id,
      fund: "Corrected Fund",
      dueDate: "2026-11-15",
      drafted: true,
      draftRef: "draft-1",
    });
    expect(drafted.request).toMatchObject({
      status: "drafted",
      fund: "Corrected Fund",
      dueDate: "2026-11-15",
    });
    await closeAuditRequest(prisma, mine, id, "done");
    const after = await upsertAuditRequest(prisma, mine, { id, fund: "Changed", drafted: true });
    expect(after.request).toMatchObject({ status: "done", fund: "Corrected Fund" });
  });

  it("lists by due date first, then newest, and keeps history reachable", async () => {
    const user = { spaceId: mine.spaceId, userId: mine.userId };
    await prisma.auditRequest.deleteMany({ where: user });
    const a = await upsertAuditRequest(prisma, user, { fund: "No due", asOf: null });
    const b = await upsertAuditRequest(prisma, user, { fund: "Late", dueDate: "2026-12-01" });
    const c = await upsertAuditRequest(prisma, user, { fund: "Soon", dueDate: "2026-11-01" });
    const d = await upsertAuditRequest(prisma, user, { fund: "Done one", dueDate: "2026-10-01" });
    await closeAuditRequest(prisma, user, d.request.id, "done");
    expect((await listAuditRequests(prisma, user)).map((r) => r.id)).toEqual([
      c.request.id,
      b.request.id,
      a.request.id,
    ]);
    expect((await listAuditRequests(prisma, user, true)).map((r) => r.id)).toContain(d.request.id);
  });
});
