import { createHash } from "node:crypto";
import { ORPCError } from "@orpc/server";
import {
  aiRecipient,
  cloudAgentsEnabled,
  inboxClassifierSelected,
  parseModelSecret,
  queueMeetingDigests,
  resolveDataRoomAi,
  selectConfiguredModel,
  TYPESAFE_CLASSIFIER_ID,
  toStringRecord,
} from "@rakazo/adapters";
import type { Actor, AiConsentQuery, AiConsentStatus, AiRecipient } from "@rakazo/contracts";
import { AI_DISCLOSURE_VERSION, AI_PRIVACY_URL } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import {
  findDefaultModelCredential,
  findDefaultVoiceCredential,
  findModelCredential,
} from "@rakazo/db";
import type { RouterDeps } from "./router.js";
import { resolveThreadTarget } from "./thread-target.js";

export async function aiConsentStatus(
  deps: RouterDeps,
  actor: Actor,
  query: AiConsentQuery = {},
): Promise<AiConsentStatus> {
  const uses = query.uses ?? ["model", "memory", "voice"];
  const modelsEnabled = uses.includes("model") && deps.env.agentRuntime !== "scripted";
  const target =
    query.botId || query.groupId ? await resolveThreadTarget(deps.prisma, actor, query) : null;
  const botIds = target
    ? target.kind === "bot"
      ? [target.botId]
      : target.memberBotIds
    : undefined;
  const [
    preferences,
    backups,
    defaultCredential,
    bots,
    routines,
    voices,
    memory,
    settings,
    consents,
    transcription,
  ] = await Promise.all([
    modelsEnabled
      ? deps.prisma.spaceModelPreference.findMany({
          where: { userId: actor.userId, spaceId: actor.spaceId },
          include: { credential: true },
        })
      : [],
    modelsEnabled
      ? deps.prisma.spaceBackupModel.findMany({
          where: { userId: actor.userId, spaceId: actor.spaceId },
          orderBy: { position: "asc" },
        })
      : [],
    modelsEnabled ? findDefaultModelCredential(deps.prisma, actor) : null,
    modelsEnabled
      ? deps.prisma.bot.findMany({
          where: {
            userId: actor.userId,
            spaceId: actor.spaceId,
            archivedAt: null,
            ...(botIds ? { id: { in: botIds } } : {}),
          },
          select: { modelProvider: true, modelId: true, thinkingLevel: true },
        })
      : [],
    // An active routine with its own model is another recipient for this bot.
    // A paused routine is included only when this check is for that routine,
    // so it does not block an ordinary chat message.
    modelsEnabled
      ? deps.prisma.routine.findMany({
          where: {
            userId: actor.userId,
            spaceId: actor.spaceId,
            modelProvider: { not: null },
            modelId: { not: null },
            bot: { archivedAt: null },
            ...(botIds ? { botId: { in: botIds } } : {}),
            OR: query.routineId ? [{ active: true }, { id: query.routineId }] : [{ active: true }],
          },
          select: { modelProvider: true, modelId: true, thinkingLevel: true },
        })
      : [],
    uses.includes("voice")
      ? query.uses
        ? findDefaultVoiceCredential(deps.prisma, actor).then((credential) =>
            credential ? [{ credential }] : [],
          )
        : deps.prisma.spaceVoicePreference.findMany({
            where: { userId: actor.userId, spaceId: actor.spaceId },
            include: { credential: true },
          })
      : [],
    uses.includes("memory")
      ? deps.prisma.spaceMemoryConfig.findUnique({ where: { spaceId: actor.spaceId } })
      : null,
    modelsEnabled ? deps.prisma.deploymentSettings.findUnique({ where: { id: "default" } }) : null,
    deps.prisma.aiDataConsent.findMany({
      where: { userId: actor.userId, spaceId: actor.spaceId, version: AI_DISCLOSURE_VERSION },
    }),
    uses.includes("voice") && !query.uses
      ? deps.prisma.transcriptionSelection.findUnique({ where: { userId: actor.userId } })
      : null,
  ]);
  const allowed = new Set(consents.map((row) => row.recipientKey));
  const recipients = new Map<string, AiRecipient>();
  const add = (recipient: ReturnType<typeof aiRecipient>) => {
    if (recipient)
      recipients.set(recipient.key, { ...recipient, allowed: allowed.has(recipient.key) });
  };
  if (modelsEnabled) {
    const deployment = deps.env.deploymentModelConfigured
      ? { provider: deps.env.defaultProvider, model: deps.env.defaultModel }
      : null;
    const selected = await Promise.all(
      (target ? [...bots, ...routines] : [null, ...bots, ...routines]).map(async (override) => {
        const overrideCredential =
          override?.modelProvider && override.modelId
            ? await findModelCredential(
                deps.prisma,
                actor,
                override.modelProvider,
                override.modelId,
              )
            : null;
        return selectConfiguredModel({
          override,
          overrideCredential,
          defaultCredential,
          settings,
          deployment,
        });
      }),
    );
    // Connected models remain reachable by helpers during a targeted bot run.
    for (const preference of preferences)
      selected.push({
        provider: preference.credential.provider,
        id: preference.modelId ?? "",
        credential: {
          ...preference.credential,
          isDefault: preference.isDefault,
          defaultModel: preference.modelId,
          thinkingLevel: preference.thinkingLevel,
        },
        thinkingLevel: null,
      });
    const backupModels = await Promise.all(
      backups.map(async (backup) => {
        const credential = await findModelCredential(
          deps.prisma,
          actor,
          backup.provider,
          backup.modelId,
        );
        return credential
          ? { provider: backup.provider, id: backup.modelId, credential, thinkingLevel: null }
          : null;
      }),
    );
    selected.push(...backupModels.filter((model) => model !== null));
    if (deps.env.teamChatJudgeProvider && deps.env.teamChatJudgeModel) {
      selected.push({
        provider: deps.env.teamChatJudgeProvider,
        id: deps.env.teamChatJudgeModel,
        credential: await findModelCredential(
          deps.prisma,
          actor,
          deps.env.teamChatJudgeProvider,
          deps.env.teamChatJudgeModel,
        ),
        thinkingLevel: null,
      });
    }
    const models = [
      ...new Map(
        selected
          .filter((model) => model.provider)
          .map((model) => [
            JSON.stringify([model.provider, model.id, model.credential?.secretId]),
            model,
          ]),
      ).values(),
    ];
    const secrets = models.length
      ? await deps.prisma.secret.findMany({
          where: {
            userId: actor.userId,
            spaceId: null,
            id: {
              in: models.flatMap((model) => (model.credential ? [model.credential.secretId] : [])),
            },
          },
        })
      : [];
    const baseUrls = new Map(
      await Promise.all(
        secrets.map(async (secret): Promise<[string, string | undefined]> => {
          try {
            const parsed = parseModelSecret(await deps.secrets.load(secret.ciphertext, secret.id));
            return [secret.id, parsed.kind === "openai_compatible" ? parsed.baseUrl : undefined];
          } catch {
            // Unreadable credentials still disclose by provider; the base URL is unknown.
            return [secret.id, undefined];
          }
        }),
      ),
    );
    for (const model of models) {
      add(
        aiRecipient({
          provider: model.provider!,
          modelId: model.id!,
          baseUrl: model.credential ? baseUrls.get(model.credential.secretId) : undefined,
          use: "model",
        }),
      );
    }
  }
  for (const voice of voices)
    add(aiRecipient({ provider: voice.credential.provider, use: "voice" }));
  // A selected transcription provider receives dictation audio, so it is a recipient of its own.
  // It is listed in settings discovery only, not in targeted checks such as speech playback.
  if (transcription) add(aiRecipient({ provider: transcription.provider, use: "voice" }));
  if (memory)
    add(
      aiRecipient({
        provider: memory.provider,
        use: "memory",
        baseUrl: toStringRecord(memory.settings).baseUrl,
      }),
    );
  if (
    uses.includes("model") &&
    deps.cloudAgent &&
    cloudAgentsEnabled(deps.cloudAgent, actor.spaceId) &&
    !deps.cloudAgent.provider.describe().capabilities.offline
  ) {
    add(aiRecipient({ provider: deps.cloudAgent.provider.describe().id, use: "model" }));
  }
  // The optional inbox classifier is its own recipient. It is listed for the settings view and for
  // granting, but not for a chat send, which it does not take part in.
  if (modelsEnabled && !query.uses && inboxClassifierSelected()) {
    add(aiRecipient({ provider: TYPESAFE_CLASSIFIER_ID, use: "model" }));
  }
  // The Data room's embedding model also receives document text, so Settings lists it (and the
  // switch revokes it) with the other models.
  if (modelsEnabled && !query.uses) {
    const documents = await resolveDataRoomAi(
      { prisma: deps.prisma, resolveModel: deps.resolveModel },
      actor,
    ).catch(() => null);
    for (const recipient of documents?.recipients ?? [])
      if (!recipients.has(recipient.key))
        recipients.set(recipient.key, {
          ...recipient,
          use: "model",
          allowed: allowed.has(recipient.key),
        });
  }
  return {
    scope: createHash("sha256")
      .update(JSON.stringify([actor.userId, actor.spaceId]))
      .digest("hex"),
    version: AI_DISCLOSURE_VERSION,
    privacyUrl: deps.env.privacyPolicyUrl ?? AI_PRIVACY_URL,
    recipients: [...recipients.values()],
  };
}

