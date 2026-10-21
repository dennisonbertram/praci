import type {
  AgentRunModel,
  AgentRunRequest,
  AgentRuntime,
  BackgroundJob,
  JobPublisher,
} from "@rakazo/adapter-kit";
import { AI_DISCLOSURE_VERSION } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb, upsertMeeting } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { aiRecipient } from "./ai-consent.js";
import { queueMeetingDigests, runMeetingDigest } from "./meeting-digest.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const model: AgentRunModel = { provider: "openrouter", id: "test-model", apiKey: "test-key" };
const modelKey = aiRecipient({ provider: "openrouter", modelId: "test-model", use: "model" })
  ?.key as string;

function fakeRuntime(answers: string[]) {
  const requests: AgentRunRequest[] = [];
  const runtime = {
    run: async function* (request: AgentRunRequest) {
      requests.push(request);
      yield {
        type: "usage" as const,
        provider: "openrouter",
        model: "test-model",
        inputTokens: 100,
        outputTokens: 10,
      };
      yield { type: "done" as const, text: answers[Math.min(requests.length, answers.length) - 1] };
    },
  } as unknown as AgentRuntime;
  return { runtime, requests };
}

function fakeJobs() {
  const enqueued: BackgroundJob[] = [];
  const jobs = {
    enqueue: async (job: BackgroundJob) => {
      enqueued.push(job);
    },
    cancel: async () => {},
    close: async () => {},
  } as JobPublisher;
  return { jobs, enqueued };
}

const digestJson = (commitments: unknown[], extra: Record<string, unknown> = {}) =>
  `Sure.\n${JSON.stringify({ decisions: ["Ship on Friday"], commitments, followUps: ["Book room"], ...extra })}`;

