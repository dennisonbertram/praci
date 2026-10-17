import type { PrismaClient } from "@rakazo/db";
import { createDataRoomRepos } from "@rakazo/db";

/** Read-only access to the bot owner's Data room documents. */
export const DATA_ROOM_TOOL_NAMES = new Set(["data_room_search", "data_room_read"]);

/** Longest document text one data_room_read returns. */
const MAX_TEXT_CHARS = 20_000;

/**
 * The owner's own bot, on a run the owner is behind, in their direct chat or in a group they own.
 * Never a messaging-channel run, where other people read the reply.
 */
export function dataRoomToolsAllowed(options: {
  runUserId: string;
  botUserId: string;
  /** The group's owner when the run is in a group. */
  groupUserId: string | null | undefined;
  groupId: string | null;
  messagingChannelRun: boolean;
}): boolean {
  return (
    options.runUserId === options.botUserId &&
    !options.messagingChannelRun &&
    (!options.groupId || options.groupUserId === options.runUserId)
  );
}

export type DataRoomToolDeps = {
  prisma: PrismaClient;
  /** From the run (the bot owner), never from model input. */
  scope: { spaceId: string; userId: string };
};

type Item = {
  id: string;
  name: string;
  docType: string | null;
  docDate: Date | null;
  parties: string[];
  summary: string | null;
};
const itemSummary = (item: Item) => ({
  id: item.id,
  name: item.name,
  type: item.docType,
  date: item.docDate?.toISOString().slice(0, 10) ?? null,
  parties: item.parties,
  summary: item.summary,
});

export function describeDataRoomActivity(name: string): string | null {
  if (name === "data_room_search") return "Looking in the Data room";
  if (name === "data_room_read") return "Reading a Data room document";
  return null;
}

export async function dataRoomToolFromTool(
  name: string,
  deps: DataRoomToolDeps,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  // The repos only read spaceId and userId from the actor.
  const actor = { ...deps.scope, email: "bot@localhost", isDeploymentOwner: false };
  const repos = createDataRoomRepos(deps.prisma);
  try {
    if (name === "data_room_search") {
      const query = typeof args.query === "string" ? args.query.trim() : "";
      if (!query) {
        const items = await repos.listItems(actor, {}, { limit: 50 });
        return { documents: items.map(itemSummary) };
      }
      const results = await repos.searchKeyword(actor, { query, limit: 10 });
      const byName = await deps.prisma.dataRoomItem.findMany({
        where: { ...deps.scope, name: { contains: query, mode: "insensitive" } },
        take: 10,
      });
      const seen = new Set<string>();
      const documents = [
        ...byName.map((item) => ({ ...itemSummary(item), match: "name" })),
        ...results.map((r) => ({
          ...itemSummary(r.item),
          match: r.snippet.replaceAll("\u0001", "").replaceAll("\u0002", ""),
        })),
      ].filter((doc) => !seen.has(doc.id) && Boolean(seen.add(doc.id)));
      return { documents };
    }
    if (name === "data_room_read") {
      const id = typeof args.id === "string" ? args.id : "";
      const item = id ? await repos.findItem(actor, id) : null;
      if (!item) return { error: "No Data room document with this id. Use data_room_search." };
      const text = await repos.getItemText(actor, id);
      if (text === null)
        return { ...itemSummary(item), error: "This document has no readable text yet." };
      return {
        ...itemSummary(item),
        text: text.slice(0, MAX_TEXT_CHARS),
        truncated: text.length > MAX_TEXT_CHARS,
      };
    }
    return { error: `Unknown Data room tool ${name}` };
  } catch {
    return { error: "Data room tool failed" };
  }
}
