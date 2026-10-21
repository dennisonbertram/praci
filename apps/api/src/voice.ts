import { ORPCError } from "@orpc/server";
import type { AdapterContext, SecretStore, TranscriptionContext } from "@rakazo/adapter-kit";
import {
  aiRecipient,
  createTranscriptionProvider,
  createVoiceProvider,
  isFishSpeechModelId,
  isTranscriptionProviderId,
  isVoiceProviderId,
  listVoiceCatalog,
  MAX_SPEAK_CHARS,
  MAX_TRANSCRIBE_BYTES,
  NoVoiceConfigured,
  persistPreparedSecret,
  voiceCatalogEntry,
} from "@rakazo/adapters";
import type { Actor, VoiceCredential, VoiceStatus } from "@rakazo/contracts";
import { AI_DISCLOSURE_VERSION } from "@rakazo/contracts";
import { toUtterances } from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import {
  deleteUnreferencedCredentialSecret,
  findDefaultVoiceCredential,
  findVoiceCredential,
  IsolationError,
  newestVoiceCredentialOrder,
  Prisma,
  selectSpaceVoicePreference,
} from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import type { Context, Hono } from "hono";
import { hasVoiceConsent } from "./ai-consent.js";
import { readBoundedBody } from "./http-body.js";
import { withSerializableRetry } from "./serializable-retry.js";

export interface VoiceDeps {
  prisma: PrismaClient;
  secrets: SecretStore;
}

export { listVoiceCatalog };

const SPEAK_TIMEOUT_MS = 60_000;
export const MAX_SPEAK_REQUEST_BYTES = 16 * 1024;
export const MAX_TRANSCRIBE_REQUEST_BYTES = 4 * Math.ceil(MAX_TRANSCRIBE_BYTES / 3) + 1024;

export function voiceContext(actor: Actor, signal?: AbortSignal): AdapterContext {
  return {
    operationId: "voice",
    traceId: "voice",
    spaceId: actor.spaceId,
    userId: actor.userId,
    signal: signal ?? new AbortController().signal,
  };
}

export function catalogEntry(provider: string) {
  return voiceCatalogEntry(provider);
}

export function toVoiceStatus(
  cred: { provider: string; voiceId: string } | null,
  transcriptionProvider: string | null = null,
): VoiceStatus {
  const entry = cred ? catalogEntry(cred.provider) : undefined;
  return {
    configured: Boolean(cred),
    ready: Boolean(cred?.voiceId),
    transcribe: Boolean(entry?.transcribe && cred),
    provider: cred?.provider ?? null,
    voiceId: cred?.voiceId ?? "",
    transcriptionProvider,
    // ponytail: S3b turns this on when a selected provider can serve dictation.
    transcriptionReady: false,
  };
}

export async function findTranscriptionSelection(deps: VoiceDeps, actor: Actor) {
  return deps.prisma.transcriptionSelection.findUnique({ where: { userId: actor.userId } });
}

/** The selected provider, with its key or null when the key is unavailable; null when nothing is selected. */
async function loadTranscriptionSelection(deps: VoiceDeps, actor: Actor) {
  const selection = await findTranscriptionSelection(deps, actor);
  if (!selection) return null;
  const secret = await deps.prisma.secret.findFirst({
    where: { id: selection.secretId, userId: actor.userId, spaceId: null },
  });
  return {
    provider: selection.provider,
    apiKey: secret ? await deps.secrets.load(secret.ciphertext, secret.id) : null,
  };
}

