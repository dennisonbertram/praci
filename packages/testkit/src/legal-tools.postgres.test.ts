import { createHash, randomUUID } from "node:crypto";
import {
  dataRoomToolFromTool,
  legalToolFromTool,
  legalToolsAllowed,
  selectBuiltinToolsForRun,
} from "@rakazo/adapters";
import type { Actor } from "@rakazo/contracts";
import { legalAgentSpawnKey } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDataRoomRepos, createDb, createRepos } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { legalOverview, legalScanNow, legalUpdateDeadline } from "../../../apps/api/src/legal.ts";
import { ensureLegalAgent } from "../../../apps/api/src/legal-agent.ts";

const databaseAvailable = process.env.VERIFY_DATABASE === "1" && Boolean(process.env.DATABASE_URL);

describe.skipIf(!databaseAvailable)("legal tools (PostgreSQL)", () => {
  const run = randomUUID().slice(0, 8);
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let a: Actor;
  let b: Actor;
  let consent = true;

  const deps = (actor: Actor) => ({
    prisma,
    scope: { spaceId: actor.spaceId, userId: actor.userId },
    allowed: async () => consent,
  });
  const legal = (actor: Actor, name: string, args: Record<string, unknown>) =>
    legalToolFromTool(name, deps(actor), args) as Promise<any>;
  const room = (actor: Actor, name: string, args: Record<string, unknown>) =>
    dataRoomToolFromTool(name, deps(actor), args) as Promise<any>;

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
  async function addItem(actor: Actor, name: string, text: string) {
    const repo = createDataRoomRepos(prisma);
    const { item } = await repo.createItem(actor, {
      source: "upload",
      sha256: createHash("sha256").update(`${run}-${counter++}`).digest("hex"),
      name,
      mimeType: "text/plain",
      size: text.length,
      docType: "contract",
      parties: ["Acme Inc"],
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
    for (const actor of [a, b]) {
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
    await legal(a, "legal_upsert_contract", { dataRoomItemId: photo.id, notLegal: true });
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
    expect((await room(b, "search_data_room", { query: "agreement" })).results).toEqual([]);
    expect(await room(b, "read_data_room_item", { id: item.id })).toHaveProperty("error");
  });

  it("searches and reads the Data Room with consent, and refuses without it", async () => {
    const item = await prisma.dataRoomItem.findFirstOrThrow({
      where: { userId: a.userId, name: "msa.txt" },
    });
    consent = true;
    const found = await room(a, "search_data_room", { query: "agreement", docType: "contract" });
    expect(found.results.map((r: any) => r.id)).toContain(item.id);
    const read = await room(a, "read_data_room_item", { id: item.id, offset: 7, limit: 10 });
    expect(read).toMatchObject({ text: "services a", offset: 7, nextOffset: 17 });

    consent = false;
    for (const [name, args] of [
      ["search_data_room", { query: "agreement" }],
      ["read_data_room_item", { id: item.id }],
    ] as const) {
      const refused = await room(a, name, args);
      expect(refused.consentRequired).toBe(true);
      expect(JSON.stringify(refused)).not.toContain("Master");
    }
    const refusedList = await legal(a, "legal_unreviewed_documents", {});
    expect(refusedList.consentRequired).toBe(true);
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
    const offered = (legalEnabled: boolean) =>
      selectBuiltinToolsForRun({
        graphicalToolsAllowed: false,
        groupId: null,
        trigger: "routine",
        semanticMemoryEnabled: false,
        messagingChannelRun: false,
        legalEnabled,
      }).map((tool) => tool.name);
    expect(offered(true)).toEqual(expect.arrayContaining(["search_data_room", "legal_link"]));
    expect(
      offered(false).filter((n) => n.startsWith("legal_") || n.endsWith("data_room_item")),
    ).toEqual([]);
  });

  it("creates one Legal agent on the Muse model with one daily routine, and queues one scan at a time", async () => {
    const queued: string[] = [];
    const api = {
      prisma,
      repos: createRepos(prisma),
      jobs: { enqueue: async (job: { name: string }) => void queued.push(job.name) } as never,
      resolveAi: async () => {
        throw new Error("unused");
      },
    };
    const bot = await ensureLegalAgent(api, a);
    const again = await ensureLegalAgent(api, a);
    expect(again.id).toBe(bot.id);
    expect(bot).toMatchObject({ modelProvider: "openrouter", modelId: "meta/muse-spark-1.2" });
    expect(await prisma.routine.count({ where: { botId: bot.id } })).toBe(1);

    const first = await legalScanNow(api, a);
    const second = await legalScanNow(api, a);
    expect(second.runId).toBe(first.runId);
    expect(await prisma.run.count({ where: { botId: bot.id } })).toBe(1);

    const overview = await legalOverview(api, a);
    expect(overview.agent.botId).toBe(bot.id);
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
});
