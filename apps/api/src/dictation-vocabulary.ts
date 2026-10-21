import { capTranscriptionContext, MAX_TRANSCRIPTION_VOCABULARY } from "@rakazo/adapter-kit";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";

export interface DictationVocabularyDeps {
  prisma: PrismaClient;
  /** Tickets are a source only where the board is on, like tickets.list. */
  ticketBoardEnabled?: boolean;
}

/**
 * Names to help a transcription provider spell: the actor's bots, then their contacts, then the
 * titles of the space's tickets. Built per request and never stored. Deduplicated (ignoring case)
 * and capped by the shared transcription caps.
 */
export async function dictationVocabulary(
  deps: DictationVocabularyDeps,
  actor: Actor,
): Promise<string[]> {
  const take = MAX_TRANSCRIPTION_VOCABULARY;
  const { prisma } = deps;
  const bots = await prisma.bot.findMany({
    where: { spaceId: actor.spaceId, userId: actor.userId, archivedAt: null },
    select: { name: true },
    orderBy: [{ pinned: "desc" }, { position: "asc" }, { createdAt: "asc" }],
    take,
  });
  const contacts = await prisma.contact.findMany({
    where: { spaceId: actor.spaceId, userId: actor.userId },
    select: { name: true },
    orderBy: { updatedAt: "desc" },
    take,
  });
  // A space has one board, so the space scope is the same one tickets.list applies.
  const tickets = deps.ticketBoardEnabled
    ? await prisma.ticket.findMany({
        where: { spaceId: actor.spaceId },
        select: { title: true },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        take,
      })
    : [];
  return dedupeVocabulary([
    ...bots.map((row) => row.name),
    ...contacts.map((row) => row.name),
    ...tickets.map((row) => row.title),
  ]);
}

export function dedupeVocabulary(names: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    unique.push(name);
  }
  return capTranscriptionContext({ vocabulary: unique }).vocabulary ?? [];
}
