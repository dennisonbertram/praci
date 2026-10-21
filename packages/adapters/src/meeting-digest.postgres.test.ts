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

  async function addUser(options: { consent?: boolean; gmail?: string; verified?: boolean } = {}) {
    const userId = `digest-user-${suffix}-${userIds.length}`;
    userIds.push(userId);
    await prisma.user.create({
      data: {
        id: userId,
        name: userId,
        email: `${userId}@Rakazo.test`,
        emailVerified: options.verified !== false,
      },
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

  it("ignores a Me speaker line in the transcript: transcript text never decides who the user is", async () => {
    const user = await addUser();
    const id = await addMeeting(user.userId, { transcript: "x" });
    await prisma.meeting.update({ where: { id }, data: { transcript: "Me: I will do it" } });
    await digest(
      user.userId,
      id,
      fakeRuntime([digestJson([{ owner: "me", text: "Claimed by a transcript line" }])]).runtime,
    );
    expect(await todos(user.userId)).toHaveLength(0);
  });

  it("counts an owner given as a name only when exactly one attendee has that name", async () => {
    const gmail = `alex-${suffix}@gmail.test`;
    const user = await addUser({ gmail });
    const ambiguous = await addMeeting(user.userId, {
      attendees: [
        { name: "Alex", email: gmail },
        { name: "alex", email: "other-alex@x.test" },
      ],
    });
    const answer = (text: string) => fakeRuntime([digestJson([{ owner: "ALEX", text }])]).runtime;
    await digest(user.userId, ambiguous, answer("Two Alexes"));
    expect(await todos(user.userId)).toHaveLength(0);
    const single = await addMeeting(user.userId, { attendees: [{ name: "Alex", email: gmail }] });
    await digest(user.userId, single, answer("One Alex"));
    expect((await todos(user.userId)).map((t) => t.text)).toEqual(["One Alex"]);
  });

  it("does not use an unverified User.email, but still uses a connected Gmail account", async () => {
    const gmail = `v-${suffix}@gmail.test`;
    const user = await addUser({ verified: false });
    const id = await addMeeting(user.userId, { attendees: [{ email: user.email }] });
    await digest(
      user.userId,
      id,
      fakeRuntime([digestJson([{ owner: user.email, text: "Unverified" }])]).runtime,
    );
    expect(await todos(user.userId)).toHaveLength(0);
    await addGmail(user.userId, gmail);
    const other = await addMeeting(user.userId, { attendees: [{ email: gmail }] });
    await digest(
      user.userId,
      other,
      fakeRuntime([digestJson([{ owner: gmail, text: "Verified by OAuth" }])]).runtime,
    );
    expect((await todos(user.userId)).map((t) => t.text)).toEqual(["Verified by OAuth"]);
  });

  it("stores the digest and its to-dos together: a failed insert leaves the meeting retryable", async () => {
    const user = await addUser();
    const id = await addMeeting(user.userId, { attendees: [{ email: user.email }] });
    let fail = true;
    const flaky = new Proxy(prisma, {
      get(target, prop, receiver) {
        if (prop !== "$transaction") return Reflect.get(target, prop, receiver);
        return (fn: (tx: PrismaClient) => Promise<unknown>) =>
          target.$transaction((tx) =>
            fn(
              new Proxy(tx, {
                get(t, p, r) {
                  if (p === "inboxTodo") {
                    return new Proxy(t.inboxTodo, {
                      get(model, method, receiver) {
                        if (method === "createMany" && fail) {
                          return () => {
                            fail = false;
                            throw new Error("insert failed");
                          };
                        }
                        return Reflect.get(model, method, receiver);
                      },
                    });
                  }
                  return Reflect.get(t, p, r);
                },
              }) as PrismaClient,
            ),
          );
      },
    }) as PrismaClient;
    const rt = fakeRuntime([digestJson([{ owner: user.email, text: "Do it" }])]);
    const run = (client: PrismaClient) =>
      runMeetingDigest(
        { prisma: client, runtime: rt.runtime, resolveModel: async () => model },
        { spaceId, userId: user.userId, meetingId: id },
      );
    await expect(run(flaky)).rejects.toThrow("insert failed");
    const after = await prisma.meeting.findUniqueOrThrow({ where: { id } });
    expect(after.digestStatus).toBeNull();
    expect(after.digest).toBeNull();
    await run(prisma);
    expect((await todos(user.userId)).map((t) => t.text)).toEqual(["Do it"]);
    expect((await prisma.meeting.findUniqueOrThrow({ where: { id } })).digestStatus).toBe("done");
  });

  it("makes one model call when two jobs digest the same meeting at once", async () => {
    const user = await addUser();
    const id = await addMeeting(user.userId, { attendees: [{ email: user.email }] });
    const requests: unknown[] = [];
    const runtime = {
      run: async function* (request: unknown) {
        requests.push(request);
        await new Promise((resolve) => setTimeout(resolve, 150));
        yield { type: "done" as const, text: digestJson([{ owner: user.email, text: "Once" }]) };
      },
    } as unknown as AgentRuntime;
    await Promise.all([digest(user.userId, id, runtime), digest(user.userId, id, runtime)]);
    expect(requests).toHaveLength(1);
    expect(await todos(user.userId)).toHaveLength(1);
  });

  it("counts a model error toward the attempt limit and ends failed", async () => {
    const user = await addUser();
    const id = await addMeeting(user.userId);
    let calls = 0;
    const runtime = {
      run: async function* () {
        calls++;
        if (calls > 0) throw new Error("model down");
        yield { type: "done" as const, text: "" };
      },
    } as unknown as AgentRuntime;
    await digest(user.userId, id, runtime);
    expect(calls).toBe(3);
    expect((await prisma.meeting.findUniqueOrThrow({ where: { id } })).digestStatus).toBe("failed");
  });

  it("filters matched digests before the limit, and continues a longer backlog", async () => {
    const user = await addUser();
    const scope = { spaceId, userId: user.userId };
    const pending = await addMeeting(user.userId);
    await prisma.meeting.update({
      where: { id: pending },
      data: { startedAt: new Date("2020-01-01T00:00:00Z") },
    });
    const queue = fakeJobs();
    // Newer meetings with a digest already matched against this identity set need nothing.
    for (let i = 0; i < 3; i++) {
      const done = await addMeeting(user.userId);
      await digest(user.userId, done, fakeRuntime([digestJson([])]).runtime);
    }
    expect(await queueMeetingDigests({ prisma, jobs: queue.jobs }, scope, 2)).toBe(1);
    expect(queue.enqueued.map((j) => (j.payload as { meetingId: string }).meetingId)).toEqual([
      pending,
    ]);

    // Three empty digests with a limit of 2: the last queued job carries on with the rest.
    const more = fakeJobs();
    const user2 = await addUser();
    const ids = [
      await addMeeting(user2.userId),
      await addMeeting(user2.userId),
      await addMeeting(user2.userId),
    ];
    expect(
      await queueMeetingDigests({ prisma, jobs: more.jobs }, { spaceId, userId: user2.userId }, 2),
    ).toBe(2);
    expect(more.enqueued.map((j) => (j.payload as { continue?: boolean }).continue)).toEqual([
      undefined,
      true,
    ]);
    const rest = fakeJobs();
    await runMeetingDigest(
      {
        prisma,
        runtime: fakeRuntime(["{}"]).runtime,
        jobs: rest.jobs,
        resolveModel: async () => model,
      },
      { spaceId, userId: user2.userId, meetingId: ids[0] as string, continue: true },
    );
    expect(rest.enqueued).toHaveLength(2);
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
