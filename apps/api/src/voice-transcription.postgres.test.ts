import { randomUUID } from "node:crypto";
import { createRouterClient } from "@orpc/server";
import { SCRIPTED_TRANSCRIPT } from "@rakazo/adapters";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";
import { transcribeVoice } from "./voice.js";

const databaseUrl = process.env.DATABASE_URL;
const describePostgres =
  process.env.VERIFY_DATABASE && databaseUrl ? describe.sequential : describe.skip;

const secrets = {
  put: async (plaintext: string) => ({ id: randomUUID(), ciphertext: `enc:${plaintext}` }),
  load: async (ref: string) => ref.slice(4),
};

describePostgres("transcription selection (PostgreSQL)", () => {
  const previousRuntime = process.env.AGENT_RUNTIME;
  const suffix = `${process.pid}-${Date.now()}`;
  const id = (name: string) => `tsel-${name}-${suffix}`;
  const orgId = id("org");
  const spaceId = id("space");
  const userA = id("user-a");
  const userB = id("user-b");
  const actor = (userId: string): Actor => ({
    userId,
    spaceId,
    email: `${userId}@rakazo.test`,
    isDeploymentOwner: false,
  });

  let prisma: PrismaClient;
  let close: () => Promise<void>;
  const deps = () => ({ prisma, secrets }) as never;
  const client = (who: Actor) =>
    createRouterClient(createRouter({ prisma, secrets } as unknown as RouterDeps), {
      context: { actor: who } as never,
    });
  const audio = { audio: new Uint8Array([1, 2]), mimeType: "audio/webm" };
  const secretCount = (userId: string) => prisma.secret.count({ where: { userId } });

  beforeAll(async () => {
    process.env.AGENT_RUNTIME = "scripted";
    const db = createDb(databaseUrl as string);
    prisma = db.prisma;
    close = async () => {
      await db.prisma.$disconnect();
      await db.pool.end();
    };
    for (const userId of [userA, userB]) {
      await prisma.user.create({
        data: { id: userId, name: userId, email: `${userId}@rakazo.test`, emailVerified: false },
      });
    }
    await prisma.organization.create({
      data: { id: orgId, name: orgId, slug: orgId, createdAt: new Date() },
    });
    await prisma.space.create({
      data: { id: spaceId, organizationId: orgId, name: "General", isDefault: true },
    });
    for (const userId of [userA, userB]) {
      await prisma.member.create({
        data: {
          id: id(`member-${userId}`),
          organizationId: orgId,
          userId,
          role: "member",
          createdAt: new Date(),
        },
      });
    }
  });

  afterAll(async () => {
    if (previousRuntime === undefined) delete process.env.AGENT_RUNTIME;
    else process.env.AGENT_RUNTIME = previousRuntime;
    if (!prisma) return;
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.user.deleteMany({ where: { id: { in: [userA, userB] } } });
    await close();
  });

  it("selecting a transcription-only provider does not change the speech provider", async () => {
    const a = client(actor(userA));
    const connected = await a.voice.connect({
      provider: "scripted",
      apiKey: "speech-key-1",
      voiceId: "voice-1",
    });
    expect(connected.isDefault).toBe(true);

    const set = await a.voice.setTranscription({
      provider: "scripted-transcribe",
      apiKey: "dictation-key-1",
    });
    expect(set).toEqual({ provider: "scripted-transcribe" });
    expect(JSON.stringify(set)).not.toContain("dictation-key-1");

    const status = await a.voice.status();
    expect(status).toMatchObject({
      provider: "scripted",
      voiceId: "voice-1",
      ready: true,
      transcriptionProvider: "scripted-transcribe",
      transcriptionReady: false,
    });
    expect(JSON.stringify(status)).not.toContain("dictation-key-1");
    expect((await a.voice.credentials()).map((c) => [c.provider, c.isDefault, c.voiceId])).toEqual([
      ["scripted", true, "voice-1"],
    ]);

    // Dictation uses the selection; a bad speech key would fail the voice provider path.
    const row = await prisma.transcriptionSelection.findUniqueOrThrow({ where: { userId: userA } });
    expect(row.provider).toBe("scripted-transcribe");
    await expect(transcribeVoice(deps(), actor(userA), audio)).resolves.toEqual({
      text: SCRIPTED_TRANSCRIPT,
    });

    // Connecting another voice provider, or picking a voice, leaves the selection alone.
    await a.voice.setVoice({ voiceId: "voice-2" });
    expect((await a.voice.status()).transcriptionProvider).toBe("scripted-transcribe");

    await a.voice.clearTranscription();
    const cleared = await a.voice.status();
    expect(cleared).toMatchObject({ provider: "scripted", transcriptionProvider: null });
    expect(await prisma.transcriptionSelection.count({ where: { userId: userA } })).toBe(0);
    // Transcription is back on the voice provider and its key.
    await expect(transcribeVoice(deps(), actor(userA), audio)).resolves.toEqual({
      text: SCRIPTED_TRANSCRIPT,
    });
    await a.voice.disconnect({ provider: "scripted" });
  });

  it("uses the selection's own key and replaces and deletes the previous secret", async () => {
    const a = client(actor(userA));
    const base = await secretCount(userA);
    await a.voice.setTranscription({ provider: "scripted-transcribe", apiKey: "fail-first-key" });
    const first = await prisma.transcriptionSelection.findUniqueOrThrow({
      where: { userId: userA },
    });
    expect(await secretCount(userA)).toBe(base + 1);
    // The scripted provider throws for keys starting with "fail", proving the selection key is used.
    await expect(transcribeVoice(deps(), actor(userA), audio)).rejects.toThrow(
      "Scripted transcription failed.",
    );

    await a.voice.setTranscription({ provider: "scripted-transcribe", apiKey: "good-second-key" });
    const second = await prisma.transcriptionSelection.findUniqueOrThrow({
      where: { userId: userA },
    });
    expect(second.id).toBe(first.id);
    expect(second.secretId).not.toBe(first.secretId);
    expect(await prisma.secret.count({ where: { id: first.secretId } })).toBe(0);
    expect(await secretCount(userA)).toBe(base + 1);
    await expect(transcribeVoice(deps(), actor(userA), audio)).resolves.toEqual({
      text: SCRIPTED_TRANSCRIPT,
    });

    await a.voice.clearTranscription();
    expect(await prisma.secret.count({ where: { id: second.secretId } })).toBe(0);
    expect(await secretCount(userA)).toBe(base);
    await expect(a.voice.clearTranscription()).resolves.toEqual({ ok: true });
  });

  it("rejects a bad key and an unknown provider without storing anything", async () => {
    const a = client(actor(userA));
    const base = await secretCount(userA);
    await expect(
      a.voice.setTranscription({ provider: "scripted-transcribe", apiKey: "   a    " }),
    ).rejects.toThrow("That key is too short.");
    await expect(
      a.voice.setTranscription({ provider: "cartesia", apiKey: "long-enough-key" }),
    ).rejects.toThrow("Unknown transcription provider.");
    expect(await prisma.transcriptionSelection.count({ where: { userId: userA } })).toBe(0);
    expect(await secretCount(userA)).toBe(base);
  });

  it("scopes the selection to its user", async () => {
    await client(actor(userA)).voice.setTranscription({
      provider: "scripted-transcribe",
      apiKey: "user-a-key-1",
    });
    const b = client(actor(userB));
    expect((await b.voice.status()).transcriptionProvider).toBeNull();
    // User B has no voice credential and no selection, so nothing is used.
    await expect(transcribeVoice(deps(), actor(userB), audio)).rejects.toThrow();
    await b.voice.clearTranscription();
    expect(await prisma.transcriptionSelection.count({ where: { userId: userA } })).toBe(1);
    await client(actor(userA)).voice.clearTranscription();
  });
});
