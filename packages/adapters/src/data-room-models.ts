import { createHash } from "node:crypto";
import type { AgentRunModel, Embedder } from "@rakazo/adapter-kit";
import { DATA_ROOM_DISCLOSURE_VERSION } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { aiRecipient } from "./ai-consent.js";
import { OpenAICompatibleEmbedder } from "./openai-compatible-embedder.js";

type Scope = { userId: string; spaceId: string };

export interface DataRoomAi {
  /** The space's chat model, for classification and vision. Null when none can be resolved. */
  model: AgentRunModel | null;
  /** Embeds through the chat model's own connection. Null: keyword search only. */
  embedder: Embedder | null;
  embeddingModel: string | null;
  /** Where document content goes. Empty when no model is set up. */
  recipients: { key: string; name: string; detail: string }[];
  /** Identifies exactly these recipients, so switching provider asks for consent again. */
  consentKey: string;
  /** The user granted the Data room disclosure for exactly these recipients. */
  allowed: boolean;
}

export interface DataRoomAiDeps {
  prisma: Pick<PrismaClient, "spaceModelPreference" | "aiDataConsent">;
  /** The executor's resolver, as inbox triage uses it. Without it no model resolves. */
  resolveModel?: (scope: Scope) => Promise<AgentRunModel>;
}

/**
 * The one place that decides which models the Data room may call for a user. The chat model comes
 * from the same resolver as inbox triage. The embedder reuses that model's connection (base URL and
 * key) with the `embeddingModel` saved on the space's default preference; a connection without a
 * base URL, an OAuth sign-in, or no saved embedding model means no embedder.
 */
export async function resolveDataRoomAi(deps: DataRoomAiDeps, scope: Scope): Promise<DataRoomAi> {
  let model: AgentRunModel | null = null;
  try {
    model = (await deps.resolveModel?.(scope)) ?? null;
  } catch {
    model = null;
  }
  const chat = model
    ? aiRecipient({
        provider: model.provider,
        modelId: model.id,
        baseUrl: model.baseUrl,
        use: "model",
      })
    : null;
  if (!model || !chat) {
    return {
      model: null,
      embedder: null,
      embeddingModel: null,
      recipients: [],
      consentKey: consentKey([]),
      allowed: false,
    };
  }
  const preference = await deps.prisma.spaceModelPreference.findFirst({
    where: { spaceId: scope.spaceId, userId: scope.userId, isDefault: true },
    select: { embeddingModel: true },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
  });
  const embeddingModel = preference?.embeddingModel?.trim() || null;
  let embedder: Embedder | null = null;
  if (embeddingModel && model.baseUrl && !model.oauth) {
    try {
      embedder = new OpenAICompatibleEmbedder({
        baseUrl: model.baseUrl,
        apiKey: model.apiKey,
        model: embeddingModel,
      });
    } catch {
      // A base URL the embedder refuses (for example a private address): keyword search only.
    }
  }
  const recipients = [{ key: chat.key, name: chat.name, detail: chat.detail }];
  if (embedder && embeddingModel) {
    const recipient = aiRecipient({
      provider: model.provider,
      modelId: embeddingModel,
      baseUrl: model.baseUrl,
      use: "model",
    });
    if (recipient) {
      recipients.push({ key: recipient.key, name: recipient.name, detail: recipient.detail });
    }
  }
  const key = consentKey(recipients.map((r) => r.key));
  const granted = await deps.prisma.aiDataConsent.findFirst({
    where: {
      userId: scope.userId,
      spaceId: scope.spaceId,
      recipientKey: key,
      version: DATA_ROOM_DISCLOSURE_VERSION,
    },
    select: { userId: true },
  });
  return {
    model,
    embedder,
    embeddingModel: embedder ? embeddingModel : null,
    recipients,
    consentKey: key,
    allowed: Boolean(granted),
  };
}

function consentKey(recipientKeys: string[]): string {
  return `data-room:${createHash("sha256")
    .update(JSON.stringify([...new Set(recipientKeys)].sort()))
    .digest("hex")}`;
}
