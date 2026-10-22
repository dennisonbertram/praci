import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import { saveContact } from "./contacts.js";
import {
  closeRound,
  getFundraisingOverview,
  markWaiting,
  notSent,
  reopenRound,
  saveRound,
} from "./fundraising.js";
import type { MercurySafeInput } from "./safes.js";
import {
  assignSafe,
  deleteSafe,
  listSafes,
  markSafe,
  SafeActiveError,
  SafeCapRequiredError,
  SafeStateError,
  saveSafe,
  syncMercurySafes,
  unassignSafe,
} from "./safes.js";
import { IsolationError } from "./scope.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("safes (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `safe-org-${suffix}`;
  const mine = { spaceId: `safe-space-a-${suffix}`, userId: `safe-user-a-${suffix}` };
  const sameSpace = { spaceId: mine.spaceId, userId: `safe-user-b-${suffix}` };
  const otherSpace = { spaceId: `safe-space-b-${suffix}`, userId: mine.userId };
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
      data: { id: organizationId, name: "Safe Org", slug: organizationId, createdAt: new Date() },
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

  const person = (email: string, kind = "prospect", extra: Record<string, unknown> = {}) =>
    saveContact(prisma, mine, {
      name: email,
      email,
      kind: kind as "prospect",
      stage: kind === "prospect" ? "committed" : undefined,
      checkSizeCents: kind === "prospect" ? 5_000_000 : undefined,
      ...extra,
    });
  const draft = (contactId: string | undefined, extra: Record<string, unknown> = {}) =>
    saveSafe(prisma, mine, {
      contactId,
      investorName: "Example Fund",
      amountCents: 5_000_000,
      proRata: false,
      ...extra,
    });
  const at = "2026-10-20T12:00:00.000Z";

  it("needs a cap from the round or the dialog", async () => {
    await expect(draft(undefined)).rejects.toBeInstanceOf(SafeCapRequiredError);
    const own = await draft(undefined, { capCents: 1_000_000_000 });
    expect(own).toMatchObject({ capCents: 1_000_000_000, roundId: null, status: "draft" });
    await deleteSafe(prisma, mine, own.id);
  });

  it("takes the open round's cap and id, and stays a post-money cap Draft", async () => {
    const round = await saveRound(prisma, mine, {
      name: "Seed",
      targetCents: 200_000_000,
      capCents: 1_000_000_000,
    });
    const a = await person("a@example.test");
    const safe = await draft(a.id);
    expect(safe).toMatchObject({
      source: "native",
      roundId: round.id,
      capCents: 1_000_000_000,
      valuationType: "post_money_cap",
      discountPercent: null,
      mfn: false,
      status: "draft",
    });
    // Only one active SAFE per contact.
    await expect(draft(a.id)).rejects.toBeInstanceOf(SafeActiveError);
  });

  it("scopes every read and write to the space and user", async () => {
    const theirs = await saveSafe(prisma, sameSpace, {
      investorName: "Other",
      amountCents: 1_000_000,
      capCents: 1_000_000_000,
      proRata: false,
    });
    expect((await listSafes(prisma, mine)).map((s) => s.id)).not.toContain(theirs.id);
    expect((await listSafes(prisma, otherSpace)).map((s) => s.id)).not.toContain(theirs.id);
    await expect(
      markSafe(prisma, mine, { id: theirs.id, action: "sent", at }),
    ).rejects.toBeInstanceOf(IsolationError);
    await expect(deleteSafe(prisma, mine, theirs.id)).rejects.toBeInstanceOf(IsolationError);
    // Another user's contact cannot be attached.
    const hers = await saveContact(prisma, sameSpace, { name: "H", email: "h@example.test" });
    await expect(draft(hers.id)).rejects.toBeInstanceOf(IsolationError);
  });

  it("flips a prospect to investor when Signed, never a board contact, and Undo does not flip back", async () => {
    const p = await person("p@example.test");
    const board = await person("board@example.test", "board");
    const sp = await draft(p.id);
    const sb = await draft(board.id);
    for (const safe of [sp, sb]) {
      await markSafe(prisma, mine, { id: safe.id, action: "sent", at });
      const signed = await markSafe(prisma, mine, { id: safe.id, action: "signed", at });
      expect(signed.status).toBe("signed");
    }
    const kinds = async () =>
      Object.fromEntries(
        (await prisma.contact.findMany({ where: { id: { in: [p.id, board.id] } } })).map((c) => [
          c.id,
          c.kind,
        ]),
      );
    expect(await kinds()).toEqual({ [p.id]: "investor", [board.id]: "board" });
    // Undo clears the date; the kind stays.
    const undone = await markSafe(prisma, mine, { id: sp.id, action: "signed", at: null });
    expect(undone.status).toBe("sent");
    expect((await kinds())[p.id]).toBe("investor");
  });

  it("sums Funded, Signed and Pending from rows, with the SAFE replacing the check size", async () => {
    const before = await getFundraisingOverview(prisma, mine);
    const c = await person("c@example.test", "prospect", { checkSizeCents: 7_000_000 });
    const withCommit = await getFundraisingOverview(prisma, mine);
    expect(withCommit.pendingCents - before.pendingCents).toBe(7_000_000);
    // Send SAFE at the same amount: the prospect leaves the pipeline, the total does not move.
    const safe = await draft(c.id, { amountCents: 7_000_000 });
    const after = await getFundraisingOverview(prisma, mine);
    expect(after.prospects.map((p) => p.id)).not.toContain(c.id);
    expect(after.pendingCents).toBe(withCommit.pendingCents);
    // Signed and Funded move the money out of Pending.
    await markSafe(prisma, mine, { id: safe.id, action: "sent", at });
    await markSafe(prisma, mine, { id: safe.id, action: "signed", at });
    const signed = await getFundraisingOverview(prisma, mine);
    expect(signed.signedCents - withCommit.signedCents).toBe(7_000_000);
    expect(signed.pendingCents).toBe(withCommit.pendingCents - 7_000_000);
    await markSafe(prisma, mine, { id: safe.id, action: "funded", at });
    const funded = await getFundraisingOverview(prisma, mine);
    expect(funded.fundedCents - withCommit.fundedCents).toBe(7_000_000);
    expect(funded.signedCents).toBe(withCommit.signedCents);
    await expect(
      markSafe(prisma, mine, { id: safe.id, action: "cancel", at }),
    ).rejects.toBeInstanceOf(SafeStateError);
  });

  it("returns a prospect to the pipeline when its only SAFE is canceled or deleted before signing", async () => {
    const d = await person("d@example.test");
    const first = await draft(d.id);
    const inPipeline = async () =>
      (await getFundraisingOverview(prisma, mine)).prospects.some((p) => p.id === d.id);
    expect(await inPipeline()).toBe(false);
    await markSafe(prisma, mine, { id: first.id, action: "cancel", at });
    expect(await inPipeline()).toBe(true);
    const second = await draft(d.id);
    expect(await inPipeline()).toBe(false);
    await deleteSafe(prisma, mine, second.id);
    expect(await inPipeline()).toBe(true);
  });

  it("refuses to fund a canceled SAFE, and lets two overlapping saves create only one", async () => {
    const e = await person("stale-fund@example.test");
    const first = await draft(e.id);
    await markSafe(prisma, mine, { id: first.id, action: "signed", at });
    await markSafe(prisma, mine, { id: first.id, action: "cancel", at });
    await expect(
      markSafe(prisma, mine, { id: first.id, action: "funded", at }),
    ).rejects.toBeInstanceOf(SafeStateError);
    expect((await listSafes(prisma, mine)).find((s) => s.id === first.id)?.paidAt).toBeNull();
    const f = await person("overlap@example.test");
    const results = await Promise.allSettled([draft(f.id), draft(f.id), draft(f.id)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });

  it("keeps a closed round's SAFEs and counts them as that round's funded money", async () => {
    const e = await person("e@example.test");
    const safe = await draft(e.id, { amountCents: 2_000_000 });
    await markSafe(prisma, mine, { id: safe.id, action: "signed", at });
    await markSafe(prisma, mine, { id: safe.id, action: "funded", at });
    const open = (await getFundraisingOverview(prisma, mine)).round!;
    await closeRound(prisma, mine, open.id);
    const closed = await getFundraisingOverview(prisma, mine);
    expect(closed.safes.find((s) => s.id === safe.id)?.roundId).toBe(open.id);
    expect(closed.fundedCents).toBeGreaterThanOrEqual(2_000_000);
    expect(closed.pendingCents).toBe(0);
  });

  it("treats a Mercury row as read-only", async () => {
    const row = await prisma.safe.create({
      data: {
        ...mine,
        source: "mercury",
        externalId: `m-${suffix}`,
        investorName: "Mercury Fund",
        amountCents: 1_000_000n,
      },
    });
    await expect(markSafe(prisma, mine, { id: row.id, action: "sent", at })).rejects.toBeInstanceOf(
      SafeStateError,
    );
    await expect(deleteSafe(prisma, mine, row.id)).rejects.toBeInstanceOf(SafeStateError);
  });

  describe("Mercury SAFEs", () => {
    // An earlier test closed the round; Pending counts only the open round's commitments.
    beforeAll(async () => {
      const round = (await getFundraisingOverview(prisma, mine)).round;
      if (round?.closedAt) await reopenRound(prisma, mine, round.id);
    });
    const mercury = (
      externalId: string,
      over: Partial<MercurySafeInput> = {},
    ): MercurySafeInput => ({
      externalId,
      investorName: "Mercury Fund",
      investorEmail: null,
      amountCents: 5_000_000,
      valuationType: "post_money_cap",
      capCents: 1_000_000_000,
      discountPercent: null,
      mfn: false,
      proRata: false,
      governingState: null,
      investmentDate: null,
      expiresAt: new Date("2099-01-01T00:00:00Z"),
      canceledAt: null,
      signedByOwnerAt: null,
      signedByInvestorAt: null,
      paidAt: null,
      documentUrl: null,
      ...over,
    });
    const sync = (...rows: MercurySafeInput[]) => syncMercurySafes(prisma, mine, rows);
    const safeOf = async (externalId: string, scope: typeof mine = mine) =>
      prisma.safe.findFirstOrThrow({ where: { ...scope, source: "mercury", externalId } });
    const contactRow = (id: string) => prisma.contact.findUniqueOrThrow({ where: { id } });
    const pipeline = async () =>
      (await getFundraisingOverview(prisma, mine)).prospects.map((p) => p.id);
    const pending = async () => (await getFundraisingOverview(prisma, mine)).pendingCents;

    it("attaches by email, ignoring case and spaces, and takes the check size out of Pending", async () => {
      const before = await pending();
      const p = await person("Match.Me@Example.test", "prospect", { checkSizeCents: 3_000_000 });
      const withCheck = await pending();
      expect(withCheck - before).toBe(3_000_000);
      await sync(
        mercury("m-match", { investorEmail: "match.me@example.test", amountCents: 3_000_000 }),
      );
      const row = await safeOf("m-match");
      expect(row.contactId).toBe(p.id);
      expect(await pipeline()).not.toContain(p.id);
      // The SAFE now counts by its Mercury status (Sent) at its amount, once.
      expect(await pending()).toBe(withCheck);
    });

    it("lists an unmatched SAFE outside every round bar until Assign attaches it", async () => {
      const p = await person("assign-me@example.test", "prospect", { checkSizeCents: 2_000_000 });
      const before = await pending();
      await sync(
        mercury("m-loose", { investorEmail: "someone-else@example.test", amountCents: 2_000_000 }),
      );
      const loose = (await getFundraisingOverview(prisma, mine)).safes.find(
        (s) => s.investorEmail === "someone-else@example.test",
      );
      expect(loose).toMatchObject({ contactId: null, roundId: null, source: "mercury" });
      expect(await pending()).toBe(before);
      const assigned = await assignSafe(prisma, mine, loose!.id, p.id);
      expect(assigned.contactId).toBe(p.id);
      expect(await pipeline()).not.toContain(p.id);
      // Assigning twice, or a native SAFE, is refused.
      await expect(assignSafe(prisma, mine, loose!.id, p.id)).rejects.toBeInstanceOf(
        SafeStateError,
      );
    });

    it("keeps one row per owner for the same Mercury id and one row per id across syncs", async () => {
      await sync(mercury("m-shared"));
      await sync(mercury("m-shared", { amountCents: 6_000_000 }));
      await syncMercurySafes(prisma, sameSpace, [mercury("m-shared")]);
      await syncMercurySafes(prisma, otherSpace, [mercury("m-shared")]);
      const rows = await prisma.safe.findMany({
        where: { source: "mercury", externalId: "m-shared" },
      });
      expect(rows).toHaveLength(3);
      expect(Number((await safeOf("m-shared")).amountCents)).toBe(6_000_000);
      expect(
        (await listSafes(prisma, sameSpace)).filter((s) => s.source === "mercury"),
      ).toHaveLength(1);
    });

    it("restores the prospect row with Not sent, and Waiting keeps counting at the check size", async () => {
      const before = await pending();
      const p = await person("waiting@example.test", "prospect", { checkSizeCents: 1_000_000 });
      const waiting = await markWaiting(prisma, mine, p.id);
      expect(waiting.mercurySentAt).toBeTruthy();
      expect(await pipeline()).toContain(p.id);
      expect(await pending()).toBe(before + 1_000_000);
      const restored = await notSent(prisma, mine, p.id);
      expect(restored.mercurySentAt).toBeNull();
      await expect(markWaiting(prisma, sameSpace, p.id)).rejects.toBeInstanceOf(IsolationError);
    });

    it("needs an email to wait, and attaching clears Waiting", async () => {
      const bare = await saveContact(prisma, mine, {
        name: "No Email",
        kind: "prospect",
        stage: "committed",
      });
      await expect(markWaiting(prisma, mine, bare.id)).rejects.toThrow(/email/i);
      const p = await person("clears@example.test");
      await markWaiting(prisma, mine, p.id);
      await sync(mercury("m-clears", { investorEmail: "clears@example.test" }));
      expect((await contactRow(p.id)).mercurySentAt).toBeNull();
    });

    it("counts a canceled or expired Mercury SAFE as zero and returns the prospect to the pipeline", async () => {
      const p = await person("canceled@example.test");
      await sync(mercury("m-cancel", { investorEmail: "canceled@example.test" }));
      expect(await pipeline()).not.toContain(p.id);
      await sync(
        mercury("m-cancel", {
          investorEmail: "canceled@example.test",
          canceledAt: new Date("2026-10-02T00:00:00Z"),
        }),
      );
      expect(await pipeline()).toContain(p.id);
      // An Expired SAFE does not block Send SAFE.
      const q = await person("expired@example.test");
      await sync(
        mercury("m-expired", {
          investorEmail: "expired@example.test",
          expiresAt: new Date("2020-01-01T00:00:00Z"),
        }),
      );
      expect(
        (await listSafes(prisma, mine)).find((s) => s.investorEmail === "expired@example.test")
          ?.status,
      ).toBe("expired");
      await expect(markWaiting(prisma, mine, q.id)).resolves.toBeTruthy();
    });

    it("refuses Send SAFE while an active SAFE is attached", async () => {
      const p = await person("active@example.test");
      await sync(mercury("m-active", { investorEmail: "active@example.test" }));
      await expect(markWaiting(prisma, mine, p.id)).rejects.toBeInstanceOf(SafeActiveError);
    });

    it("fixes a wrong assign with Unassign then Assign, counting the SAFE once", async () => {
      const wrong = await person("wrong@example.test", "prospect", { checkSizeCents: 4_000_000 });
      const right = await person("right@example.test", "prospect", { checkSizeCents: 4_000_000 });
      await sync(
        mercury("m-fix", { investorEmail: "nobody@example.test", amountCents: 4_000_000 }),
      );
      const safe = await safeOf("m-fix");
      await assignSafe(prisma, mine, safe.id, wrong.id);
      // Unassign restores the prospect's check size and leaves its kind.
      const unassigned = await unassignSafe(prisma, mine, safe.id);
      expect(unassigned.contactId).toBeNull();
      expect(await pipeline()).toContain(wrong.id);
      expect((await contactRow(wrong.id)).kind).toBe("prospect");
      await assignSafe(prisma, mine, safe.id, right.id);
      expect(await pipeline()).toContain(wrong.id);
      expect(await pipeline()).not.toContain(right.id);
      await expect(unassignSafe(prisma, sameSpace, safe.id)).rejects.toBeInstanceOf(IsolationError);
    });

    it("links the one matching Finance deposit and none when two have the same amount", async () => {
      const paidAt = new Date("2026-10-10T00:00:00Z");
      const deposit = (externalId: string, amount: bigint, over: Record<string, unknown> = {}) =>
        prisma.financeTransaction.create({
          data: {
            ...mine,
            provider: "mercury",
            externalId,
            accountExternalId: "acct",
            postedAt: new Date("2026-10-11T00:00:00Z"),
            amountCents: amount,
            currency: "USD",
            counterparty: "Wire",
            vendorKey: "wire",
            status: "posted",
            kind: "other",
            classification: "financing",
            ...over,
          },
        });
      const one = await deposit(`dep-one-${suffix}`, 7_100_000n);
      await sync(mercury("m-dep-one", { amountCents: 7_100_000, paidAt }));
      expect((await safeOf("m-dep-one")).financeTransactionId).toBe(one.id);
      await deposit(`dep-a-${suffix}`, 7_200_000n);
      await deposit(`dep-b-${suffix}`, 7_200_000n);
      await sync(mercury("m-dep-two", { amountCents: 7_200_000, paidAt }));
      expect((await safeOf("m-dep-two")).financeTransactionId).toBeNull();
      // A transaction already linked to a SAFE is never used again.
      await sync(mercury("m-dep-again", { amountCents: 7_100_000, paidAt }));
      expect((await safeOf("m-dep-again")).financeTransactionId).toBeNull();
    });

    it("keeps the rows when the Mercury server is removed and refreshes the same rows on re-add", async () => {
      const server = await prisma.mcpServer.create({
        data: {
          ...mine,
          slug: `mercury-${suffix}`,
          name: "Mercury",
          transport: "http",
          endpoint: "https://mcp.mercury.com/mcp",
        },
      });
      const p = await person("server@example.test");
      await markWaiting(prisma, mine, p.id);
      await sync(mercury("m-server", { investorEmail: "nobody-server@example.test" }));
      const before = (await listSafes(prisma, mine)).length;
      await prisma.mcpServer.delete({ where: { id: server.id } });
      expect((await listSafes(prisma, mine)).length).toBe(before);
      expect((await contactRow(p.id)).mercurySentAt).not.toBeNull();
      await sync(mercury("m-server", { investorEmail: "nobody-server@example.test" }));
      expect((await listSafes(prisma, mine)).length).toBe(before);
    });
  });
});