/** Whether this user has consented to sending voice data to the provider. A provider that shares nothing outside the app has no recipient and needs none. */
export async function hasVoiceConsent(
  prisma: PrismaClient,
  actor: Actor,
  provider: string,
): Promise<boolean> {
  const recipient = aiRecipient({ provider, use: "voice" });
  if (!recipient) return true;
  const count = await prisma.aiDataConsent.count({
    where: {
      userId: actor.userId,
      spaceId: actor.spaceId,
      recipientKey: recipient.key,
      version: AI_DISCLOSURE_VERSION,
    },
  });
  return count > 0;
}

export async function allowAiConsent(
  deps: RouterDeps,
  actor: Actor,
  input: { scope: string; version: string; keys: string[] },
) {
  const current = await aiConsentStatus(deps, actor);
  const known = new Set(current.recipients.map((recipient) => recipient.key));
  if (
    input.scope !== current.scope ||
    input.version !== current.version ||
    input.keys.some((key) => !known.has(key))
  ) {
    throw new ORPCError("CONFLICT", { message: "AI data sharing changed. Review it again." });
  }
  await deps.prisma.$transaction(
    input.keys.map((recipientKey) =>
      deps.prisma.aiDataConsent.upsert({
        where: {
          userId_spaceId_recipientKey: {
            userId: actor.userId,
            spaceId: actor.spaceId,
            recipientKey,
          },
        },
        create: {
          userId: actor.userId,
          spaceId: actor.spaceId,
          recipientKey,
          version: current.version,
        },
        update: { version: current.version, grantedAt: new Date() },
      }),
    ),
  );
  // Granting consent lets stored meetings without a digest be digested; a lost enqueue is retried
  // by the next trigger.
  await queueMeetingDigests(deps, { spaceId: actor.spaceId, userId: actor.userId }).catch(
    () => undefined,
  );
  return {
    ...current,
    recipients: current.recipients.map((recipient) =>
      input.keys.includes(recipient.key) ? { ...recipient, allowed: true } : recipient,
    ),
  };
}
