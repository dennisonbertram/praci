import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import { saveContact } from "./contacts.js";
import {
  closeRound,
  FundraiseRoundOpenError,
  getFundraisingOverview,
  reopenRound,
  saveProspect,
  saveRound,
} from "./fundraising.js";
import { IsolationError } from "./scope.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("fundraising (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `fund-org-${suffix}`;
  const mine = { spaceId: `fund-space-a-${suffix}`, userId: `fund-user-a-${suffix}` };
  const sameSpace = { spaceId: mine.spaceId, userId: `fund-user-b-${suffix}` };
  const otherSpace = { spaceId: `fund-space-b-${suffix}`, userId: mine.userId };
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
      data: [mine.userId, sameSpace.userId].map((id) => ({
        id,
        name: id,
        email: `${id}@example.test`,
      })),
    });
    await prisma.organization.create({
      data: { id: organizationId, name: "Fund Org", slug: organizationId, createdAt: new Date() },
    });
    await prisma.space.createMany({
      data: [mine.spaceId, otherSpace.spaceId].map((id) => ({ id, organizationId, name: id })),
    });
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: [mine.userId, sameSpace.userId] } } });
    await close();
  });

  const input = { name: "Seed", targetCents: 200_000_000, capCents: 1_000_000_000 };
  const prospect = (email: string, extra: Record<string, unknown> = {}) =>
    saveContact(prisma, mine, {
      name: email,
      email,
      kind: "prospect",
      stage: "target",
      ...extra,
    });

  it("allows one open round per space and user, and refuses a second", async () => {
    const first = await saveRound(prisma, mine, input);
    expect(first.closedAt).toBeNull();
    await expect(saveRound(prisma, mine, { ...input, name: "Second" })).rejects.toBeInstanceOf(
      FundraiseRoundOpenError,
    );
    // Other users and other spaces have their own open round.
    await saveRound(prisma, sameSpace, input);
    await saveRound(prisma, otherSpace, input);
    // Editing the open round changes it in place.
    const edited = await saveRound(prisma, mine, { ...input, id: first.id, name: "Seed 2" });
    expect(edited).toMatchObject({ id: first.id, name: "Seed 2" });
  });

  it("scopes rounds and prospects to the space and user", async () => {
    const overview = await getFundraisingOverview(prisma, mine);
    const theirs = await getFundraisingOverview(prisma, sameSpace);
    expect(overview.round?.id).not.toBe(theirs.round?.id);
    await expect(closeRound(prisma, sameSpace, overview.round!.id)).rejects.toBeInstanceOf(
      IsolationError,
    );
    await expect(
      saveRound(prisma, otherSpace, { ...input, id: overview.round!.id }),
    ).rejects.toBeInstanceOf(IsolationError);
    const hers = await saveContact(prisma, sameSpace, {
      name: "Not Mine",
      email: "not-mine@example.test",
      kind: "prospect",
      stage: "committed",
      checkSizeCents: 1_000_000,
    });
    await expect(
      saveProspect(prisma, mine, { id: hers.id, stage: "passed" }),
    ).rejects.toBeInstanceOf(IsolationError);
    expect((await getFundraisingOverview(prisma, mine)).prospects.map((p) => p.id)).not.toContain(
      hers.id,
    );
  });

  it("counts a Committed prospect in Pending only for the round open when it was saved", async () => {
    const open = (await getFundraisingOverview(prisma, mine)).round!;
    const a = await prospect("a@example.test", { stage: "committed", checkSizeCents: 5_000_000 });
    await prospect("b@example.test", { stage: "intro", checkSizeCents: 9_000_000 });
    await prospect("c@example.test", { stage: "committed", checkSizeCents: 3_000_000 });
    expect(a.roundId).toBe(open.id);
    expect((await getFundraisingOverview(prisma, mine)).pendingCents).toBe(8_000_000);

    // Closing the round leaves the commitment counting nowhere.
    await closeRound(prisma, mine, open.id);
    const closed = await getFundraisingOverview(prisma, mine);
    expect(closed.round).toMatchObject({ id: open.id });
    expect(closed.round?.closedAt).not.toBeNull();
    expect(closed.pendingCents).toBe(0);

    // A later round does not inherit it ...
    const next = await saveRound(prisma, mine, { ...input, name: "Series A" });
    expect((await getFundraisingOverview(prisma, mine)).pendingCents).toBe(0);
    // ... and Reopen is refused while that round is open.
    await expect(reopenRound(prisma, mine, open.id)).rejects.toBeInstanceOf(
      FundraiseRoundOpenError,
    );
    // ... until its Committed stage is saved again.
    await saveProspect(prisma, mine, { id: a.id, stage: "committed" });
    const rejoined = await getFundraisingOverview(prisma, mine);
    // Only a joined the new round; c is still tied to the closed one.
    expect(rejoined.pendingCents).toBe(5_000_000);
    expect(rejoined.prospects.find((p) => p.id === a.id)?.roundId).toBe(next.id);

    // Moving it out of Committed clears the round.
    const moved = await saveProspect(prisma, mine, { id: a.id, stage: "passed" });
    expect(moved.roundId).toBeNull();

    // Close the new round and reopen the old one: c's commitment counts again.
    await closeRound(prisma, mine, next.id);
    const reopened = await reopenRound(prisma, mine, open.id);
    expect(reopened.closedAt).toBeNull();
    expect((await getFundraisingOverview(prisma, mine)).pendingCents).toBe(3_000_000);
  });

  it("shows the latest closed round when none is open, and nothing before the first round", async () => {
    const theirs = await getFundraisingOverview(prisma, sameSpace);
    await closeRound(prisma, sameSpace, theirs.round!.id);
    expect((await getFundraisingOverview(prisma, sameSpace)).round).toMatchObject({
      id: theirs.round!.id,
    });
    const lonely = { spaceId: otherSpace.spaceId, userId: sameSpace.userId };
    expect(await getFundraisingOverview(prisma, lonely)).toEqual({
      round: null,
      pendingCents: 0,
      signedCents: 0,
      fundedCents: 0,
      prospects: [],
      safes: [],
    });
  });
});
