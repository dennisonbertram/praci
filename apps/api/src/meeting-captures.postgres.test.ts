import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRouterClient } from "@orpc/server";
import type { BackgroundJob, TranscriptionProvider } from "@rakazo/adapter-kit";
import {
  aiRecipient,
  CAPTURE_ABANDONED_MS,
  createSecretStore,
  LocalArtifactStore,
  runCaptureFinalize,
  runCaptureSweep,
  runCaptureTranscribe,
} from "@rakazo/adapters";
import type { Actor } from "@rakazo/contracts";
import { AI_DISCLOSURE_VERSION, MEETING_CAPTURE_CHUNK_MAX_BYTES } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { Hono } from "hono";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { mountMeetingCaptureRoutes } from "./meeting-captures.js";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const text = (value: string) => new TextEncoder().encode(value);
/** Answers with the chunk's own bytes as text, and fails on "FAIL", so order is observable. */
const echoProvider = (): TranscriptionProvider =>
  ({
    transcribe: async ({ audio }: { audio: Uint8Array }) => {
      const said = new TextDecoder().decode(audio);
      if (said === "FAIL") throw new Error("provider down");
      return { text: said };
    },
  }) as unknown as TranscriptionProvider;

describePostgres("Meeting captures (PostgreSQL)", () => {
  const run = randomUUID().slice(0, 8);
  const secrets = createSecretStore("fake-encryption-key", {});
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let root: string;
  let artifacts: LocalArtifactStore;
  let app: Hono;
  const enqueued: BackgroundJob[] = [];
  const actors: Record<string, Actor> = {};
  const jobs = { enqueue: async (job: BackgroundJob) => void enqueued.push(job) };

  const client = (who: Actor) =>
    createRouterClient(
      createRouter({
        prisma,
        env: { webOrigin: "https://app.example.com" },
        jobs,
        artifacts,
        secrets,
      } as unknown as RouterDeps),
      { context: { actor: who } as never },
    );
  const jobsNamed = (name: string) => enqueued.filter((job) => job.name === name);
  const deps = () => ({ prisma, artifacts, secrets, jobs, createProvider: echoProvider });

  const upload = (
    who: string,
    id: string,
    track: string,
    seq: number,
    startMs: number,
    body: Uint8Array,
  ) =>
    app.request(
      `/api/meeting-captures/${id}/chunks?track=${track}&seq=${seq}&startMs=${startMs}&endMs=${startMs + 1000}`,
      {
        method: "POST",
        body: body as BodyInit,
        headers: { "content-type": "application/octet-stream", "x-test-actor": who },
      },
    );
  /** Runs every queued transcribe job once; a throw is a retry, as the queue would. */
  const drainTranscribe = async () => {
    const queue = jobsNamed("meetings.capture_transcribe");
    enqueued.length = 0;
    for (const job of queue) {
      await runCaptureTranscribe(
        deps(),
        job.payload as { spaceId: string; userId: string; chunkId: string },
      ).catch(() => undefined);
    }
  };
  const finalizePayload = (captureId: string, who: Actor) => ({
    spaceId: who.spaceId,
    userId: who.userId,
    captureId,
  });
  const meetingOf = (captureId: string) =>
    prisma.meeting.findFirst({ where: { provider: "praci", externalId: captureId } });

  beforeAll(async () => {
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    root = await mkdtemp(path.join(tmpdir(), "capture-"));
    artifacts = new LocalArtifactStore(root);
    for (const [label, role] of [
      ["a", "owner"],
      ["b", "owner"],
      ["m", "member"],
    ] as const) {
      const userId = `cap-user-${label}-${run}`;
      const orgId = `cap-org-${label}-${run}`;
      const spaceId = `cap-space-${label}-${run}`;
      await prisma.organization.create({
        data: { id: orgId, name: label, slug: orgId, createdAt: new Date() },
      });
      await prisma.space.create({
        data: { id: spaceId, organizationId: orgId, name: label, isDefault: true },
      });
      await prisma.user.create({
        data: {
          id: userId,
          name: `User ${label}`,
          email: `${userId}@rakazo.test`,
          emailVerified: true,
        },
      });
      await prisma.member.create({
        data: {
          id: `cap-mem-${label}-${run}`,
          organizationId: orgId,
          userId,
          role: "member",
          createdAt: new Date(),
        },
      });
      await prisma.spaceMember.upsert({
        where: { spaceId_userId: { spaceId, userId } },
        update: { role },
        create: {
          id: `cap-sm-${label}-${run}`,
          spaceId,
          organizationId: orgId,
          userId,
          role,
          createdAt: new Date(),
        },
      });
      actors[label] = { userId, spaceId, email: `${userId}@rakazo.test`, isDeploymentOwner: false };
    }
    // User a's server transcription: a selected provider with consent. b has none.
    const a = actors.a as Actor;
    const stored = await secrets.put("fake-key-12345", {
      operationId: "t",
      traceId: "t",
      spaceId: a.spaceId,
      userId: a.userId,
      signal: new AbortController().signal,
    });
    await prisma.secret.create({
      data: {
        id: stored.id,
        userId: a.userId,
        spaceId: null,
        kind: "voice",
        ciphertext: stored.ciphertext,
      },
    });
    await prisma.transcriptionSelection.create({
      data: { userId: a.userId, provider: "openai", secretId: stored.id },
    });
    await prisma.aiDataConsent.create({
      data: {
        userId: a.userId,
        spaceId: a.spaceId,
        recipientKey: (aiRecipient({ provider: "openai", use: "voice" }) as { key: string }).key,
        version: AI_DISCLOSURE_VERSION,
      },
    });
    app = new Hono();
    mountMeetingCaptureRoutes(
      app,
      { prisma, artifacts, jobs },
      async (request) => actors[request.headers.get("x-test-actor") ?? ""] ?? null,
    );
  });

  beforeEach(() => {
    enqueued.length = 0;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.space.deleteMany({ where: { id: { startsWith: "cap-space-", endsWith: run } } });
    await prisma.organization.deleteMany({
      where: { id: { startsWith: "cap-org-" }, slug: { endsWith: run } },
    });
    await prisma.user.deleteMany({ where: { id: { startsWith: "cap-user-", endsWith: run } } });
    await rm(root, { recursive: true, force: true });
    await close();
  });

  const start = (who: Actor, clientId: string, engine: "server" | "device" = "server") =>
    client(who).meetingCaptures.start({
      clientId,
      title: "Weekly sync",
      engine,
      tracks: ["microphone", "system"],
    });

  it("starts idempotently per user and clientId", async () => {
    const a = actors.a as Actor;
    const first = await start(a, "same");
    expect(await start(a, "same")).toEqual(first);
    expect((await start(actors.b as Actor, "same")).captureId).not.toBe(first.captureId);
    expect(
      await prisma.meetingCapture.count({ where: { userId: a.userId, clientId: "same" } }),
    ).toBe(1);
    expect(await client(a).meetingCaptures.active()).toMatchObject({
      captureId: first.captureId,
      status: "recording",
    });
    await client(a).meetingCaptures.discard({ captureId: first.captureId });
  });

  it("enforces the space policy and lets only owners and admins change it", async () => {
    const b = actors.b as Actor;
    await expect(
      client(actors.m as Actor).spaces.setMeetingRecording({ policy: "off" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await client(b).spaces.setMeetingRecording({ policy: "confirm" });
    await expect(start(b, "c1")).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const ok = await client(b).meetingCaptures.start({
      clientId: "c2",
      engine: "server",
      tracks: ["microphone"],
      consentConfirmed: true,
    });
    const row = await prisma.meetingCapture.findUniqueOrThrow({ where: { id: ok.captureId } });
    expect(row.consentConfirmedAt).toBeInstanceOf(Date);
    await client(b).spaces.setMeetingRecording({ policy: "off" });
    await expect(start(b, "c3")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await client(b).spaces.setMeetingRecording({ policy: "remind" });
    expect((await start(b, "c4")).captureId).toBeTruthy();
    // A policy change does not touch a capture already started.
    expect((await start(b, "c2")).captureId).toBe(ok.captureId);
  });

  it("refuses to change the policy of a space being deleted and hides the setting", async () => {
    const b = actors.b as Actor;
    await client(b).spaces.setMeetingRecording({ policy: "remind" });
    await prisma.space.update({ where: { id: b.spaceId }, data: { deletingAt: new Date() } });
    try {
      await expect(client(b).spaces.setMeetingRecording({ policy: "off" })).rejects.toMatchObject({
        code: "CONFLICT",
        message: "Space deletion is already in progress",
      });
      const row = await prisma.space.findUniqueOrThrow({ where: { id: b.spaceId } });
      expect(row.meetingRecording).toBe("remind");
      const listed = (await client(b).spaces.list()).spaces;
      expect(listed.find((s) => s.id === b.spaceId)?.canSetMeetingRecording).toBe(false);
    } finally {
      await prisma.space.update({ where: { id: b.spaceId }, data: { deletingAt: null } });
    }
    const listed = (await client(b).spaces.list()).spaces;
    expect(listed.find((s) => s.id === b.spaceId)?.canSetMeetingRecording).toBe(true);
  });

  it("rejects another user's capture everywhere", async () => {
    const { captureId } = await start(actors.a as Actor, "private");
    const b = client(actors.b as Actor);
    await expect(
      b.meetingCaptures.appendText({
        captureId,
        track: "microphone",
        seq: 0,
        startMs: 0,
        endMs: 1,
        text: "x",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      b.meetingCaptures.finish({ captureId, endedAt: new Date().toISOString() }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(b.meetingCaptures.discard({ captureId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    expect((await upload("b", captureId, "microphone", 0, 0, text("hi"))).status).toBe(404);
    expect((await upload("nobody", captureId, "microphone", 0, 0, text("hi"))).status).toBe(401);
    await client(actors.a as Actor).meetingCaptures.discard({ captureId });
  });

  it("stores a retried chunk once and refuses other bytes at the same position", async () => {
    const { captureId } = await start(actors.a as Actor, "retry");
    expect((await upload("a", captureId, "microphone", 0, 0, text("one"))).status).toBe(201);
    expect((await upload("a", captureId, "microphone", 0, 0, text("one"))).status).toBe(200);
    expect((await upload("a", captureId, "microphone", 0, 0, text("other"))).status).toBe(409);
    expect((await upload("a", captureId, "bogus", 0, 0, text("one"))).status).toBe(400);
    const big = new Uint8Array(MEETING_CAPTURE_CHUNK_MAX_BYTES + 1);
    expect((await upload("a", captureId, "microphone", 1, 0, big)).status).toBe(413);
    expect(await prisma.meetingCaptureChunk.count({ where: { captureId } })).toBe(1);
    // The retry queued transcription again, and the queue keeps one job per chunk.
    expect(jobsNamed("meetings.capture_transcribe")).toHaveLength(2);
    expect(new Set(jobsNamed("meetings.capture_transcribe").map((j) => j.replaceKey)).size).toBe(1);
    await client(actors.a as Actor).meetingCaptures.discard({ captureId });
  });

  it("stores lines in time order across tracks, deletes audio, and finalizes once", async () => {
    const a = actors.a as Actor;
    const { captureId } = await start(a, "full");
    await upload("a", captureId, "microphone", 0, 0, text("mic one"));
    await upload("a", captureId, "system", 0, 10_000, text("sys one"));
    await upload("a", captureId, "microphone", 1, 30_000, text("mic two"));
    await upload("a", captureId, "system", 1, 20_000, text("sys two"));
    const keys = (await prisma.meetingCaptureChunk.findMany({ where: { captureId } })).map(
      (c) => c.blobKey as string,
    );
    expect(keys).toHaveLength(4);

    await client(a).meetingCaptures.finish({ captureId, endedAt: new Date().toISOString() });
    // Chunks are pending, so finalize waits.
    await runCaptureFinalize(deps(), finalizePayload(captureId, a));
    expect(await meetingOf(captureId)).toBeNull();

    await drainTranscribe();
    // The last transcription queued finalize; the audio is gone.
    expect(jobsNamed("meetings.capture_finalize").length).toBeGreaterThan(0);
    for (const key of keys)
      await expect(
        artifacts.get(key, { spaceId: a.spaceId, userId: a.userId } as never),
      ).rejects.toThrow();
    expect(
      await prisma.meetingCaptureChunk.count({
        where: { captureId, blobKey: null, status: "done" },
      }),
    ).toBe(4);

    enqueued.length = 0;
    await runCaptureFinalize(deps(), finalizePayload(captureId, a));
    const meeting = await meetingOf(captureId);
    expect(meeting).toMatchObject({
      title: "Weekly sync",
      transcript: "User a: mic one\nThem: sys one\nThem: sys two\nUser a: mic two",
      connectionId: null,
      mcpServerId: null,
    });
    expect(meeting?.attendees).toEqual([{ name: "User a", email: `${a.userId}@rakazo.test` }]);
    expect(jobsNamed("meetings.digest")).toHaveLength(1);
    expect(await client(a).meetings.get({ meetingId: meeting?.id as string })).toMatchObject({
      provider: "praci",
      partial: false,
    });

    // A repeat is a no-op.
    await runCaptureFinalize(deps(), finalizePayload(captureId, a));
    expect(
      await prisma.meeting.count({ where: { provider: "praci", externalId: captureId } }),
    ).toBe(1);
    expect(jobsNamed("meetings.digest")).toHaveLength(1);
    expect(await client(a).meetingCaptures.active()).toBeNull();
  });

  it("marks the meeting partial when a chunk fails all three attempts, and deletes its audio", async () => {
    const a = actors.a as Actor;
    const { captureId } = await start(a, "partial");
    await upload("a", captureId, "microphone", 0, 0, text("good"));
    await upload("a", captureId, "system", 0, 5000, text("FAIL"));
    await client(a).meetingCaptures.finish({ captureId, endedAt: new Date().toISOString() });
    const queue = jobsNamed("meetings.capture_transcribe");
    for (let attempt = 0; attempt < 3; attempt += 1) {
      for (const job of queue) {
        await runCaptureTranscribe(deps(), job.payload as never).catch(() => undefined);
      }
    }
    const chunks = await prisma.meetingCaptureChunk.findMany({
      where: { captureId },
      orderBy: { track: "asc" },
    });
    expect(chunks.map((c) => [c.track, c.status, c.blobKey])).toEqual([
      ["microphone", "done", null],
      ["system", "failed", null],
    ]);
    await runCaptureFinalize(deps(), finalizePayload(captureId, a));
    const meeting = await meetingOf(captureId);
    expect(meeting?.transcript).toBe("User a: good");
    expect(await client(a).meetings.get({ meetingId: meeting?.id as string })).toMatchObject({
      partial: true,
    });
  });

  it("marks the meeting partial when the client reports pieces the server refused", async () => {
    const a = actors.a as Actor;
    const { captureId } = await start(a, "lost");
    await upload("a", captureId, "microphone", 0, 0, text("kept"));
    await client(a).meetingCaptures.finish({
      captureId,
      endedAt: new Date().toISOString(),
      lostChunks: 2,
    });
    await drainTranscribe();
    await runCaptureFinalize(deps(), finalizePayload(captureId, a));
    const meeting = await meetingOf(captureId);
    expect(meeting?.transcript).toBe("User a: kept");
    expect(await client(a).meetings.get({ meetingId: meeting?.id as string })).toMatchObject({
      partial: true,
    });
  });

  it("reports transcription consent for the provider transcription would actually use", async () => {
    expect(await client(actors.a as Actor).voice.status()).toMatchObject({
      transcriptionConsented: true,
    });
    expect(await client(actors.b as Actor).voice.status()).toMatchObject({
      transcriptionConsented: false,
    });
    // Consent for the selected provider, but its key is gone: transcription would not use it.
    const m = actors.m as Actor;
    await prisma.transcriptionSelection.create({
      data: { userId: m.userId, provider: "openai", secretId: `missing-${run}` },
    });
    await prisma.aiDataConsent.create({
      data: {
        userId: m.userId,
        spaceId: m.spaceId,
        recipientKey: (aiRecipient({ provider: "openai", use: "voice" }) as { key: string }).key,
        version: AI_DISCLOSURE_VERSION,
      },
    });
    expect(await client(m).voice.status()).toMatchObject({ transcriptionConsented: false });
  });

  it("fails chunks without consent instead of sending audio", async () => {
    const b = actors.b as Actor;
    const { captureId } = await start(b, "noconsent");
    await upload("b", captureId, "microphone", 0, 0, text("secret"));
    await drainTranscribe();
    const [chunk] = await prisma.meetingCaptureChunk.findMany({ where: { captureId } });
    expect(chunk).toMatchObject({ status: "failed", blobKey: null, text: null });
    await client(b).meetingCaptures.discard({ captureId });
  });

  it("finalizes an abandoned capture from the sweep with what arrived", async () => {
    const a = actors.a as Actor;
    const { captureId } = await start(a, "abandoned", "device");
    await client(a).meetingCaptures.appendText({
      captureId,
      track: "microphone",
      seq: 0,
      startMs: 0,
      endMs: 1000,
      text: "hello",
    });
    // Retrying the same text is fine; other text at the same position is not.
    await client(a).meetingCaptures.appendText({
      captureId,
      track: "microphone",
      seq: 0,
      startMs: 0,
      endMs: 1000,
      text: "hello",
    });
    await expect(
      client(a).meetingCaptures.appendText({
        captureId,
        track: "microphone",
        seq: 0,
        startMs: 0,
        endMs: 1000,
        text: "different",
      }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    // Not abandoned yet.
    expect(await runCaptureSweep({ prisma, jobs })).toBe(0);
    await prisma.meetingCapture.update({
      where: { id: captureId },
      data: { lastChunkAt: new Date(Date.now() - CAPTURE_ABANDONED_MS - 60_000) },
    });
    enqueued.length = 0;
    expect(await runCaptureSweep({ prisma, jobs })).toBe(1);
    const [job] = jobsNamed("meetings.capture_finalize");
    expect(job?.payload).toEqual(finalizePayload(captureId, a));
    await runCaptureFinalize(deps(), job?.payload as never);
    expect((await meetingOf(captureId))?.transcript).toBe("User a: hello");
    expect(await runCaptureSweep({ prisma, jobs })).toBe(0);
  });

  it("discards a capture with its chunks and audio", async () => {
    const a = actors.a as Actor;
    const { captureId } = await start(a, "discard");
    await upload("a", captureId, "microphone", 0, 0, text("bye"));
    const [chunk] = await prisma.meetingCaptureChunk.findMany({ where: { captureId } });
    await client(a).meetingCaptures.discard({ captureId });
    expect(await prisma.meetingCaptureChunk.count({ where: { captureId } })).toBe(0);
    await expect(
      artifacts.get(chunk?.blobKey as string, { spaceId: a.spaceId, userId: a.userId } as never),
    ).rejects.toThrow();
    expect((await upload("a", captureId, "microphone", 1, 0, text("late"))).status).toBe(404);
    expect(await client(a).meetingCaptures.active()).toBeNull();
    await client(a).meetingCaptures.discard({ captureId });
  });

  const blobDeletes = () =>
    jobsNamed("dataroom.blob.delete").map((j) => (j.payload as { storageKey: string }).storageKey);
  const keysOf = async (captureId: string) =>
    (await prisma.meetingCaptureChunk.findMany({ where: { captureId } })).flatMap((c) =>
      c.blobKey ? [c.blobKey] : [],
    );

  it("leaves a discarded capture discarded when finalize runs afterwards, and queues the audio's deletion", async () => {
    const a = actors.a as Actor;
    const { captureId } = await start(a, "discard-final");
    await upload("a", captureId, "microphone", 0, 0, text("kept?"));
    const keys = await keysOf(captureId);
    await client(a).meetingCaptures.finish({ captureId, endedAt: new Date().toISOString() });
    await client(a).meetingCaptures.discard({ captureId });
    expect(blobDeletes()).toEqual(expect.arrayContaining(keys));
    await runCaptureFinalize(deps(), finalizePayload(captureId, a));
    expect(
      (await prisma.meetingCapture.findUniqueOrThrow({ where: { id: captureId } })).status,
    ).toBe("discarded");
    expect(await meetingOf(captureId)).toBeNull();
  });

  it("refuses an append after finalize, and clears chunk text once the meeting holds it", async () => {
    const a = actors.a as Actor;
    const { captureId } = await start(a, "late", "device");
    const append = (seq: number, said: string) =>
      client(a).meetingCaptures.appendText({
        captureId,
        track: "microphone",
        seq,
        startMs: seq * 1000,
        endMs: seq * 1000 + 500,
        text: said,
      });
    await append(0, "first");
    await client(a).meetingCaptures.finish({ captureId, endedAt: new Date().toISOString() });
    await runCaptureFinalize(deps(), finalizePayload(captureId, a));
    await expect(append(1, "too late")).rejects.toMatchObject({ code: "CONFLICT" });
    expect((await meetingOf(captureId))?.transcript).toBe("User a: first");
    expect(
      await prisma.meetingCaptureChunk.findMany({
        where: { captureId },
        select: { text: true, status: true },
      }),
    ).toEqual([{ text: null, status: "done" }]);
  });

  it("does not overwrite a chunk another worker already settled", async () => {
    const a = actors.a as Actor;
    const { captureId } = await start(a, "two-workers");
    await upload("a", captureId, "microphone", 0, 0, text("real words"));
    const chunk = await prisma.meetingCaptureChunk.findFirstOrThrow({ where: { captureId } });
    await prisma.meetingCaptureChunk.update({ where: { id: chunk.id }, data: { attempts: 2 } });
    const payload = { spaceId: a.spaceId, userId: a.userId, chunkId: chunk.id };
    // While the first worker is inside the provider, a second worker settles the chunk.
    const racing = () =>
      ({
        transcribe: async () => {
          await runCaptureTranscribe(deps(), payload);
          throw new Error("provider down");
        },
      }) as unknown as TranscriptionProvider;
    await runCaptureTranscribe({ ...deps(), createProvider: racing }, payload);
    expect(
      await prisma.meetingCaptureChunk.findUniqueOrThrow({ where: { id: chunk.id } }),
    ).toMatchObject({
      status: "done",
      text: "real words",
      blobKey: null,
    });
    await client(a).meetingCaptures.discard({ captureId });
  });

  it("refuses a concurrent chunk with other bytes and deletes the surplus audio", async () => {
    const a = actors.a as Actor;
    const { captureId } = await start(a, "conflict");
    // The rival chunk lands between the route's first check and its locked insert.
    const racing = Object.create(artifacts) as LocalArtifactStore;
    racing.put = async (...args: Parameters<LocalArtifactStore["put"]>) => {
      const stored = await artifacts.put(...args);
      await prisma.meetingCaptureChunk.create({
        data: {
          spaceId: a.spaceId,
          userId: a.userId,
          captureId,
          track: "microphone",
          seq: 0,
          startMs: 0,
          endMs: 1,
          sha256: "rival",
          status: "done",
          text: "rival",
        },
      });
      return stored;
    };
    const racingApp = new Hono();
    mountMeetingCaptureRoutes(racingApp, { prisma, artifacts: racing, jobs }, async () => a);
    const response = await racingApp.request(
      `/api/meeting-captures/${captureId}/chunks?track=microphone&seq=0&startMs=0&endMs=1000`,
      {
        method: "POST",
        body: text("ours") as BodyInit,
        headers: { "content-type": "application/octet-stream" },
      },
    );
    expect(response.status).toBe(409);
    expect(await prisma.meetingCaptureChunk.count({ where: { captureId } })).toBe(1);
    expect(blobDeletes()).toHaveLength(1);
    await client(a).meetingCaptures.discard({ captureId });
  });

  it("queues the digest on a finalize retry after the first attempt could not", async () => {
    const a = actors.a as Actor;
    const { captureId } = await start(a, "digest-retry", "device");
    await client(a).meetingCaptures.appendText({
      captureId,
      track: "system",
      seq: 0,
      startMs: 0,
      endMs: 1,
      text: "hi",
    });
    await client(a).meetingCaptures.finish({ captureId, endedAt: new Date().toISOString() });
    let failing = true;
    const flaky = {
      enqueue: async (job: BackgroundJob) => {
        if (job.name === "meetings.digest" && failing) throw new Error("queue down");
        enqueued.push(job);
      },
    };
    await expect(
      runCaptureFinalize({ ...deps(), jobs: flaky }, finalizePayload(captureId, a)),
    ).rejects.toThrow();
    // Nothing was marked done, and no half-stored meeting is left.
    expect(
      (await prisma.meetingCapture.findUniqueOrThrow({ where: { id: captureId } })).status,
    ).toBe("finishing");
    expect(await meetingOf(captureId)).toBeNull();
    failing = false;
    await runCaptureFinalize({ ...deps(), jobs: flaky }, finalizePayload(captureId, a));
    expect(jobsNamed("meetings.digest")).toHaveLength(1);
    expect(
      (await prisma.meetingCapture.findUniqueOrThrow({ where: { id: captureId } })).status,
    ).toBe("done");
  });
});
