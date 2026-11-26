import { randomUUID } from "node:crypto";
import { createRouterClient } from "@orpc/server";
import {
  deleteExpiredHeldValues,
  deleteExpiredTeachData,
  EncryptedSecretStore,
  storeBotSecret,
  taughtSkillPromptForRoutine,
} from "@rakazo/adapters";
import type { Actor } from "@rakazo/contracts";
import { decodeLoginSecret, encodeLoginSecret } from "@rakazo/contracts";
import { ASK_SIGN_IN_STEP, PROTECTED_STEP } from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import { createDb, createRepos } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";
import { createTaughtSkillsService } from "./taught-skills.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

describePostgres("teach by demonstration (PostgreSQL)", () => {
  const suffix = randomUUID().slice(0, 8);
  const id = (name: string) => `tbd-${name}-${suffix}`;
  const orgId = id("org");
  const spaceId = id("space");
  const ownerId = id("owner");
  const strangerId = id("stranger");
  const actor = (userId: string): Actor => ({
    userId,
    spaceId,
    email: `${userId}@rakazo.test`,
    isDeploymentOwner: false,
  });
  const owner = actor(ownerId);
  const stranger = actor(strangerId);
  const secrets = new EncryptedSecretStore("test-only-encryption-key");
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let botId: string;
  let otherBotId: string;
  let service: ReturnType<typeof createTaughtSkillsService>;

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await db.prisma.$disconnect();
      await db.pool.end();
    };
    for (const user of [ownerId, strangerId]) {
      await prisma.user.create({
        data: { id: user, name: user, email: `${user}@rakazo.test`, emailVerified: false },
      });
    }
    await prisma.organization.create({
      data: { id: orgId, name: orgId, slug: orgId, createdAt: new Date() },
    });
    await prisma.space.create({
      data: { id: spaceId, organizationId: orgId, name: "General", isDefault: true },
    });
    for (const user of [ownerId, strangerId]) {
      await prisma.member.create({
        data: {
          id: id(`m-${user}`),
          organizationId: orgId,
          userId: user,
          role: "member",
          createdAt: new Date(),
        },
      });
    }
    const repos = createRepos(prisma);
    const make = (name: string) =>
      repos.createBot(owner, {
        name,
        title: "",
        description: "",
        instructions: "",
        notifyOnFinish: false,
      });
    botId = (await make("Teacher")).id;
    otherBotId = (await make("Other")).id;
    service = createTaughtSkillsService({
      prisma,
      events: {
        append: vi.fn(),
        notify: vi.fn(),
        finalizeComputerControlRelease: vi.fn(),
      } as never,
      jobs: { enqueue: vi.fn(), cancel: vi.fn() } as never,
      sandbox: { observe: vi.fn() } as never,
      home: {} as never,
      dataDir: "/tmp",
      secrets,
      putLogin: async (who, bot, login) => {
        await storeBotSecret({
          prisma,
          secretStore: secrets,
          scope: { userId: who.userId, spaceId: who.spaceId, botId: bot },
          destination: { name: login.name, origin: login.site, auth: { type: "login" } },
          plaintext: encodeLoginSecret({ username: login.username, password: login.password }),
        });
      },
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.bot.deleteMany({ where: { spaceId } });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, strangerId] } } });
    await close();
  });

  async function recording(goal = "Sign in to the CRM") {
    return prisma.taughtSkill.create({
      data: {
        spaceId,
        botId,
        userId: ownerId,
        goal,
        status: "recording",
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60_000),
        recording: { events: [], snapshots: [] },
      },
    });
  }

  const type = async (text: string, field?: string) => {
    for (const key of text) {
      await service.recordInput(owner, botId, { kind: "key", key, ...(field ? { field } : {}) });
    }
  };

  /** Types a username, Tab, then a password into a field labelled Password (no Protected input). */
  async function teachSignIn() {
    const skill = await recording();
    await type("alice");
    await service.recordInput(owner, botId, { kind: "key", key: "Tab" });
    await type("hunter2", "Password");
    await service.recordInput(owner, botId, { kind: "key", key: "Enter" });
    const stopped = await service.stop(owner, skill.id);
    return { skill, stopped };
  }

  it("never stores a typed password, holds it encrypted, and offers it as a login", async () => {
    const { skill, stopped } = await teachSignIn();
    expect(stopped.playbook.steps).toEqual([
      'Type "alice".',
      "Press key: Tab.",
      PROTECTED_STEP,
      "Press key: Enter.",
    ]);
    expect(stopped.loginPrompts).toEqual([{ stepIndex: 2, field: "Password", username: "alice" }]);
    const row = await prisma.taughtSkill.findUniqueOrThrow({ where: { id: skill.id } });
    expect(JSON.stringify(row)).not.toContain("hunter2");
    const held = await prisma.teachHeldValue.findMany({ where: { skillId: skill.id } });
    expect(held).toHaveLength(1);
    expect(held[0]?.ciphertext).not.toContain("hunter2");
    expect(held[0]?.stepIndex).toBe(2);
    expect(held[0]?.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 30 * 60_000);
  });

  it("saveLogin creates a bot login, rewrites the steps and deletes the held value", async () => {
    const { skill } = await teachSignIn();
    const saved = await service.saveLogin(owner, {
      skillId: skill.id,
      stepIndex: 2,
      name: "crm",
      site: "https://crm.example.test/login",
      username: "alice",
    });
    expect(saved.playbook.steps).toEqual([
      "Fill saved login crm into Username.",
      "Press key: Tab.",
      "Fill saved login crm into Password.",
      "Press key: Enter.",
    ]);
    expect(saved.loginPrompts).toEqual([]);
    expect(await prisma.teachHeldValue.count({ where: { skillId: skill.id } })).toBe(0);
    const secret = await prisma.botSecret.findFirstOrThrow({
      where: { botId, userId: ownerId, name: "crm" },
    });
    expect(secret.origin).toBe("https://crm.example.test");
    // The login holds exactly what was typed, readable only through the secret store.
    expect(decodeLoginSecret(await secrets.load(secret.ciphertext, secret.id))).toEqual({
      username: "alice",
      password: "hunter2",
    });
    // Saving again has nothing left to save.
    await expect(
      service.saveLogin(owner, {
        skillId: skill.id,
        stepIndex: 2,
        name: "crm",
        site: "https://crm.example.test",
        username: "alice",
      }),
    ).rejects.toThrow();
  });

  it("only rewrites the typed username step when the user confirmed that exact value", async () => {
    const { skill } = await teachSignIn();
    const saved = await service.saveLogin(owner, {
      skillId: skill.id,
      stepIndex: 2,
      name: "crm2",
      site: "https://crm.example.test",
      username: "alice@example.test",
    });
    expect(saved.playbook.steps).toEqual([
      'Type "alice".',
      "Press key: Tab.",
      "Fill saved login crm2 into Password.",
      "Press key: Enter.",
    ]);
    const secret = await prisma.botSecret.findFirstOrThrow({
      where: { botId, userId: ownerId, name: "crm2" },
    });
    expect(decodeLoginSecret(await secrets.load(secret.ciphertext, secret.id)).username).toBe(
      "alice@example.test",
    );
  });

  it("skipLogin deletes the held value and asks the user to sign in", async () => {
    const { skill } = await teachSignIn();
    const skipped = await service.skipLogin(owner, { skillId: skill.id, stepIndex: 2 });
    expect(skipped.playbook.steps[2]).toBe(ASK_SIGN_IN_STEP);
    expect(skipped.loginPrompts).toEqual([]);
    expect(await prisma.teachHeldValue.count({ where: { skillId: skill.id } })).toBe(0);
  });

  it("saving the skill drops an unanswered password and the raw recording", async () => {
    const { skill } = await teachSignIn();
    const saved = await service.save(owner, skill.id, "CRM sign in");
    expect(saved.status).toBe("saved");
    expect(saved.playbook.steps[2]).toBe(ASK_SIGN_IN_STEP);
    expect(saved.recording.events).toEqual([]);
    expect(await prisma.teachHeldValue.count({ where: { skillId: skill.id } })).toBe(0);
  });

  it("saving rewrites a password step whose held value already expired", async () => {
    const { skill } = await teachSignIn();
    await prisma.teachHeldValue.updateMany({
      where: { skillId: skill.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const saved = await service.save(owner, skill.id, "CRM sign in");
    expect(saved.playbook.steps).not.toContain(PROTECTED_STEP);
    expect(saved.playbook.steps[2]).toBe(ASK_SIGN_IN_STEP);
  });

  it("returns a recording scrubbed of a held password that a window title echoed", async () => {
    const skill = await recording();
    await type("hunter2", "Password");
    await prisma.taughtSkill.update({
      where: { id: skill.id },
      data: {
        recording: {
          events: [{ at: "1", kind: "window", title: "Doc - hunter2", app: "hunter2" }],
          snapshots: [{ at: "1", summary: "Doc - hunter2" }],
        },
      },
    });
    const fetched = await service.get(owner, skill.id);
    expect(JSON.stringify(fetched.recording)).not.toContain("hunter2");
    await service.cancel(owner, skill.id);
  });

  it("refuses a held value that expired, and the sweep deletes it", async () => {
    const { skill } = await teachSignIn();
    await prisma.teachHeldValue.updateMany({
      where: { skillId: skill.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(
      service.saveLogin(owner, {
        skillId: skill.id,
        stepIndex: 2,
        name: "expired",
        site: "https://crm.example.test",
        username: "alice",
      }),
    ).rejects.toThrow(/no longer held/);
    expect((await service.get(owner, skill.id)).loginPrompts).toEqual([]);
    expect(await deleteExpiredHeldValues(prisma)).toBeGreaterThanOrEqual(1);
    expect(await prisma.teachHeldValue.count({ where: { skillId: skill.id } })).toBe(0);
  });

  it("deletes drafts left unsaved for a day, with their held values", async () => {
    const { skill } = await teachSignIn();
    expect(await prisma.teachHeldValue.count({ where: { skillId: skill.id } })).toBeGreaterThan(0);
    await deleteExpiredTeachData(prisma);
    expect(await prisma.taughtSkill.count({ where: { id: skill.id } })).toBe(1);
    await prisma.$executeRaw`UPDATE taught_skills SET "updatedAt" = now() - interval '25 hours' WHERE id = ${skill.id}`;
    await deleteExpiredTeachData(prisma);
    expect(await prisma.taughtSkill.count({ where: { id: skill.id } })).toBe(0);
    expect(await prisma.teachHeldValue.count({ where: { skillId: skill.id } })).toBe(0);
  });

  it("rejects another user on every skill operation", async () => {
    const { skill } = await teachSignIn();
    await expect(service.get(stranger, skill.id)).rejects.toThrow();
    await expect(
      service.saveLogin(stranger, {
        skillId: skill.id,
        stepIndex: 2,
        name: "x",
        site: "https://crm.example.test",
        username: "alice",
      }),
    ).rejects.toThrow();
    await expect(
      service.skipLogin(stranger, { skillId: skill.id, stepIndex: 2 }),
    ).rejects.toThrow();
    await expect(service.cancel(stranger, skill.id)).rejects.toThrow();
    await expect(service.remove(stranger, skill.id)).rejects.toThrow();
    expect(await service.listSaved(stranger, botId)).toEqual([]);
    // Nothing was touched.
    expect(await prisma.teachHeldValue.count({ where: { skillId: skill.id } })).toBe(1);
  });

  it("cancel keeps nothing", async () => {
    const skill = await recording("Throwaway");
    await type("secretpass", "Password");
    expect(await prisma.teachHeldValue.count({ where: { skillId: skill.id } })).toBe(1);
    await service.cancel(owner, skill.id);
    expect(await prisma.taughtSkill.count({ where: { id: skill.id } })).toBe(0);
    expect(await prisma.teachHeldValue.count({ where: { skillId: skill.id } })).toBe(0);
  });

  it("a routine runs the current playbook, and deleting the skill clears the reference", async () => {
    const { skill } = await teachSignIn();
    await service.skipLogin(owner, { skillId: skill.id, stepIndex: 2 });
    await service.save(owner, skill.id, "Routine skill");
    const routine = await prisma.routine.create({
      data: {
        spaceId,
        botId,
        userId: ownerId,
        name: "Daily",
        prompt: "",
        crons: ["0 9 * * *"],
        taughtSkillId: skill.id,
        active: true,
        nextRunAt: new Date(Date.now() + 3_600_000),
      },
    });
    const scope = { taughtSkillId: skill.id, spaceId, userId: ownerId, botId };
    const before = await taughtSkillPromptForRoutine(prisma, scope);
    expect(before).toContain("Run taught skill: Routine skill");
    expect(before).toContain("3. Ask the user to sign in.");
    // An edit to the skill reaches the routine: it stores a reference, not pasted text.
    const current = await service.get(owner, skill.id);
    await service.updateDraft(owner, skill.id, {
      playbook: { ...current.playbook, steps: ["Open the dashboard.", "Click Export."] },
    });
    const after = await taughtSkillPromptForRoutine(prisma, scope);
    expect(after).toContain("1. Open the dashboard.");
    expect(after).not.toContain("Press key: Tab");
    expect(
      (await prisma.taughtSkill.findUniqueOrThrow({ where: { id: skill.id } })).lastRunAt,
    ).not.toBeNull();
    // Another user's or another bot's routine cannot read this skill.
    expect(await taughtSkillPromptForRoutine(prisma, { ...scope, userId: strangerId })).toBeNull();
    expect(await taughtSkillPromptForRoutine(prisma, { ...scope, botId: otherBotId })).toBeNull();

    expect(await service.listSaved(owner, botId)).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: skill.id, name: "Routine skill" })]),
    );
    await service.remove(owner, skill.id);
    const orphan = await prisma.routine.findUniqueOrThrow({ where: { id: routine.id } });
    expect(orphan.taughtSkillId).toBeNull();
    expect(orphan.active).toBe(false);
    expect(await service.listSaved(owner, botId)).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: skill.id })]),
    );
  });

  it("records how the Test run ended", async () => {
    const skill = await prisma.taughtSkill.create({
      data: {
        spaceId,
        botId,
        userId: ownerId,
        goal: "Export",
        name: "Export",
        status: "saved",
        playbook: {
          whenToUse: "x",
          inputs: [],
          steps: ["Click Export."],
          howToCheck: "x",
          whatToReturn: "x",
          approvalBoundaries: "x",
          failureHandling: "x",
        },
      },
    });
    const first = await service.testRun(owner, skill.id);
    expect((await service.get(owner, skill.id)).lastTestOutcome).toBeNull();
    await prisma.run.update({ where: { id: first.runId }, data: { status: "completed" } });
    const firstRun = await prisma.run.findUniqueOrThrow({ where: { id: first.runId } });
    const reply = async (runId: string, threadId: string, text: string) =>
      prisma.message.create({
        data: {
          threadId,
          runId,
          role: "bot",
          seq:
            ((await prisma.message.aggregate({ where: { threadId }, _max: { seq: true } }))._max
              .seq ?? 0) + 1,
          blocks: [{ kind: "text", text }],
        },
      });
    // A completed run with no "Result:" line is not a success.
    expect(await service.get(owner, skill.id)).toMatchObject({ lastTestOutcome: "stopped" });
    await prisma.taughtSkill.update({
      where: { id: skill.id },
      data: { lastTestOutcome: null, lastTestNote: null },
    });
    await reply(first.runId, firstRun.threadId, "Done.\nResult: worked");
    expect(await service.get(owner, skill.id)).toMatchObject({
      lastTestOutcome: "worked",
      lastTestNote: null,
    });
    expect((await service.get(owner, skill.id)).lastRunAt).not.toBeNull();

    const second = await service.testRun(owner, skill.id);
    expect((await service.get(owner, skill.id)).lastTestOutcome).toBeNull();
    await prisma.run.update({
      where: { id: second.runId },
      data: { status: "failed", error: "Stopped at step 4: Export button not on screen\nstack" },
    });
    expect(await service.get(owner, skill.id)).toMatchObject({
      lastTestOutcome: "stopped",
      lastTestNote: "Stopped at step 4: Export button not on screen",
    });

    const third = await service.testRun(owner, skill.id);
    await prisma.run.update({ where: { id: third.runId }, data: { status: "completed" } });
    await reply(third.runId, firstRun.threadId, "Result: stopped at step 2: no Export button");
    expect(await service.get(owner, skill.id)).toMatchObject({
      lastTestOutcome: "stopped",
      lastTestNote: "Stopped at step 2: no Export button",
    });
  });

  it("routines accept a saved skill of the same bot and expose its name", async () => {
    const client = createRouterClient(
      createRouter({
        prisma,
        env: {},
        events: { append: vi.fn(), notify: vi.fn() },
        jobs: { enqueue: vi.fn(), cancel: vi.fn() },
      } as unknown as RouterDeps),
      { context: { actor: owner } as never },
    ) as unknown as {
      routines: {
        create(input: Record<string, unknown>): Promise<{
          id: string;
          prompt: string;
          taughtSkill: { id: string; name: string } | null;
        }>;
        update(input: Record<string, unknown>): Promise<unknown>;
        list(input: { botId: string }): Promise<{ id: string; taughtSkill: unknown }[]>;
      };
    };
    const saved = await prisma.taughtSkill.create({
      data: { spaceId, botId, userId: ownerId, goal: "g", name: "Weekly export", status: "saved" },
    });
    const draft = await prisma.taughtSkill.create({
      data: { spaceId, botId, userId: ownerId, goal: "g", name: "Draft", status: "draft" },
    });
    const base = { name: "Run it", crons: ["0 9 * * 1"], taughtSkillId: saved.id };

    const created = await client.routines.create({ ...base, botId });
    expect(created).toMatchObject({
      prompt: "",
      taughtSkill: { id: saved.id, name: "Weekly export" },
    });
    expect((await client.routines.list({ botId })).find((r) => r.id === created.id)).toMatchObject({
      taughtSkill: { id: saved.id, name: "Weekly export" },
    });
    // Another bot, an unsaved draft and a missing instruction are all refused.
    await expect(client.routines.create({ ...base, botId: otherBotId })).rejects.toThrow();
    await expect(
      client.routines.create({ ...base, botId, taughtSkillId: draft.id }),
    ).rejects.toThrow(/Save the skill first/);
    await expect(
      client.routines.create({ name: "x", crons: ["0 9 * * 1"], botId }),
    ).rejects.toThrow();
    await expect(
      client.routines.update({ routineId: created.id, taughtSkillId: null }),
    ).rejects.toThrow(/Add an instruction/);
    await client.routines.update({
      routineId: created.id,
      taughtSkillId: null,
      prompt: "Do the export",
    });
    expect((await client.routines.list({ botId })).find((r) => r.id === created.id)).toMatchObject({
      taughtSkill: null,
    });
  });
});
