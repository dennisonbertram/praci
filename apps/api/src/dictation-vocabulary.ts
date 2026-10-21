import {
  MAX_TRANSCRIPTION_VOCABULARY,
  MAX_TRANSCRIPTION_VOCABULARY_ITEM_CHARS,
} from "@rakazo/adapter-kit";
import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { ensureBoard } from "@rakazo/db";

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
  // The same board resolution and filter as tickets.list.
  const board = deps.ticketBoardEnabled ? await ensureBoard(prisma, actor.spaceId) : null;
  const tickets = board
    ? await prisma.ticket.findMany({
        where: { spaceId: actor.spaceId, boardId: board.id },
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
  // Truncate first, so names that differ only past the cap count as one.
  for (const raw of names) {
    const name = raw.trim().slice(0, MAX_TRANSCRIPTION_VOCABULARY_ITEM_CHARS);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(name);
  }
  return unique.slice(0, MAX_TRANSCRIPTION_VOCABULARY);
}
