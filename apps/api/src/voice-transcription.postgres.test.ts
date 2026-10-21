import { randomUUID } from "node:crypto";
import { createRouterClient } from "@orpc/server";
import {
  aiRecipient,
  SCRIPTED_TRANSCRIPT,
  SCRIPTED_TRANSCRIPTION_TEXT,
  ScriptedTranscriptionProvider,
  withSecretPersistence,
} from "@rakazo/adapters";
import type { Actor } from "@rakazo/contracts";
import { AI_DISCLOSURE_VERSION } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { createDb } from "@rakazo/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { aiConsentStatus } from "./ai-consent.js";
import type { RouterDeps } from "./router.js";
import { createRouter } from "./router.js";
import { clearTranscription, setTranscription, transcribeVoice } from "./voice.js";

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

    // Dictation uses the selection: its text differs from the voice provider's.
    const row = await prisma.transcriptionSelection.findUniqueOrThrow({ where: { userId: userA } });
    expect(row.provider).toBe("scripted-transcribe");
    await expect(transcribeVoice(deps(), actor(userA), audio)).resolves.toEqual({
      text: SCRIPTED_TRANSCRIPTION_TEXT,
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
    const sentKeys: string[] = [];
    const original = ScriptedTranscriptionProvider.prototype.transcribe;
    const spy = vi
      .spyOn(ScriptedTranscriptionProvider.prototype, "transcribe")
      .mockImplementation(function (this: ScriptedTranscriptionProvider, request, context) {
        sentKeys.push(request.apiKey);
        return original.call(this, request, context);
      });
    try {
      await a.voice.setTranscription({ provider: "scripted-transcribe", apiKey: "first-key-123" });
      const first = await prisma.transcriptionSelection.findUniqueOrThrow({
        where: { userId: userA },
      });
      expect(await secretCount(userA)).toBe(base + 1);
      await transcribeVoice(deps(), actor(userA), audio);

      await a.voice.setTranscription({ provider: "scripted-transcribe", apiKey: "second-key-123" });
      const second = await prisma.transcriptionSelection.findUniqueOrThrow({
        where: { userId: userA },
      });
      expect(second.id).toBe(first.id);
      expect(second.secretId).not.toBe(first.secretId);
      expect(await prisma.secret.count({ where: { id: first.secretId } })).toBe(0);
      expect(await secretCount(userA)).toBe(base + 1);
      await expect(transcribeVoice(deps(), actor(userA), audio)).resolves.toEqual({
        text: SCRIPTED_TRANSCRIPTION_TEXT,
      });
      expect(sentKeys).toEqual(["first-key-123", "second-key-123"]);

      await a.voice.clearTranscription();
      expect(await prisma.secret.count({ where: { id: second.secretId } })).toBe(0);
      expect(await secretCount(userA)).toBe(base);
      await expect(a.voice.clearTranscription()).resolves.toEqual({ ok: true });
    } finally {
      spy.mockRestore();
    }
  });

  it("rejects a bad key and an unknown provider without storing anything", async () => {
    const a = client(actor(userA));
    const base = await secretCount(userA);
    await expect(
      a.voice.setTranscription({ provider: "scripted-transcribe", apiKey: "   a    " }),
    ).rejects.toThrow("That key is too short.");
    await expect(
      a.voice.setTranscription({ provider: "scripted-transcribe", apiKey: "fail-bad-key-1" }),
    ).rejects.toThrow("That key was rejected.");
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

  it("retries a serialization conflict with a fresh remote secret and leaves no orphan", async () => {
    const remote = new Map<string, string>();
    let puts = 0;
    const store = {
      put: async (plaintext: string) => {
        puts += 1;
        const ref = `remote-ref-${puts}`;
        remote.set(ref, plaintext);
        return { id: `remote-id-${puts}`, ciphertext: ref };
      },
      load: async (ref: string) => remote.get(ref) ?? "",
      delete: async (ref: string) => {
        remote.delete(ref);
      },
      describe: () => ({}),
      redact: (value: string) => value,
      onChange: () => () => undefined,
    };
    const wrapped = withSecretPersistence(prisma, store as never);
    let conflicted = false;
    const flaky = new Proxy(wrapped, {
      get(target, property, receiver) {
        if (property !== "$transaction") return Reflect.get(target, property, receiver);
        return (fn: (tx: never) => Promise<unknown>, options: never) =>
          target.$transaction(async (tx) => {
            const result = await fn(tx as never);
            if (!conflicted) {
              conflicted = true;
              throw Object.assign(new Error("conflict"), { code: "P2034" });
            }
            return result;
          }, options);
      },
    });
    const flakyDeps = { prisma: flaky, secrets: store } as never;

    await setTranscription(flakyDeps, actor(userA), {
      provider: "scripted-transcribe",
      apiKey: "retried-key-1",
    });
    expect(conflicted).toBe(true);
    expect(puts).toBe(2);
    const row = await prisma.transcriptionSelection.findUniqueOrThrow({ where: { userId: userA } });
    const secret = await prisma.secret.findUniqueOrThrow({ where: { id: row.secretId } });
    expect(remote.get(secret.ciphertext)).toBe("retried-key-1");
    expect([...remote.keys()]).toEqual([secret.ciphertext]);

    await setTranscription(flakyDeps, actor(userA), {
      provider: "scripted-transcribe",
      apiKey: "replaced-key-1",
    });
    const replaced = await prisma.transcriptionSelection.findUniqueOrThrow({
      where: { userId: userA },
    });
    const replacedSecret = await prisma.secret.findUniqueOrThrow({
      where: { id: replaced.secretId },
    });
    expect([...remote.keys()]).toEqual([replacedSecret.ciphertext]);

    await clearTranscription(flakyDeps, actor(userA));
    expect(remote.size).toBe(0);
  });

  describe("consent for the selected transcription provider", () => {
    const recipientKey = () =>
      aiRecipient({ provider: "scripted-transcribe", use: "voice" })?.key as string;
    const consentCount = () =>
      prisma.aiDataConsent.count({ where: { userId: userA, recipientKey: recipientKey() } });
    const select = () =>
      client(actor(userA)).voice.setTranscription({
        provider: "scripted-transcribe",
        apiKey: "dictation-key-1",
      });
    const revoke = () =>
      prisma.aiDataConsent.deleteMany({ where: { userId: userA, recipientKey: recipientKey() } });
    beforeEach(async () => {
      await revoke();
    });
    const calls = () => vi.spyOn(ScriptedTranscriptionProvider.prototype, "transcribe");
    const cleanup = async () => {
      await client(actor(userA)).voice.clearTranscription();
      await revoke();
      await prisma.spaceVoicePreference.deleteMany({ where: { userId: userA } });
      await prisma.userVoiceCredential.deleteMany({ where: { userId: userA } });
      vi.restoreAllMocks();
    };

    it("lists the selected provider as a voice recipient", async () => {
      const status = () =>
        aiConsentStatus(
          { prisma, secrets, env: { agentRuntime: "scripted" } } as never,
          actor(userA),
        );
      expect((await status()).recipients).toEqual([]);
      await select();
      const listed = (await status()).recipients.find((r) => r.key === recipientKey());
      expect(listed).toMatchObject({ use: "voice", allowed: true });
      await cleanup();
    });

    it("records consent only after the key verifies", async () => {
      const a = client(actor(userA));
      await expect(
        a.voice.setTranscription({ provider: "scripted-transcribe", apiKey: "fail-bad-key-1" }),
      ).rejects.toThrow("That key was rejected.");
      expect(await consentCount()).toBe(0);
      await select();
      expect(await consentCount()).toBe(1);
      await cleanup();
    });

    it("uses the selection when its recipient has consent", async () => {
      await select();
      await expect(transcribeVoice(deps(), actor(userA), audio)).resolves.toEqual({
        text: SCRIPTED_TRANSCRIPTION_TEXT,
      });
      await cleanup();
    });

    it("no audio reaches the transcription provider without its consent", async () => {
      const a = client(actor(userA));
      await a.voice.connect({ provider: "scripted", apiKey: "speech-key-1", voiceId: "voice-1" });
      await select();
      await revoke();
      const spy = calls();
      // The voice provider takes over; the selection's provider sees no request.
      await expect(transcribeVoice(deps(), actor(userA), audio)).resolves.toEqual({
        text: SCRIPTED_TRANSCRIPT,
      });
      expect(spy).not.toHaveBeenCalled();
      await cleanup();
    });

    it("returns the consent error when neither provider has consent", async () => {
      await select();
      await revoke();
      const spy = calls();
      await expect(transcribeVoice(deps(), actor(userA), audio)).rejects.toThrow(
        "AI data sharing needs your permission.",
      );
      // A voice provider that shares data outside the app and has no consent is no fallback.
      const secret = await prisma.secret.create({
        data: { id: id("openai-secret"), userId: userA, kind: "voice", ciphertext: "enc:k" },
      });
      const cred = await prisma.userVoiceCredential.create({
        data: { userId: userA, provider: "openai", secretId: secret.id },
      });
      await prisma.spaceVoicePreference.create({
        data: { spaceId, userId: userA, credentialId: cred.id, voiceId: "alloy", isDefault: true },
      });
      await expect(transcribeVoice(deps(), actor(userA), audio)).rejects.toThrow(
        "AI data sharing needs your permission.",
      );
      expect(spy).not.toHaveBeenCalled();
      await prisma.secret.deleteMany({ where: { id: secret.id } });
      await cleanup();
    });

    const openaiKey = () => aiRecipient({ provider: "openai", use: "voice" })?.key as string;
    const addOpenai = async (consented: boolean) => {
      const secret = await prisma.secret.create({
        data: { id: id(`oa-${Math.random()}`), userId: userA, kind: "voice", ciphertext: "enc:k" },
      });
      const cred = await prisma.userVoiceCredential.create({
        data: { userId: userA, provider: "openai", secretId: secret.id },
      });
      await prisma.spaceVoicePreference.create({
        data: { spaceId, userId: userA, credentialId: cred.id, voiceId: "alloy", isDefault: true },
      });
      if (consented) {
        await prisma.aiDataConsent.create({
          data: {
            userId: userA,
            spaceId,
            recipientKey: openaiKey(),
            version: AI_DISCLOSURE_VERSION,
          },
        });
      }
      return secret.id;
    };
    const dropOpenai = async (secretId: string) => {
      await prisma.aiDataConsent.deleteMany({
        where: { userId: userA, recipientKey: openaiKey() },
      });
      await prisma.secret.deleteMany({ where: { id: secretId } });
    };

    it("falls back to a consented voice provider that shares data, sending nothing to the selection", async () => {
      await select();
      await revoke();
      const secretId = await addOpenai(true);
      const fetchMock = vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ text: "from openai" })));
      vi.stubGlobal("fetch", fetchMock);
      const spy = calls();
      try {
        await expect(transcribeVoice(deps(), actor(userA), audio)).resolves.toEqual({
          text: "from openai",
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(spy).not.toHaveBeenCalled();
      } finally {
        vi.unstubAllGlobals();
        await dropOpenai(secretId);
        await cleanup();
      }
    });

    it("fails closed when the selection's key is unavailable", async () => {
      await select();
      const row = await prisma.transcriptionSelection.findUniqueOrThrow({
        where: { userId: userA },
      });
      await prisma.secret.deleteMany({ where: { id: row.secretId } });
      const secretId = await addOpenai(false);
      const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: "x" })));
      vi.stubGlobal("fetch", fetchMock);
      try {
        await expect(transcribeVoice(deps(), actor(userA), audio)).rejects.toThrow(
          "AI data sharing needs your permission.",
        );
        expect(fetchMock).not.toHaveBeenCalled();
      } finally {
        vi.unstubAllGlobals();
        await dropOpenai(secretId);
        await cleanup();
      }
    });

    it("does not list the transcriber in a targeted speech check", async () => {
      await select();
      await revoke();
      const secretId = await addOpenai(true);
      try {
        const status = await aiConsentStatus(
          { prisma, secrets, env: { agentRuntime: "scripted" } } as never,
          actor(userA),
          { uses: ["voice"] },
        );
        expect(status.recipients.map((r) => r.key)).toEqual([openaiKey()]);
      } finally {
        await dropOpenai(secretId);
        await cleanup();
      }
    });

    it("strips context for a provider that ignores it or has no consent", async () => {
      const context = { vocabulary: ["Rakazo"], beforeText: "Hello" };
      const seen: unknown[] = [];
      const spy = calls().mockImplementation(async (request) => {
        seen.push(request.context);
        return { text: "ok" };
      });
      await select();
      await transcribeVoice(deps(), actor(userA), { ...audio, context });
      expect(seen).toEqual([context]);

      seen.length = 0;
      const describeSpy = vi
        .spyOn(ScriptedTranscriptionProvider.prototype, "describe")
        .mockReturnValue({ capabilities: { usesContext: false } } as never);
      await transcribeVoice(deps(), actor(userA), { ...audio, context });
      expect(seen).toEqual([undefined]);
      describeSpy.mockRestore();

      // Without consent the selection is not used, so the context goes nowhere.
      seen.length = 0;
      await revoke();
      await expect(transcribeVoice(deps(), actor(userA), { ...audio, context })).rejects.toThrow();
      expect(seen).toEqual([]);
      spy.mockRestore();
      await cleanup();
    });
  });
});
