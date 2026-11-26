import { randomUUID } from "node:crypto";
import type { Actor } from "@rakazo/contracts";
import { AI_DISCLOSURE_VERSION, HEX_CONNECTOR_ID, OMI_CONNECTOR_ID } from "@rakazo/contracts";
import { unattendedToolRequiresApproval } from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import { createDb, createRepos, upsertMeeting } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { aiRecipient } from "./ai-consent.js";
import { MemoryArtifacts, RecordingJobs } from "./data-room-test-fakes.js";
import { MISSING_MODEL_MESSAGE } from "./executor.js";
import { runMeetingFollowup } from "./meeting-followup.js";
import { recordOwnerOpened, startMeetingRun } from "./meeting-handoff.js";
import { meetingToolFromTool } from "./meeting-tools.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;
const modelKey = aiRecipient({ provider: "openrouter", modelId: "test-model", use: "model" })
  ?.key as string;

describePostgres("waking the source agent (PostgreSQL)", () => {
  const run = randomUUID().slice(0, 8);
  const spaceId = `mh-space-${run}`;
  const userIds: string[] = [];
  let prisma: PrismaClient;
  let handle: Awaited<ReturnType<typeof createDb>>;
  let artifacts: MemoryArtifacts;
  let jobs: RecordingJobs;
  let a: Actor;
  let n = 0;

  const addUser = async (label: string): Promise<Actor> => {
    const userId = `mh-user-${label}-${run}`;
    userIds.push(userId);
    await prisma.user.create({
      data: { id: userId, name: label, email: `${userId}@rakazo.test`, emailVerified: true },
    });
    await prisma.member.create({
      data: {
        id: `member-${userId}`,
        organizationId: spaceId,
        userId,
        role: "member",
        createdAt: new Date(),
      },
    });
    await prisma.aiDataConsent.create({
      data: { userId, spaceId, recipientKey: modelKey, version: AI_DISCLOSURE_VERSION },
    });
    return { userId, spaceId, email: `${userId}@rakazo.test`, isDeploymentOwner: false };
  };

  const agent = (who: Actor, spawnKey: string | null = `integration-agent:${randomUUID()}`) =>
    createRepos(prisma).createBot(who, {
      spawnKey: spawnKey ?? undefined,
      name: "Source agent",
      title: "",
      description: "",
      instructions: "",
      notifyOnFinish: true,
    });

  /** A meeting from an Omi connection whose agent is `bot`. */
  async function omiMeeting(
    who: Actor,
    bot: { id: string } | null,
    over: { title?: string; startedAt?: Date; endedAt?: Date } = {},
  ) {
    // Each default meeting sits in its own slot, so the same-call check never links two tests.
    const startedAt = over.startedAt ?? new Date(Date.now() - n * 61 * 60_000);
    const connection = await prisma.connection.create({
      data: {
        spaceId,
        userId: who.userId,
        connectorId: OMI_CONNECTOR_ID,
        provider: "omi",
        displayName: "Omi",
        status: "connected",
        agentBotId: bot?.id ?? null,
      },
    });
    const externalId = `m-${run}-${n++}`;
    await upsertMeeting(prisma, who, { connectionId: connection.id }, "omi", {
      externalId,
      title: over.title ?? "Confidential board call",
      startedAt: startedAt.toISOString(),
      endedAt: (over.endedAt ?? new Date(startedAt.getTime() + 3_600_000)).toISOString(),
      attendees: [],
      organizerEmail: null,
      sourceUrl: null,
      folders: [],
      summary: "s",
      privateNotes: "",
      transcript: [{ speaker: "A", text: "hello" }],
      updatedAt: startedAt.toISOString(),
    });
    return (await prisma.meeting.findFirstOrThrow({ where: { userId: who.userId, externalId } }))
      .id;
  }

  const model = async () => ({});
  const followup = (who: Actor, meetingId: string, resolveModel: unknown = model) =>
    runMeetingFollowup(
      { prisma, jobs, artifacts, resolveModel: resolveModel as typeof model },
      { ...who, meetingId },
    );
  const runsOf = (botId: string) => prisma.run.findMany({ where: { botId } });

  beforeAll(async () => {
    handle = createDb(databaseUrl as string);
    prisma = handle.prisma;
    artifacts = new MemoryArtifacts();
    jobs = new RecordingJobs();
    await prisma.organization.create({
      data: { id: spaceId, name: "MH", slug: spaceId, createdAt: new Date() },
    });
    await prisma.space.create({
      data: { id: spaceId, organizationId: spaceId, name: "General", isDefault: true },
    });
    a = await addUser("a");
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.dataRoomItem.deleteMany({ where: { spaceId } });
    await prisma.organization.deleteMany({ where: { id: spaceId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
    await handle.pool.end();
  });

  it("wakes the connection's agent once, with a prompt that holds no meeting text and a linked meta line", async () => {
    const bot = await agent(a);
    const id = await omiMeeting(a, bot);
    await followup(a, id);
    const [woken, ...rest] = await runsOf(bot.id);
    expect(rest).toHaveLength(0);
    expect(woken).toMatchObject({ trigger: "routine", unattended: true, threadId: bot.threadId });
    const task = await prisma.task.findFirstOrThrow({ where: { id: woken?.taskId as string } });
    expect(task.prompt).toContain(`meeting id ${id}`);
    expect(task.prompt).not.toContain("Confidential");
    const item = await prisma.dataRoomItem.findFirstOrThrow({
      where: { externalId: `meeting:${id}` },
    });
    expect(task.prompt).toContain(`item ${item.id}`);
    const message = await prisma.message.findFirstOrThrow({ where: { threadId: bot.threadId } });
    expect(message.blocks).toEqual([
      {
        kind: "meta",
        text: "Summarizing your new meeting",
        link: { label: "Meeting", href: `/app/meetings/${id}` },
      },
    ]);
    expect(await prisma.meetingHandoff.count({ where: { meetingId: id, botId: bot.id } })).toBe(1);
    expect(jobs.all.some((j) => j.name === "run.continue")).toBe(true);
    expect((await prisma.bot.findUniqueOrThrow({ where: { id: bot.id } })).notifyOnFinish).toBe(
      true,
    );
    // A repeat wakes nothing more.
    await followup(a, id);
    expect(await runsOf(bot.id)).toHaveLength(1);
  });

  it("two concurrent jobs start one run", async () => {
    const bot = await agent(a);
    const id = await omiMeeting(a, bot);
    await Promise.all([followup(a, id), followup(a, id)]);
    expect(await runsOf(bot.id)).toHaveLength(1);
    expect(await prisma.meetingHandoff.count({ where: { meetingId: id } })).toBe(1);
  });

  it("an MCP server's agent is woken", async () => {
    const bot = await agent(a);
    const server = await prisma.mcpServer.create({
      data: {
        spaceId,
        userId: a.userId,
        slug: `granola-${run}`,
        name: "Granola",
        transport: "http",
        endpoint: "https://mcp.granola.ai/mcp",
        agentBotId: bot.id,
      },
    });
    const id = await omiMeeting(a, null);
    await prisma.meeting.update({
      where: { id },
      data: { connectionId: null, mcpServerId: server.id, provider: "granola" },
    });
    await prisma.bot.update({
      where: { id: bot.id },
      data: { spawnKey: `integration-agent:${server.id}` },
    });
    await followup(a, id);
    expect(await runsOf(bot.id)).toHaveLength(1);
  });

  it("a Praci recording wakes the user's Hex agent, or nothing without one", async () => {
    const solo = await addUser("solo");
    const id = await omiMeeting(solo, null);
    await prisma.meeting.update({ where: { id }, data: { connectionId: null, provider: "praci" } });
    await followup(solo, id);
    expect(await prisma.meetingHandoff.count({ where: { meetingId: id } })).toBe(0);
    expect(await prisma.dataRoomItem.count({ where: { externalId: `meeting:${id}` } })).toBe(1);

    const hex = await agent(solo);
    await prisma.connection.create({
      data: {
        spaceId,
        userId: solo.userId,
        connectorId: HEX_CONNECTOR_ID,
        provider: "hex",
        displayName: "Hex",
        status: "connected",
        agentBotId: hex.id,
      },
    });
    const id2 = await omiMeeting(solo, null, { startedAt: new Date(Date.now() - 3 * 3_600_000) });
    await prisma.meeting.update({
      where: { id: id2 },
      data: { connectionId: null, provider: "praci" },
    });
    await followup(solo, id2);
    expect(await runsOf(hex.id)).toHaveLength(1);
  });

  it("wakes no agent that is archived, not a meeting-source agent, or has no model", async () => {
    const archived = await agent(a);
    const archivedId = await omiMeeting(a, archived);
    await prisma.bot.update({ where: { id: archived.id }, data: { archivedAt: new Date() } });
    await followup(a, archivedId);
    expect(await runsOf(archived.id)).toHaveLength(0);

    const plain = await agent(a, null);
    const plainId = await omiMeeting(a, plain);
    await followup(a, plainId);
    expect(await runsOf(plain.id)).toHaveLength(0);

    const noModel = await agent(a);
    const noModelId = await omiMeeting(a, noModel);
    await followup(a, noModelId, async () => {
      throw new Error(MISSING_MODEL_MESSAGE);
    });
    expect(await runsOf(noModel.id)).toHaveLength(0);
    expect(await prisma.dataRoomItem.count({ where: { externalId: `meeting:${noModelId}` } })).toBe(
      1,
    );
  });

  it("another user's agent is never woken", async () => {
    const other = await addUser("other");
    const theirs = await agent(other);
    const id = await omiMeeting(a, theirs);
    await followup(a, id);
    expect(await runsOf(theirs.id)).toHaveLength(0);
  });

  it("does not wake the agent when the owner opened the meeting first", async () => {
    const bot = await agent(a);
    const id = await omiMeeting(a, bot);
    const open = (opened?: (id: string) => Promise<void>) =>
      meetingToolFromTool(
        "meetings_get",
        {
          prisma,
          scope: { spaceId, userId: a.userId },
          consentAllowed: async () => true,
          ...(opened ? { onOpened: opened } : {}),
        },
        { id },
      );
    await open((meetingId) => recordOwnerOpened(prisma, { spaceId, userId: a.userId }, meetingId));
    await followup(a, id);
    expect(await runsOf(bot.id)).toHaveLength(0);
    expect(await prisma.dataRoomItem.count({ where: { externalId: `meeting:${id}` } })).toBe(1);
  });

  it("does not wake the agent while a run is active on its thread", async () => {
    const bot = await agent(a);
    const task = await prisma.task.create({
      data: {
        spaceId,
        userId: a.userId,
        botId: bot.id,
        threadId: bot.threadId,
        prompt: "x",
        status: "queued",
      },
    });
    await prisma.run.create({
      data: {
        spaceId,
        userId: a.userId,
        botId: bot.id,
        threadId: bot.threadId,
        taskId: task.id,
        status: "running",
        trigger: "user",
        unattended: false,
      },
    });
    const id = await omiMeeting(a, bot);
    await followup(a, id);
    expect(await runsOf(bot.id)).toHaveLength(1);
    expect(await prisma.meetingHandoff.count({ where: { meetingId: id } })).toBe(0);
  });

  const activeRun = async (bot: { id: string; threadId: string }) => {
    const task = await prisma.task.create({
      data: {
        spaceId,
        userId: a.userId,
        botId: bot.id,
        threadId: bot.threadId,
        prompt: "x",
        status: "queued",
      },
    });
    await prisma.run.create({
      data: {
        spaceId,
        userId: a.userId,
        botId: bot.id,
        threadId: bot.threadId,
        taskId: task.id,
        status: "running",
        trigger: "user",
        unattended: false,
      },
    });
  };
  const retries = () =>
    jobs.all.filter((j) => j.replaceKey?.endsWith(":retry")).map((j) => j.payload);

  it("on the last retry a busy agent still gets a meta line, and no run or further retry", async () => {
    const bot = await agent(a);
    await activeRun(bot);
    const id = await omiMeeting(a, bot);
    jobs.all.length = 0;
    const deps = { prisma, jobs, artifacts, resolveModel: model };
    await runMeetingFollowup(deps, { ...a, meetingId: id, retry: 4 });
    expect(await prisma.message.count({ where: { threadId: bot.threadId } })).toBe(0);
    expect(retries()).toHaveLength(1);

    jobs.all.length = 0;
    await runMeetingFollowup(deps, { ...a, meetingId: id, retry: 5 });
    const message = await prisma.message.findFirstOrThrow({ where: { threadId: bot.threadId } });
    expect(message.blocks).toEqual([
      {
        kind: "meta",
        text: "New meeting",
        link: { label: "Meeting", href: `/app/meetings/${id}` },
      },
    ]);
    const [handoff, ...rest] = await prisma.meetingHandoff.findMany({ where: { meetingId: id } });
    expect(rest).toHaveLength(0);
    expect(handoff).toMatchObject({ kind: "source", runId: null });
    expect(await prisma.task.count({ where: { threadId: bot.threadId } })).toBe(1);
    expect(await runsOf(bot.id)).toHaveLength(1);
    expect(retries()).toHaveLength(0);
  });

  it("on the last retry a free agent still gets the normal summary run", async () => {
    const bot = await agent(a);
    const id = await omiMeeting(a, bot);
    await runMeetingFollowup(
      { prisma, jobs, artifacts, resolveModel: model },
      { ...a, meetingId: id, retry: 5 },
    );
    const message = await prisma.message.findFirstOrThrow({ where: { threadId: bot.threadId } });
    expect(message.blocks).toMatchObject([{ kind: "meta", text: "Summarizing your new meeting" }]);
    expect(await runsOf(bot.id)).toHaveLength(1);
  });

  it("a meta-only write does not wait for an active run, but a prompt still does", async () => {
    const bot = await agent(a);
    await activeRun(bot);
    const id = await omiMeeting(a, bot);
    const meeting = await prisma.meeting.findFirstOrThrow({ where: { id } });
    const target = { id: bot.id, threadId: bot.threadId as string };
    const scope = { spaceId, userId: a.userId };
    let busy = 0;
    const input = { meeting, bot: target, kind: "source" as const, meta: { text: "m" } };
    const onBusy = () => void busy++;
    expect(
      await startMeetingRun({ prisma, jobs }, scope, { ...input, prompt: "p", onBusy }),
    ).toBeNull();
    expect(busy).toBe(1);
    expect(await prisma.message.count({ where: { threadId: bot.threadId } })).toBe(0);
    expect(
      await startMeetingRun({ prisma, jobs }, scope, { ...input, prompt: null, onBusy }),
    ).toBeNull();
    expect(busy).toBe(1);
    expect(await prisma.message.count({ where: { threadId: bot.threadId } })).toBe(1);
  });

  it("files a second recording of the same call but wakes nobody for it", async () => {
    const who = await addUser("dup");
    const first = await agent(who);
    const second = await agent(who);
    const start = new Date(Date.now() - 2 * 3_600_000);
    const one = await omiMeeting(who, first, { startedAt: start });
    const two = await omiMeeting(who, second, {
      startedAt: new Date(start.getTime() + 5 * 60_000),
      endedAt: new Date(start.getTime() + 3_600_000),
    });
    await followup(who, one);
    await followup(who, two);
    expect(await runsOf(first.id)).toHaveLength(1);
    expect(await runsOf(second.id)).toHaveLength(0);
    expect(await prisma.dataRoomItem.count({ where: { externalId: `meeting:${two}` } })).toBe(1);
    // A different call is still woken.
    const later = await omiMeeting(who, second, {
      startedAt: new Date(start.getTime() + 90 * 60_000),
    });
    await followup(who, later);
    expect(await runsOf(second.id)).toHaveLength(1);
  });

  it("a model lookup error other than 'no model' fails the job so it retries", async () => {
    const bot = await agent(a);
    const id = await omiMeeting(a, bot);
    await expect(
      followup(a, id, async () => {
        throw new Error("database unavailable");
      }),
    ).rejects.toThrow("database unavailable");
    expect(await runsOf(bot.id)).toHaveLength(0);
    await followup(a, id);
    expect(await runsOf(bot.id)).toHaveLength(1);
  });

  it("two jobs for one call from different sources wake one agent", async () => {
    const who = await addUser("race");
    const first = await agent(who);
    const second = await agent(who);
    const start = new Date(Date.now() - 4 * 3_600_000);
    const one = await omiMeeting(who, first, { startedAt: start });
    const two = await omiMeeting(who, second, { startedAt: start });
    await Promise.all([followup(who, one), followup(who, two)]);
    expect((await runsOf(first.id)).length + (await runsOf(second.id)).length).toBe(1);
  });

  it("a run that starts while the wake waits for the thread lock stops the wake", async () => {
    const bot = await agent(a);
    const id = await omiMeeting(a, bot);
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    let locked!: () => void;
    const hasLock = new Promise<void>((resolve) => (locked = resolve));
    const owner = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM threads WHERE id = ${bot.threadId} FOR UPDATE`;
      locked();
      await held;
      const task = await tx.task.create({
        data: {
          spaceId,
          userId: a.userId,
          botId: bot.id,
          threadId: bot.threadId,
          prompt: "x",
          status: "queued",
        },
      });
      await tx.run.create({
        data: {
          spaceId,
          userId: a.userId,
          botId: bot.id,
          threadId: bot.threadId,
          taskId: task.id,
          status: "queued",
          trigger: "user",
          unattended: false,
        },
      });
    });
    await hasLock;
    const wake = followup(a, id);
    await new Promise((resolve) => setTimeout(resolve, 500));
    release();
    await owner;
    await wake;
    expect(await runsOf(bot.id)).toHaveLength(1);
    expect(await prisma.meetingHandoff.count({ where: { meetingId: id } })).toBe(0);
  });

  it("an unattended meeting agent reads meetings without an approval card", () => {
    for (const tool of ["meetings_list", "meetings_search", "meetings_get"]) {
      expect(unattendedToolRequiresApproval(true, tool, false)).toBe(false);
    }
  });
});
