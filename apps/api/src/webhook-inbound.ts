import { createHash } from "node:crypto";
import type { JobPublisher, SecretStore } from "@rakazo/adapter-kit";
import { runContinueJob, SecretStoreUnavailableError } from "@rakazo/adapter-kit";
import {
  inboundRoutineModelPin,
  secretRefMatches,
  splitRoutinesByConnectionPin,
  taughtSkillPromptForRoutine,
} from "@rakazo/adapters";
import { formatUntrustedDeliveryPayload, inboundRoutineBlock } from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";

export const WEBHOOK_MAX_BODY_BYTES = 64 * 1024;
export const WEBHOOK_SECRET_KIND = "webhook";

export type WebhookEvents = {
  sendUserMessage(input: {
    spaceId: string;
    threadId: string;
    botId: string;
    userId: string;
    blocks: Array<{ kind: "text"; text: string }>;
    prompt: string;
    trigger: "webhook";
    /** The one routine this turn belongs to; omitted when a delivery matched several. */
    routineId?: string;
    clientNonce?: string;
    allowParallelRun?: boolean;
    modelPin?: {
      modelProvider: string;
      modelId: string;
      modelCredentialId?: string | null;
      thinkingLevel: string | null;
    };
  }): Promise<{ messageId: string; runId: string | null; seq: number }>;
};

export type WebhookDeps = {
  prisma: PrismaClient;
  secrets: SecretStore;
  events: WebhookEvents;
  jobs: Pick<JobPublisher, "enqueue">;
};

export type WebhookTarget = {
  bot: {
    id: string;
    spaceId: string;
    userId: string;
    webhookSecretId: string;
  };
  threadId: string;
  expected: string;
};

export type InboundTarget = {
  bot: Pick<WebhookTarget["bot"], "id" | "spaceId" | "userId">;
  threadId: string;
};

export { formatUntrustedDeliveryPayload };

/** Keep inbound event labels to a short safe token so they cannot break prompt framing. */
export function inboundEventName(value: unknown): string {
  if (typeof value !== "string") return "webhook";
  const trimmed = value.trim();
  return /^[a-z0-9._-]{1,100}$/i.test(trimmed) ? trimmed : "webhook";
}

export function formatWebhookPrompt(payload: Record<string, unknown>): string {
  return formatUntrustedDeliveryPayload(
    `[Inbound Event: ${inboundEventName(payload.event)}]`,
    payload,
  );
}

export function parseWebhookPayload(
  raw: string,
  contentType: string | undefined,
): Record<string, unknown> {
  const trimmed = raw.trim();
  if (!trimmed) return {};
  const looksJson =
    contentType?.includes("application/json") || trimmed.startsWith("{") || trimmed.startsWith("[");
  if (looksJson) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return { data: parsed };
    } catch {
      return { text: trimmed };
    }
  }
  return { text: trimmed };
}

const WEBHOOK_SECRET_CACHE_MAX = 1_000;

type WebhookSecretCacheEntry = {
  secretId: string;
  ciphertext: string;
  plaintext: Promise<string | null>;
  expires: number;
};

/** Webhook secrets by bot id; the decrypt promise is shared so concurrent misses decrypt once. */
export type WebhookSecretCache = Map<string, WebhookSecretCacheEntry>;

const subscribedWebhookCaches = new WeakMap<SecretStore, WeakSet<WebhookSecretCache>>();
function subscribeWebhookCache(secrets: SecretStore, cache: WebhookSecretCache): void {
  let caches = subscribedWebhookCaches.get(secrets);
  if (!caches) {
    caches = new WeakSet();
    subscribedWebhookCaches.set(secrets, caches);
  }
  if (caches.has(cache)) return;
  caches.add(cache);
  secrets.onChange?.((ref) => {
    for (const [botId, entry] of cache)
      if (secretRefMatches(entry.ciphertext, ref)) cache.delete(botId);
  });
}

function isPermanentDecryptFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : "";
  return (
    message.includes("unable to authenticate") || message.includes("Encrypted secret is malformed")
  );
}

