import type { BackgroundJob, JobPublisher } from "@rakazo/adapter-kit";
import {
  buildApprovalAskBlock,
  buildXlsx,
  readSpreadsheetTool,
  reconcilePipelineImports,
  runPipelineImport,
  stagePipelineImportFromTool,
} from "@rakazo/adapters";
import type { Actor, PipelineImportRow } from "@rakazo/contracts";
import { investorsAgentSpawnKey } from "@rakazo/contracts";
import {
  applyNextPipelineImportRow,
  asSystem,
  createDb,
  createThreadEvents,
  getFundraisingOverview,
  runAsSystem,
  runAsTenant,
} from "@rakazo/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyPipelineImport, readPipelineImport } from "./pipeline-import.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

// Every firm, person, address and figure here is invented.
describePostgres("list import (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `imp-org-${suffix}`;
  const spaceId = `imp-space-${suffix}`;
  const otherSpaceId = `imp-other-space-${suffix}`;
  const userId = `imp-user-a-${suffix}`;
  const otherUserId = `imp-user-b-${suffix}`;
  const scope = { spaceId, userId };
  const other = { spaceId, userId: otherUserId };
  const actor = { ...scope, email: "a@example.test", isDeploymentOwner: false } as Actor;
  const otherActor = { ...other, email: "b@example.test", isDeploymentOwner: false } as Actor;
  let db: ReturnType<typeof createDb>;
  /** Fixtures and checks see every row; the code under test runs as its tenant, under row security. */
  let prisma: ReturnType<typeof createDb>["prisma"];
  let raw: ReturnType<typeof createDb>["prisma"];
  const asOwner = <T>(fn: () => T | PromiseLike<T>) => runAsTenant(scope, fn);
  let botId: string;
  let threadId: string;
  let enqueued: BackgroundJob[];
  let seq = 0;
  const jobs: JobPublisher = {
    enqueue: async (job) => {
      enqueued.push(job);
    },
    cancel: async () => {},
    close: async () => {},
  };
  const events = () => createThreadEvents(raw);
  const deps = () => ({ prisma: raw, jobs, events: events() });
  const target = () => ({ threadId });

  beforeAll(async () => {
    const runtimeUrl = new URL(databaseUrl!);
    runtimeUrl.searchParams.set("options", "-c role=rakazo_app");
    db = createDb(runtimeUrl.href);
    raw = db.prisma;
    prisma = asSystem(raw);
    await prisma.user.createMany({
      data: [userId, otherUserId].map((id) => ({ id, name: id, email: `${id}@example.test` })),
    });
    await prisma.organization.create({
      data: { id: organizationId, name: "Imp", slug: organizationId, createdAt: new Date() },
    });
    await prisma.space.createMany({
      data: [spaceId, otherSpaceId].map((id) => ({ id, organizationId, name: id })),
    });
    botId = (
      await prisma.bot.create({
        data: {
          ...scope,
          name: "Investors agent",
          color: "blue",
          spawnKey: investorsAgentSpawnKey(userId),
        },
      })
    ).id;
    threadId = (await prisma.thread.create({ data: { ...scope, botId } })).id;
  });
  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: organizationId } }).catch(() => undefined);
    await prisma.user.deleteMany({ where: { id: { in: [userId, otherUserId] } } });
    await raw.$disconnect();
    await db.pool.end();
  });
  beforeEach(async () => {
    enqueued = [];
    await prisma.pipelineImport.deleteMany({ where: { spaceId } });
    await prisma.pipelineRecord.deleteMany({ where: { spaceId } });
    await prisma.contact.deleteMany({ where: { spaceId } });
    await prisma.run.deleteMany({ where: { threadId } });
    await prisma.message.deleteMany({ where: { threadId } });
    await prisma.task.deleteMany({ where: { threadId } });
    await prisma.event.deleteMany({ where: { threadId } });
    await prisma.bot.update({ where: { id: botId }, data: { firewall: false, audience: "owner" } });
  });

  /** A running run, as the executor has one while a list is staged. */
  async function startRun() {
    const task = await prisma.task.create({
      data: { ...scope, botId, threadId, prompt: "p", status: "running" },
    });
    return prisma.run.create({
      data: { ...scope, botId, threadId, taskId: task.id, status: "running", trigger: "user" },
    });
  }
  const toolDeps = (runId: string) => ({
    events: events(),
    jobs,
    scope,
    runId,
    botId,
  });
  async function stage(rows: unknown[], extra: { start?: boolean; runId?: string } = {}) {
    const runId = extra.runId ?? (await startRun()).id;
    return asOwner(() =>
      stagePipelineImportFromTool(toolDeps(runId), { rows, start: extra.start }),
    );
  }

  /** `pipeline_import_review` as the executor runs it: an effect, a prepared card, a pause. */
  async function review(runId?: string) {
    const n = seq++;
    const run = runId
      ? await prisma.run.findUniqueOrThrow({ where: { id: runId } })
      : await startRun();
    const effect = await prisma.externalEffect.create({
      data: {
        spaceId,
        runId: run.id,
        kind: "pipeline_import_review",
        idempotencyKey: `imp-${suffix}-${n}`,
        status: "intended",
        request: {},
      },
    });
    const prepared = await asOwner(() => events().preparePipelineImportCard(scope, effect.id));
    if (!("importId" in prepared)) return { prepared, effect, run };
    const message = await prisma.message.create({
      data: {
        threadId,
        seq: 1000 + n,
        role: "bot",
        runId: run.id,
        botId,
        blocks: [
          buildApprovalAskBlock(effect.id, "pipeline_import_review", {}, [], {
            pipelineImport: prepared,
          }) as never,
        ],
      },
    });
    await prisma.run.update({ where: { id: run.id }, data: { status: "waiting_input" } });
    return { prepared, effect, run, message, ids: { runId: run.id, messageId: message.id } };
  }
  type Card = Awaited<ReturnType<typeof review>> & { ids: { runId: string; messageId: string } };
  const asCard = (c: Awaited<ReturnType<typeof review>>) => {
    if (!("ids" in c)) throw new Error(`no card: ${JSON.stringify(c.prepared)}`);
    return c as Card;
  };
  const read = (c: Card) => asOwner(() => readPipelineImport(deps(), actor, target(), c.ids));
  async function press(c: Card, answers: Record<string, string> = {}, hash?: string) {
    const card = await read(c);
    await asOwner(() =>
      applyPipelineImport(deps(), actor, target(), {
        ...c.ids,
        hash: hash ?? card.hash,
        answers,
      }),
    );
  }
  const drain = (importId: string) =>
    asOwner(() => runPipelineImport(deps(), { ...scope, importId }));
  /** Stage, review, answer, apply. */
  async function importList(rows: unknown[], answers: Record<string, string> = {}) {
    await stage(rows, { start: true });
    const c = await review();
    if (!("ids" in c)) return { c, card: null };
    const card = await read(asCard(c));
    await press(asCard(c), answers);
    await drain((c.prepared as { importId: string }).importId);
    return { c: asCard(c), card };
  }
  const contact = (data: { name: string; email?: string; organization?: string; kind?: string }) =>
    prisma.contact.create({ data: { ...scope, kind: "prospect", ...data } });
  const record = (firm: string) =>
    prisma.pipelineRecord.findFirstOrThrow({
      where: { ...scope, name: firm },
      include: { people: { include: { contact: true } } },
    });
  const contactCount = () => prisma.contact.count({ where: scope });
  const recordCount = () => prisma.pipelineRecord.count({ where: scope });

  describe("staging", () => {
    it("holds rows, changes nothing else, and asks for no approval", async () => {
      const result = await stage([{ firm: "Sample Fund", people: [{ name: "Riley Example" }] }]);
      expect(result).toMatchObject({ staged: 1, added: 1, failed: [] });
      expect(await contactCount()).toBe(0);
      expect(await recordCount()).toBe(0);
    });

    it("refuses an amount, a kind, an id and a round, row by row, and keeps the good rows", async () => {
      const result = await stage([
        { firm: "Good Fund" },
        { firm: "Amount Fund", amountUsd: 250000 },
        { firm: "Kind Fund", kind: "investor" },
        { firm: "Id Fund", id: "contact-1" },
        { firm: "Round Fund", roundId: "round-1" },
      ]);
      expect(result.staged).toBe(1);
      expect((result.failed as { firm: string }[]).map((row) => row.firm)).toEqual([
        "Amount Fund",
        "Kind Fund",
        "Id Fund",
        "Round Fund",
      ]);
    });

    it("refuses a person entry that lists several people", async () => {
      const result = await stage([
        { firm: "Two Fund", people: [{ name: "Riley Example and Sam Example" }] },
      ]);
      expect(result).toMatchObject({ staged: 0 });
      expect((result.failed as { reason: string }[])[0]?.reason).toContain("their own entry");
    });

    it("refuses more than 60 rows in a call", async () => {
      const rows = Array.from({ length: 61 }, (_, i) => ({ firm: `Fund ${i}` }));
      expect(await stage(rows)).toEqual({ error: expect.stringContaining("At most 60") });
    });

    it("a retried call and a repeated firm add no row, and a retry keeps the open card", async () => {
      const run = await startRun();
      const rows = [{ firm: "Sample Fund", people: [{ name: "Riley Example" }] }];
      await stage(rows, { runId: run.id });
      const c = asCard(await review());
      expect(await stage(rows, { runId: run.id })).toMatchObject({ staged: 1, added: 0 });
      expect((await read(c)).status).toBe("reviewing");
      expect(
        await stage([{ firm: "sample fund!", people: [{ name: "Sam Example" }] }], {
          runId: run.id,
        }),
      ).toMatchObject({ staged: 1, added: 0 });
      const stored = await prisma.pipelineImportRow.findFirstOrThrow({ where: scope });
      expect((stored.data as PipelineImportRow).people).toHaveLength(2);
    });

    it("start discards what another run left, and not what this run staged", async () => {
      const first = await startRun();
      await stage([{ firm: "Old Fund" }], { runId: first.id, start: true });
      await stage([{ firm: "Second Fund" }], { runId: first.id, start: true });
      expect(await prisma.pipelineImportRow.count({ where: scope })).toBe(2);
      await stage([{ firm: "New Fund" }], { start: true });
      const open = await prisma.pipelineImport.findFirstOrThrow({
        where: { ...scope, status: "staging" },
        include: { rows: true },
      });
      expect(open.rows.map((row) => row.normalizedFirm)).toEqual(["newfund"]);
    });

    it("runs apart cannot start two open imports", async () => {
      await Promise.all(Array.from({ length: 4 }, (_, i) => stage([{ firm: `Fund ${i}` }])));
      expect(await prisma.pipelineImport.count({ where: { ...scope, status: "staging" } })).toBe(1);
      expect(await prisma.pipelineImportRow.count({ where: scope })).toBe(4);
    });
  });

  describe("the match rules", () => {
    it("same email, any kind: that contact, and its kind stays", async () => {
      const investor = await contact({
        name: "Morgan Sample",
        email: "morgan@example.test",
        organization: "Elsewhere Fund",
        kind: "investor",
      });
      const { card } = await importList([
        {
          firm: "Lantern Fund",
          people: [{ name: "M. Sample", email: "Morgan@Example.test" }],
        },
      ]);
      expect(card?.questions).toEqual([]);
      expect(card?.savedContacts).toEqual(["Morgan Sample · morgan@example.test"]);
      const r = await record("Lantern Fund");
      expect(r.people.map((p) => p.contactId)).toEqual([investor.id]);
      expect(r.people[0]?.contact.kind).toBe("investor");
    });

    it("same name and organization, exactly one: that contact", async () => {
      const saved = await contact({ name: "Avery Example", organization: "Lantern Fund, LLC" });
      const { card } = await importList([
        { firm: "Lantern Fund LLC", people: [{ name: "avery  example" }] },
      ]);
      expect(card?.questions).toEqual([]);
      expect((await record("Lantern Fund LLC")).people.map((p) => p.contactId)).toEqual([saved.id]);
    });

    it("same name at another organization: asks", async () => {
      const saved = await contact({ name: "Drew Example", organization: "Elsewhere Example" });
      await stage([{ firm: "Peak Fund", people: [{ name: "Drew Example" }] }]);
      const c = asCard(await review());
      const card = await read(c);
      expect(card.questions).toHaveLength(1);
      expect(card.questions[0]).toMatchObject({
        kind: "person",
        name: "Drew Example",
        firm: "Peak Fund",
        allowNew: true,
      });
      expect(card.questions[0]?.candidates.map((o) => o.id)).toEqual([saved.id]);
    });

    it("several with that name and organization: asks, never the first one", async () => {
      const first = await contact({ name: "Jamie Sample", organization: "Peak Fund" });
      const second = await contact({ name: "Jamie Sample", organization: "Peak Fund" });
      await stage([{ firm: "Peak Fund", people: [{ name: "Jamie Sample" }] }]);
      const card = await read(asCard(await review()));
      expect(card.questions[0]?.candidates.map((o) => o.id).sort()).toEqual(
        [first.id, second.id].sort(),
      );
    });

    it("a match already on another record: asks, and choosing it leaves it there", async () => {
      await importList([
        { firm: "First Fund", people: [{ name: "Kai Sample", email: "kai@example.test" }] },
      ]);
      const kai = await prisma.contact.findFirstOrThrow({
        where: { ...scope, name: "Kai Sample" },
      });
      await stage([
        { firm: "Second Fund", people: [{ name: "Kai Sample", email: "kai@example.test" }] },
      ]);
      const c = asCard(await review());
      const card = await read(c);
      const question = card.questions[0];
      expect(question?.candidates[0]).toMatchObject({ id: kai.id, stays: "First Fund" });
      // A new contact would repeat the email.
      expect(question?.allowNew).toBe(false);
      await press(c, { [question?.id as string]: kai.id });
      await drain((c.prepared as { importId: string }).importId);
      expect((await record("First Fund")).people.map((p) => p.contactId)).toEqual([kai.id]);
      expect((await record("Second Fund")).people).toEqual([]);
    });

    it("no email, the firm has other saved people, another name: a new contact", async () => {
      await importList([{ firm: "Peak Fund", people: [{ name: "Avery Example" }] }]);
      const { card } = await importList([
        { firm: "Peak Fund", people: [{ name: "Blake Example" }] },
      ]);
      expect(card?.questions).toEqual([]);
      expect(card?.newContacts).toEqual(["Blake Example · Peak Fund"]);
      const r = await record("Peak Fund");
      expect(r.people.map((p) => p.contact.name).sort()).toEqual([
        "Avery Example",
        "Blake Example",
      ]);
      expect(r.people.filter((p) => p.isPrimary)).toHaveLength(1);
    });

    it("nothing matches: a new contact, kind prospect, added by the agent", async () => {
      await importList([{ firm: "Peak Fund", people: [{ name: "Blake Example" }] }]);
      const created = await prisma.contact.findFirstOrThrow({ where: scope });
      expect(created).toMatchObject({ kind: "prospect", organization: "Peak Fund", botId });
    });

    it("two rows naming one person: the later one asks instead of adding a second contact", async () => {
      await stage([
        { firm: "First Fund", people: [{ name: "Kai Sample" }] },
        { firm: "Second Fund", people: [{ name: "Kai Sample" }] },
      ]);
      const c = asCard(await review());
      const card = await read(c);
      expect(card.newContacts).toEqual(["Kai Sample · First Fund"]);
      expect(card.questions[0]?.candidates[0]).toMatchObject({ stays: "First Fund" });
      await press(c, {
        [card.questions[0]?.id as string]: card.questions[0]?.candidates[0]?.id as string,
      });
      await drain((c.prepared as { importId: string }).importId);
      expect(await contactCount()).toBe(1);
      expect((await record("Second Fund")).people).toEqual([]);
    });

    it("another user's contact is never seen", async () => {
      await prisma.contact.create({
        data: { ...other, name: "Blake Example", email: "blake@example.test", kind: "prospect" },
      });
      const { card } = await importList([
        { firm: "Peak Fund", people: [{ name: "Blake Example", email: "blake@example.test" }] },
      ]);
      expect(card?.questions).toEqual([]);
      expect(card?.newContacts).toEqual(["Blake Example · Peak Fund"]);
    });
  });

  describe("a person's email", () => {
    it("the list's email fills a matched saved contact that has none", async () => {
      const saved = await contact({ name: "Nick Example", organization: "Peak Fund" });
      const { card } = await importList([
        { firm: "Peak Fund", people: [{ name: "Nick Example", email: "nick@example.test" }] },
      ]);
      expect(card?.questions).toEqual([]);
      expect(card?.savedContacts).toEqual(["Nick Example · Peak Fund"]);
      expect((await record("Peak Fund")).people.map((p) => p.contactId)).toEqual([saved.id]);
      expect((await prisma.contact.findUniqueOrThrow({ where: { id: saved.id } })).email).toBe(
        "nick@example.test",
      );
    });

    it("a re-import fills the contact it made, once the list gives the email", async () => {
      await importList([{ firm: "Peak Fund", people: [{ name: "Nick Example" }] }]);
      const { c, card } = await importList([
        { firm: "Peak Fund", people: [{ name: "Nick Example", email: "nick@example.test" }] },
      ]);
      expect(card).toMatchObject({ add: 0, update: 1 });
      expect((await read(c)).result).toMatchObject({ updated: 1 });
      const saved = await prisma.contact.findFirstOrThrow({
        where: { ...scope, name: "Nick Example" },
      });
      expect(saved.email).toBe("nick@example.test");
    });

    it("a saved contact's own email is never replaced", async () => {
      const saved = await contact({
        name: "Nick Example",
        organization: "Peak Fund",
        email: "nick@work.test",
      });
      await importList([
        { firm: "Peak Fund", people: [{ name: "Nick Example", email: "nick@example.test" }] },
      ]);
      expect((await prisma.contact.findUniqueOrThrow({ where: { id: saved.id } })).email).toBe(
        "nick@work.test",
      );
    });

    it("the fill is skipped while another contact has that email", async () => {
      const saved = await contact({ name: "Nick Example", organization: "Peak Fund" });
      await stage([
        { firm: "Peak Fund", people: [{ name: "Nick Example", email: "nick@example.test" }] },
      ]);
      const c = asCard(await review());
      await press(c);
      await contact({ name: "Other Example", email: "NICK@EXAMPLE.test" });
      await drain((c.prepared as { importId: string }).importId);
      expect(
        (await prisma.contact.findUniqueOrThrow({ where: { id: saved.id } })).email,
      ).toBeNull();
      expect((await record("Peak Fund")).people.map((p) => p.contactId)).toEqual([saved.id]);
    });
  });

  describe("what a row stores", () => {
    it("a firm with no person is a record with no contact", async () => {
      const { card } = await importList([{ firm: "Riverside Example Fund" }]);
      expect(card?.noPerson).toEqual(["Riverside Example Fund"]);
      expect(await contactCount()).toBe(0);
      expect((await record("Riverside Example Fund")).people).toEqual([]);
    });

    it("priority goes to Wave and its order; check size text to Fund details, never Possible amount", async () => {
      await importList([
        {
          firm: "Peak Fund",
          group: "Wave 2",
          order: 7,
          nextStep: "Ask for an intro",
          introPath: "Via Sam Example",
          details: [{ label: "Stage and check", value: "Seed lead, $250K-$500K" }],
        },
      ]);
      const r = await record("Peak Fund");
      expect(r).toMatchObject({
        group: "Wave 2",
        listOrder: 7,
        nextStep: "Ask for an intro",
        amountCents: null,
        status: "not_reached",
        roundId: null,
      });
      expect(r.details).toEqual([
        expect.objectContaining({
          label: "Stage and check",
          value: "Seed lead, $250K-$500K",
          source: "list",
        }),
        expect.objectContaining({ label: "Intro path", value: "Via Sam Example", source: "list" }),
      ]);
    });

    it("the Pipeline reads Wave, Fund details and Referred by from an imported row", async () => {
      await importList([
        {
          firm: "Peak Fund",
          people: [{ name: "Blake Example" }],
          group: "Wave 2",
          details: [{ label: "Stage and check", value: "Seed lead, $250K-$500K" }],
          introPath: "Via Sam Example",
          referrer: { name: "Sam Example" },
        },
        {
          firm: "Riverside Example Fund",
          group: "Wave 3",
          details: [{ label: "Fit", value: "Strong" }],
          referrer: { name: "Sam Example" },
        },
      ]);
      const sam = await prisma.contact.findFirstOrThrow({
        where: { ...scope, name: "Sam Example" },
      });
      const { prospects } = await asOwner(() => getFundraisingOverview(raw, scope));
      const rowOf = (firm: string) =>
        prospects.find((row) => row.pipelineRecord?.name === firm)?.pipelineRecord;
      // Both shapes: a row with a person, and a firm with no person yet.
      expect(rowOf("Peak Fund")).toMatchObject({
        group: "Wave 2",
        referredBy: { id: sam.id, name: "Sam Example" },
        people: [{ name: "Blake Example" }],
        details: [
          { label: "Stage and check", value: "Seed lead, $250K-$500K", source: "list" },
          { label: "Intro path", value: "Via Sam Example", source: "list" },
        ],
      });
      expect(rowOf("Riverside Example Fund")).toMatchObject({
        group: "Wave 3",
        referredBy: { id: sam.id, name: "Sam Example" },
        people: [],
        details: [{ label: "Fit", value: "Strong", source: "list" }],
      });
    });

    it("a Wave next step moves to the Wave and leaves the next step empty", async () => {
      await importList([{ firm: "Peak Fund", nextStep: "Wave 3" }]);
      expect(await record("Peak Fund")).toMatchObject({ group: "Wave 3", nextStep: null });
    });

    it("a next call date lands at midnight UTC with no time", async () => {
      await importList([{ firm: "Peak Fund", nextCallAt: "2026-05-04" }]);
      expect(await record("Peak Fund")).toMatchObject({
        nextCallAt: new Date("2026-05-04T00:00:00Z"),
        nextCallHasTime: false,
      });
    });
  });

  describe("referrers", () => {
    const rows = [
      { firm: "Fund A", referrer: { name: "Sam Example" } },
      { firm: "Fund B", referrer: { name: "sam example" } },
      { firm: "Fund C", referrer: { name: "Sam Example" } },
    ];

    it("a new referrer is one new contact of kind other, linked on every row", async () => {
      const { card } = await importList(rows);
      expect(card?.questions).toEqual([]);
      expect(card?.newContacts).toEqual(["Sam Example"]);
      const sam = await prisma.contact.findFirstOrThrow({ where: scope });
      expect(await contactCount()).toBe(1);
      expect(sam.kind).toBe("other");
      for (const firm of ["Fund A", "Fund B", "Fund C"]) {
        expect((await record(firm)).referredByContactId).toBe(sam.id);
      }
    });

    it("an unclear referrer is asked once, with how many prospects it covers", async () => {
      const elsewhere = await contact({ name: "Sam Example", organization: "Elsewhere" });
      await stage(rows);
      const c = asCard(await review());
      const card = await read(c);
      expect(card.questions).toHaveLength(1);
      expect(card.questions[0]).toMatchObject({ kind: "referrer", referred: 3 });
      await press(c, { [card.questions[0]?.id as string]: elsewhere.id });
      await drain((c.prepared as { importId: string }).importId);
      expect((await record("Fund B")).referredByContactId).toBe(elsewhere.id);
      expect((await prisma.contact.findUniqueOrThrow({ where: { id: elsewhere.id } })).kind).toBe(
        "prospect",
      );
    });

    it("two addresses that differ only in punctuation are two people", async () => {
      await importList([
        { firm: "Fund A", referrer: { name: "Alex Bell", email: "a.b@example.test" } },
        { firm: "Fund B", referrer: { name: "Alex Bell", email: "ab@example.test" } },
      ]);
      const referrers = await prisma.contact.findMany({
        where: scope,
        select: { email: true },
        orderBy: { email: "asc" },
      });
      expect(referrers.map((r) => r.email)).toEqual(["a.b@example.test", "ab@example.test"]);
      expect((await record("Fund A")).referredByContactId).not.toBe(
        (await record("Fund B")).referredByContactId,
      );
    });

    it("a partial name asks rather than creates; leaving it empty sets nothing", async () => {
      const jordan = await contact({ name: "Jordan Sample", kind: "other" });
      await stage([{ firm: "Fund A", referrer: { name: "J. Sample" } }]);
      const c = asCard(await review());
      const card = await read(c);
      expect(card.questions[0]?.candidates.map((o) => o.id)).toEqual([jordan.id]);
      await press(c, { [card.questions[0]?.id as string]: "skip" });
      await drain((c.prepared as { importId: string }).importId);
      expect((await record("Fund A")).referredByContactId).toBeNull();
      expect(await contactCount()).toBe(1);
    });

    it("a referrer also on the list as a person is the same contact", async () => {
      await stage([
        { firm: "Fund A", people: [{ name: "Sam Example" }] },
        { firm: "Fund B", referrer: { name: "Sam Example" } },
      ]);
      const c = asCard(await review());
      const card = await read(c);
      const question = card.questions[0];
      expect(question?.kind).toBe("referrer");
      await press(c, { [question?.id as string]: question?.candidates[0]?.id as string });
      await drain((c.prepared as { importId: string }).importId);
      expect(await contactCount()).toBe(1);
      expect((await record("Fund B")).referredByContactId).toBe(
        (await record("Fund A")).people[0]?.contactId,
      );
    });

    it("a re-run does not ask again about a referrer already set", async () => {
      const elsewhere = await contact({ name: "Sam Example", organization: "Elsewhere" });
      await stage([{ firm: "Fund A", referrer: { name: "Sam Example" } }]);
      const c = asCard(await review());
      await press(c, { [(await read(c)).questions[0]?.id as string]: elsewhere.id });
      await drain((c.prepared as { importId: string }).importId);
      await stage([{ firm: "Fund A", referrer: { name: "Sam Example" } }], { start: true });
      expect((await review()).prepared).toEqual({ nothing: true, rows: 1 });
    });
  });

  describe("kind and portal", () => {
    it("a saved investor keeps kind, portal access and fields; nothing is overwritten", async () => {
      const seen = new Date("2026-03-01T00:00:00Z");
      const investor = await prisma.contact.create({
        data: {
          ...scope,
          name: "Morgan Sample",
          email: "morgan@example.test",
          organization: "Old Name Capital",
          notes: "Prefers mornings",
          kind: "investor",
          portalLinkSentAt: seen,
          portalLastSeenAt: seen,
        },
      });
      const token = await prisma.investorPortalToken.create({
        data: {
          ...scope,
          contactId: investor.id,
          tokenHash: `hash-${suffix}`,
          expiresAt: new Date("2030-01-01T00:00:00Z"),
        },
      });
      const item = await prisma.dataRoomItem.create({
        data: {
          ...scope,
          source: "upload",
          sha256: "invented",
          name: "Invented deck.pdf",
          mimeType: "application/pdf",
          size: 1n,
        },
      });
      await prisma.investorShare.create({
        data: { ...scope, contactId: investor.id, dataRoomItemId: item.id },
      });
      await importList([
        {
          firm: "Lantern Fund",
          people: [{ name: "Morgan Renamed", email: "morgan@example.test" }],
        },
      ]);
      const after = await prisma.contact.findUniqueOrThrow({ where: { id: investor.id } });
      expect(after).toMatchObject({
        name: "Morgan Sample",
        organization: "Old Name Capital",
        notes: "Prefers mornings",
        kind: "investor",
        portalLinkSentAt: seen,
        portalLastSeenAt: seen,
        portalBlockedAt: null,
      });
      expect(await prisma.investorPortalToken.count({ where: { id: token.id } })).toBe(1);
      expect(await prisma.investorShare.count({ where: { contactId: investor.id } })).toBe(1);
      expect((await record("Lantern Fund")).people.map((p) => p.contactId)).toEqual([investor.id]);
    });
  });

  describe("re-running", () => {
    const list = [
      {
        firm: "Peak Fund",
        group: "Wave 1",
        nextStep: "Ask for an intro",
        people: [{ name: "Blake Example", email: "blake@example.test" }, { name: "Avery Example" }],
        referrer: { name: "Sam Example" },
        details: [{ label: "Fit", value: "Strong" }],
      },
      { firm: "Riverside Example Fund" },
    ];

    it("adds nobody, overwrites nothing, and posts no card", async () => {
      await importList(list);
      const before = await prisma.contact.findMany({ where: scope, orderBy: { id: "asc" } });
      await prisma.pipelineRecord.updateMany({
        where: { ...scope, name: "Peak Fund" },
        data: { nextStep: "Call on Thursday", group: "Wave 9" },
      });
      await stage(list, { start: true });
      const again = await review();
      expect(again.prepared).toEqual({ nothing: true, rows: 2 });
      expect(await prisma.contact.findMany({ where: scope, orderBy: { id: "asc" } })).toEqual(
        before,
      );
      expect(await recordCount()).toBe(2);
      expect(await record("Peak Fund")).toMatchObject({
        nextStep: "Call on Thursday",
        group: "Wave 9",
      });
    });

    it("fills only what is empty on a prospect already there", async () => {
      await importList([{ firm: "Peak Fund", nextStep: "Keep this" }]);
      const { card } = await importList([
        {
          firm: "Peak Fund",
          nextStep: "Not this",
          group: "Wave 4",
          details: [{ label: "Fit", value: "Good" }],
        },
      ]);
      expect(card).toMatchObject({ add: 0, update: 1 });
      const r = await record("Peak Fund");
      expect(r).toMatchObject({ nextStep: "Keep this", group: "Wave 4" });
      expect(r.details).toEqual([expect.objectContaining({ label: "Fit", value: "Good" })]);
    });

    it("a next call is filled only while the record has none", async () => {
      await importList([{ firm: "Peak Fund", nextCallAt: "2026-05-04" }]);
      await importList([{ firm: "Peak Fund", nextCallAt: "2026-06-01" }]);
      expect(await record("Peak Fund")).toMatchObject({
        nextCallAt: new Date("2026-05-04T00:00:00Z"),
        nextCallHasTime: false,
      });
      await importList([{ firm: "Riverside Example Fund" }]);
      const { card } = await importList([
        { firm: "Riverside Example Fund", nextCallAt: "2026-06-01" },
      ]);
      expect(card).toMatchObject({ add: 0, update: 1 });
      expect(await record("Riverside Example Fund")).toMatchObject({
        nextCallAt: new Date("2026-06-01T00:00:00Z"),
        nextCallHasTime: false,
      });
    });

    it("the same person chosen across a firm is not asked about again", async () => {
      const drew = await contact({ name: "Drew Example", organization: "Elsewhere Example" });
      await stage([{ firm: "Peak Fund", people: [{ name: "Drew Example" }] }]);
      const c = asCard(await review());
      await press(c, { [(await read(c)).questions[0]?.id as string]: drew.id });
      await drain((c.prepared as { importId: string }).importId);
      await stage([{ firm: "Peak Fund", people: [{ name: "Drew Example" }] }], { start: true });
      expect((await review()).prepared).toEqual({ nothing: true, rows: 1 });
    });
  });

  describe("one import, one card", () => {
    it("states the title, the counts and what cannot be done on a phone", async () => {
      await contact({ name: "Kai Sample", email: "kai@example.test" });
      await stage([
        { firm: "Fund A", people: [{ name: "Riley Example" }] },
        { firm: "Fund B", people: [{ name: "Kai Sample", email: "kai@example.test" }] },
        { firm: "Fund C" },
      ]);
      const c = asCard(await review());
      expect(c.message.blocks).toEqual([
        expect.objectContaining({
          text: "Add 3 prospects to Fundraising",
          actions: [{ id: "deny", label: "Deny" }],
          status: "pending",
          detail: [
            "Saved contacts are not overwritten.",
            "1 new contact",
            "1 contact already saved",
            "1 prospect with no person yet",
            "Review and add on the web or in the desktop app.",
          ].join("\n"),
        }),
      ]);
    });

    it("a second review replaces the open card, in another run too", async () => {
      await stage([{ firm: "Fund A" }]);
      const first = asCard(await review());
      await stage([{ firm: "Fund B" }]);
      // Staging something new closed the card: it no longer covers the list.
      expect(
        await prisma.externalEffect.findUniqueOrThrow({ where: { id: first.effect.id } }),
      ).toMatchObject({ status: "denied" });
      const second = asCard(await review());
      expect((await read(second)).add).toBe(2);
      const third = asCard(await review());
      const closed = await prisma.message.findUniqueOrThrow({ where: { id: second.message.id } });
      expect(closed.blocks).toEqual([
        expect.objectContaining({ status: "answered", answer: "superseded" }),
      ]);
      expect((await prisma.run.findUniqueOrThrow({ where: { id: second.run.id } })).status).toBe(
        "queued",
      );
      expect((await read(second)).status).toBe("closed");
      expect((await read(third)).status).toBe("reviewing");
      await expect(press(second)).rejects.toThrow();
      expect(await recordCount()).toBe(0);
    });

    it("the press needs every question answered, with one of its own options", async () => {
      const stranger = await prisma.contact.create({
        data: { ...other, name: "Someone Else", kind: "prospect" },
      });
      const saved = await contact({ name: "Drew Example", organization: "Elsewhere" });
      await stage([{ firm: "Peak Fund", people: [{ name: "Drew Example" }] }]);
      const c = asCard(await review());
      const question = (await read(c)).questions[0]?.id as string;
      await expect(press(c)).rejects.toThrow(/left to choose/i);
      await expect(press(c, { [question]: stranger.id })).rejects.toThrow(/left to choose/i);
      expect(await recordCount()).toBe(0);
      await press(c, { [question]: saved.id });
      await drain((c.prepared as { importId: string }).importId);
      expect((await record("Peak Fund")).people[0]?.contactId).toBe(saved.id);
    });

    it("Skip this row adds nothing for that firm", async () => {
      await contact({ name: "Drew Example", organization: "Elsewhere" });
      await stage([{ firm: "Peak Fund", people: [{ name: "Drew Example" }] }, { firm: "Fund B" }]);
      const c = asCard(await review());
      await press(c, { [(await read(c)).questions[0]?.id as string]: "skip" });
      await drain((c.prepared as { importId: string }).importId);
      expect(await recordCount()).toBe(1);
      expect((await read(c)).result).toMatchObject({ added: 1, failed: [] });
    });

    it("a change since the card was read rejects the press", async () => {
      await stage([{ firm: "Peak Fund", people: [{ name: "Drew Example" }] }]);
      const c = asCard(await review());
      const { hash } = await read(c);
      await contact({ name: "Drew Example", organization: "Peak Fund" });
      await expect(press(c, {}, hash)).rejects.toThrow(/changed/i);
      expect(await recordCount()).toBe(0);
    });

    it("the other user cannot read or press it", async () => {
      await stage([{ firm: "Peak Fund" }]);
      const c = asCard(await review());
      await expect(
        runAsTenant(other, () => readPipelineImport(deps(), otherActor, target(), c.ids)),
      ).rejects.toThrow();
      await expect(
        runAsTenant(other, () =>
          applyPipelineImport(deps(), otherActor, target(), { ...c.ids, hash: "x", answers: {} }),
        ),
      ).rejects.toThrow();
    });

    it("Allow cannot apply it, and Deny closes it with nothing written", async () => {
      await stage([{ firm: "Peak Fund" }]);
      const c = asCard(await review());
      const base = { ...c.ids, spaceId, threadId, answeredByUserId: userId };
      const answer = (text: string) =>
        asOwner(() => events().answerRunInput({ ...base, answer: text }));
      expect(await answer("allow")).toBe(false);
      expect(await answer("always")).toBe(false);
      expect(await recordCount()).toBe(0);
      expect(await answer("deny")).toBe(true);
      expect(
        await prisma.externalEffect.findUniqueOrThrow({ where: { id: c.effect.id } }),
      ).toMatchObject({ status: "denied" });
      expect((await read(c)).status).toBe("closed");
      expect(await recordCount()).toBe(0);
    });

    for (const [label, change] of [
      ["firewalled", { firewall: true }],
      ["external", { audience: "external" }],
    ] as const) {
      it(`a ${label} agent's press is refused`, async () => {
        await stage([{ firm: "Peak Fund" }]);
        const c = asCard(await review());
        const { hash } = await read(c);
        await prisma.bot.update({ where: { id: botId }, data: change });
        await expect(press(c, {}, hash)).rejects.toThrow(/cannot/i);
        expect(await recordCount()).toBe(0);
      });
    }

    it("a tainted run's press is refused", async () => {
      await stage([{ firm: "Peak Fund" }]);
      const c = asCard(await review());
      await prisma.run.update({ where: { id: c.run.id }, data: { externalTaint: true } });
      await expect(press(c)).rejects.toThrow(/cannot/i);
      expect(await recordCount()).toBe(0);
    });
  });

  describe("result and recovery", () => {
    it("the result reaches the card and the run, once, with the job queued for it", async () => {
      await stage([{ firm: "Fund A", people: [{ name: "Riley Example" }] }, { firm: "Fund B" }]);
      const c = asCard(await review());
      await press(c);
      expect(enqueued.map((job) => job.name)).toEqual(["pipeline.import"]);
      expect((await prisma.run.findUniqueOrThrow({ where: { id: c.run.id } })).status).toBe(
        "waiting_input",
      );
      expect((await read(c)).status).toBe("applying");
      await drain((c.prepared as { importId: string }).importId);
      const card = await read(c);
      expect(card).toMatchObject({
        status: "done",
        result: { added: 2, updated: 0, newContacts: 1, savedContacts: 0, failed: [] },
      });
      const effect = await prisma.externalEffect.findUniqueOrThrow({ where: { id: c.effect.id } });
      expect(effect.status).toBe("completed");
      expect(effect.result).toMatchObject({ added: 2, failed: [] });
      expect((await prisma.run.findUniqueOrThrow({ where: { id: c.run.id } })).status).toBe(
        "queued",
      );
      expect(enqueued.map((job) => job.name)).toContain("run.continue");
      const message = await prisma.message.findUniqueOrThrow({ where: { id: c.message.id } });
      expect(message.blocks).toEqual([
        expect.objectContaining({
          text: "Added 2 prospects to Fundraising",
          detail: "1 new contact\n0 contacts already saved",
          status: "answered",
        }),
      ]);
    });

    it("a second press changes nothing", async () => {
      await stage([{ firm: "Fund A" }]);
      const c = asCard(await review());
      const { hash } = await read(c);
      await press(c, {}, hash);
      await expect(press(c, {}, hash)).rejects.toThrow();
      expect(enqueued.filter((job) => job.name === "pipeline.import")).toHaveLength(1);
    });

    it("several workers at once and a restart apply each row once", async () => {
      const rows = Array.from({ length: 12 }, (_, i) => ({
        firm: `Fund ${i}`,
        people: [{ name: `Person ${i}` }],
        referrer: { name: "Sam Example" },
      }));
      await stage(rows);
      const c = asCard(await review());
      await press(c);
      const importId = (c.prepared as { importId: string }).importId;
      // A worker that died after three rows.
      for (let i = 0; i < 3; i += 1) {
        await asOwner(() => applyNextPipelineImportRow(raw, scope, importId));
      }
      await Promise.all([drain(importId), drain(importId), drain(importId)]);
      await drain(importId);
      expect(await recordCount()).toBe(12);
      expect(await contactCount()).toBe(13);
      expect(await prisma.pipelineEvent.count({ where: { ...scope, kind: "import" } })).toBe(12);
      expect((await read(c)).result).toMatchObject({ added: 12, newContacts: 13, failed: [] });
      expect(enqueued.filter((job) => job.name === "run.continue")).toHaveLength(1);
    });

    it("one saved contact named on several rows counts once", async () => {
      await contact({ name: "Sam Example", kind: "other" });
      await stage([
        { firm: "Fund A", referrer: { name: "Sam Example" } },
        { firm: "Fund B", referrer: { name: "Sam Example" } },
      ]);
      const c = asCard(await review());
      await press(c);
      await drain((c.prepared as { importId: string }).importId);
      expect((await read(c)).result).toMatchObject({ added: 2, savedContacts: 1 });
    });

    it("a row that fails is reported by name and the others are saved", async () => {
      const gone = await contact({ name: "Drew Example", organization: "Elsewhere" });
      await stage([
        { firm: "Fund A" },
        { firm: "Maple Fund", people: [{ name: "Drew Example" }] },
        { firm: "Fund C" },
      ]);
      const c = asCard(await review());
      await press(c, { [(await read(c)).questions[0]?.id as string]: gone.id });
      await prisma.contact.delete({ where: { id: gone.id } });
      await drain((c.prepared as { importId: string }).importId);
      expect((await read(c)).result).toMatchObject({
        added: 2,
        failed: [{ firm: "Maple Fund", reason: "Could not be saved." }],
      });
      expect(await recordCount()).toBe(2);
    });

    it("the reconciler queues an import whose worker died", async () => {
      await stage([{ firm: "Fund A" }]);
      const c = asCard(await review());
      await press(c);
      enqueued = [];
      await runAsSystem("list import reconcile test", () =>
        reconcilePipelineImports({
          prisma: raw,
          jobs,
          now: new Date(Date.now() + 60 * 60_000),
          batchSize: 10,
          staleMs: 60_000,
        }),
      );
      expect(enqueued).toEqual([
        expect.objectContaining({ name: "pipeline.import", keepExisting: true }),
      ]);
    });
  });

  describe("staging against a press", () => {
    /** Holds the thread row, so the calls below line up behind it in a known order. */
    async function holdThread() {
      let release = () => {};
      let held = () => {};
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const acquired = new Promise<void>((resolve) => {
        held = resolve;
      });
      const holder = runAsSystem("list import race test", () =>
        raw.$transaction(
          async (tx) => {
            await tx.$queryRaw`SELECT id FROM threads WHERE id = ${threadId} FOR UPDATE`;
            held();
            await gate;
          },
          { timeout: 30_000 },
        ),
      );
      await acquired;
      return async () => {
        release();
        await holder;
      };
    }
    /** Until this many sessions wait on a lock. Gives up quietly: the assertions still decide. */
    async function untilBlocked(sessions: number) {
      for (let i = 0; i < 100; i += 1) {
        const [row] = await prisma.$queryRaw<{ waiting: bigint }[]>`
          SELECT count(*) AS waiting FROM pg_stat_activity
          WHERE datname = current_database() AND wait_event_type = 'Lock'`;
        if (Number(row?.waiting) >= sessions) return;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    it("a press that waited first stands: staging after it cannot reopen the import", async () => {
      await stage([{ firm: "Fund A" }]);
      const c = asCard(await review());
      const { hash } = await read(c);
      const importId = (c.prepared as { importId: string }).importId;
      const stagingRun = await startRun();
      const release = await holdThread();
      const pressing = asOwner(() =>
        applyPipelineImport(deps(), actor, target(), { ...c.ids, hash, answers: {} }),
      );
      await untilBlocked(1);
      const staging = stage([{ firm: "Fund B" }], { runId: stagingRun.id });
      await untilBlocked(2);
      await release();
      await pressing;
      await staging;
      const accepted = await prisma.pipelineImport.findUniqueOrThrow({
        where: { id: importId },
        include: { rows: true },
      });
      expect(accepted).toMatchObject({ status: "applying", effectId: c.effect.id });
      expect(accepted.rows.map((row) => row.normalizedFirm)).toEqual(["funda"]);
      await drain(importId);
      expect((await prisma.run.findUniqueOrThrow({ where: { id: c.run.id } })).status).toBe(
        "queued",
      );
      expect(await prisma.pipelineRecord.count({ where: { ...scope, name: "Fund A" } })).toBe(1);
      const next = await prisma.pipelineImport.findFirstOrThrow({
        where: { ...scope, status: "staging" },
        include: { rows: true },
      });
      expect(next.rows.map((row) => row.normalizedFirm)).toEqual(["fundb"]);
    });

    it("a stage that waited first closes the card, and the press changes nothing", async () => {
      await stage([{ firm: "Fund A" }]);
      const c = asCard(await review());
      const { hash } = await read(c);
      const stagingRun = await startRun();
      const release = await holdThread();
      const staging = stage([{ firm: "Fund B" }], { runId: stagingRun.id });
      await untilBlocked(1);
      const pressing = asOwner(() =>
        applyPipelineImport(deps(), actor, target(), { ...c.ids, hash, answers: {} }),
      ).then(
        () => "accepted",
        () => "refused",
      );
      await untilBlocked(2);
      await release();
      await staging;
      expect(await pressing).toBe("refused");
      expect(
        await prisma.externalEffect.findUniqueOrThrow({ where: { id: c.effect.id } }),
      ).toMatchObject({ status: "denied" });
      expect(enqueued.filter((job) => job.name === "pipeline.import")).toEqual([]);
      expect(await recordCount()).toBe(0);
    });
  });

  it("row level security keeps another space out of the import tables", async () => {
    await stage([{ firm: "Peak Fund" }]);
    const counts = (tenant: { spaceId: string; userId: string }) =>
      runAsTenant(tenant, async () => ({
        imports: await raw.pipelineImport.count(),
        rows: await raw.pipelineImportRow.count(),
      }));
    expect(await counts(scope)).toEqual({ imports: 1, rows: 1 });
    expect(await counts({ spaceId: otherSpaceId, userId })).toEqual({ imports: 0, rows: 0 });
  });

  it("a full-size list from a real .xlsx through read_spreadsheet, across stage calls", async () => {
    const header = [
      "Priority",
      "Wave",
      "Firm",
      "Partners",
      "Round role",
      "Check size",
      "Fit",
      "Warm intro path",
      "Contact path",
      "Next step",
    ];
    const introducers = ["Sam Example", "Jordan Placeholder", "Pat Testcase"];
    const sheet: (string | number | null)[][] = [header];
    for (let i = 1; i <= 140; i += 1) {
      const people =
        i % 7 === 0
          ? "" // No named person.
          : i % 5 === 0
            ? `Alex Sample${i}, Blair Sample${i} and Casey Sample${i}`
            : `Drew Sample${i}${i % 10 === 1 ? ` <drew${i}@invented.example.test>` : ""}`;
      sheet.push([
        i % 3 === 0 ? "High" : "Medium",
        `Wave ${(i % 4) + 1}`,
        `Invented Capital ${i}`,
        people,
        i % 2 ? "Lead" : "Follow",
        `$${100 + i}K-$${200 + i}K`,
        i % 3 ? "Strong" : "Maybe",
        i % 4 === 0 ? `Via ${introducers[i % 3]}` : "Cold",
        "LinkedIn",
        i % 6 === 0 ? "Ask for an intro" : null,
      ]);
    }
    const bytes = buildXlsx([{ name: "Investors", rows: sheet }]);
    const artifact = await prisma.artifact.create({
      data: {
        ...scope,
        name: "invented-investors.xlsx",
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        size: bytes.length,
        hash: "invented",
        storageKey: "invented",
      },
    });
    const read = await asOwner(() =>
      readSpreadsheetTool(
        {
          prisma: raw,
          artifacts: { get: async () => bytes } as never,
          scope,
          dataRoomEnabled: false,
        },
        { operationId: "t", traceId: "t", ...scope, signal: new AbortController().signal },
        { artifact_id: artifact.id, max_rows: 1000 },
      ),
    );
    expect(read.truncated).toBeFalsy();
    const cells = read.rows as (string | number | null)[][];
    expect(cells).toHaveLength(140);
    expect(read.header).toEqual(expect.arrayContaining(["Firm", "Check size"]));

    // What the agent does with the rows: split people, keep check size as text, take clear referrers.
    const at = (name: string) => (read.header as string[]).indexOf(name) + 1;
    const stageRows = cells.map((row) => {
      const text = (name: string) => row[at(name)] as string | null;
      const via = text("Warm intro path")?.startsWith("Via ")
        ? (text("Warm intro path") as string).slice(4)
        : undefined;
      return {
        firm: text("Firm"),
        people: (text("Partners") ?? "")
          .split(/,| and /)
          .map((cell) => cell.trim())
          .filter(Boolean)
          .map((cell) => {
            const match = /^(.*?)\s*<(.+)>$/.exec(cell);
            return match ? { name: match[1], email: match[2] } : { name: cell };
          }),
        group: text("Wave"),
        order: row[0],
        nextStep: text("Next step"),
        details: [
          { label: "Stage and check", value: `${text("Round role")}, ${text("Check size")}` },
          { label: "Fit", value: text("Fit") },
          { label: "Contact path", value: text("Contact path") },
        ],
        introPath: text("Warm intro path"),
        ...(via ? { referrer: { name: via } } : {}),
      };
    });

    const run = await startRun();
    let total = 0;
    for (let i = 0; i < stageRows.length; i += 60) {
      const result = await stage(stageRows.slice(i, i + 60), {
        runId: run.id,
        start: i === 0,
      });
      expect(result.failed).toEqual([]);
      total = result.staged as number;
    }
    expect(total).toBe(140);
    expect(await prisma.pipelineImport.count({ where: scope })).toBe(1);
    expect(await recordCount()).toBe(0);

    const c = asCard(await review(run.id));
    const card = await read2(c);
    expect(card.add).toBe(140);
    expect(card.questions).toEqual([]);
    expect(card.noPerson).toHaveLength(20);
    await press(c);
    await drain((c.prepared as { importId: string }).importId);
    const result = (await read2(c)).result;
    expect(result).toMatchObject({ added: 140, failed: [] });
    expect(await recordCount()).toBe(140);
    // Three people on 24 rows, nobody on 20, one on the other 96, and three referrers.
    expect(await contactCount()).toBe(24 * 3 + 96 + 3);
    const referrers = await prisma.contact.findMany({ where: { ...scope, kind: "other" } });
    expect(referrers.map((r) => r.name).sort()).toEqual([...introducers].sort());
    const money = await prisma.pipelineRecord.count({
      where: { ...scope, amountCents: { not: null } },
    });
    expect(money).toBe(0);
    const overview = await asOwner(() => getFundraisingOverview(raw, scope));
    expect(overview.pendingCents).toBe(0);
    expect(overview.prospects).toHaveLength(140);

    // The same list again adds nobody.
    const again = await startRun();
    for (let i = 0; i < stageRows.length; i += 60) {
      await stage(stageRows.slice(i, i + 60), { runId: again.id, start: i === 0 });
    }
    expect((await review(again.id)).prepared).toEqual({ nothing: true, rows: 140 });
    expect(await contactCount()).toBe(24 * 3 + 96 + 3);
    expect(await recordCount()).toBe(140);
  }, 180_000);
  const read2 = (c: Card) => asOwner(() => readPipelineImport(deps(), actor, target(), c.ids));
});