export async function setTranscription(
  deps: VoiceDeps,
  actor: Actor,
  input: { provider: string; apiKey: string; signal?: AbortSignal },
): Promise<{ provider: string }> {
  const provider = isTranscriptionProviderId(input.provider)
    ? createTranscriptionProvider(input.provider)
    : null;
  if (!provider) {
    throw new ORPCError("BAD_REQUEST", { message: "Unknown transcription provider." });
  }
  const verified = await provider.verify(input.apiKey, voiceContext(actor, input.signal));
  if (!verified.ok) {
    throw new ORPCError("BAD_REQUEST", { message: verified.message ?? "That key was rejected." });
  }
  // Each attempt prepares its own secret: a rolled-back attempt cleans up the reference it wrote.
  await withSerializableRetry(async () => {
    const stored = await deps.secrets.put(input.apiKey, voiceContext(actor, input.signal));
    await persistPreparedSecret(deps.prisma, deps.secrets, stored, () =>
      deps.prisma.$transaction(
        async (tx) => {
          const existing = await tx.transcriptionSelection.findUnique({
            where: { userId: actor.userId },
          });
          await tx.secret.create({
            data: {
              id: stored.id,
              userId: actor.userId,
              spaceId: null,
              kind: "voice",
              ciphertext: stored.ciphertext,
            },
          });
          await tx.transcriptionSelection.upsert({
            where: { userId: actor.userId },
            create: { userId: actor.userId, provider: input.provider, secretId: stored.id },
            update: { provider: input.provider, secretId: stored.id },
          });
          // Connecting is the consent act; this runs only after the key verified.
          const recipient = aiRecipient({ provider: input.provider, use: "voice" });
          if (recipient) {
            await tx.aiDataConsent.upsert({
              where: {
                userId_spaceId_recipientKey: {
                  userId: actor.userId,
                  spaceId: actor.spaceId,
                  recipientKey: recipient.key,
                },
              },
              create: {
                userId: actor.userId,
                spaceId: actor.spaceId,
                recipientKey: recipient.key,
                version: AI_DISCLOSURE_VERSION,
              },
              update: { version: AI_DISCLOSURE_VERSION, grantedAt: new Date() },
            });
          }
          if (existing) await tx.secret.deleteMany({ where: { id: existing.secretId } });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      ),
    );
  });
  return { provider: input.provider };
}

export async function clearTranscription(deps: VoiceDeps, actor: Actor): Promise<{ ok: true }> {
  await withSerializableRetry(() =>
    deps.prisma.$transaction(
      async (tx) => {
        const existing = await tx.transcriptionSelection.findUnique({
          where: { userId: actor.userId },
        });
        if (!existing) return;
        await tx.transcriptionSelection.delete({ where: { id: existing.id } });
        await tx.secret.deleteMany({ where: { id: existing.secretId, userId: actor.userId } });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
  return { ok: true as const };
}

export function toVoiceCredential(row: {
  id: string;
  provider: string;
  isDefault: boolean;
  voiceId: string;
  speechModel?: string | null;
}): VoiceCredential {
  return {
    id: row.id,
    provider: row.provider,
    hasKey: true,
    isDefault: row.isDefault,
    voiceId: row.voiceId,
    speechModel: row.speechModel ?? "",
    transcribe: Boolean(catalogEntry(row.provider)?.transcribe),
  };
}

const FISH_AUDIO_PROVIDER = "fish-audio";

/** Empty clears the Fish override. Anything else must be a header-safe model id. */
export function fishSpeechModelValue(speechModel: string): string | null {
  const trimmed = speechModel.trim();
  if (!trimmed) return null;
  if (!isFishSpeechModelId(trimmed)) {
    throw new ORPCError("BAD_REQUEST", { message: "That speech model id is not valid." });
  }
  return trimmed;
}

export async function loadDefaultVoiceCredential(deps: VoiceDeps, actor: Actor) {
  return loadVoiceCredential(deps, actor);
}

export async function loadVoiceCredential(deps: VoiceDeps, actor: Actor, provider?: string) {
  const cred = provider
    ? await findVoiceCredential(deps.prisma, actor, provider)
    : await findDefaultVoiceCredential(deps.prisma, actor);
  if (!cred) return null;
  const secret = await deps.prisma.secret.findFirst({
    where: { id: cred.secretId, userId: actor.userId, spaceId: null },
  });
  if (!secret) return null;
  return { cred, apiKey: await deps.secrets.load(secret.ciphertext, secret.id) };
}

export async function resolveVoiceTarget(
  deps: VoiceDeps,
  actor: Actor,
  input: { botId?: string; voiceId?: string },
) {
  let botVoiceId: string | null = null;
  if (input.botId) {
    const bot = await deps.prisma.bot.findFirst({
      where: { id: input.botId, spaceId: actor.spaceId, userId: actor.userId },
      select: { voiceId: true },
    });
    if (!bot) throw new IsolationError();
    botVoiceId = bot.voiceId;
  }
  const loaded = await loadDefaultVoiceCredential(deps, actor);
  if (!loaded) throw new NoVoiceConfigured("key");
  const voiceId = input.voiceId || botVoiceId || loaded.cred.voiceId;
  if (!voiceId) throw new NoVoiceConfigured("voice");
  return { ...loaded, voiceId };
}

export async function persistVoiceCredential(
  deps: VoiceDeps,
  actor: Actor,
  input: {
    provider: string;
    plaintext: string;
    voiceId?: string;
    speechModel?: string;
    signal?: AbortSignal;
  },
): Promise<VoiceCredential> {
  if (!isVoiceProviderId(input.provider)) {
    throw new ORPCError("BAD_REQUEST", { message: "Unknown voice provider." });
  }
  const requestedSpeechModel =
    input.provider === FISH_AUDIO_PROVIDER && input.speechModel !== undefined
      ? fishSpeechModelValue(input.speechModel)
      : undefined;
  const provider = createVoiceProvider(input.provider);
  const verified = await provider.verify(input.plaintext, voiceContext(actor, input.signal));
  if (!verified.ok) {
    throw new ORPCError("BAD_REQUEST", { message: verified.message ?? "That key was rejected." });
  }
  let voiceId = input.voiceId?.trim() ?? "";
  if (!voiceId) {
    const voices = await provider.listVoices(input.plaintext, voiceContext(actor, input.signal));
    voiceId = voices[0]?.id ?? "";
  }
  const stored = await deps.secrets.put(input.plaintext, voiceContext(actor, input.signal));
  const cred = await withSerializableRetry(() =>
    deps.prisma.$transaction(
      async (tx) => {
        const existing = await tx.userVoiceCredential.findFirst({
          where: { userId: actor.userId, provider: input.provider },
          orderBy: newestVoiceCredentialOrder,
        });
        const secret = await tx.secret.create({
          data: {
            id: stored.id,
            userId: actor.userId,
            spaceId: null,
            kind: "voice",
            ciphertext: stored.ciphertext,
          },
        });
        const credential = !existing
          ? await tx.userVoiceCredential.create({
              data: {
                userId: actor.userId,
                provider: input.provider,
                secretId: secret.id,
              },
            })
          : await tx.userVoiceCredential.update({
              where: { id: existing.id },
              data: { secretId: secret.id },
            });
        const previousPreference = existing
          ? await tx.spaceVoicePreference.findUnique({
              where: {
                spaceId_userId_credentialId: {
                  spaceId: actor.spaceId,
                  userId: actor.userId,
                  credentialId: existing.id,
                },
              },
            })
          : null;
        const selectedVoiceId = voiceId || previousPreference?.voiceId || "";
        const speechModel =
          requestedSpeechModel !== undefined
            ? requestedSpeechModel
            : previousPreference?.speechModel;
        await selectSpaceVoicePreference(tx, actor, credential.id, selectedVoiceId, speechModel);
        if (existing) {
          await deleteUnreferencedCredentialSecret(tx, {
            credentialKind: "voice",
            credentialId: existing.id,
            secretId: existing.secretId,
          });
        }
        return {
          ...credential,
          isDefault: true,
          voiceId: selectedVoiceId,
          speechModel: speechModel ?? "",
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
  return toVoiceCredential(cred);
}

export async function disconnectVoiceCredential(
  deps: VoiceDeps,
  actor: Actor,
  input: { provider: string },
): Promise<{ ok: true }> {
  const provider = input.provider.trim();
  if (!provider) {
    throw new ORPCError("BAD_REQUEST", { message: "Unknown voice provider." });
  }
  await withSerializableRetry(() =>
    deps.prisma.$transaction(
      async (tx) => {
        const existing = await tx.userVoiceCredential.findMany({
          where: { userId: actor.userId, provider },
        });
        if (existing.length === 0) return;
        const ids = existing.map((row) => row.id);
        await tx.spaceVoicePreference.deleteMany({
          where: { userId: actor.userId, credentialId: { in: ids } },
        });
        await tx.userVoiceCredential.deleteMany({
          where: { userId: actor.userId, id: { in: ids } },
        });
        for (const row of existing) {
          await deleteUnreferencedCredentialSecret(tx, {
            credentialKind: "voice",
            credentialId: row.id,
            secretId: row.secretId,
          });
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
  return { ok: true as const };
}

export async function updateVoiceSpeechModel(
  deps: VoiceDeps,
  actor: Actor,
  input: { provider: string; speechModel: string },
): Promise<VoiceCredential> {
  if (input.provider !== FISH_AUDIO_PROVIDER) {
    throw new ORPCError("BAD_REQUEST", { message: "Speech model applies to Fish Audio." });
  }
  const speechModel = fishSpeechModelValue(input.speechModel);
  return withSerializableRetry(() =>
    deps.prisma.$transaction(
      async (tx) => {
        const found = await tx.userVoiceCredential.findFirst({
          where: { userId: actor.userId, provider: input.provider },
          orderBy: newestVoiceCredentialOrder,
        });
        if (!found) {
          throw new ORPCError("BAD_REQUEST", { message: "Connect a voice provider first." });
        }
        const where = {
          spaceId_userId_credentialId: {
            spaceId: actor.spaceId,
            userId: actor.userId,
            credentialId: found.id,
          },
        };
        const preference = await tx.spaceVoicePreference.findUnique({ where });
        if (!preference) {
          // Remember the model without taking the default. Another provider may
          // already be selected, and this row still has no voice.
          if (speechModel === null) {
            return toVoiceCredential({ ...found, isDefault: false, voiceId: "", speechModel: "" });
          }
          const created = await tx.spaceVoicePreference.create({
            data: {
              spaceId: actor.spaceId,
              userId: actor.userId,
              credentialId: found.id,
              speechModel,
            },
          });
          return toVoiceCredential({
            ...found,
            isDefault: created.isDefault,
            voiceId: created.voiceId,
            speechModel: created.speechModel,
          });
        }
        const updated = await tx.spaceVoicePreference.update({
          where: { id: preference.id },
          data: { speechModel },
        });
        return toVoiceCredential({
          ...found,
          isDefault: preference.isDefault,
          voiceId: preference.voiceId,
          speechModel: updated.speechModel,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  );
}

export async function prepareVoice(
  deps: VoiceDeps,
  actor: Actor,
  input: { text: string; voiceId?: string; botId?: string },
) {
  try {
    await resolveVoiceTarget(deps, actor, input);
  } catch (error) {
    if (error instanceof NoVoiceConfigured) {
      return { ready: false, utterances: [] as string[] };
    }
    throw error;
  }
  return { ready: true, utterances: toUtterances(input.text) };
}

export async function synthesizeVoice(
  deps: VoiceDeps,
  actor: Actor,
  input: { text: string; voiceId?: string; botId?: string; signal?: AbortSignal },
) {
  const target = await resolveVoiceTarget(deps, actor, input);
  const text = input.text.trim();
  if (!text) throw new ORPCError("BAD_REQUEST", { message: "Nothing to speak." });
  if (text.length > MAX_SPEAK_CHARS) {
    throw new ORPCError("BAD_REQUEST", { message: "That utterance is too long to speak." });
  }
  const provider = createVoiceProvider(target.cred.provider);
  return provider.synthesize(
    {
      text,
      voiceId: target.voiceId,
      apiKey: target.apiKey,
      model: target.cred.speechModel || undefined,
      signal: input.signal,
    },
    voiceContext(actor, input.signal),
  );
}

export async function transcribeVoice(
  deps: VoiceDeps,
  actor: Actor,
  input: {
    audio: Uint8Array;
    mimeType: string;
    language?: string;
    context?: TranscriptionContext;
    signal?: AbortSignal;
  },
) {
  // The server picks the provider; clients only upload. A selected provider is used only with its
  // recipient's consent, otherwise the voice provider (also needing consent while a selection
  // exists). Without a selection, behaviour is unchanged: the voice provider, no consent check.
  // A selection row whose key is unavailable (for example mid-replacement) still follows the
  // selection rules, so audio never skips the consent check.
  const selected = await loadTranscriptionSelection(deps, actor);
  let target: { provider: string; apiKey: string } | null = null;
  // One consent decision for the chosen provider, used for both audio and context.
  let consented = false;
  if (selected?.apiKey && (await hasVoiceConsent(deps.prisma, actor, selected.provider))) {
    target = { provider: selected.provider, apiKey: selected.apiKey };
    consented = true;
  } else {
    const loaded = await loadDefaultVoiceCredential(deps, actor);
    if (loaded) target = { provider: loaded.cred.provider, apiKey: loaded.apiKey };
    if (target) consented = await hasVoiceConsent(deps.prisma, actor, target.provider);
    if (selected && !consented) {
      throw new ORPCError("CONFLICT", { message: "AI data sharing needs your permission." });
    }
  }
  if (!target) throw new NoVoiceConfigured("key");
  const { apiKey } = target;
  const provider = createTranscriptionProvider(target.provider);
  if (!provider) {
    throw new ORPCError("BAD_REQUEST", {
      message: "This voice provider does not transcribe audio. Use on-device dictation instead.",
    });
  }
  // Context goes only to a provider that uses it and whose recipient has consented.
  const context =
    input.context && consented && provider.describe().capabilities.usesContext
      ? input.context
      : undefined;
  if (input.audio.byteLength === 0 || input.audio.byteLength > MAX_TRANSCRIBE_BYTES) {
    throw new ORPCError("BAD_REQUEST", { message: "That recording is empty or too large." });
  }
  return provider.transcribe(
    {
      audio: input.audio,
      mimeType: input.mimeType || "audio/webm",
      language: input.language,
      context,
      apiKey,
      signal: input.signal,
    },
    voiceContext(actor, input.signal),
  );
}

export function mountVoiceHttpRoutes(
  app: Hono,
  deps: VoiceDeps,
  authenticate: (c: Context) => Promise<Actor | null>,
) {
  app.post("/api/voice/speak", async (c) => {
    const actor = await authenticate(c);
    if (!actor) return c.json({ error: "Unauthorized" }, 401);
    const raw = await readBoundedBody(c.req.raw, MAX_SPEAK_REQUEST_BYTES);
    if (raw === null) return c.json({ error: "Request body is too large." }, 413);
    const body = parseVoiceRequestBody(raw);
    try {
      const clip = await synthesizeVoice(deps, actor, {
        text: String((body as { text?: unknown }).text ?? ""),
        voiceId: optionalString((body as { voiceId?: unknown }).voiceId),
        botId: optionalString((body as { botId?: unknown }).botId),
        signal: AbortSignal.any(
          [c.req.raw.signal, AbortSignal.timeout(SPEAK_TIMEOUT_MS)].filter(
            Boolean,
          ) as AbortSignal[],
        ),
      });
      // Copy into a fresh ArrayBuffer-backed view: DOM-lib BodyInit rejects
      // Uint8Array<ArrayBufferLike> since TS 5.7.
      return new Response(new Uint8Array(clip.bytes), {
        headers: {
          "content-type": clip.mimeType,
          "cache-control": "no-store",
        },
      });
    } catch (error) {
      return voiceHttpError(c, error);
    }
  });

  app.post("/api/voice/transcribe", async (c) => {
    const actor = await authenticate(c);
    if (!actor) return c.json({ error: "Unauthorized" }, 401);
    const raw = await readBoundedBody(c.req.raw, MAX_TRANSCRIBE_REQUEST_BYTES);
    if (raw === null) return c.json({ error: "Request body is too large." }, 413);
    const body = parseVoiceRequestBody(raw);
    const audioBase64 = String((body as { audioBase64?: unknown }).audioBase64 ?? "");
    const language = optionalString((body as { language?: unknown }).language);
    try {
      const audio = decodeAudioBase64(audioBase64);
      const result = await transcribeVoice(deps, actor, {
        audio,
        mimeType: String((body as { mimeType?: unknown }).mimeType ?? "audio/webm"),
        language,
        signal: c.req.raw.signal,
      });
      return c.json({ text: result.text });
    } catch (error) {
      return voiceHttpError(c, error);
    }
  });
}

function parseVoiceRequestBody(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function decodeAudioBase64(value: string): Uint8Array {
  if (!value.trim()) throw new ORPCError("BAD_REQUEST", { message: "Recording is empty." });
  try {
    return new Uint8Array(Buffer.from(value, "base64"));
  } catch {
    throw new ORPCError("BAD_REQUEST", { message: "Recording is not valid audio." });
  }
}

function voiceHttpError(c: Context, error: unknown) {
  if (error instanceof IsolationError) {
    return c.json({ error: "Resource not found" }, 404);
  }
  if (error instanceof NoVoiceConfigured) {
    return c.json({ error: error.message }, 409);
  }
  if (error instanceof ORPCError) {
    const code = String(error.code ?? "BAD_REQUEST");
    const status =
      code === "UNAUTHORIZED" ? 401 : code === "NOT_FOUND" ? 404 : code === "CONFLICT" ? 409 : 400;
    return c.json({ error: error.message }, status);
  }
  const message = error instanceof Error ? error.message : "Voice request failed.";
  // Message only: request bodies, keys and audio never reach the log.
  getLogger().warn("voice request failed", { route: c.req.path, reason: message });
  return c.json({ error: message }, 502);
}
