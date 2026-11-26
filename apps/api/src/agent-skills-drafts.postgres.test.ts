import { randomUUID } from "node:crypto";
import {
  listAgentSkillRecords,
  skillCreateFromTool,
  skillDeleteFromTool,
  skillUpdateFromTool,
  toolRunFromTool,
  toolSourceHash,
} from "@rakazo/adapters";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createAgentSkillsService } from "./agent-skills.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("agent-written skills need approval (PostgreSQL)", () => {
  const run = randomUUID().slice(0, 8);
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let service: ReturnType<typeof createAgentSkillsService>;
  const spaceA = `skd-space-a-${run}`;
  const spaceB = `skd-space-b-${run}`;
  const actor = (spaceId: string, userId: string): Actor => ({
    spaceId,
    userId,
    email: "x@rakazo.test",
    isDeploymentOwner: false,
  });
  const owner = actor(spaceA, `skd-owner-${run}`);
  const sameSpaceOther = actor(spaceA, `skd-other-${run}`);
  const otherSpace = actor(spaceB, `skd-owner-${run}`);
  const activeNames = async (who: Actor) =>
    (await listAgentSkillRecords(prisma, who)).map((skill) => skill.name);
  const draft = (name: string) =>
    skillCreateFromTool(prisma, owner, { name, description: `${name} recipe`, body: "Steps." });

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    for (const id of [spaceA, spaceB]) {
      await prisma.organization.create({
        data: { id: `org-${id}`, name: id, slug: `org-${id}`, createdAt: new Date() },
      });
      await prisma.space.create({
        data: { id, organizationId: `org-${id}`, name: id, isDefault: true },
      });
    }
    service = createAgentSkillsService(prisma);
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({
      where: { id: { in: [spaceA, spaceB].map((s) => `org-${s}`) } },
    });
    await close();
  });

  it("an agent create is a draft that no catalog shows", async () => {
    const created = await draft("Invoice chase");
    expect(created).toMatchObject({ ok: true, status: "draft" });
    expect(String(created.message)).toContain("awaiting the owner's approval");
    expect(await activeNames(owner)).not.toContain("Invoice chase");
    expect((await service.list(owner)).map((s) => s.name)).not.toContain("Invoice chase");
    expect((await service.listWithContent(owner)).map((s) => s.name)).not.toContain(
      "Invoice chase",
    );
    await expect(service.get(owner, { name: "Invoice chase" })).rejects.toThrow();
    expect(await service.drafts(owner)).toEqual([
      expect.objectContaining({ name: "Invoice chase", revision: false }),
    ]);
    await service.discardDraft(owner, String(created.id));
  });

  it("approving makes it active, in the catalog and badged as agent-written", async () => {
    const created = await draft("Weekly recap");
    const approved = await service.approveDraft(owner, String(created.id));
    expect(approved).toMatchObject({ name: "Weekly recap", origin: "agent" });
    expect(await activeNames(owner)).toContain("Weekly recap");
    expect(await service.drafts(owner)).toEqual([]);
  });

  it("discarding deletes the draft", async () => {
    const created = await draft("Throwaway");
    await service.discardDraft(owner, String(created.id));
    expect(await service.drafts(owner)).toEqual([]);
    expect(await prisma.agentSkill.count({ where: { id: String(created.id) } })).toBe(0);
    // The name is free again.
    expect(await draft("Throwaway")).toMatchObject({ ok: true });
    await prisma.agentSkill.deleteMany({ where: { spaceId: spaceA, name: "Throwaway" } });
  });

  it("an agent update of an active skill is a pending revision", async () => {
    const created = await draft("Standup");
    await service.approveDraft(owner, String(created.id));
    const before = await service.get(owner, { skillId: String(created.id) });

    const updated = await skillUpdateFromTool(prisma, owner, {
      skillId: String(created.id),
      body: "Better steps.",
    });
    expect(updated).toMatchObject({ ok: true, status: "revision_pending" });
    const after = await service.get(owner, { skillId: String(created.id) });
    expect(after.content).toBe(before.content);
    expect(await service.drafts(owner)).toEqual([
      expect.objectContaining({ id: created.id, revision: true }),
    ]);

    // Discarding keeps the active text.
    await service.discardDraft(owner, String(created.id));
    expect((await service.get(owner, { skillId: String(created.id) })).content).toBe(
      before.content,
    );

    // Approving applies it.
    await skillUpdateFromTool(prisma, owner, {
      skillId: String(created.id),
      body: "Better steps.",
    });
    await service.approveDraft(owner, String(created.id));
    expect((await service.get(owner, { skillId: String(created.id) })).content).toContain(
      "Better steps.",
    );
    expect(await service.drafts(owner)).toEqual([]);
  });

  it("owner edits in the UI apply directly and settle a pending revision", async () => {
    const created = await draft("Notes");
    await service.approveDraft(owner, String(created.id));
    await skillUpdateFromTool(prisma, owner, { skillId: String(created.id), body: "Agent idea." });
    const edited = await service.update(owner, { skillId: String(created.id), body: "Mine." });
    expect(edited.content).toContain("Mine.");
    expect(await service.drafts(owner)).toEqual([]);
    const made = await service.create(owner, { name: "Direct", description: "d", body: "b" });
    expect(made.origin).toBe("user");
    expect(await activeNames(owner)).toContain("Direct");
  });

  it("an agent edit of its own draft stays a draft", async () => {
    const created = await draft("Still draft");
    const updated = await skillUpdateFromTool(prisma, owner, {
      skillId: String(created.id),
      body: "Edited.",
    });
    expect(updated).toMatchObject({ ok: true, status: "draft" });
    expect(await activeNames(owner)).not.toContain("Still draft");
    await service.discardDraft(owner, String(created.id));
  });

  it("another user or space cannot see, approve or discard the draft", async () => {
    const created = await draft("Private");
    const id = String(created.id);
    for (const other of [sameSpaceOther, otherSpace]) {
      expect(await service.drafts(other)).toEqual([]);
      await expect(service.approveDraft(other, id)).rejects.toThrow();
      await expect(service.discardDraft(other, id)).rejects.toThrow();
    }
    expect(await prisma.agentSkill.findUnique({ where: { id } })).toMatchObject({
      status: "draft",
    });
    // Agent delete tools do not touch drafts they cannot see either.
    expect(await skillDeleteFromTool(prisma, sameSpaceOther, { skillId: id })).toEqual({
      error: "Skill not found.",
    });
    await service.discardDraft(owner, id);
  });

  describe("tools", () => {
    const schema = {
      type: "object",
      required: ["items"],
      properties: { items: { type: "array", items: { type: "number" } } },
    };
    const sum = "function run(i) { return { total: i.items.reduce((a, b) => a + b, 0) }; }";
    const sumPlusOne = "function run(i) { return { total: i.items.reduce((a, b) => a + b, 1) }; }";
    const attended = { allowDraft: true };
    const unattended = { allowDraft: false };
    const call = (name: string, options = unattended) =>
      toolRunFromTool(prisma, owner, { name, input: { items: [1, 2, 3] } }, options);
    const makeTool = async (name: string) => {
      const created = await skillCreateFromTool(prisma, owner, {
        name,
        description: `${name} tool`,
        body: "Use tool_run.",
        toolSource: sum,
        toolInputSchema: schema,
        reads: "Numbers you pass in",
        writes: "Nothing",
      });
      expect(created).toMatchObject({ ok: true, status: "draft" });
      return String(created.id);
    };

    it("a draft tool test-runs only in an attended run, with no hash until approved", async () => {
      const id = await makeTool("sum_tool");
      expect(await call("sum_tool", attended)).toEqual({ result: { total: 6 } });
      expect(await call("sum_tool", unattended)).toMatchObject({ error: expect.any(String) });
      expect((await prisma.agentSkill.findUnique({ where: { id } }))?.toolSourceHash).toBeNull();
      const [shown] = await service.drafts(owner);
      expect(shown?.tool).toMatchObject({
        source: sum,
        hash: toolSourceHash(sum),
        writes: "Nothing",
      });
      await service.discardDraft(owner, id);
    });

    it("approving pins the hash of the source shown, and the tool then runs unattended", async () => {
      const id = await makeTool("pinned_tool");
      await expect(service.approveDraft(owner, id)).rejects.toThrow();
      await expect(service.approveDraft(owner, id, "wrong")).rejects.toThrow();
      const approved = await service.approveDraft(owner, id, toolSourceHash(sum));
      expect(approved.tool).toBe(true);
      expect((await prisma.agentSkill.findUnique({ where: { id } }))?.toolSourceHash).toBe(
        toolSourceHash(sum),
      );
      expect(await call("pinned_tool")).toEqual({ result: { total: 6 } });
      // Input that does not match the schema is refused before it runs.
      expect(
        await toolRunFromTool(
          prisma,
          owner,
          { name: "pinned_tool", input: { items: "x" } },
          unattended,
        ),
      ).toMatchObject({ error: expect.stringContaining("list") });
    });

    it("a draft edited after the owner opened it cannot be approved with the old hash", async () => {
      const id = await makeTool("raced_tool");
      await skillUpdateFromTool(prisma, owner, { skillId: id, toolSource: sumPlusOne });
      await expect(service.approveDraft(owner, id, toolSourceHash(sum))).rejects.toThrow();
      await service.discardDraft(owner, id);
    });

    it("an update of an active tool changes nothing until the owner approves", async () => {
      const id = await makeTool("revised_tool");
      await service.approveDraft(owner, id, toolSourceHash(sum));
      const updated = await skillUpdateFromTool(prisma, owner, {
        skillId: id,
        toolSource: sumPlusOne,
      });
      expect(updated).toMatchObject({ ok: true, status: "revision_pending" });
      expect(await call("revised_tool")).toEqual({ result: { total: 6 } });
      const row = await prisma.agentSkill.findUnique({ where: { id } });
      expect(row).toMatchObject({ toolSource: sum, toolSourceHash: toolSourceHash(sum) });
      const [revision] = await service.drafts(owner);
      expect(revision).toMatchObject({ revision: true, tool: { source: sumPlusOne } });
      await service.approveDraft(owner, id, toolSourceHash(sumPlusOne));
      expect(await call("revised_tool")).toEqual({ result: { total: 7 } });
    });

    it("refuses an active tool whose stored source no longer matches the approved hash", async () => {
      const id = await makeTool("tampered_tool");
      await service.approveDraft(owner, id, toolSourceHash(sum));
      await prisma.agentSkill.update({ where: { id }, data: { toolSource: sumPlusOne } });
      expect(await call("tampered_tool")).toEqual({
        error: "This tool changed since it was approved.",
      });
    });

    it("another user cannot run the tool", async () => {
      const id = await makeTool("mine_tool");
      await service.approveDraft(owner, id, toolSourceHash(sum));
      expect(
        await toolRunFromTool(
          prisma,
          sameSpaceOther,
          { name: "mine_tool", input: { items: [] } },
          unattended,
        ),
      ).toEqual({ error: "Tool not found." });
    });
  });
});
