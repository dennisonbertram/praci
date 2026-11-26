import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { BackgroundJob, JobPublisher } from "@rakazo/adapter-kit";
import type { Actor } from "@rakazo/contracts";
import { AI_DISCLOSURE_VERSION } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDataRoomRepos, createDb } from "@rakazo/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { aiRecipient } from "./ai-consent.js";
import { LocalArtifactStore } from "./artifacts.js";
import { createFileDataRoomItem } from "./data-room-files.js";
import { listRecentOmiSegments } from "./omi-recent.js";
import { muxOggOpus } from "./omi-records.js";
import {
  NO_TRANSCRIPTION_PROVIDER,
  requeueOmiTranscriptions,
  runOmiTranscribe,
} from "./omi-transcribe.js";
import { createSecretStore } from "./secret-store-factory.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

// The scripted provider returns a fixed line and calls no vendor.
const SCRIPTED_TRANSCRIPT = "hello from the transcription provider";
describePostgres("Omi transcription (PostgreSQL)", () => {
  const run = randomUUID().slice(0, 8);
  const secrets = createSecretStore("fake-encryption-key", {});
  let prisma: PrismaClient;
  let close: () => Promise<void>;
  let root: string;
  let artifacts: LocalArtifactStore;
  const actors: Actor[] = [];
  const queued: BackgroundJob[] = [];
  let counter = 0;

  /** Synthetic 20 ms frames (not audio) muxed the way assembly does. */
  const audio = (seconds: number) =>
    muxOggOpus(
      Array.from({ length: seconds * 50 }, () => new Uint8Array(2).fill(7)),
      { sampleRate: 16000, frameMs: 20 },
    );

  const makeItem = async (who: Actor, seconds: number) => {
    counter += 1;
    const filing = createFileDataRoomItem(
      { prisma, artifacts, jobs: { enqueue: async () => undefined } as unknown as JobPublisher },
      createDataRoomRepos(prisma),
    );
    const bytes = audio(seconds);
    bytes[bytes.length - 1] = counter; // distinct content per item
    const filed = await filing.storeAndFile(who, {
      content: { bytes },
      name: `Recording ${counter}`,
      mimeType: "audio/ogg",
      folderId: null,
      source: "omi",
      externalId: `omi:${run}:${counter}`,
      notIndexed: true,
      ready: true,
    });
    return (filed.item as { id: string }).id;
  };
  const payload = (who: Actor, itemId: string) => ({
    spaceId: who.spaceId,
    userId: who.userId,
    itemId,
  });
  const row = (itemId: string) =>
    prisma.dataRoomItem.findUniqueOrThrow({ where: { id: itemId }, include: { text: true } });

  const select = async (who: Actor, provider: string, consent: boolean) => {
    const stored = await secrets.put("fake-key-12345", {
      operationId: "t",
      traceId: "t",
      spaceId: who.spaceId,
      userId: who.userId,
      signal: new AbortController().signal,
    });
    await prisma.secret.create({
      data: {
        id: stored.id,
        userId: who.userId,
        spaceId: null,
        kind: "voice",
        ciphertext: stored.ciphertext,
      },
    });
    await prisma.transcriptionSelection.create({
      data: { userId: who.userId, provider, secretId: stored.id },
    });
    if (consent) {
      await prisma.aiDataConsent.create({
        data: {
          userId: who.userId,
          spaceId: who.spaceId,
          recipientKey: (aiRecipient({ provider, use: "voice" }) as { key: string }).key,
          version: AI_DISCLOSURE_VERSION,
        },
      });
    }
  };

  beforeAll(async () => {
    process.env.AGENT_RUNTIME = "scripted";
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await prisma.$disconnect();
      await db.pool.end();
    };
    root = await mkdtemp(path.join(tmpdir(), "omi-tx-"));
    artifacts = new LocalArtifactStore(root);
    for (const label of ["a", "b"]) {
      const userId = `omitx-user-${label}-${run}`;
      const orgId = `omitx-org-${label}-${run}`;
      const spaceId = `omitx-space-${label}-${run}`;
      await prisma.organization.create({
        data: { id: orgId, name: label, slug: orgId, createdAt: new Date() },
      });
      await prisma.space.create({
        data: { id: spaceId, organizationId: orgId, name: label, isDefault: true },
      });
      await prisma.user.create({
        data: { id: userId, name: label, email: `${userId}@rakazo.test`, emailVerified: false },
      });
      await prisma.member.create({
        data: {
          id: `omitx-mem-${label}-${run}`,
          organizationId: orgId,
          userId,
          role: "member",
          createdAt: new Date(),
        },
      });
      await prisma.spaceMember.upsert({
        where: { spaceId_userId: { spaceId, userId } },
        update: {},
        create: {
          id: `omitx-sm-${label}-${run}`,
          spaceId,
          organizationId: orgId,
          userId,
          createdAt: new Date(),
        },
      });
      actors.push({ userId, spaceId, email: `${userId}@rakazo.test`, isDeploymentOwner: false });
    }
  });

  beforeEach(async () => {
    queued.length = 0;
    for (const who of actors) {
      await prisma.transcriptionSelection.deleteMany({ where: { userId: who.userId } });
      await prisma.aiDataConsent.deleteMany({ where: { userId: who.userId } });
    }
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.space.deleteMany({ where: { id: { in: actors.map((x) => x.spaceId) } } });
    await prisma.organization.deleteMany({
      where: { id: { startsWith: "omitx-org-" }, slug: { endsWith: run } },
    });
    await prisma.user.deleteMany({ where: { id: { startsWith: "omitx-user-", endsWith: run } } });
    await rm(root, { recursive: true, force: true });
    await close();
  });

  const deps = () => ({ prisma, artifacts, secrets });

  it("sets an error, without throwing, when no provider is chosen", async () => {
    const who = actors[0] as Actor;
    const id = await makeItem(who, 5);
    await runOmiTranscribe(deps(), payload(who, id));
    const item = await row(id);
    expect(item.error).toBe(NO_TRANSCRIPTION_PROVIDER);
    expect(item.status).toBe("ready");
    expect(item.text?.text ?? "").toBe("");
  });

  it("sets the same error when the chosen provider has no consent", async () => {
    const who = actors[0] as Actor;
    await select(who, "scripted-transcribe", false);
    const id = await makeItem(who, 5);
    await runOmiTranscribe(deps(), payload(who, id));
    const item = await row(id);
    expect(item.error).toBe(NO_TRANSCRIPTION_PROVIDER);
    expect(item.text?.text ?? "").toBe("");
  });

  it("stores the transcript with an offset, keeps the item unindexed, and does not repeat", async () => {
    const who = actors[0] as Actor;
    await select(who, "scripted-transcribe", true);
    const id = await makeItem(who, 5);
    await prisma.dataRoomItem.update({ where: { id }, data: { error: NO_TRANSCRIPTION_PROVIDER } });
    await runOmiTranscribe(
      {
        ...deps(),
        jobs: {
          enqueue: async (j: BackgroundJob) => void queued.push(j),
        } as unknown as JobPublisher,
      },
      payload(who, id),
    );
    expect(queued.map((j) => [j.name, (j.payload as { itemId: string }).itemId])).toEqual([
      ["omi.sort", id],
    ]);
    const item = await row(id);
    expect(item.text?.text).toBe(`[00:00] ${SCRIPTED_TRANSCRIPT}`);
    expect(item.error).toBeNull();
    expect(item.status).toBe("ready");
    expect(item.notIndexed).toBe(true);
    expect(item.previewText).toContain(SCRIPTED_TRANSCRIPT);
    await runOmiTranscribe(deps(), payload(who, id));
    expect(await prisma.dataRoomItemText.count({ where: { itemId: id } })).toBe(1);
    expect((await row(id)).text?.text).toBe(`[00:00] ${SCRIPTED_TRANSCRIPT}`);
  });

  it("joins the text of a long recording in order", async () => {
    const who = actors[0] as Actor;
    await select(who, "scripted-transcribe", true);
    const id = await makeItem(who, 700);
    await runOmiTranscribe(deps(), payload(who, id));
    expect((await row(id)).text?.text).toBe(
      Array.from(
        { length: 12 },
        (_, i) => `[${String(i).padStart(2, "0")}:00] ${SCRIPTED_TRANSCRIPT}`,
      ).join("\n\n"),
    );
  });

  it("ends with transcription_failed after three provider errors, and a later run recovers", async () => {
    const who = actors[0] as Actor;
    await select(who, "scripted-transcribe", true);
    await prisma.dataRoomItem.deleteMany({ where: { spaceId: who.spaceId } });
    const id = await makeItem(who, 5);
    const failing = {
      ...deps(),
      createProvider: () =>
        ({
          transcribe: async () => {
            throw new Error("boom");
          },
        }) as never,
    };
    await expect(runOmiTranscribe(failing, payload(who, id))).rejects.toThrow();
    await expect(runOmiTranscribe(failing, payload(who, id))).rejects.toThrow();
    expect((await row(id)).error).toBeNull();
    await runOmiTranscribe(failing, payload(who, id));
    expect(await row(id)).toMatchObject({ error: "transcription_failed", failures: 3 });
    await requeueOmiTranscriptions(
      {
        prisma,
        jobs: {
          enqueue: async (j: BackgroundJob) => void queued.push(j),
        } as unknown as JobPublisher,
      },
      who,
    );
    expect(queued).toHaveLength(1);
    expect(await row(id)).toMatchObject({ error: null, failures: 0 });
    await runOmiTranscribe(deps(), payload(who, id));
    expect(await row(id)).toMatchObject({ error: null, failures: 0 });
    expect((await row(id)).text?.text).toBe(`[00:00] ${SCRIPTED_TRANSCRIPT}`);
  });

  it("queues again only the caller's recordings that waited for a provider", async () => {
    const [x, y] = [actors[0] as Actor, actors[1] as Actor];
    await prisma.dataRoomItem.deleteMany({ where: { spaceId: { in: [x.spaceId, y.spaceId] } } });
    const waiting = await makeItem(x, 5);
    const other = await makeItem(y, 5);
    await prisma.dataRoomItem.updateMany({
      where: { id: { in: [waiting, other] } },
      data: { error: NO_TRANSCRIPTION_PROVIDER },
    });
    await requeueOmiTranscriptions(
      {
        prisma,
        jobs: {
          enqueue: async (j: BackgroundJob) => void queued.push(j),
        } as unknown as JobPublisher,
      },
      x,
    );
    expect(queued.map((j) => [j.name, (j.payload as { itemId: string }).itemId])).toEqual([
      ["omi.transcribe", waiting],
    ]);
  });

  it("lists only the caller's stretches from recordings inside the window", async () => {
    const [x, y] = [actors[0] as Actor, actors[1] as Actor];
    const now = new Date("2026-11-12T12:00:00Z");
    const connection = await prisma.connection.create({
      data: {
        spaceId: x.spaceId,
        userId: x.userId,
        connectorId: "omi",
        provider: "omi",
        displayName: "Omi",
        status: "connected",
      },
    });
    const stretch = async (who: Actor, daysAgo: number) => {
      const itemId = await makeItem(who, 5);
      await prisma.dataRoomItem.update({
        where: { id: itemId },
        data: { sourceUpdatedAt: new Date(now.getTime() - daysAgo * 86_400_000) },
      });
      await prisma.omiSegment.create({
        data: {
          spaceId: who.spaceId,
          userId: who.userId,
          connectionId: connection.id,
          audioItemId: itemId,
          start: 0,
          end: 60,
          kind: "note",
          title: `${daysAgo} days ago`,
          sortedBy: "agent",
        },
      });
    };
    await stretch(x, 1);
    await stretch(x, 7.5);
    await stretch(x, 9);
    await stretch(y, 1);
    const titles = (await listRecentOmiSegments(prisma, x, 8, now)).map((s) => s.title);
    expect(titles).toEqual(["1 days ago", "7.5 days ago"]);
    expect(await listRecentOmiSegments(prisma, x, 2, now)).toHaveLength(1);
  });
});