function touchWebhookSecret(
  cache: WebhookSecretCache,
  botId: string,
  entry: WebhookSecretCacheEntry,
) {
  // Re-insert so the least recently delivered bot is evicted first.
  cache.delete(botId);
  cache.set(botId, entry);
  if (cache.size <= WEBHOOK_SECRET_CACHE_MAX) return;
  const oldest = cache.keys().next().value;
  if (oldest !== undefined) cache.delete(oldest);
}

function decryptWebhookSecret(
  secrets: WebhookDeps["secrets"],
  cache: WebhookSecretCache,
  botId: string,
  secret: { id: string; ciphertext: string },
): WebhookSecretCacheEntry {
  const entry: WebhookSecretCacheEntry = {
    secretId: secret.id,
    ciphertext: secret.ciphertext,
    plaintext: Promise.resolve(null),
    expires: Date.now() + 30_000,
  };
  entry.plaintext = secrets.load(secret.ciphertext, secret.id).catch((error: unknown) => {
    // Auth and malformed ciphertext stay unusable. Anything else can clear, so retry it.
    if (
      (error instanceof SecretStoreUnavailableError || !isPermanentDecryptFailure(error)) &&
      cache.get(botId) === entry
    )
      cache.delete(botId);
    if (error instanceof SecretStoreUnavailableError) throw error;
    return null;
  });
  return entry;
}

// One decrypt per bot; v2 scrypt runs off the event loop.
function loadWebhookSecret(
  secrets: WebhookDeps["secrets"],
  cache: WebhookSecretCache,
  botId: string,
  secret: { id: string; ciphertext: string },
): Promise<string | null> {
  subscribeWebhookCache(secrets, cache);
  const cached = cache.get(botId);
  const entry =
    cached?.secretId === secret.id &&
    cached.ciphertext === secret.ciphertext &&
    cached.expires > Date.now()
      ? cached
      : decryptWebhookSecret(secrets, cache, botId, secret);
  touchWebhookSecret(cache, botId, entry);
  return entry.plaintext;
}

/** Load the bot webhook secret target, or null when the bot/secret is missing or invalid. */
export async function loadWebhookTarget(
  deps: Pick<WebhookDeps, "prisma" | "secrets">,
  cache: WebhookSecretCache,
  botId: string,
): Promise<WebhookTarget | null> {
  const bot = await deps.prisma.bot.findUnique({
    where: { id: botId, archivedAt: null },
    select: {
      id: true,
      spaceId: true,
      userId: true,
      webhookSecretId: true,
      thread: { select: { id: true } },
    },
  });

  if (!bot?.thread || !bot.webhookSecretId) {
    cache.delete(botId);
    return null;
  }

  const secret = await deps.prisma.secret.findUnique({
    where: { id: bot.webhookSecretId },
    select: { id: true, ciphertext: true, kind: true, userId: true, spaceId: true },
  });
  if (
    !secret ||
    secret.kind !== WEBHOOK_SECRET_KIND ||
    secret.userId !== bot.userId ||
    secret.spaceId !== bot.spaceId
  ) {
    cache.delete(botId);
    return null;
  }

  const expected = await loadWebhookSecret(deps.secrets, cache, botId, secret);
  if (expected === null) return null;

  const current = await deps.prisma.bot.findUnique({
    where: { id: botId, archivedAt: null },
    select: { webhookSecretId: true },
  });
  // Rotation can commit during decrypt; the row read above may already be revoked.
  if (current?.webhookSecretId !== secret.id) {
    const cached = cache.get(botId);
    if (cached?.secretId === secret.id) cache.delete(botId);
    return null;
  }

  return {
    bot: {
      id: bot.id,
      spaceId: bot.spaceId,
      userId: bot.userId,
      webhookSecretId: bot.webhookSecretId,
    },
    threadId: bot.thread.id,
    expected,
  };
}

/** Idempotency key shared by messaging wakes and TeamChat duplicate-skip lookups. */
export function messagingWakeIdempotencyKey(provider: string, handle: string): string {
  return `${provider}:${handle}`;
}

/** Client nonce for idempotent inbound deliveries (webhook / github / messaging). */
export function inboundDeliveryClientNonce(
  source: "webhook" | "github" | "messaging",
  botId: string,
  idempotencyKey: string,
): string {
  return `${source}:${botId}:${createHash("sha256").update(idempotencyKey).digest("base64url")}`;
}

