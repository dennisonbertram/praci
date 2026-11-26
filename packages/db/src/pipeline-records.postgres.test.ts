import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "./client.js";
import { createDb } from "./client.js";
import { addContactIfNew, deleteContact, listContacts, saveContact } from "./contacts.js";
import {
  closeRound,
  getFundraisingOverview,
  markWaiting,
  notSent,
  saveProspect,
  saveRound,
} from "./fundraising.js";
import { savePipelineRecord } from "./pipeline-records.js";
import type { MercurySafeInput } from "./safes.js";
import { assignSafe, markSafe, SafeActiveError, saveSafe, syncMercurySafes } from "./safes.js";
import { IsolationError } from "./scope.js";

const databaseUrl = process.env.DATABASE_URL;
const migrationUrl = process.env.DATABASE_MIGRATION_URL ?? databaseUrl;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const migration = readFileSync(
  new URL("../prisma/migrations/20261231000052_pipeline_records/migration.sql", import.meta.url),
  "utf8",
);
const backfill = migration.slice(
  migration.indexOf("-- backfill:start"),
  migration.indexOf("-- backfill:end"),
);

describePostgres("pipeline records (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `pipe-org-${suffix}`;
  const users = ["a", "b", "c", "d", "e", "f", "g", "h"].map((u) => `pipe-user-${u}-${suffix}`);
  const spaceA = `pipe-space-a-${suffix}`;
  const spaceB = `pipe-space-b-${suffix}`;
  const scopeOf = (index: number, spaceId = spaceA) => ({
    spaceId,
    userId: users[index] as string,
  });
  const mine = scopeOf(0);
  const sameSpace = scopeOf(1);
  const otherSpace = scopeOf(0, spaceB);
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let pool: Pool;

  beforeAll(async () => {
    const db = createDb(databaseUrl!);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    pool = new Pool({ connectionString: migrationUrl, max: 1 });
    await prisma.user.createMany({
      data: users.map((id) => ({ id, name: id, email: `${id}@example.test` })),
    });
    await prisma.organization.create({
      data: { id: organizationId, name: "Pipe Org", slug: organizationId, createdAt: new Date() },
    });
    await prisma.space.createMany({
      data: [spaceA, spaceB].map((id) => ({ id, organizationId, name: id })),
    });
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await pool.end();
    await close();
  });

  const round = { name: "Seed", targetCents: 200_000_000, capCents: 1_000_000_000 };
  const recordOf = async (scope: typeof mine, contactId: string) =>
    (
      await prisma.pipelineRecordPerson.findFirstOrThrow({
        where: { ...scope, contactId },
        include: { record: true },
      })
    ).record;

  describe("backfill", () => {
    const owner = scopeOf(2);
    /** A prospect saved before records existed: the old columns, and nothing on a record. */
    const legacy = (data: Record<string, unknown>) =>
      prisma.contact.create({
        data: { ...owner, name: "Unnamed", kind: "prospect", ...data },
      }) as Promise<{ id: string; name: string }>;
    const counts = async () => ({
      records: await prisma.pipelineRecord.count({ where: owner }),
      people: await prisma.pipelineRecordPerson.count({ where: owner }),
      events: await prisma.pipelineEvent.count({ where: owner }),
    });

    it("gives every prospect a record with the same page, totals and rows, and a re-run adds nothing", async () => {
      const open = await saveRound(prisma, owner, round);
      const closed = await prisma.fundraiseRound.create({
        data: { ...owner, name: "Earlier", targetCents: 1n, capCents: 1n, closedAt: new Date() },
      });
      const target = await legacy({
        name: "Sample Target",
        stage: "target",
        notes: "Met at a demo",
      });
      const intro = await legacy({ name: "Sample Intro", stage: "intro", nextStep: "Ask Riley" });
      const meeting = await legacy({ name: "Sample Meeting", stage: "meeting" });
      const diligence = await legacy({ name: "Sample Diligence", stage: "diligence" });
      const committed = await legacy({
        name: "Sample Committed",
        email: "committed@example.test",
        stage: "committed",
        checkSizeCents: 5_000_000n,
        roundId: open.id,
      });
      const otherRound = await legacy({
        name: "Sample Earlier",
        stage: "committed",
        checkSizeCents: 9_000_000n,
        roundId: closed.id,
      });
      const passed = await legacy({ name: "Sample Passed", stage: "passed" });
      const noStage = await legacy({ name: "Sample Blank", stage: null });
      const wave = await legacy({ name: "Sample Wave", stage: "target", nextStep: " Wave 2 " });
      const waiting = await legacy({
        name: "Sample Waiting",
        email: "waiting@example.test",
        stage: "committed",
        checkSizeCents: 1_000_000n,
        roundId: open.id,
        mercurySentAt: new Date("2026-02-01T00:00:00Z"),
      });
      // Two prospects at one firm stay two rows, as they are today.
      const firmOne = await legacy({
        name: "Alex One",
        organization: "Sample Fund",
        stage: "target",
      });
      const firmTwo = await legacy({
        name: "Blair Two",
        organization: "Sample Fund",
        stage: "intro",
      });
      const twin = await legacy({ name: "Alex One", organization: "Sample Fund", stage: "target" });
      const triplet = await legacy({
        name: "Alex One",
        organization: "Sample Fund",
        stage: "target",
      });
      // A prospect with an active SAFE has left the pipeline; the SAFE counts, its check size does not.
      const safeHolder = await legacy({
        name: "Sample Safe",
        stage: "committed",
        checkSizeCents: 7_000_000n,
        roundId: open.id,
      });
      await prisma.safe.create({
        data: {
          ...owner,
          contactId: safeHolder.id,
          roundId: open.id,
          investorName: "Sample Safe",
          amountCents: 4_000_000n,
          capCents: 1_000_000_000n,
        },
      });
      // An investor who signed earlier is not a prospect and stays off the pipeline.
      const investor = await prisma.contact.create({
        data: {
          ...owner,
          name: "Sample Signed",
          kind: "investor",
          stage: "committed",
          checkSizeCents: 3_000_000n,
          roundId: open.id,
        },
      });

      // The transition trigger already made records for the rows above; the backfill must alone.
      await prisma.pipelineRecord.deleteMany({ where: owner });
      await pool.query(backfill);
      const first = await counts();
      expect(first).toEqual({ records: 15, people: 15, events: 1 });

      const overview = await getFundraisingOverview(prisma, owner);
      // Committed in the open round at check size, plus the Draft SAFE instead of its check size.
      expect(overview.pendingCents).toBe(5_000_000 + 1_000_000 + 4_000_000);
      const rows = new Map(overview.prospects.map((p) => [p.id, p]));
      expect(rows.has(safeHolder.id)).toBe(false);
      expect(rows.has(investor.id)).toBe(false);
      expect(rows.size).toBe(14);
      expect(rows.get(target.id)).toMatchObject({ stage: "target" });
      expect(rows.get(intro.id)).toMatchObject({ stage: "intro", nextStep: "Ask Riley" });
      expect(rows.get(meeting.id)).toMatchObject({ stage: "meeting" });
      expect(rows.get(diligence.id)).toMatchObject({ stage: "diligence" });
      expect(rows.get(committed.id)).toMatchObject({
        stage: "committed",
        checkSizeCents: 5_000_000,
        roundId: open.id,
      });
      expect(rows.get(otherRound.id)).toMatchObject({ roundId: closed.id });
      expect(rows.get(passed.id)).toMatchObject({ stage: "passed" });
      expect(rows.get(noStage.id)).toMatchObject({ stage: "target" });
      expect(rows.get(waiting.id)?.mercurySentAt).toBe("2026-02-01T00:00:00.000Z");
      expect(rows.get(firmOne.id)).toBeTruthy();
      expect(rows.get(firmTwo.id)).toBeTruthy();
      expect(rows.get(twin.id)).toBeTruthy();

      // Each stage is the first status of its group.
      const statuses = await Promise.all(
        [target, intro, meeting, diligence, committed, passed, noStage].map(
          async (c) => (await recordOf(owner, c.id)).status,
        ),
      );
      expect(statuses).toEqual([
        "not_reached",
        "intro_requested",
        "meeting_booked",
        "diligence",
        "committed",
        "passed",
        "not_reached",
      ]);
      // A Wave label moves to group; notes become one event and stay on the contact.
      expect(await recordOf(owner, wave.id)).toMatchObject({ group: "Wave 2", nextStep: null });
      expect(rows.get(wave.id)?.nextStep).toBeNull();
      const note = await prisma.pipelineEvent.findFirstOrThrow({
        where: { ...owner, kind: "note" },
      });
      expect(note.payload).toEqual({ text: "Met at a demo" });
      expect(rows.get(target.id)?.notes).toBe("Met at a demo");
      // Interest follows Committed and Passed; the firm name is unique however many share it.
      expect(await recordOf(owner, committed.id)).toMatchObject({ interest: "in" });
      expect(await recordOf(owner, passed.id)).toMatchObject({ interest: "out" });
      expect((await recordOf(owner, firmOne.id)).name).toBe("Sample Fund");
      expect((await recordOf(owner, firmTwo.id)).name).toBe("Blair Two, Sample Fund");
      expect((await recordOf(owner, twin.id)).name).toBe("Alex One, Sample Fund");
      expect((await recordOf(owner, triplet.id)).normalizedName).toContain(triplet.id);

      // A second run adds nothing and keeps what changed in between.
      await saveProspect(prisma, owner, { id: intro.id, nextStep: "Owner edit" });
      await pool.query(backfill);
      expect(await counts()).toEqual(first);
      expect((await recordOf(owner, intro.id)).nextStep).toBe("Owner edit");
      expect((await getFundraisingOverview(prisma, owner)).pendingCents).toBe(
        overview.pendingCents,
      );
      // Contacts of other kinds read as having no pipeline fields.
      const contacts = await listContacts(prisma, owner);
      expect(contacts.find((c) => c.id === investor.id)).toMatchObject({
        stage: null,
        checkSizeCents: null,
        pipelineRecord: null,
      });
    });
  });

  describe("one writer", () => {
    it("leaves status, amount and next step alone when a contact's email is edited", async () => {
      const p = await saveContact(prisma, mine, {
        name: "Sample Editor",
        kind: "prospect",
        stage: "meeting",
        checkSizeCents: 2_000_000,
        nextStep: "Send the deck",
      });
      const record = await recordOf(mine, p.id);
      await prisma.pipelineRecord.update({ where: { id: record.id }, data: { status: "met" } });
      const saved = await saveContact(prisma, mine, {
        id: p.id,
        name: p.name,
        email: "editor@example.test",
      });
      expect(saved).toMatchObject({
        email: "editor@example.test",
        stage: "meeting",
        checkSizeCents: 2_000_000,
        nextStep: "Send the deck",
        pipelineRecord: { id: record.id, status: "met" },
      });
    });

    it("keeps the finer status when a save names the stage it is already in", async () => {
      const p = await saveContact(prisma, mine, { name: "Sample Fine", kind: "prospect" });
      const { id } = await recordOf(mine, p.id);
      await prisma.pipelineRecord.update({ where: { id }, data: { status: "intro_made" } });
      await saveProspect(prisma, mine, { id: p.id, stage: "intro" });
      expect((await recordOf(mine, p.id)).status).toBe("intro_made");
      await saveProspect(prisma, mine, { id: p.id, stage: "meeting" });
      expect((await recordOf(mine, p.id)).status).toBe("meeting_booked");
      expect(await prisma.pipelineEvent.count({ where: { recordId: id, kind: "status" } })).toBe(1);
    });

    it("sets Interest from Committed and Passed, and clears Out on leaving Passed", async () => {
      const p = await saveContact(prisma, mine, { name: "Sample Stance", kind: "prospect" });
      await saveProspect(prisma, mine, { id: p.id, stage: "committed" });
      expect((await recordOf(mine, p.id)).interest).toBe("in");
      await saveProspect(prisma, mine, { id: p.id, stage: "passed" });
      expect(await recordOf(mine, p.id)).toMatchObject({
        interest: "out",
        statusBeforePassed: "committed",
      });
      await saveProspect(prisma, mine, { id: p.id, stage: "target" });
      expect(await recordOf(mine, p.id)).toMatchObject({
        interest: null,
        statusBeforePassed: null,
        status: "not_reached",
      });
    });

    it("creates a record for a prospect from any route, and never writes the old columns", async () => {
      const owner = scopeOf(3);
      const open = await saveRound(prisma, owner, round);
      // The Contacts page.
      const fromContacts = await saveContact(prisma, owner, {
        name: "From Contacts",
        kind: "prospect",
      });
      // An agent's contacts_add.
      const fromAgent = await addContactIfNew(prisma, owner, {
        name: "From Agent",
        kind: "prospect",
      });
      // A contact later changed to prospect.
      const vendor = await saveContact(prisma, owner, { name: "From Vendor", kind: "vendor" });
      const turned = await saveContact(prisma, owner, {
        id: vendor.id,
        name: vendor.name,
        kind: "prospect",
      });
      await saveContact(prisma, owner, {
        name: "From Import",
        kind: "prospect",
        stage: "committed",
        checkSizeCents: 500_000,
        nextStep: "Call",
      });
      // Add prospect with its pipeline fields.
      const added = await saveContact(prisma, owner, {
        name: "From Page",
        kind: "prospect",
        stage: "committed",
        checkSizeCents: 700_000,
      });
      expect(added).toMatchObject({
        stage: "committed",
        checkSizeCents: 700_000,
        roundId: open.id,
      });
      const overview = await getFundraisingOverview(prisma, owner);
      expect(overview.prospects.map((p) => p.name).sort()).toEqual([
        "From Agent",
        "From Contacts",
        "From Import",
        "From Page",
        "From Vendor",
      ]);
      expect(overview.pendingCents).toBe(1_200_000);
      expect(await prisma.pipelineRecord.count({ where: owner })).toBe(5);
      for (const c of [fromContacts, fromAgent.contact, turned])
        expect((await recordOf(owner, c.id)).status).toBe("not_reached");
      // Saved twice, one record.
      await saveContact(prisma, owner, { id: fromContacts.id, name: "From Contacts", notes: "x" });
      expect(await prisma.pipelineRecord.count({ where: owner })).toBe(5);
      // The old columns stay frozen.
      const row = await prisma.contact.findUniqueOrThrow({ where: { id: added.id } });
      expect(row).toMatchObject({ stage: null, checkSizeCents: null, roundId: null });
      // A non-prospect gets none.
      const board = await saveContact(prisma, owner, { name: "Board Person", kind: "board" });
      expect(board.pipelineRecord).toBeNull();
    });

    it("gives two prospects at one firm their own rows, with unique record names", async () => {
      const owner = scopeOf(3, spaceB);
      const one = await saveContact(prisma, owner, {
        name: "Alex",
        organization: "Example Peak",
        kind: "prospect",
      });
      const two = await saveContact(prisma, owner, {
        name: "Blair",
        organization: "Example Peak",
        kind: "prospect",
      });
      const firm = await saveContact(prisma, owner, {
        name: "Example Peak",
        organization: "Example Peak",
        kind: "prospect",
      });
      expect((await recordOf(owner, one.id)).name).toBe("Example Peak");
      expect((await recordOf(owner, two.id)).name).toBe("Blair, Example Peak");
      expect((await recordOf(owner, firm.id)).normalizedName).toContain(firm.id);
    });

    it("takes a contact whose kind leaves prospect off the pipeline, as today", async () => {
      const owner = scopeOf(4);
      const open = await saveRound(prisma, owner, round);
      const p = await saveContact(prisma, owner, {
        name: "Sample Leaver",
        kind: "prospect",
        stage: "committed",
        checkSizeCents: 800_000,
      });
      expect(p.roundId).toBe(open.id);
      expect((await getFundraisingOverview(prisma, owner)).pendingCents).toBe(800_000);
      await saveContact(prisma, owner, { id: p.id, name: p.name, kind: "vendor" });
      const overview = await getFundraisingOverview(prisma, owner);
      expect(overview.pendingCents).toBe(0);
      expect(overview.prospects).toEqual([]);
      expect(await prisma.pipelineRecord.count({ where: owner })).toBe(0);
    });
  });

  describe("isolation", () => {
    it("refuses another user's and another space's contact or record", async () => {
      const p = await saveContact(prisma, mine, { name: "Sample Private", kind: "prospect" });
      const { id: recordId } = await recordOf(mine, p.id);
      for (const scope of [sameSpace, otherSpace]) {
        await expect(
          saveProspect(prisma, scope, { id: p.id, stage: "passed" }),
        ).rejects.toBeInstanceOf(IsolationError);
        await expect(
          saveProspect(prisma, scope, { id: recordId, stage: "passed" }),
        ).rejects.toBeInstanceOf(IsolationError);
        expect(
          (await getFundraisingOverview(prisma, scope)).prospects.map((r) => r.id),
        ).not.toContain(p.id);
        expect((await listContacts(prisma, scope)).map((c) => c.id)).not.toContain(p.id);
      }
      expect((await recordOf(mine, p.id)).status).toBe("not_reached");
    });

    it("refuses at the database a person from another user or space, or in two records", async () => {
      const p = await saveContact(prisma, mine, { name: "Sample Solo", kind: "prospect" });
      const q = await saveContact(prisma, mine, { name: "Sample Second", kind: "prospect" });
      const theirs = await saveContact(prisma, sameSpace, {
        name: "Sample Theirs",
        kind: "prospect",
      });
      const elsewhere = await saveContact(prisma, otherSpace, {
        name: "Sample Away",
        kind: "prospect",
      });
      const record = await recordOf(mine, p.id);
      const link = (contactId: string, scope = mine) =>
        prisma.pipelineRecordPerson.create({ data: { ...scope, recordId: record.id, contactId } });
      await expect(link(theirs.id)).rejects.toThrow();
      await expect(link(elsewhere.id)).rejects.toThrow();
      await expect(link(theirs.id, sameSpace)).rejects.toThrow();
      // Already in its own record of this pipeline.
      await expect(link(q.id)).rejects.toThrow();
      // Two primaries.
      const friend = await saveContact(prisma, mine, { name: "Sample Friend", kind: "other" });
      await expect(
        prisma.pipelineRecordPerson.create({
          data: { ...mine, recordId: record.id, contactId: friend.id, isPrimary: true },
        }),
      ).rejects.toThrow();
    });
  });

  describe("records with no person", () => {
    it("keep their row and amount when the last contact is deleted, and take the first person back", async () => {
      const owner = scopeOf(5);
      await saveRound(prisma, owner, round);
      const p = await saveContact(prisma, owner, {
        name: "Sample Lonely",
        kind: "prospect",
        stage: "committed",
        checkSizeCents: 600_000,
      });
      const record = await recordOf(owner, p.id);
      await deleteContact(prisma, owner, p.id);
      const overview = await getFundraisingOverview(prisma, owner);
      expect(overview.pendingCents).toBe(600_000);
      expect(overview.prospects).toHaveLength(1);
      expect(overview.prospects[0]).toMatchObject({
        id: record.id,
        name: "Sample Lonely",
        email: null,
        stage: "committed",
        checkSizeCents: 600_000,
        pipelineRecord: { id: record.id },
      });
      // Moved by its record id, since it has no contact.
      await saveProspect(prisma, owner, { id: record.id, stage: "passed" });
      expect((await getFundraisingOverview(prisma, owner)).pendingCents).toBe(0);
      await saveProspect(prisma, owner, { id: record.id, stage: "committed" });
      // The same name attaches the first person to the record instead of making a second one.
      const back = await saveContact(prisma, owner, { name: "Sample Lonely", kind: "prospect" });
      expect(back.pipelineRecord?.id).toBe(record.id);
      expect(back.stage).toBe("committed");
      expect(await prisma.pipelineRecord.count({ where: owner })).toBe(1);
      const rows = await getFundraisingOverview(prisma, owner);
      expect(rows.prospects.map((r) => r.id)).toEqual([back.id]);
    });

    it("joins the named record even when the first person has another name", async () => {
      const owner = scopeOf(4, spaceB);
      const p = await saveContact(prisma, owner, {
        name: "Sample Named Firm",
        kind: "prospect",
        stage: "committed",
        checkSizeCents: 400_000,
      });
      const record = await recordOf(owner, p.id);
      await deleteContact(prisma, owner, p.id);
      const before = await prisma.pipelineRecord.count({ where: owner });
      const person = await saveContact(prisma, owner, {
        name: "Riley Placeholder",
        organization: "Another Name",
        kind: "prospect",
        pipelineRecordId: record.id,
      });
      expect(person.pipelineRecord?.id).toBe(record.id);
      expect(person).toMatchObject({ stage: "committed", checkSizeCents: 400_000 });
      expect(await prisma.pipelineRecord.count({ where: owner })).toBe(before);
      expect(
        await prisma.pipelineRecordPerson.findFirstOrThrow({ where: { contactId: person.id } }),
      ).toMatchObject({
        isPrimary: true,
      });
      // Another user's record is refused, and nothing is saved.
      await expect(
        saveContact(prisma, scopeOf(6, spaceB), {
          name: "Sample Intruder",
          kind: "prospect",
          pipelineRecordId: record.id,
        }),
      ).rejects.toBeInstanceOf(IsolationError);
      expect(await listContacts(prisma, scopeOf(6, spaceB))).toEqual([]);
    });

    it("stops waiting for Mercury when the last person is deleted", async () => {
      const owner = scopeOf(5, spaceA);
      const p = await saveContact(prisma, owner, {
        name: "Sample Waiter",
        email: "waiter@example.test",
        kind: "prospect",
      });
      const record = await recordOf(owner, p.id);
      await markWaiting(prisma, owner, p.id);
      await deleteContact(prisma, owner, p.id);
      const row = (await getFundraisingOverview(prisma, owner)).prospects.find(
        (r) => r.id === record.id,
      );
      expect(row?.mercurySentAt).toBeNull();
    });

    it("promotes the next person when the primary is deleted", async () => {
      const owner = scopeOf(5, spaceB);
      const p = await saveContact(prisma, owner, { name: "Sample Primary", kind: "prospect" });
      const record = await recordOf(owner, p.id);
      const next = await saveContact(prisma, owner, { name: "Sample Next", kind: "other" });
      await prisma.pipelineRecordPerson.create({
        data: { ...owner, recordId: record.id, contactId: next.id },
      });
      await deleteContact(prisma, owner, p.id);
      const overview = await getFundraisingOverview(prisma, owner);
      expect(overview.prospects.map((r) => r.id)).toEqual([next.id]);
    });

    it("does not count a commitment twice once the contact holding its SAFE is deleted", async () => {
      const owner = scopeOf(6);
      await saveRound(prisma, owner, round);
      const p = await saveContact(prisma, owner, {
        name: "Sample Holder",
        kind: "prospect",
        stage: "committed",
        checkSizeCents: 900_000,
      });
      await saveSafe(prisma, owner, {
        contactId: p.id,
        investorName: "Sample Holder",
        amountCents: 900_000,
        proRata: false,
      });
      expect((await getFundraisingOverview(prisma, owner)).pendingCents).toBe(900_000);
      await deleteContact(prisma, owner, p.id);
      expect((await getFundraisingOverview(prisma, owner)).pendingCents).toBe(900_000);
    });
  });

  // During a rolling deploy an API process still on the old code writes the old contact columns.
  describe("an old process during a deploy", () => {
    const owner = scopeOf(7, spaceB);
    const pendingOf = async () => (await getFundraisingOverview(prisma, owner)).pendingCents;

    it("keeps money and rows right through the transition trigger", async () => {
      const open = await saveRound(prisma, owner, round);
      // A prospect saved by the old code after the backfill ran.
      const added = await prisma.contact.create({
        data: {
          ...owner,
          name: "Sample Old Process",
          kind: "prospect",
          stage: "committed",
          checkSizeCents: 1_000_000n,
          nextStep: "Call",
          roundId: open.id,
        },
      });
      expect(await recordOf(owner, added.id)).toMatchObject({
        status: "committed",
        amountCents: 1_000_000n,
        nextStep: "Call",
        roundId: open.id,
        interest: "in",
      });
      expect(await pendingOf()).toBe(1_000_000);
      // A prospect the new code saved, whose amount the old code then edits.
      const p = await saveContact(prisma, owner, {
        name: "Sample New Process",
        kind: "prospect",
        stage: "committed",
        checkSizeCents: 2_000_000,
      });
      expect(await pendingOf()).toBe(3_000_000);
      await prisma.contact.update({ where: { id: p.id }, data: { checkSizeCents: 2_500_000n } });
      expect(await pendingOf()).toBe(3_500_000);
      await prisma.contact.update({
        where: { id: p.id },
        data: { stage: "passed", roundId: null },
      });
      expect(await recordOf(owner, p.id)).toMatchObject({
        status: "passed",
        roundId: null,
        interest: "out",
        statusBeforePassed: "committed",
      });
      expect(await pendingOf()).toBe(1_000_000);
      await prisma.contact.update({
        where: { id: added.id },
        data: { mercurySentAt: new Date("2026-02-01T00:00:00Z") },
      });
      expect((await recordOf(owner, added.id)).waitingSince).not.toBeNull();
    });

    it("does not let an old save of stale values replace what the new code wrote", async () => {
      const p = await saveContact(prisma, owner, { name: "Sample Stale", kind: "prospect" });
      const { id } = await recordOf(owner, p.id);
      await savePipelineRecord(prisma, owner, id, { status: "met", amountCents: 700_000 });
      // The old dialog sends the columns as it read them: all still empty.
      await prisma.contact.update({
        where: { id: p.id },
        data: { email: "stale@example.test", stage: null, checkSizeCents: null, nextStep: null },
      });
      expect(await recordOf(owner, p.id)).toMatchObject({ status: "met", amountCents: 700_000n });
    });
  });

  describe("SAFE rules", () => {
    const at = "2026-10-20T12:00:00.000Z";
    const mercury = (
      externalId: string,
      over: Partial<MercurySafeInput> = {},
    ): MercurySafeInput => ({
      externalId,
      investorName: "Sample Mercury",
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
    /** A new user with an open round and a Committed firm of two people: a prospect and a saved investor. */
    async function firm(spaceId: string, name: string) {
      const userId = `pipe-safe-${name}-${suffix}`;
      await prisma.user.create({
        data: { id: userId, name: userId, email: `${userId}@example.test` },
      });
      const scope = { spaceId, userId };
      const open = await saveRound(prisma, scope, round);
      const primary = await saveContact(prisma, scope, {
        name: "Sample Partner",
        organization: "Sample Street Capital",
        email: "partner@example.test",
        kind: "prospect",
        stage: "committed",
        checkSizeCents: 5_000_000,
      });
      const record = await recordOf(scope, primary.id);
      const second = await saveContact(prisma, scope, {
        name: "Sample Associate",
        email: "associate@example.test",
        kind: "investor",
      });
      await prisma.pipelineRecordPerson.create({
        data: { ...scope, recordId: record.id, contactId: second.id },
      });
      return { scope, open, primary, second, record };
    }
    const overviewOf = (scope: typeof mine) => getFundraisingOverview(prisma, scope);
    const safeFor = (scope: typeof mine, contactId: string, amountCents = 5_000_000) =>
      saveSafe(prisma, scope, {
        contactId,
        investorName: "Sample Associate",
        amountCents,
        capCents: 1_000_000_000,
        proRata: false,
      });

    it("counts a two-person firm once, whichever person holds the SAFE", async () => {
      const { scope, primary, second, record } = await firm(spaceA, "twoperson");
      // One row and one amount, however many people.
      let view = await overviewOf(scope);
      expect(view.pendingCents).toBe(5_000_000);
      expect(view.prospects.map((p) => p.id)).toEqual([primary.id]);
      // The second person's SAFE takes the firm out at the SAFE's amount, not on top of it.
      const safe = await safeFor(scope, second.id, 3_000_000);
      view = await overviewOf(scope);
      expect(view.pendingCents).toBe(3_000_000);
      expect(view.prospects).toEqual([]);
      // The firm can have only one SAFE in the round, through either person.
      await expect(safeFor(scope, primary.id)).rejects.toBeInstanceOf(SafeActiveError);
      await expect(markWaiting(prisma, scope, primary.id)).rejects.toBeInstanceOf(SafeActiveError);
      // Signed money leaves Pending; canceled, the firm returns at its amount.
      await markSafe(prisma, scope, { id: safe.id, action: "cancel", at });
      view = await overviewOf(scope);
      expect(view.pendingCents).toBe(5_000_000);
      expect(view.prospects.map((p) => p.id)).toEqual([primary.id]);
      expect((await recordOf(scope, second.id)).id).toBe(record.id);
    });

    it("attaches Mercury's SAFE to any person, with the record's round, and ends Waiting", async () => {
      const { scope, open, second, record } = await firm(spaceA, "sync");
      await markWaiting(prisma, scope, second.id);
      expect((await recordOf(scope, second.id)).waitingSince).not.toBeNull();
      await syncMercurySafes(prisma, scope, [
        mercury("m-second", { investorEmail: "associate@example.test", amountCents: 4_000_000 }),
      ]);
      const row = await prisma.safe.findFirstOrThrow({ where: { ...scope, source: "mercury" } });
      expect(row).toMatchObject({ contactId: second.id, roundId: open.id });
      expect(await recordOf(scope, second.id)).toMatchObject({ id: record.id, waitingSince: null });
      const view = await overviewOf(scope);
      expect(view.pendingCents).toBe(4_000_000);
      expect(view.prospects).toEqual([]);
    });

    it("lets a matched investor wait for Mercury, and refuses one on no record", async () => {
      const { scope, second } = await firm(spaceA, "gates");
      const waiting = await markWaiting(prisma, scope, second.id);
      expect(waiting.mercurySentAt).toBeTruthy();
      expect((await overviewOf(scope)).pendingCents).toBe(5_000_000);
      const restored = await notSent(prisma, scope, second.id);
      expect(restored.mercurySentAt).toBeNull();
      expect(restored.kind).toBe("investor");
      const away = await saveContact(prisma, scope, {
        name: "Sample Elsewhere",
        email: "elsewhere@example.test",
        kind: "investor",
      });
      await expect(markWaiting(prisma, scope, away.id)).rejects.toBeInstanceOf(IsolationError);
      await expect(notSent(prisma, scope, away.id)).rejects.toBeInstanceOf(IsolationError);
      // Not another user's, and the kind of a matched person never changes.
      await expect(markWaiting(prisma, sameSpace, second.id)).rejects.toBeInstanceOf(
        IsolationError,
      );
      expect((await prisma.contact.findUniqueOrThrow({ where: { id: second.id } })).kind).toBe(
        "investor",
      );
    });

    it("assigns Mercury's SAFE to any person on a record, taking the record's round", async () => {
      const { scope, open, primary, record } = await firm(spaceA, "assign");
      const advisor = await saveContact(prisma, scope, {
        name: "Sample Advisor",
        kind: "advisor",
      });
      await prisma.pipelineRecordPerson.create({
        data: { ...scope, recordId: record.id, contactId: advisor.id },
      });
      await markWaiting(prisma, scope, primary.id);
      await syncMercurySafes(prisma, scope, [mercury("m-assign")]);
      const loose = await prisma.safe.findFirstOrThrow({ where: { ...scope, source: "mercury" } });
      expect(loose).toMatchObject({ contactId: null, roundId: null });
      const assigned = await assignSafe(prisma, scope, loose.id, advisor.id);
      expect(assigned).toMatchObject({ contactId: advisor.id, roundId: open.id });
      expect((await recordOf(scope, primary.id)).waitingSince).toBeNull();
      expect((await overviewOf(scope)).pendingCents).toBe(5_000_000);
    });

    it("lets an investor with a funded SAFE from an old round get a new one in this round", async () => {
      const { scope, open, primary, second } = await firm(spaceB, "oldround");
      // The funded SAFE belongs to an earlier round.
      const earlier = await prisma.fundraiseRound.create({
        data: { ...scope, name: "Earlier", targetCents: 1n, capCents: 1n, closedAt: new Date() },
      });
      const funded = await prisma.safe.create({
        data: {
          ...scope,
          contactId: second.id,
          roundId: earlier.id,
          investorName: "Sample Associate",
          amountCents: 1_000_000n,
          capCents: 1_000_000_000n,
          sentAt: new Date(at),
          signedByOwnerAt: new Date(at),
          signedByInvestorAt: new Date(at),
          paidAt: new Date(at),
        },
      });
      let view = await overviewOf(scope);
      expect(view.prospects.map((p) => p.id)).toEqual([primary.id]);
      expect(view.pendingCents).toBe(5_000_000);
      await markWaiting(prisma, scope, second.id);
      await notSent(prisma, scope, second.id);
      const fresh = await safeFor(scope, second.id);
      expect(fresh.roundId).toBe(open.id);
      view = await overviewOf(scope);
      expect(view.prospects).toEqual([]);
      expect(view.pendingCents).toBe(5_000_000);
      expect(view.fundedCents).toBe(0);
      // Undoing a cancel weighs only this round's SAFEs, so the old funded one does not block it.
      await markSafe(prisma, scope, { id: fresh.id, action: "cancel", at });
      await markSafe(prisma, scope, { id: fresh.id, action: "cancel", at: null });
      await expect(safeFor(scope, primary.id)).rejects.toBeInstanceOf(SafeActiveError);
      expect(funded.id).toBeTruthy();
    });

    it("counts a SAFE with no round only when it was created after the record", async () => {
      const { scope, primary, record, open } = await firm(spaceB, "noround");
      await closeRound(prisma, scope, open.id);
      const late = await safeFor(scope, primary.id);
      expect(late.roundId).toBeNull();
      expect((await overviewOf(scope)).prospects).toEqual([]);
      await expect(safeFor(scope, primary.id)).rejects.toBeInstanceOf(SafeActiveError);
      // The same SAFE from before the record existed neither hides the row nor blocks a new one.
      await prisma.safe.update({
        where: { id: late.id },
        data: { createdAt: new Date(record.createdAt.getTime() - 60_000) },
      });
      expect((await overviewOf(scope)).prospects.map((p) => p.id)).toEqual([primary.id]);
      await expect(markWaiting(prisma, scope, primary.id)).resolves.toBeTruthy();
    });

    it("refuses any active SAFE for a contact on no record, as before", async () => {
      const { scope, open } = await firm(spaceB, "norecord");
      const away = await saveContact(prisma, scope, { name: "Sample Solo", kind: "investor" });
      const earlier = await prisma.fundraiseRound.create({
        data: { ...scope, name: "Earlier", targetCents: 1n, capCents: 1n, closedAt: new Date() },
      });
      await prisma.safe.create({
        data: {
          ...scope,
          contactId: away.id,
          roundId: earlier.id,
          investorName: "Sample Solo",
          amountCents: 1n,
          capCents: 1n,
        },
      });
      expect(open.closedAt).toBeNull();
      await expect(safeFor(scope, away.id)).rejects.toBeInstanceOf(SafeActiveError);
    });

    it("returns a two-person firm when a signed SAFE is canceled", async () => {
      const { scope, primary } = await firm(spaceB, "signed");
      const safe = await safeFor(scope, primary.id);
      await markSafe(prisma, scope, { id: safe.id, action: "signed", at });
      expect((await overviewOf(scope)).prospects).toEqual([]);
      await markSafe(prisma, scope, { id: safe.id, action: "cancel", at });
      const view = await overviewOf(scope);
      expect(view.prospects.map((p) => p.id)).toEqual([primary.id]);
      expect(view.pendingCents).toBe(5_000_000);
    });

    it("keeps a lone prospect who signed and canceled off the pipeline in that round only", async () => {
      const { scope, open, primary, second } = await firm(spaceB, "signedalone");
      await prisma.pipelineRecordPerson.deleteMany({ where: { ...scope, contactId: second.id } });
      const safe = await safeFor(scope, primary.id);
      await markSafe(prisma, scope, { id: safe.id, action: "signed", at });
      await markSafe(prisma, scope, { id: safe.id, action: "cancel", at });
      let view = await overviewOf(scope);
      expect(view.prospects).toEqual([]);
      expect(view.pendingCents).toBe(0);
      // A later round is new business: the firm is listed, and its old commitment counts nowhere.
      await closeRound(prisma, scope, open.id);
      await saveRound(prisma, scope, { ...round, name: "Series A" });
      view = await overviewOf(scope);
      expect(view.prospects.map((p) => p.id)).toEqual([primary.id]);
      expect(view.pendingCents).toBe(0);
    });

    it("leaves an old funded Mercury SAFE outside the round, and the commitment standing", async () => {
      const { scope, primary, second, record } = await firm(spaceA, "oldmercury");
      // The firm has been on the list for years; the round only started now.
      await prisma.pipelineRecord.update({
        where: { id: record.id },
        data: { createdAt: new Date("2020-01-01T00:00:00Z") },
      });
      const old = new Date("2024-03-01T00:00:00Z");
      await syncMercurySafes(prisma, scope, [
        mercury("m-old", {
          investorEmail: "associate@example.test",
          amountCents: 1_000_000,
          investmentDate: old,
          signedByOwnerAt: old,
          signedByInvestorAt: old,
          paidAt: old,
        }),
      ]);
      const row = await prisma.safe.findFirstOrThrow({ where: { ...scope, source: "mercury" } });
      expect(row).toMatchObject({ contactId: second.id, roundId: null });
      const view = await overviewOf(scope);
      expect(view.fundedCents).toBe(0);
      expect(view.pendingCents).toBe(5_000_000);
      expect(view.prospects.map((p) => p.id)).toEqual([primary.id]);
      await expect(markWaiting(prisma, scope, primary.id)).resolves.toBeTruthy();
    });

    it("takes a Mercury SAFE dated within the round into that round", async () => {
      const { scope, open, second } = await firm(spaceA, "newmercury");
      const today = new Date();
      await syncMercurySafes(prisma, scope, [
        mercury("m-new", {
          investorEmail: "associate@example.test",
          amountCents: 2_000_000,
          investmentDate: today,
          signedByOwnerAt: today,
          signedByInvestorAt: today,
          paidAt: today,
        }),
      ]);
      const row = await prisma.safe.findFirstOrThrow({ where: { ...scope, source: "mercury" } });
      expect(row).toMatchObject({ contactId: second.id, roundId: open.id });
      const view = await overviewOf(scope);
      expect(view.fundedCents).toBe(2_000_000);
      expect(view.pendingCents).toBe(0);
    });

    it("leaves a Mercury SAFE dated after a closed round outside it", async () => {
      const { scope, open, second } = await firm(spaceA, "aftermercury");
      await prisma.fundraiseRound.update({
        where: { id: open.id },
        data: { closedAt: new Date("2026-01-01T00:00:00Z") },
      });
      const later = new Date("2026-03-01T00:00:00Z");
      await syncMercurySafes(prisma, scope, [
        mercury("m-after", { investorEmail: "associate@example.test", investmentDate: later }),
      ]);
      const row = await prisma.safe.findFirstOrThrow({ where: { ...scope, source: "mercury" } });
      expect(row).toMatchObject({ contactId: second.id, roundId: null });
    });

    it("applies the same date rule when Assign attaches an old Mercury SAFE", async () => {
      const { scope, primary, record } = await firm(spaceA, "oldassign");
      await prisma.pipelineRecord.update({
        where: { id: record.id },
        data: { createdAt: new Date("2020-01-01T00:00:00Z") },
      });
      await syncMercurySafes(prisma, scope, [
        mercury("m-oldassign", { investmentDate: new Date("2024-03-01T00:00:00Z") }),
      ]);
      const loose = await prisma.safe.findFirstOrThrow({ where: { ...scope, source: "mercury" } });
      const assigned = await assignSafe(prisma, scope, loose.id, primary.id);
      expect(assigned).toMatchObject({ contactId: primary.id, roundId: null });
      const view = await overviewOf(scope);
      expect(view.pendingCents).toBe(5_000_000);
      expect(view.prospects.map((p) => p.id)).toEqual([primary.id]);
    });

    it("keeps the other person's commitment when a contact with an earlier round's SAFE is deleted", async () => {
      const { scope, open, primary, second } = await firm(spaceB, "deleteold");
      const earlier = await prisma.fundraiseRound.create({
        data: { ...scope, name: "Earlier", targetCents: 1n, capCents: 1n, closedAt: new Date() },
      });
      await prisma.safe.create({
        data: {
          ...scope,
          contactId: second.id,
          roundId: earlier.id,
          investorName: "Sample Associate",
          amountCents: 1_000_000n,
          capCents: 1_000_000_000n,
        },
      });
      await deleteContact(prisma, scope, second.id);
      expect((await recordOf(scope, primary.id)).roundId).toBe(open.id);
      expect((await overviewOf(scope)).pendingCents).toBe(5_000_000);
    });

    it("counts a firm once after a SAFE holder's kind changes", async () => {
      const { scope, primary, second } = await firm(spaceB, "kindchange");
      await safeFor(scope, primary.id, 3_000_000);
      expect((await overviewOf(scope)).pendingCents).toBe(3_000_000);
      await saveContact(prisma, scope, { id: primary.id, name: primary.name, kind: "vendor" });
      const view = await overviewOf(scope);
      expect(view.pendingCents).toBe(3_000_000);
      expect(view.prospects).toEqual([]);
      // With no SAFE to hold it there, a person who stops being a prospect does leave the firm.
      await saveContact(prisma, scope, { id: second.id, name: second.name, kind: "prospect" });
      await saveContact(prisma, scope, { id: second.id, name: second.name, kind: "vendor" });
      expect(
        await prisma.pipelineRecordPerson.count({ where: { ...scope, contactId: second.id } }),
      ).toBe(0);
    });

    afterAll(async () => {
      await prisma.user.deleteMany({ where: { id: { startsWith: "pipe-safe-" } } });
    });
  });

  it("does not let an agent's contact write carry a stage past the writer's scope", async () => {
    const owner = scopeOf(7);
    const p = await saveContact(prisma, owner, {
      name: "Sample Carried",
      kind: "prospect",
      stage: "intro",
    });
    const foreign = await saveRound(prisma, sameSpace, {
      ...round,
      name: `Foreign ${suffix}`,
    }).catch(() => getFundraisingOverview(prisma, sameSpace).then((o) => o.round!));
    await expect(
      saveContact(prisma, owner, {
        id: p.id,
        name: p.name,
        stage: "committed",
        roundId: foreign.id,
      }),
    ).rejects.toBeInstanceOf(IsolationError);
    expect((await recordOf(owner, p.id)).status).toBe("intro_requested");
  });
});