describePostgres("meeting digest (PostgreSQL)", () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const organizationId = `digest-org-${suffix}`;
  const spaceId = `digest-space-${suffix}`;
  const userIds: string[] = [];
  let prisma: PrismaClient;
  let handle: Awaited<ReturnType<typeof createDb>>;

  async function addUser(options: { consent?: boolean; gmail?: string } = {}) {
    const userId = `digest-user-${suffix}-${userIds.length}`;
    userIds.push(userId);
    await prisma.user.create({
      data: { id: userId, name: userId, email: `${userId}@Rakazo.test`, emailVerified: false },
    });
    await prisma.member.create({
      data: {
        id: `member-${userId}`,
        organizationId,
        userId,
        role: "member",
        createdAt: new Date(),
      },
    });
    if (options.consent !== false) {
      await prisma.aiDataConsent.create({
        data: { userId, spaceId, recipientKey: modelKey, version: AI_DISCLOSURE_VERSION },
      });
    }
    if (options.gmail) await addGmail(userId, options.gmail);
    return { userId, email: `${userId}@rakazo.test` };
  }
  const addGmail = (userId: string, address: string) =>
    prisma.connection.create({
      data: {
        spaceId,
        userId,
        provider: "gmail",
        displayName: "Mailbox",
        status: "connected",
        providerRef: `${userId}-${address}`,
        metadata: { mailAddress: address },
      },
    });

  let n = 0;
  async function addMeeting(
    userId: string,
    extra: { attendees?: Array<{ name?: string; email?: string }>; transcript?: string } = {},
  ) {
    const externalId = `m-${suffix}-${n++}`;
    const connection = await prisma.connection.create({
      data: {
        spaceId,
        userId,
        provider: "granola",
        displayName: "Granola",
        status: "connected",
      },
    });
    await upsertMeeting(prisma, { spaceId, userId }, { connectionId: connection.id }, "granola", {
      externalId,
      title: "Planning",
      startedAt: "2026-10-19T15:00:00.000Z",
      endedAt: null,
      attendees: extra.attendees ?? [],
      organizerEmail: null,
      sourceUrl: null,
      folders: [],
      summary: "We planned.",
      privateNotes: "",
      transcript: [{ speaker: "Ada", text: extra.transcript ?? "Hello" }],
      updatedAt: "2026-10-19T16:00:00.000Z",
    });
    const row = await prisma.meeting.findFirstOrThrow({ where: { userId, externalId } });
    return row.id;
  }

  const digest = (userId: string, meetingId: string, rt: AgentRuntime) =>
    runMeetingDigest(
      { prisma, runtime: rt, resolveModel: async () => model },
      { spaceId, userId, meetingId },
    );
  const todos = (userId: string) =>
    prisma.inboxTodo.findMany({ where: { userId }, orderBy: { createdAt: "asc" } });

  beforeAll(async () => {
    handle = createDb(databaseUrl as string);
    prisma = handle.prisma;
    await prisma.organization.create({
      data: { id: organizationId, name: "Digest Org", slug: organizationId, createdAt: new Date() },
    });
    await prisma.space.create({
      data: { id: spaceId, organizationId, name: "General", isDefault: true },
    });
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await handle.prisma.$disconnect();
    await handle.pool.end();
  });

  it("stores a valid digest, calls the model once without tools, and makes the user's to-do from User.email", async () => {
    const user = await addUser();
    const id = await addMeeting(user.userId, {
      attendees: [{ name: "Me Myself", email: user.email.toUpperCase() }, { email: "bob@x.test" }],
    });
    const rt = fakeRuntime([
      digestJson([
        { owner: user.email, text: "Send the revised budget", due: "2026-10-30" },
        { owner: "bob@x.test", text: "Review the contract" },
      ]),
    ]);
    await digest(user.userId, id, rt.runtime);

    expect(rt.requests).toHaveLength(1);
    expect(rt.requests[0]?.tools).toEqual([]);
    expect(rt.requests[0]?.prompt).toContain("Untrusted meeting data");
    const meeting = await prisma.meeting.findUniqueOrThrow({ where: { id } });
    expect(meeting.digestStatus).toBe("done");
    expect(meeting.digest).toMatchObject({ decisions: ["Ship on Friday"] });
    const rows = await todos(user.userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      text: "Send the revised budget",
      detail: "Planning, Oct 19",
      meetingId: id,
      connectionId: null,
    });
    expect(rows[0]?.dueOn?.toISOString().slice(0, 10)).toBe("2026-10-30");
  });

  it("a commitment by someone else is never added to the user's to-dos", async () => {
    const user = await addUser();
    const id = await addMeeting(user.userId, {
      attendees: [{ email: user.email }, { name: "Bob", email: "bob@x.test" }],
    });
    const rt = fakeRuntime([
      digestJson([
        { owner: "bob@x.test", text: "Bob sends the deck" },
        { owner: "Bob", text: "Bob books the room" },
        { owner: "carol@x.test", text: "Carol is not even there" },
      ]),
    ]);
    await digest(user.userId, id, rt.runtime);
    expect(await todos(user.userId)).toHaveLength(0);
    expect((await prisma.meeting.findUniqueOrThrow({ where: { id } })).digestStatus).toBe("done");
  });

  it("takes the identity from a connected Gmail account", async () => {
    const gmail = `ada-${suffix}@gmail.test`;
    const user = await addUser({ gmail });
    const id = await addMeeting(user.userId, { attendees: [{ name: "Ada", email: gmail }] });
    await digest(
      user.userId,
      id,
      fakeRuntime([digestJson([{ owner: "Ada", text: "Call the vendor" }])]).runtime,
    );
    expect((await todos(user.userId)).map((t) => t.text)).toEqual(["Call the vendor"]);
  });

  it("treats a commitment owned by 'me' as the user's only when the transcript has a Me speaker", async () => {
    const user = await addUser();
    const withMe = await addMeeting(user.userId, { transcript: "x" });
    await prisma.meeting.update({
      where: { id: withMe },
      data: { transcript: "Me: I will do it" },
    });
    const without = await addMeeting(user.userId);
    const answer = (text: string) => fakeRuntime([digestJson([{ owner: "me", text }])]).runtime;
    await digest(user.userId, without, answer("Not mine"));
    await digest(user.userId, withMe, answer("Mine from the me line"));
    expect((await todos(user.userId)).map((t) => t.text)).toEqual(["Mine from the me line"]);
  });

  it("stores the digest but creates no to-do when the user has no matching attendee", async () => {
    const user = await addUser();
    const id = await addMeeting(user.userId, { attendees: [{ email: "other@x.test" }] });
    await digest(
      user.userId,
      id,
      fakeRuntime([digestJson([{ owner: user.email, text: "Not attending" }])]).runtime,
    );
    expect(await todos(user.userId)).toHaveLength(0);
    expect((await prisma.meeting.findUniqueOrThrow({ where: { id } })).digestStatus).toBe("done");
  });

  it("marks the digest failed after invalid answers and stays silent", async () => {
    const user = await addUser();
    const id = await addMeeting(user.userId);
    const rt = fakeRuntime(["not json", '{"decisions": 4}', "{}"]);
    await digest(user.userId, id, rt.runtime);
    expect(rt.requests).toHaveLength(3);
    const meeting = await prisma.meeting.findUniqueOrThrow({ where: { id } });
    expect(meeting.digestStatus).toBe("failed");
    expect(meeting.digest).toBeNull();
    // A failed digest is not tried again.
    await digest(user.userId, id, rt.runtime);
    expect(rt.requests).toHaveLength(3);
  });

  it("caps an oversized digest and rejects an answer that is far too long", async () => {
    const user = await addUser();
    const big = await addMeeting(user.userId, { attendees: [{ email: user.email }] });
    const many = Array.from({ length: 80 }, (_, i) => ({
      owner: user.email,
      text: `Task number ${i} ${"x".repeat(500)}`,
    }));
    await digest(
      user.userId,
      big,
      fakeRuntime([digestJson(many, { decisions: Array.from({ length: 50 }, (_, i) => `d${i}`) })])
        .runtime,
    );
    const stored = (await prisma.meeting.findUniqueOrThrow({ where: { id: big } })).digest as {
      decisions: unknown[];
      commitments: Array<{ text: string }>;
    };
    expect(stored.decisions).toHaveLength(20);
    expect(stored.commitments).toHaveLength(30);
    expect(stored.commitments.every((c) => c.text.length <= 200)).toBe(true);

    const huge = await addMeeting(user.userId);
    const rt = fakeRuntime([digestJson([], { followUps: ["y".repeat(80_000)] })]);
    await digest(user.userId, huge, rt.runtime);
    expect((await prisma.meeting.findUniqueOrThrow({ where: { id: huge } })).digestStatus).toBe(
      "failed",
    );
  });

  it("stores an instruction-like commitment as plain text and makes no tool call", async () => {
    const user = await addUser();
    const id = await addMeeting(user.userId, { attendees: [{ email: user.email }] });
    const rt = fakeRuntime([
      digestJson([{ owner: user.email, text: "Wire $5,000 to account 000 <a href=x>now</a>" }]),
    ]);
    await digest(user.userId, id, rt.runtime);
    expect(rt.requests.every((r) => r.tools.length === 0)).toBe(true);
    const [row] = await todos(user.userId);
    expect(row?.text).toBe("Wire $5,000 to account 000 <a href=x>now</a>");
    expect(row?.messageId).toBeNull();
  });

  it("gives one to-do for the same promise from two meetings, and none again for a meeting that has one", async () => {
    const user = await addUser();
    const a = await addMeeting(user.userId, { attendees: [{ email: user.email }] });
    const b = await addMeeting(user.userId, { attendees: [{ email: user.email }] });
    const answer = digestJson([{ owner: user.email, text: "Send the deck." }]);
    await digest(user.userId, a, fakeRuntime([answer]).runtime);
    await digest(
      user.userId,
      b,
      fakeRuntime([digestJson([{ owner: user.email, text: "send the deck" }])]).runtime,
    );
    expect(await todos(user.userId)).toHaveLength(1);
    // A re-digest of the first meeting changes nothing.
    await prisma.meeting.update({
      where: { id: a },
      data: { digest: undefined, digestStatus: null },
    });
    await digest(
      user.userId,
      a,
      fakeRuntime([digestJson([{ owner: user.email, text: "Something new" }])]).runtime,
    );
    expect((await todos(user.userId)).map((t) => t.text)).toEqual(["Send the deck."]);
  });

  it("does nothing without AI-data consent, and queues empty digests once it is granted", async () => {
    const user = await addUser({ consent: false });
    const id = await addMeeting(user.userId, { attendees: [{ email: user.email }] });
    const rt = fakeRuntime([digestJson([{ owner: user.email, text: "Do it" }])]);
    await digest(user.userId, id, rt.runtime);
    expect(rt.requests).toHaveLength(0);
    expect(await todos(user.userId)).toHaveLength(0);
    expect((await prisma.meeting.findUniqueOrThrow({ where: { id } })).digestStatus).toBeNull();

    const queue = fakeJobs();
    await prisma.aiDataConsent.create({
      data: {
        userId: user.userId,
        spaceId,
        recipientKey: modelKey,
        version: AI_DISCLOSURE_VERSION,
      },
    });
    expect(
      await queueMeetingDigests({ prisma, jobs: queue.jobs }, { spaceId, userId: user.userId }),
    ).toBe(1);
    expect(queue.enqueued.map((j) => [j.name, j.payload])).toEqual([
      ["meetings.digest", { spaceId, userId: user.userId, meetingId: id }],
    ]);
    await digest(user.userId, id, rt.runtime);
    expect((await todos(user.userId)).map((t) => t.text)).toEqual(["Do it"]);
  });

  it("matches a stored digest again, with no model call, when a mail account adds an identity", async () => {
    const user = await addUser();
    const gmail = `later-${suffix}@gmail.test`;
    const id = await addMeeting(user.userId, { attendees: [{ email: gmail }] });
    const first = fakeRuntime([digestJson([{ owner: gmail, text: "Pay the invoice" }])]);
    await digest(user.userId, id, first.runtime);
    expect(await todos(user.userId)).toHaveLength(0);

    const queue = fakeJobs();
    const deps = { prisma, jobs: queue.jobs };
    // Nothing changed yet: the stored digest was already matched against this identity set.
    expect(await queueMeetingDigests(deps, { spaceId, userId: user.userId })).toBe(0);
    await addGmail(user.userId, gmail);
    expect(await queueMeetingDigests(deps, { spaceId, userId: user.userId })).toBe(1);
    const second = fakeRuntime(["unused"]);
    await digest(user.userId, id, second.runtime);
    expect(second.requests).toHaveLength(0);
    expect((await todos(user.userId)).map((t) => t.text)).toEqual(["Pay the invoice"]);
  });

  it("never reads another user's meeting", async () => {
    const owner = await addUser();
    const stranger = await addUser();
    const id = await addMeeting(owner.userId, { attendees: [{ email: stranger.email }] });
    const rt = fakeRuntime([digestJson([{ owner: stranger.email, text: "Not theirs" }])]);
    await digest(stranger.userId, id, rt.runtime);
    expect(rt.requests).toHaveLength(0);
    expect(await todos(stranger.userId)).toHaveLength(0);
  });
});
