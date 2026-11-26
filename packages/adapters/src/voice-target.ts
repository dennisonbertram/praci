import type { SecretStore } from "@rakazo/adapter-kit";
import type { Actor } from "@rakazo/contracts";
import { AI_DISCLOSURE_VERSION } from "@rakazo/contracts";
import type { PrismaClient, TranscriptionSelection } from "@rakazo/db";
import { findDefaultVoiceCredential, findVoiceCredential } from "@rakazo/db";
import { aiRecipient } from "./ai-consent.js";

interface Deps {
  prisma: PrismaClient;
  secrets: SecretStore;
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

export function findTranscriptionSelection(
  deps: Pick<Deps, "prisma">,
  actor: Actor,
): Promise<TranscriptionSelection | null> {
  return deps.prisma.transcriptionSelection.findUnique({ where: { userId: actor.userId } });
}

/** The selected provider, with its key or null when the key is unavailable; null when nothing is selected. */
async function loadTranscriptionSelection(deps: Deps, actor: Actor) {
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

export async function loadVoiceCredential(deps: Deps, actor: Actor, provider?: string) {
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

/**
 * The provider and key to transcribe a user's audio with. A selected provider is used only with
 * its recipient's consent; otherwise the voice provider. `selected` says a selection row exists,
 * so a caller can refuse audio that lacks consent. A selection whose key is unavailable still
 * counts as selected, so audio never skips the consent check.
 */
export async function selectTranscriptionTarget(deps: Deps, actor: Actor) {
  const selected = await loadTranscriptionSelection(deps, actor);
  if (selected?.apiKey && (await hasVoiceConsent(deps.prisma, actor, selected.provider))) {
    return {
      target: { provider: selected.provider, apiKey: selected.apiKey },
      consented: true,
      selected: true,
    };
  }
  const loaded = await loadVoiceCredential(deps, actor);
  const target = loaded ? { provider: loaded.cred.provider, apiKey: loaded.apiKey } : null;
  const consented = target ? await hasVoiceConsent(deps.prisma, actor, target.provider) : false;
  return { target, consented, selected: Boolean(selected) };
}