export async function deliverWebhookEvent(
  deps: Pick<WebhookDeps, "events" | "jobs"> & { prisma?: Pick<PrismaClient, "taughtSkill"> },
  target: InboundTarget,
  input: {
    prompt: string;
    routines: Array<{
      id: string;
      name: string;
      prompt: string;
      /** A routine that runs a taught skill sends the skill's current playbook instead of `prompt`. */
      taughtSkillId?: string | null;
      modelProvider: string | null;
      modelId: string | null;
      modelCredentialId?: string | null;
      thinkingLevel: string | null;
    }>;
    source: "webhook" | "github" | "messaging";
    idempotencyKey?: string;
    /** Chat text for a bot-level webhook delivery that matched no routine; the model still gets the fenced prompt. */
    displayLabel?: string;
    /** Messaging wakes share the live chat thread; keep a separate webhook run. */
    allowParallelRun?: boolean;
  },
): Promise<{ ok: true; messageId: string; runId: string | null; seq: number }> {
  // Routines pinned to different connections each get their own turn (and their own idempotency
  // key); a later one waits behind the first as pending steering and runs on its own pin.
  const groups = splitRoutinesByConnectionPin(input.routines);
  if (groups.length > 1) {
    const sent = [];
    for (const [index, routines] of groups.entries()) {
      sent.push(
        await deliverWebhookEvent(deps, target, {
          ...input,
          routines,
          idempotencyKey: input.idempotencyKey ? `${input.idempotencyKey}#${index}` : undefined,
        }),
      );
    }
    return sent[0]!;
  }
  const routinePrompts = await Promise.all(
    input.routines.map(async (routine) => {
      const skillPrompt =
        deps.prisma && routine.taughtSkillId
          ? await taughtSkillPromptForRoutine(deps.prisma, {
              taughtSkillId: routine.taughtSkillId,
              spaceId: target.bot.spaceId,
              userId: target.bot.userId,
              botId: target.bot.id,
            })
          : null;
      return skillPrompt ?? routine.prompt.trim();
    }),
  );
  const promptText =
    input.routines.length > 0
      ? [
          ...input.routines.map((routine, index) =>
            inboundRoutineBlock({ name: routine.name, prompt: routinePrompts[index]! }),
          ),
          "",
          input.source === "github"
            ? "Inbound GitHub event metadata:"
            : input.source === "messaging"
              ? "Inbound messaging event:"
              : "Inbound webhook payload:",
          input.prompt,
        ].join("\n")
      : input.prompt;

  const displayText =
    input.routines.length > 0
      ? `Routine: ${input.routines.map((routine) => routine.name).join(", ")}`
      : input.source === "webhook" && input.displayLabel
        ? input.displayLabel
        : promptText;

  const clientNonce = input.idempotencyKey
    ? inboundDeliveryClientNonce(input.source, target.bot.id, input.idempotencyKey)
    : undefined;
  const pin = inboundRoutineModelPin(input.routines);

  const sent = await deps.events.sendUserMessage({
    spaceId: target.bot.spaceId,
    threadId: target.threadId,
    botId: target.bot.id,
    userId: target.bot.userId,
    // Chat shows only the routine names; the model-only wrapper stays in `prompt`.
    blocks: [{ kind: "text", text: displayText }],
    prompt: promptText,
    trigger: "webhook",
    // One routine owns this turn's run; a turn shared by several has no single owner.
    ...(input.routines.length === 1 ? { routineId: input.routines[0]!.id } : {}),
    clientNonce,
    ...(input.allowParallelRun ? { allowParallelRun: true } : {}),
    ...(pin.modelProvider && pin.modelId
      ? {
          modelPin: {
            modelProvider: pin.modelProvider,
            modelId: pin.modelId,
            ...(pin.modelCredentialId ? { modelCredentialId: pin.modelCredentialId } : {}),
            thinkingLevel: pin.thinkingLevel ?? null,
          },
        }
      : {}),
  });

  if (sent.runId) {
    await deps.jobs.enqueue(runContinueJob(sent.runId)).catch((error) => {
      getLogger().error(`${input.source} run enqueue error`, error);
    });
  }

  return { ok: true as const, messageId: sent.messageId, runId: sent.runId, seq: sent.seq };
}
