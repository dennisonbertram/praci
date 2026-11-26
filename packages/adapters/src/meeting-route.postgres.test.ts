import { randomUUID } from "node:crypto";
import type { Actor } from "@rakazo/contracts";
import {
  AI_DISCLOSURE_VERSION,
  investorsAgentSpawnKey,
  MEETING_ROUTE_PROMPT_START,
  OMI_CONNECTOR_ID,
} from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb, createRepos, upsertMeeting } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { aiRecipient } from "./ai-consent.js";
import { MemoryArtifacts, RecordingJobs } from "./data-room-test-fakes.js";
import { MISSING_MODEL_MESSAGE } from "./executor.js";
import { runMeetingFollowup } from "./meeting-followup.js";
import { routedRunReadRefusal } from "./meeting-handoff.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;
const modelKey = aiRecipient({ provider: "openrouter", modelId: "test-model", use: "model" })
  ?.key as string;

describePostgres("routing investor calls (PostgreSQL)", () => {
  const run = randomUUID().slice(0, 8);
  const spaceId = `mr-space-${run}`;
  const userIds: string[] = [];
  let prisma: PrismaClient;
  let handle: Awaited<ReturnType<typeof createDb>>;
  let artifacts: MemoryArtifacts;
  let jobs: RecordingJobs;
  let a: Actor;
  let n = 0;

  const addUser = async (label: string): Promise<Actor> => {
    const userId = `mr-user-${label}-${run}`;
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

  const investorsAgent = (who: Actor) =>
    createRepos(prisma).createBot(who, {
      spawnKey: investorsAgentSpawnKey(who.userId),
      name: "Investors",
      title: "",
      description: "",
      instructions: "",
      notifyOnFinish: true,
    });

  const contact = (who: Actor, email: string, name: string, organization = "Example Ventures") =>
    prisma.contact.create({
      data: { spaceId, userId: who.userId, email, name, organization, kind: "investor" },
    });

  /** A fresh Praci recording (no source agent) with the given attendees. */
  async function meeting(
    who: Actor,
    category: string | null,
    emails: string[],
    title = "Confidential seed call",
    at?: Date,
  ) {
    const startedAt = at ?? new Date(Date.now() - n * 90 * 60_000 - 60_000);
    const externalId = `m-${run}-${n++}`;
    const connection = await prisma.connection.create({
      data: {
        spaceId,
        userId: who.userId,
        connectorId: OMI_CONNECTOR_ID,
        provider: "omi",
        displayName: "Omi",
        status: "connected",
      },
    });
    await upsertMeeting(prisma, who, { connectionId: connection.id }, "omi", {
      externalId,
      title,
      startedAt: startedAt.toISOString(),
      endedAt: new Date(startedAt.getTime() + 3_600_000).toISOString(),
      attendees: emails.map((email) => ({ name: "Someone", email })),
      organizerEmail: null,
      sourceUrl: null,
      folders: [],
      summary: "s",
      privateNotes: "",
      transcript: [{ speaker: "A", text: "hello" }],
      updatedAt: startedAt.toISOString(),
    });
    const row = await prisma.meeting.findFirstOrThrow({
      where: { userId: who.userId, externalId },
    });
    // A Praci recording with no Hex agent: no source agent is woken, so only routing is tested.
    await prisma.meeting.update({
      where: { id: row.id },
      data: {
        category,
        connectionId: null,
        provider: "praci",
        // A fixed start with an end of now keeps the call fresh.
        ...(at ? { endedAt: new Date() } : {}),
      },
    });
    return row.id;
  }

  const model = async () => ({});
  const followup = (who: Actor, meetingId: string, resolveModel: () => Promise<unknown> = model) =>
    runMeetingFollowup({ prisma, jobs, artifacts, resolveModel }, { ...who, meetingId });
  const busy = async (bot: { id: string; threadId: string | null }, who: Actor) => {
    const task = await prisma.task.create({
      data: {
        spaceId,
        userId: who.userId,
        botId: bot.id,
        threadId: bot.threadId as string,
        prompt: "x",
        status: "queued",
      },
    });
    return prisma.run.create({
      data: {
        spaceId,
        userId: who.userId,
        botId: bot.id,
        threadId: bot.threadId as string,
        taskId: task.id,
        status: "running",
        trigger: "user",
        unattended: false,
      },
    });
  };
  const runsOf = (botId: string) => prisma.run.findMany({ where: { botId } });
  const messagesOf = (threadId: string) => prisma.message.findMany({ where: { threadId } });

  beforeAll(async () => {
    handle = createDb(databaseUrl as string);
    prisma = handle.prisma;
    artifacts = new MemoryArtifacts();
    jobs = new RecordingJobs();
    await prisma.organization.create({
      data: { id: spaceId, name: "MR", slug: spaceId, createdAt: new Date() },
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

  it("routes a matched investor call once: meta line, one route handoff, a prompt with no title", async () => {
    const bot = await investorsAgent(a);
    const ada = await contact(a, "ada@example-ventures.test", "Ada Example");
    const id = await meeting(a, "investor", ["Ada@Example-Ventures.test", "nobody@else.test"]);
    await followup(a, id);

    const [routed, ...rest] = await runsOf(bot.id);
    expect(rest).toHaveLength(0);
    expect(routed).toMatchObject({ trigger: "routine", unattended: true });
    const task = await prisma.task.findFirstOrThrow({ where: { id: routed?.taskId as string } });
    expect(task.prompt.startsWith(MEETING_ROUTE_PROMPT_START)).toBe(true);
    expect(task.prompt).toContain(`meeting ${id}`);
    // Contact names can come from email senders, so the prompt carries ids only.
    expect(task.prompt).not.toContain("Ada Example");
    expect(task.prompt).not.toContain("Example Ventures");
    expect(task.prompt).toContain(ada.id);
    expect(task.prompt).not.toContain("Confidential");
    expect(task.prompt).not.toContain("nobody@else.test");
    expect(task.prompt).toContain("Do not read the meeting");
    const item = await prisma.dataRoomItem.findFirstOrThrow({
      where: { externalId: `meeting:${id}` },
    });
    expect(task.prompt).toContain(`item ${item.id}`);

    const [message] = await messagesOf(bot.threadId as string);
    expect(message?.blocks).toEqual([
      {
        kind: "meta",
        text: `New investor call, ${new Date().toISOString().slice(0, 10)}, Praci: Ada Example`,
        link: { label: "Meeting", href: `/app/meetings/${id}` },
      },
    ]);
    expect(await prisma.meetingHandoff.count({ where: { meetingId: id, kind: "route" } })).toBe(1);

    await followup(a, id);
    expect(await runsOf(bot.id)).toHaveLength(1);
    expect(await messagesOf(bot.threadId as string)).toHaveLength(1);
  });

  it("dates the note and the meta line in the owner's time zone, and in UTC without one", async () => {
    const at = new Date("2026-11-09T00:30:00Z");
    for (const [zone, day] of [
      ["America/New_York", "2026-11-08"],
      [null, "2026-11-09"],
    ] as const) {
      const who = await addUser(`zone-${day}`);
      await prisma.user.update({ where: { id: who.userId }, data: { timezone: zone } });
      const bot = await investorsAgent(who);
      const id = await meeting(who, "investor", ["x@else.test"], "Seed call", at);
      await followup(who, id);
      const item = await prisma.dataRoomItem.findFirstOrThrow({
        where: { externalId: `meeting:${id}` },
      });
      expect(item.name.startsWith(`${day} `)).toBe(true);
      const [message] = await messagesOf(bot.threadId as string);
      expect(JSON.stringify(message?.blocks)).toContain(`New investor call, ${day},`);
    }
  });

  it("posts the meta line but starts no run when no attendee matches", async () => {
    const who = await addUser("nomatch");
    const bot = await investorsAgent(who);
    const id = await meeting(who, "investor", ["stranger@else.test"]);
    await followup(who, id);
    expect(await runsOf(bot.id)).toHaveLength(0);
    const [message] = await messagesOf(bot.threadId as string);
    expect(JSON.stringify(message?.blocks)).toContain("New investor call");
    // A repeat does not post the line again.
    await followup(who, id);
    expect(await messagesOf(bot.threadId as string)).toHaveLength(1);
  });

  it("does nothing without an Investors agent, and never creates one", async () => {
    const solo = await addUser("solo");
    await contact(solo, "ada@solo.test", "Ada Solo");
    const id = await meeting(solo, "investor", ["ada@solo.test"]);
    await followup(solo, id);
    expect(await prisma.meetingHandoff.count({ where: { meetingId: id } })).toBe(0);
    expect(
      await prisma.bot.count({ where: { spawnKey: investorsAgentSpawnKey(solo.userId) } }),
    ).toBe(0);
  });

  it("does nothing for another category", async () => {
    const who = await addUser("customer");
    const bot = await investorsAgent(who);
    await contact(who, "ada@customer.test", "Ada Customer");
    const id = await meeting(who, "customer", ["ada@customer.test"]);
    await followup(who, id);
    expect(await runsOf(bot.id)).toHaveLength(0);
    expect(await messagesOf(bot.threadId as string)).toHaveLength(0);
  });

  it("never matches another user's contacts", async () => {
    const owner = await addUser("owner");
    const other = await addUser("other");
    const bot = await investorsAgent(owner);
    await contact(other, "ada@theirs.test", "Ada Theirs");
    const id = await meeting(owner, "investor", ["ada@theirs.test"]);
    await followup(owner, id);
    expect(await runsOf(bot.id)).toHaveLength(0);
    const [message] = await messagesOf(bot.threadId as string);
    expect(JSON.stringify(message?.blocks)).not.toContain("Ada Theirs");
  });

  it("a busy Investors thread gets the route later: a delayed retry job, then one run", async () => {
    const who = await addUser("busy");
    const bot = await investorsAgent(who);
    await contact(who, "ada@busy.test", "Ada Busy");
    const id = await meeting(who, "investor", ["ada@busy.test"]);
    const active = await busy(bot, who);
    jobs.all.length = 0;
    await followup(who, id);
    expect(await runsOf(bot.id)).toHaveLength(1);
    const retry = jobs.all.find((j) => j.name === "meetings.followup");
    expect(retry?.availableAt && retry.availableAt.getTime() > Date.now()).toBe(true);
    expect(retry?.payload).toMatchObject({ meetingId: id });
    await prisma.run.update({ where: { id: active.id }, data: { status: "completed" } });
    await followup(who, id);
    expect(await runsOf(bot.id)).toHaveLength(2);
    expect(await prisma.meetingHandoff.count({ where: { meetingId: id, kind: "route" } })).toBe(1);
  });

  it("a busy source agent is woken by the retry too", async () => {
    const who = await addUser("busysrc");
    const hex = await createRepos(prisma).createBot(who, {
      spawnKey: `integration-agent:${randomUUID()}`,
      name: "Source",
      title: "",
      description: "",
      instructions: "",
      notifyOnFinish: true,
    });
    const connection = await prisma.connection.create({
      data: {
        spaceId,
        userId: who.userId,
        connectorId: OMI_CONNECTOR_ID,
        provider: "omi",
        displayName: "Omi",
        status: "connected",
        agentBotId: hex.id,
      },
    });
    const id = await meeting(who, "other", []);
    await prisma.meeting.update({
      where: { id },
      data: { connectionId: connection.id, provider: "omi" },
    });
    const active = await busy({ id: hex.id, threadId: hex.threadId }, who);
    jobs.all.length = 0;
    await followup(who, id);
    expect(jobs.all.some((j) => j.name === "meetings.followup" && j.availableAt)).toBe(true);
    await prisma.run.update({ where: { id: active.id }, data: { status: "completed" } });
    await followup(who, id);
    expect(await prisma.meetingHandoff.count({ where: { meetingId: id, kind: "source" } })).toBe(1);
  });

  it("a second source of the same call does not route again", async () => {
    const who = await addUser("twice");
    const bot = await investorsAgent(who);
    await contact(who, "ada@twice.test", "Ada Twice");
    const first = await meeting(who, "investor", ["ada@twice.test"]);
    const second = await meeting(who, "investor", ["ada@twice.test"]);
    const span = await prisma.meeting.findUniqueOrThrow({ where: { id: first } });
    await prisma.meeting.update({
      where: { id: second },
      data: { startedAt: span.startedAt, endedAt: span.endedAt },
    });
    await followup(who, first);
    await prisma.run.updateMany({ where: { botId: bot.id }, data: { status: "completed" } });
    await followup(who, second);
    expect(await runsOf(bot.id)).toHaveLength(1);
    expect(await prisma.meetingHandoff.count({ where: { botId: bot.id } })).toBe(1);
  });

  it("with no model the meta line is still posted, and no run starts", async () => {
    const who = await addUser("nomodel");
    const bot = await investorsAgent(who);
    await contact(who, "ada@nomodel.test", "Ada NoModel");
    const id = await meeting(who, "investor", ["ada@nomodel.test"]);
    await followup(who, id, async () => {
      throw new Error(MISSING_MODEL_MESSAGE);
    });
    expect(await runsOf(bot.id)).toHaveLength(0);
    expect(JSON.stringify((await messagesOf(bot.threadId as string))[0]?.blocks)).toContain(
      "Ada NoModel",
    );
  });

  it("a routed run may not read meeting text", async () => {
    const who = await addUser("refuse");
    const bot = await investorsAgent(who);
    await contact(who, "ada@refuse.test", "Ada Refuse");
    const id = await meeting(who, "investor", ["ada@refuse.test"]);
    await followup(who, id);
    const item = await prisma.dataRoomItem.findFirstOrThrow({
      where: { externalId: `meeting:${id}` },
    });
    const scope = { spaceId, userId: who.userId };
    const prompt = `${MEETING_ROUTE_PROMPT_START}meeting ${id}.`;
    const refusal = (name: string, args: Record<string, unknown>, p = prompt) =>
      routedRunReadRefusal(prisma, scope, p, name, args);
    expect(await refusal("meetings_get", { id })).toMatch(/not allowed/);
    expect(await refusal("read_data_room_item", { item_id: item.id })).toMatch(/not allowed/);
    const other = await prisma.dataRoomItem.create({
      data: {
        spaceId,
        userId: who.userId,
        name: "n.txt",
        source: "upload",
        sha256: "x",
        mimeType: "text/plain",
        size: 1n,
      },
    });
    expect(await refusal("read_data_room_item", { item_id: other.id })).toBeNull();
    // Any other run is unaffected.
    expect(await refusal("meetings_get", { id }, "Summarize")).toBeNull();
    expect(bot.id).toBeTruthy();
  });
});
