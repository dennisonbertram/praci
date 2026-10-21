import { createHash, randomUUID } from "node:crypto";
import {
  createRunExecutor,
  dataRoomToolsAllowed,
  driveToolsAllowed,
  legalDataRoomGate,
  legalToolFromTool,
  legalToolNeedsConsent,
  legalToolsAllowed,
  mailToolsAllowed,
  selectBuiltinToolsForRun,
} from "@rakazo/adapters";
import type { Actor } from "@rakazo/contracts";
import {
  DATA_ROOM_DISCLOSURE_VERSION,
  LEGAL_AGENT_BUILTIN_TOOLS,
  legalAgentSpawnKey,
} from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDataRoomRepos, createDb, createRepos } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  legalConsentGrant,
  legalItemLinks,
  legalOverview,
  legalScanNow,
  legalUpdateDeadline,
} from "../../../apps/api/src/legal.ts";
import { ensureLegalAgent, ensureLegalRoutine } from "../../../apps/api/src/legal-agent.ts";

const databaseAvailable = process.env.VERIFY_DATABASE === "1" && Boolean(process.env.DATABASE_URL);

describe.skipIf(!databaseAvailable)("legal tools (PostgreSQL)", () => {
  const run = randomUUID().slice(0, 8);
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let a: Actor;
  let b: Actor;
  let consent = true;
  const extra: Actor[] = [];

  const deps = (actor: Actor) => ({
    prisma,
    scope: { spaceId: actor.spaceId, userId: actor.userId },
    allowed: async () => consent,
  });
  const legal = (actor: Actor, name: string, args: Record<string, unknown>) =>
    legalToolFromTool(name, deps(actor), args) as Promise<any>;
  let dataRoomCalls = 0;
  /** The Legal wrapper around a (stubbed) Data room tool; the tools themselves are tested with the Data room. */
  const room = (actor: Actor, name: string, result: Record<string, unknown>) =>
    legalDataRoomGate(deps(actor), name, async () => {
      dataRoomCalls++;
      return result;
    }) as Promise<any>;

  async function makeActor(tag: string): Promise<Actor> {
    const userId = `lg-user-${tag}-${run}`;
    const orgId = `lg-org-${tag}-${run}`;
    const spaceId = `lg-space-${tag}-${run}`;
    await prisma.user.create({
      data: { id: userId, name: tag, email: `${userId}@rakazo.test`, emailVerified: false },
    });
    await prisma.organization.create({
      data: { id: orgId, name: tag, slug: orgId, createdAt: new Date() },
    });
    await prisma.space.create({
      data: { id: spaceId, organizationId: orgId, name: tag, isDefault: true },
    });
    await prisma.member.create({
      data: {
        id: `${userId}-m`,
        organizationId: orgId,
        userId,
        role: "owner",
        createdAt: new Date(),
      },
    });
    return { userId, spaceId, email: `${userId}@rakazo.test`, isDeploymentOwner: false };
  }

  let counter = 0;
  /** A ready Data Room item with extracted text, as the pipeline leaves it. */
  async function addItem(actor: Actor, name: string, text: string, tagged = true) {
    const repo = createDataRoomRepos(prisma);
    const { item } = await repo.createItem(actor, {
      source: "upload",
      sha256: createHash("sha256").update(`${run}-${counter++}`).digest("hex"),
      name,
      mimeType: "text/plain",
      size: text.length,
      ...(tagged ? { docType: "contract", parties: ["Acme Inc"] } : {}),
    });
    await prisma.dataRoomItemText.create({
      data: { itemId: item.id, spaceId: actor.spaceId, userId: actor.userId, text },
    });
    await repo.replaceChunks(actor, item.id, [
      { ordinal: 0, text, contentHash: createHash("sha256").update(text).digest("hex") },
    ]);
    return prisma.dataRoomItem.update({
      where: { id: item.id },
      data: { status: "ready", revision: { increment: 1 } },
    });
  }

  beforeAll(async () => {
    const db = createDb(process.env.DATABASE_URL as string);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    a = await makeActor("a");
    b = await makeActor("b");
  });

  afterAll(async () => {
    if (!prisma) return;
    for (const actor of [a, b, ...extra]) {
      await prisma.space.deleteMany({ where: { id: actor.spaceId } });
      await prisma.organization.deleteMany({
        where: { slug: actor.userId.replace("user", "org") },
      });
      await prisma.user.deleteMany({ where: { id: actor.userId } });
    }
    await close();
  });

  it("lists unreviewed documents, drops analyzed ones, and lists them again after a revision bump", async () => {
    const item = await addItem(a, "msa.txt", "Master services agreement between Acme Inc and Us.");
    const first = await legal(a, "legal_unreviewed_documents", {});
    expect(first.documents.map((d: any) => d.id)).toEqual([item.id]);
    expect(first.documents[0]).toMatchObject({ docType: "contract", parties: ["Acme Inc"] });

    const saved = await legal(a, "legal_upsert_contract", {
      dataRoomItemId: item.id,
      revision: item.revision,
      title: "Acme MSA",
      contractType: "MSA",
      status: "active",
      counterparties: ["Acme Inc"],
      expirationDate: "2027-03-31",
      autoRenews: true,
      renewalNoticeDays: 30,
      valueCents: "1250000",
      currency: "usd",
    });
    expect(saved.contract).toMatchObject({
      analyzedRevision: item.revision,
      valueCents: "1250000",
      currency: "USD",
      expirationDate: "2027-03-31",
    });
    // The tool derives the renewal and notice dates, so the agent never does date arithmetic.
    expect(saved.derivedDeadlines.map((d: any) => [d.kind, d.dueDate]).sort()).toEqual([
      ["notice", "2027-03-01"],
      ["renewal", "2027-03-31"],
    ]);
    expect((await legal(a, "legal_unreviewed_documents", {})).documents).toEqual([]);

    await prisma.dataRoomItem.update({
      where: { id: item.id },
      data: { revision: { increment: 1 } },
    });
    expect(
      (await legal(a, "legal_unreviewed_documents", {})).documents.map((d: any) => d.id),
    ).toEqual([item.id]);

    // A document the agent found is not legal stops being offered and is never listed.
    const photo = await addItem(a, "photo.txt", "Team photo caption");
    await legal(a, "legal_upsert_contract", {
      dataRoomItemId: photo.id,
      revision: photo.revision,
      notLegal: true,
    });
    const left = await legal(a, "legal_unreviewed_documents", {});
    expect(left.documents.map((d: any) => d.id)).not.toContain(photo.id);
    const contracts = await legal(a, "legal_query", { view: "contracts" });
    expect(contracts.contracts.map((c: any) => c.title)).toEqual(["Acme MSA"]);
  });

  it("creates deadlines without duplicating them, and updates their status", async () => {
    const [contract] = (await legal(a, "legal_query", { view: "contracts" })).contracts;
    const args = {
      contractId: contract.id,
      title: "Pay annual fee",
      dueDate: "2027-01-15",
      kind: "payment",
      sourceQuote: "Fees are due on January 15.",
    };
    const one = await legal(a, "legal_upsert_deadline", args);
    const two = await legal(a, "legal_upsert_deadline", { ...args, notes: "second pass" });
    expect(two.deadline.id).toBe(one.deadline.id);
    expect(two.deadline.notes).toBe("second pass");

    const moved = await legal(a, "legal_upsert_deadline", {
      id: one.deadline.id,
      title: "Pay annual fee",
      dueDate: "2027-01-20",
      kind: "payment",
      status: "done",
    });
    expect(moved.deadline).toMatchObject({ dueDate: "2027-01-20", status: "done" });
    const open = await legal(a, "legal_query", { view: "deadlines" });
    expect(open.deadlines.map((d: any) => d.id)).not.toContain(one.deadline.id);

    expect(
      await legal(a, "legal_upsert_deadline", { ...args, dueDate: "2027-02-30" }),
    ).toHaveProperty("error");
  });

  it("upserts nodes by kind and normalized label, and keeps one edge per relation", async () => {
    const n1 = await legal(a, "legal_upsert_node", { kind: "company", label: "Acme, Inc." });
    const n2 = await legal(a, "legal_upsert_node", { kind: "company", label: "ACME Inc" });
    expect(n2.node.id).toBe(n1.node.id);
    const other = await legal(a, "legal_upsert_node", { kind: "company", label: "Us LLC" });
    const e1 = await legal(a, "legal_link", {
      fromId: other.node.id,
      toId: n1.node.id,
      relation: "Party To",
      sourceQuote: "between Acme and Us",
    });
    const e2 = await legal(a, "legal_link", {
      fromId: other.node.id,
      toId: n1.node.id,
      relation: "party_to",
    });
    expect(e2.edge.id).toBe(e1.edge.id);
    expect(await prisma.legalEdge.count({ where: { fromId: other.node.id } })).toBe(1);
    const hood = await legal(a, "legal_query", { view: "node", nodeId: n1.node.id });
    expect(hood.neighbors.map((n: any) => n.label)).toEqual(["Us LLC"]);
  });

  it("shows nothing of user A to user B and refuses A's ids", async () => {
    const [contract] = (await legal(a, "legal_query", { view: "contracts" })).contracts;
    const node = await prisma.legalNode.findFirstOrThrow({ where: { userId: a.userId } });
    const item = await prisma.dataRoomItem.findFirstOrThrow({ where: { userId: a.userId } });
    expect((await legal(b, "legal_query", { view: "contracts" })).contracts).toEqual([]);
    expect((await legal(b, "legal_query", { view: "deadlines" })).deadlines).toEqual([]);
    expect(await legal(b, "legal_query", { view: "node", nodeId: node.id })).toHaveProperty(
      "error",
    );
    expect((await legal(b, "legal_unreviewed_documents", {})).documents).toEqual([]);
    expect(
      await legal(b, "legal_upsert_contract", {
        dataRoomItemId: item.id,
        revision: item.revision,
        title: "x",
        contractType: "x",
        status: "active",
      }),
    ).toHaveProperty("error");
    expect(
      await legal(b, "legal_upsert_deadline", {
        contractId: contract.id,
        title: "x",
        dueDate: "2027-01-01",
        kind: "other",
      }),
    ).toHaveProperty("error");
    const mine = await legal(b, "legal_upsert_node", { kind: "company", label: "B Corp" });
    expect(
      await legal(b, "legal_link", { fromId: mine.node.id, toId: node.id, relation: "owns" }),
    ).toHaveProperty("error");
    // B reading A's id gets no revision back, so nothing about A's item leaks through the wrapper.
    expect(await room(b, "read_data_room_item", { id: item.id })).not.toHaveProperty("revision");
  });

  it("searches and reads the Data Room with consent, and refuses without it", async () => {
    const item = await prisma.dataRoomItem.findFirstOrThrow({
      where: { userId: a.userId, name: "msa.txt" },
    });
    consent = true;
    const read = await room(a, "read_data_room_item", { id: item.id, text: "Master" });
    expect(read).toMatchObject({ text: "Master", revision: item.revision });

    consent = false;
    dataRoomCalls = 0;
    for (const name of ["search_data_room", "read_data_room_item"]) {
      const refused = await room(a, name, { id: item.id, text: "Master" });
      expect(refused.consentRequired).toBe(true);
      expect(JSON.stringify(refused)).not.toContain("Master");
    }
    expect(dataRoomCalls).toBe(0);
    const refusedList = await legal(a, "legal_unreviewed_documents", {});
    expect(refusedList.consentRequired).toBe(true);
    for (const args of [
      { view: "contracts" },
      { view: "deadlines" },
      { view: "node", label: "Acme" },
    ]) {
      const refusedQuery = await legal(a, "legal_query", args);
      expect(refusedQuery.consentRequired).toBe(true);
      expect(JSON.stringify(refusedQuery)).not.toContain("Acme MSA");
    }
    consent = true;
  });

  it("offers the legal and Data Room tools only to the owner's Legal agent", () => {
    const base = {
      hasProvider: true,
      groupId: null,
      runUserId: "u",
      botUserId: "u",
      trigger: "routine",
      messagingChannelRun: false,
    };
    expect(legalToolsAllowed({ ...base, botSpawnKey: legalAgentSpawnKey("u") })).toBe(true);
    expect(legalToolsAllowed({ ...base, botSpawnKey: null })).toBe(false);
    expect(
      legalToolsAllowed({ ...base, botSpawnKey: legalAgentSpawnKey("u"), trigger: "webhook" }),
    ).toBe(false);
    // A run another agent started gets no Legal tools, and none of the mail, Drive or Data room ones.
    const botMessage = { ...base, trigger: "bot_message" };
    expect(legalToolsAllowed({ ...botMessage, botSpawnKey: legalAgentSpawnKey("u") })).toBe(false);
    expect(mailToolsAllowed(botMessage)).toBe(false);
    expect(driveToolsAllowed(botMessage)).toBe(false);
    expect(dataRoomToolsAllowed(botMessage)).toBe(false);
    const offered = (legalEnabled: boolean, dataRoomEnabled: boolean) =>
      selectBuiltinToolsForRun({
        graphicalToolsAllowed: false,
        groupId: null,
        trigger: "routine",
        semanticMemoryEnabled: false,
        messagingChannelRun: false,
        legalEnabled,
        dataRoomEnabled,
      }).map((tool) => tool.name);
    const roomTools = ["search_data_room", "read_data_room_item"];
    expect(offered(true, true)).toEqual(expect.arrayContaining([...roomTools, "legal_link"]));
    // The Data room tools keep their owner-only gate: being a Legal run does not bypass it.
    expect(offered(true, false).filter((n) => roomTools.includes(n))).toEqual([]);
    expect(offered(true, false)).toContain("legal_link");
    expect(offered(false, true)).toEqual(expect.arrayContaining(roomTools));
    expect(offered(false, true).filter((n) => n.startsWith("legal_"))).toEqual([]);
    // The Legal allowlist reads the Data room but does not add to it.
    expect(LEGAL_AGENT_BUILTIN_TOOLS).toEqual(expect.arrayContaining(roomTools));
    expect(LEGAL_AGENT_BUILTIN_TOOLS).not.toContain("add_to_data_room");
  });

  it("creates one Legal agent on the Muse model with one daily routine, and queues one scan at a time", async () => {
    const queued: string[] = [];
    const api = {
      prisma,
      repos: createRepos(prisma),
      artifacts: {} as never,
      jobs: { enqueue: async (job: { name: string }) => void queued.push(job.name) } as never,
      resolveAi: async () => {
        throw new Error("unused");
      },
    };
    const bot = await ensureLegalAgent(api, a);
    const again = await ensureLegalAgent(api, a);
    expect(again.id).toBe(bot.id);
    expect(bot).toMatchObject({ modelProvider: "openrouter", modelId: "meta/muse-wonder" });
    expect(await prisma.routine.count({ where: { botId: bot.id } })).toBe(1);

    const first = await legalScanNow(api, a);
    const second = await legalScanNow(api, a);
    expect(second.runId).toBe(first.runId);
    expect(await prisma.run.count({ where: { botId: bot.id } })).toBe(1);

    const overview = await legalOverview(api, a);
    expect(overview.agent.botId).toBe(bot.id);
    expect(overview.agent.dailyScanActive).toBe(true);
    await prisma.routine.updateMany({ where: { botId: bot.id }, data: { active: false } });
    expect((await legalOverview(api, a)).agent.dailyScanActive).toBe(false);
    await prisma.routine.updateMany({ where: { botId: bot.id }, data: { active: true } });
    expect(overview.agent.lastScanRun).toEqual({ id: first.runId, status: "running", error: null });
    await prisma.run.update({
      where: { id: first.runId },
      data: { status: "failed", error: "Data Room consent is required." },
    });
    expect((await legalOverview(api, a)).agent.lastScanRun).toEqual({
      id: first.runId,
      status: "failed",
      error: "Data Room consent is required.",
    });
    await prisma.run.update({ where: { id: first.runId }, data: { status: "queued" } });
    expect(overview.contracts[0]).toMatchObject({ title: "Acme MSA", valueCents: "1250000" });
    expect(overview.counts.openDeadlines).toBeGreaterThan(0);
    const deadline = overview.deadlines[0]!;
    const done = await legalUpdateDeadline(api, a, { id: deadline.id, status: "done" });
    expect(done.status).toBe("done");
    await expect(
      legalUpdateDeadline(api, b, { id: deadline.id, status: "open" }),
    ).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("reports the model the agent will really use, and whether it is the preferred one", async () => {
    const api = (model: { provider: string; id: string } | null) => ({
      prisma,
      repos: createRepos(prisma),
      artifacts: {} as never,
      jobs: { enqueue: async () => {} } as never,
      resolveAi: async () => ({ model }) as never,
    });
    expect(
      (await legalOverview(api({ provider: "openrouter", id: "meta/muse-wonder" }), a)).model,
    ).toEqual({ provider: "openrouter", id: "meta/muse-wonder", isPreferred: true });
    expect(
      (await legalOverview(api({ provider: "openrouter", id: "openai/gpt-6-luna" }), a)).model,
    ).toEqual({ provider: "openrouter", id: "openai/gpt-6-luna", isPreferred: false });
    expect((await legalOverview(api(null), a)).model).toBeNull();
  });

  it("starts the Legal agent at xhigh, fills empty model fields on an old agent, and never starts a run", async () => {
    const c = await makeActor("c");
    extra.push(c);
    const api = {
      prisma,
      repos: createRepos(prisma),
      artifacts: {} as never,
      jobs: { enqueue: async () => {} } as never,
      resolveAi: async () => ({ model: null }) as never,
    };
    const bot = await ensureLegalAgent(api, c);
    expect(bot.thinkingLevel).toBe("xhigh");
    expect(await prisma.run.count({ where: { botId: bot.id } })).toBe(0);

    // Choosing the system model leaves the model empty and it stays empty; an empty thinking level is filled.
    await prisma.bot.update({
      where: { id: bot.id },
      data: { modelProvider: null, modelId: null, thinkingLevel: null },
    });
    expect(await ensureLegalAgent(api, c)).toMatchObject({
      modelId: null,
      thinkingLevel: "xhigh",
    });
    // The model Legal was pinned to before Muse Wonder was never a choice, so it moves too.
    await prisma.bot.update({
      where: { id: bot.id },
      data: { modelProvider: "openrouter", modelId: "meta/muse-spark-1.2" },
    });
    expect(await ensureLegalAgent(api, c)).toMatchObject({ modelId: "meta/muse-wonder" });
    expect(await prisma.bot.findUniqueOrThrow({ where: { id: bot.id } })).toMatchObject({
      modelId: "meta/muse-wonder",
    });
    await prisma.bot.update({
      where: { id: bot.id },
      data: { modelProvider: "anthropic", modelId: "x", thinkingLevel: "low" },
    });
    await ensureLegalAgent(api, c);
    expect(await prisma.bot.findUniqueOrThrow({ where: { id: bot.id } })).toMatchObject({
      modelProvider: "anthropic",
      modelId: "x",
      thinkingLevel: "low",
    });

    // Two racing calls still leave one routine.
    await prisma.routine.deleteMany({ where: { botId: bot.id } });
    const [r1, r2] = await Promise.all([
      ensureLegalRoutine(api, c, bot.id),
      ensureLegalRoutine(api, c, bot.id),
    ]);
    expect(r1.id).toBe(r2.id);
    expect(await prisma.routine.count({ where: { botId: bot.id } })).toBe(1);
  });

  it("creates the Legal agent when the overview is read first, so the model is known", async () => {
    const c = await makeActor("e");
    extra.push(c);
    const api = {
      prisma,
      repos: createRepos(prisma),
      artifacts: {} as never,
      jobs: { enqueue: async () => {} } as never,
      resolveAi: async () =>
        ({ model: { provider: "openrouter", id: "meta/muse-wonder" } }) as never,
    };
    const overview = await legalOverview(api, c);
    expect(overview.agent.botId).not.toBeNull();
    expect(overview.model).toMatchObject({ isPreferred: true });
  });

  it("stores the revision the agent read, so a document that changed meanwhile stays unreviewed", async () => {
    const item = await addItem(a, "nda.txt", "Mutual NDA between Acme Inc and Us.");
    await legal(a, "legal_upsert_contract", {
      dataRoomItemId: item.id,
      revision: item.revision - 1,
      title: "Acme NDA",
      contractType: "NDA",
      status: "active",
    });
    expect(
      (await legal(a, "legal_unreviewed_documents", {})).documents.map((d: any) => d.id),
    ).toContain(item.id);
    const read = await room(a, "read_data_room_item", { id: item.id, text: "x" });
    await legal(a, "legal_upsert_contract", {
      dataRoomItemId: item.id,
      revision: read.revision,
      title: "Acme NDA",
      contractType: "NDA",
      status: "active",
    });
    expect(
      (await legal(a, "legal_unreviewed_documents", {})).documents.map((d: any) => d.id),
    ).not.toContain(item.id);
    expect(
      await legal(a, "legal_upsert_contract", { dataRoomItemId: item.id, title: "x" }),
    ).toHaveProperty("error");
  });

  it("re-derives deadlines: closes ones that no longer apply, never touches hand-made or user-closed ones", async () => {
    const item = await addItem(a, "lease.txt", "Office lease.");
    const base = {
      dataRoomItemId: item.id,
      revision: item.revision,
      title: "Office lease",
      contractType: "lease",
      status: "active",
      expirationDate: "2028-06-30",
      autoRenews: false,
      renewalNoticeDays: 90,
      renewalQuote: "Either party may give 90 days written notice of non-renewal.",
    };
    const first = await legal(a, "legal_upsert_contract", base);
    const contractId = first.contract.id;
    expect(first.derivedDeadlines).toHaveLength(2);
    expect(first.derivedDeadlines.map((d: any) => d.title).sort()).toEqual([
      "Expires",
      "Renewal notice deadline",
    ]);
    for (const d of first.derivedDeadlines)
      expect(d.sourceQuote).toContain("90 days written notice");
    const manual = await legal(a, "legal_upsert_deadline", {
      contractId,
      title: "Insurance certificate",
      dueDate: "2028-01-10",
      kind: "compliance",
    });
    const noticeRow = first.derivedDeadlines.find((d: any) => d.kind === "notice");
    await prisma.legalDeadline.update({ where: { id: noticeRow.id }, data: { status: "done" } });

    // A new title replaces the derived expiry deadline instead of duplicating it.
    const renamed = await legal(a, "legal_upsert_contract", { ...base, title: "HQ lease" });
    const open = (await legal(a, "legal_query", { view: "deadlines", contractId })).deadlines;
    expect(open.map((d: any) => d.title).sort()).toEqual(["Expires", "Insurance certificate"]);
    expect(renamed.derivedDeadlines.length).toBeGreaterThan(0);
    expect(
      (await prisma.legalDeadline.findUniqueOrThrow({ where: { id: noticeRow.id } })).status,
    ).toBe("done");

    // Terminating the contract dismisses what is derived and still open; the hand-made one stays.
    await legal(a, "legal_upsert_contract", { ...base, title: "HQ lease", status: "terminated" });
    const left = (await legal(a, "legal_query", { view: "deadlines", contractId })).deadlines;
    expect(left.map((d: any) => d.id)).toEqual([manual.deadline.id]);
  });

  it("opens a new derived deadline when a closed one's date has changed, and keeps the closed one", async () => {
    const item = await addItem(a, "renewal.txt", "Software renewal.");
    const base = {
      dataRoomItemId: item.id,
      revision: item.revision,
      title: "Software licence",
      contractType: "licence",
      status: "active",
      expirationDate: "2029-06-30",
      autoRenews: true,
      renewalNoticeDays: 60,
    };
    const first = await legal(a, "legal_upsert_contract", base);
    const contractId = first.contract.id;
    const notice = first.derivedDeadlines.find((d: any) => d.kind === "notice");
    await legal(a, "legal_upsert_deadline", { ...notice, id: notice.id, status: "done" });

    // Same date again: the closed notice stays closed and no second row appears.
    await legal(a, "legal_upsert_contract", base);
    expect(await prisma.legalDeadline.count({ where: { contractId, kind: "notice" } })).toBe(1);

    // The contract was amended: the new notice date opens, the closed one stays as history.
    await legal(a, "legal_upsert_contract", { ...base, expirationDate: "2031-06-30" });
    const rows = await prisma.legalDeadline.findMany({
      where: { contractId, kind: "notice" },
      orderBy: { dueDate: "asc" },
    });
    expect(rows.map((r) => [r.dueDate.toISOString().slice(0, 10), r.status])).toEqual([
      ["2029-05-01", "done"],
      ["2031-05-01", "open"],
    ]);
  });

  it("lists recently done deadlines so a recurring one can get its next occurrence", async () => {
    const day = (offset: number) =>
      new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
    for (const [title, offset] of [
      ["Recent audit", -10],
      ["Old audit", -400],
    ] as const) {
      await legal(a, "legal_upsert_deadline", {
        title,
        dueDate: day(offset),
        kind: "filing",
        status: "done",
      });
    }
    const recent = await legal(a, "legal_query", {
      view: "deadlines",
      status: "done",
      dueInLastDays: 60,
    });
    const titles = recent.deadlines.map((d: any) => d.title);
    expect(titles).toContain("Recent audit");
    expect(titles).not.toContain("Old audit");
    expect(recent.deadlines.every((d: any) => d.status === "done")).toBe(true);
    const all = await legal(a, "legal_query", { view: "deadlines", status: "done" });
    expect(all.deadlines.map((d: any) => d.title)).toEqual(
      expect.arrayContaining(["Recent audit", "Old audit"]),
    );
  });

  it("hides items from denied connections in the unreviewed list", async () => {
    const connection = await prisma.connection.create({
      data: {
        spaceId: a.spaceId,
        userId: a.userId,
        connectorId: "google",
        provider: "gmail",
        displayName: "Denied mail",
        status: "connected",
      },
    });
    const hidden = await addItem(a, "from-denied-mail.txt", "Imported through a denied account.");
    await prisma.dataRoomItem.update({
      where: { id: hidden.id },
      data: { sourceConnectionId: connection.id },
    });
    const ids = async (denied: string[]) => {
      const result = await legalToolFromTool(
        "legal_unreviewed_documents",
        { ...deps(a), deniedConnectionIds: denied },
        {},
      );
      return result as { remaining: number; documents: { id: string }[] };
    };
    const open = await ids([]);
    expect(open.documents.map((d) => d.id)).toContain(hidden.id);
    const denied = await ids([connection.id]);
    expect(denied.documents.map((d) => d.id)).not.toContain(hidden.id);
    expect(denied.remaining).toBe(open.remaining - 1);
  });

  it("refuses the Legal write tools when consent is off", async () => {
    consent = false;
    try {
      const calls: [string, Record<string, unknown>][] = [
        ["legal_upsert_contract", { dataRoomItemId: "x", revision: 0, notLegal: true }],
        ["legal_upsert_deadline", { title: "T", dueDate: "2030-01-01", kind: "other" }],
        ["legal_upsert_node", { kind: "company", label: "No Consent Co" }],
        ["legal_link", { fromId: "x", toId: "y", relation: "party_to" }],
      ];
      for (const [name, args] of calls) {
        expect(await legal(a, name, args)).toMatchObject({ consentRequired: true });
      }
      expect(
        await prisma.legalNode.count({ where: { userId: a.userId, label: "No Consent Co" } }),
      ).toBe(0);
    } finally {
      consent = true;
    }
  });

  it("removes a contract, its node and the edges it sourced when its Data room item is deleted", async () => {
    const item = await addItem(a, "to-delete.txt", "Soon deleted.");
    const made = await legal(a, "legal_upsert_contract", {
      dataRoomItemId: item.id,
      revision: item.revision,
      title: "Doomed MSA",
      contractType: "msa",
      status: "active",
    });
    const contractNode = await legal(a, "legal_upsert_node", {
      kind: "contract",
      label: "Doomed MSA",
      contractId: made.contract.id,
    });
    const party = await legal(a, "legal_upsert_node", { kind: "company", label: "Survivor Co" });
    await legal(a, "legal_link", {
      fromId: party.node.id,
      toId: contractNode.node.id,
      relation: "party_to",
      dataRoomItemId: item.id,
      sourceQuote: "between Survivor Co and us",
    });

    await legal(a, "legal_upsert_deadline", {
      contractId: made.contract.id,
      title: "Hand-made reminder",
      dueDate: "2030-01-01",
      kind: "other",
    });
    // The delete dialog says what goes with the document; another user learns nothing.
    expect(await legalItemLinks({ prisma }, a, item.id)).toEqual({
      contractTitle: "Doomed MSA",
      deadlines: 1,
    });
    expect(await legalItemLinks({ prisma }, b, item.id)).toEqual({
      contractTitle: null,
      deadlines: 0,
    });

    await createDataRoomRepos(prisma).deleteItem(a, item.id);

    expect(await prisma.legalContract.count({ where: { id: made.contract.id } })).toBe(0);
    expect(await prisma.legalNode.count({ where: { id: contractNode.node.id } })).toBe(0);
    expect(await prisma.legalEdge.count({ where: { toId: contractNode.node.id } })).toBe(0);
    expect(await prisma.legalNode.count({ where: { id: party.node.id } })).toBe(1);
  });

  it("skips the daily wakeup while a scan is already running, and runs it once the scan ended", async () => {
    const enqueued: string[] = [];
    const jobs = {
      enqueue: async (job: { name: string }) => void enqueued.push(job.name),
      cancel: async () => undefined,
      close: async () => undefined,
    };
    const api = {
      prisma,
      repos: createRepos(prisma),
      artifacts: {} as never,
      jobs: jobs as never,
      resolveAi: async () => {
        throw new Error("unused");
      },
    };
    const executor = createRunExecutor({
      prisma,
      jobs,
      events: { append: async () => undefined },
    } as unknown as Parameters<typeof createRunExecutor>[0]);
    const bot = await ensureLegalAgent(api, a);
    const routine = await prisma.routine.findFirstOrThrow({ where: { botId: bot.id } });
    const { runId } = await legalScanNow(api, a);
    const runs = () => prisma.run.count({ where: { botId: bot.id, routineId: routine.id } });
    const before = await runs();
    const due = async () => {
      const at = new Date(Date.now() - 1_000);
      await prisma.routine.update({
        where: { id: routine.id },
        data: { nextRunAt: at, active: true },
      });
      return at.toISOString();
    };

    await executor.wakeRoutine(routine.id, await due());
    expect(await runs()).toBe(before);
    const moved = await prisma.routine.findUniqueOrThrow({ where: { id: routine.id } });
    expect(moved.nextRunAt && moved.nextRunAt.getTime() > Date.now()).toBe(true);

    await prisma.run.update({ where: { id: runId }, data: { status: "completed" } });
    await executor.wakeRoutine(routine.id, await due());
    expect(await runs()).toBe(before + 1);
  });

  it("rechecks consent for Legal mail, Drive and calendar calls", () => {
    for (const name of [
      "mail_get",
      "mail_search",
      "drive_read",
      "drive_search",
      "calendar_list_events",
    ]) {
      expect(legalToolNeedsConsent(name)).toBe(true);
    }
    expect(legalToolNeedsConsent("legal_query")).toBe(false);
    expect(legalToolNeedsConsent("web_search")).toBe(false);
  });

  it("hides contracts, deadlines and graph records from denied connections in legal_query", async () => {
    const connection = await prisma.connection.create({
      data: {
        spaceId: a.spaceId,
        userId: a.userId,
        connectorId: "google",
        provider: "gmail",
        displayName: "Denied for query",
        status: "connected",
      },
    });
    const item = await addItem(a, "denied-query.txt", "Denied contract.");
    await prisma.dataRoomItem.update({
      where: { id: item.id },
      data: { sourceConnectionId: connection.id },
    });
    const made = await legal(a, "legal_upsert_contract", {
      dataRoomItemId: item.id,
      revision: item.revision,
      title: "Denied Source Contract",
      contractType: "msa",
      status: "active",
      expirationDate: "2031-03-03",
    });
    const node = await legal(a, "legal_upsert_node", {
      kind: "contract",
      label: "Denied Source Contract",
      contractId: made.contract.id,
    });
    const party = await legal(a, "legal_upsert_node", { kind: "company", label: "Denied Peer" });
    await legal(a, "legal_link", {
      fromId: party.node.id,
      toId: node.node.id,
      relation: "party_to",
      dataRoomItemId: item.id,
    });
    const asDenied = (args: Record<string, unknown>) =>
      legalToolFromTool(
        "legal_query",
        { ...deps(a), deniedConnectionIds: [connection.id] },
        args,
      ) as Promise<any>;

    expect(
      (await legal(a, "legal_query", { view: "contracts" })).contracts.map((c: any) => c.title),
    ).toContain("Denied Source Contract");
    expect(
      (await asDenied({ view: "contracts" })).contracts.map((c: any) => c.title),
    ).not.toContain("Denied Source Contract");
    const open = (r: any) => r.deadlines.filter((d: any) => d.contractId === made.contract.id);
    expect(open(await legal(a, "legal_query", { view: "deadlines" })).length).toBeGreaterThan(0);
    expect(open(await asDenied({ view: "deadlines" }))).toHaveLength(0);
    expect(await asDenied({ view: "node", nodeId: node.node.id })).toMatchObject({
      error: "No node matched",
    });
    const peer = await asDenied({ view: "node", nodeId: party.node.id });
    expect(peer.edges).toHaveLength(0);
    expect(peer.neighbors).toHaveLength(0);
  });

  it("commits the contract and its derived deadlines together", async () => {
    const item = await addItem(a, "atomic.txt", "Atomic contract.");
    const failing = new Proxy(prisma, {
      get(target, key, receiver) {
        if (key !== "$transaction") return Reflect.get(target, key, receiver);
        return (work: (tx: unknown) => Promise<unknown>) =>
          target.$transaction((tx) =>
            work(
              new Proxy(tx, {
                get(inner, name, r) {
                  if (name !== "legalDeadline") return Reflect.get(inner, name, r);
                  return new Proxy(inner.legalDeadline, {
                    get(model, method, mr) {
                      if (method === "create") throw new Error("deadline write failed");
                      return Reflect.get(model, method, mr);
                    },
                  });
                },
              }),
            ),
          );
      },
    });
    const result = await legalToolFromTool(
      "legal_upsert_contract",
      { ...deps(a), prisma: failing },
      {
        dataRoomItemId: item.id,
        revision: item.revision,
        title: "Atomic",
        contractType: "msa",
        status: "active",
        expirationDate: "2032-01-01",
      },
    );
    expect(result).toMatchObject({ error: "Legal tool failed" });
    expect(await prisma.legalContract.count({ where: { dataRoomItemId: item.id } })).toBe(0);
  });

  it("dismisses the open derived deadlines when a contract is reclassified as not legal", async () => {
    const item = await addItem(a, "reclass.txt", "First read as a contract.");
    const made = await legal(a, "legal_upsert_contract", {
      dataRoomItemId: item.id,
      revision: item.revision,
      title: "Reclassified",
      contractType: "msa",
      status: "active",
      expirationDate: "2033-02-02",
      renewalNoticeDays: 30,
    });
    expect(made.derivedDeadlines).toHaveLength(2);
    await legal(a, "legal_upsert_contract", {
      dataRoomItemId: item.id,
      revision: item.revision,
      notLegal: true,
    });
    const rows = await prisma.legalDeadline.findMany({ where: { contractId: made.contract.id } });
    expect(rows.map((r) => r.status)).toEqual(["dismissed", "dismissed"]);
    expect(rows[0]?.notes).toBe("Dismissed: the contract no longer has this date.");
  });

  it("keeps a node per contract when two contracts share a title", async () => {
    const make = async (name: string) => {
      const item = await addItem(a, name, name);
      const made = await legal(a, "legal_upsert_contract", {
        dataRoomItemId: item.id,
        revision: item.revision,
        title: "Same Title NDA",
        contractType: "nda",
        status: "active",
      });
      const node = await legal(a, "legal_upsert_node", {
        kind: "contract",
        label: "Same Title NDA",
        contractId: made.contract.id,
      });
      return { item, node: node.node.id as string };
    };
    const one = await make("nda-one.txt");
    const two = await make("nda-two.txt");
    expect(one.node).not.toBe(two.node);
    const party = await legal(a, "legal_upsert_node", { kind: "company", label: "NDA Party" });
    await legal(a, "legal_link", { fromId: party.node.id, toId: two.node, relation: "party_to" });
    await createDataRoomRepos(prisma).deleteItem(a, one.item.id);
    expect(await prisma.legalNode.count({ where: { id: two.node } })).toBe(1);
    expect(await prisma.legalEdge.count({ where: { toId: two.node } })).toBe(1);
  });

  it("rejects a revision ahead of the document and keeps accepting a lower one", async () => {
    const item = await addItem(a, "revision.txt", "Revision check.");
    const base = {
      dataRoomItemId: item.id,
      title: "Revision",
      contractType: "msa",
      status: "active",
    };
    const ahead = await legal(a, "legal_upsert_contract", { ...base, revision: item.revision + 1 });
    expect(ahead.error).toContain("newer than the document's current revision");
    expect(await prisma.legalContract.count({ where: { dataRoomItemId: item.id } })).toBe(0);
    const behind = await legal(a, "legal_upsert_contract", { ...base, revision: 0 });
    expect(behind.contract.analyzedRevision).toBe(0);
  });

  it("refuses to link evidence from another user's document", async () => {
    const mine = await legal(a, "legal_upsert_node", { kind: "company", label: "Evidence Co" });
    const other = await legal(a, "legal_upsert_node", { kind: "company", label: "Evidence Two" });
    const foreign = await addItem(b, "secret.txt", "B's document");
    expect(
      await legal(a, "legal_link", {
        fromId: mine.node.id,
        toId: other.node.id,
        relation: "owns",
        dataRoomItemId: foreign.id,
      }),
    ).toHaveProperty("error");
    expect(
      await legal(a, "legal_upsert_deadline", {
        title: "x",
        dueDate: "2027-01-01",
        kind: "other",
        dataRoomItemId: foreign.id,
      }),
    ).toHaveProperty("error");
  });

  it("queues one scan run when two requests arrive together", async () => {
    const c = await makeActor("d");
    extra.push(c);
    const api = {
      prisma,
      repos: createRepos(prisma),
      artifacts: {} as never,
      jobs: { enqueue: async () => {} } as never,
      resolveAi: async () => ({ model: null }) as never,
    };
    const runs = await Promise.all([
      legalScanNow(api, c),
      legalScanNow(api, c),
      legalScanNow(api, c),
    ]);
    expect(new Set(runs.map((r) => r.runId)).size).toBe(1);
    expect(await prisma.run.count({ where: { botId: runs[0]!.botId } })).toBe(1);
    expect(await prisma.routine.count({ where: { botId: runs[0]!.botId } })).toBe(1);
  });

  it("re-queues Data room items that were waiting for consent when the Legal grant is given", async () => {
    const c = await makeActor("f");
    extra.push(c);
    // Files that already carry tags keep them, so only an untagged one is sent for classifying.
    const waiting = await addItem(c, "waiting.txt", "A ready item nobody classified yet.", false);
    const queued: { name: string; payload: any }[] = [];
    const ai = {
      model: { provider: "openrouter", id: "meta/muse-wonder" },
      embedder: null,
      embeddingModel: null,
      recipients: [{ key: "r", name: "OpenRouter", detail: "meta/muse-wonder" }],
      consentKey: "data-room:legal-test",
      allowed: false,
    };
    const api = {
      prisma,
      repos: createRepos(prisma),
      artifacts: {} as never,
      jobs: { enqueue: async (job: any) => void queued.push(job) } as never,
      resolveAi: async () => ai as never,
    };
    await legalConsentGrant(api, c, { key: ai.consentKey, version: DATA_ROOM_DISCLOSURE_VERSION });
    expect(
      queued.filter((j) => j.name === "dataroom.classify").map((j) => j.payload.itemId),
    ).toEqual([waiting.id]);
    expect(await prisma.aiDataConsent.count({ where: { userId: c.userId } })).toBe(1);
    // A stale key is refused and nothing more is queued.
    queued.length = 0;
    await expect(
      legalConsentGrant(api, c, { key: "other", version: DATA_ROOM_DISCLOSURE_VERSION }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(queued).toEqual([]);
  });
});
