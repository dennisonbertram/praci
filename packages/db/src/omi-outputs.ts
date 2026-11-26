import type { Actor } from "@rakazo/contracts";
import type { PrismaClient } from "./client.js";

/**
 * Deletes the Recordings items filed for these meetings and returns their blob keys, which the
 * caller queues for deletion.
 */
export async function deleteMeetingRecordings(
  db: Pick<PrismaClient, "dataRoomItem">,
  actor: Pick<Actor, "spaceId" | "userId">,
  meetingIds: string[],
): Promise<string[]> {
  const where = {
    spaceId: actor.spaceId,
    userId: actor.userId,
    source: "meeting",
    sourceConnectionId: null,
    externalId: { in: meetingIds.map((id) => `meeting:${id}`) },
  };
  const items = await db.dataRoomItem.findMany({
    where,
    select: { storageKey: true, thumbnailKey: true },
  });
  await db.dataRoomItem.deleteMany({ where });
  return items.flatMap((i) => [i.storageKey, i.thumbnailKey].filter((k): k is string => !!k));
}

/**
 * Deletes meetings with their Inbox to-dos and Recordings items, as `deleteMeeting` does (no
 * tombstone: the user did not delete them). Returns the blob keys of the removed items.
 */
export async function deleteMeetingsWithTodos(
  db: Pick<PrismaClient, "meeting" | "inboxTodo" | "dataRoomItem">,
  actor: Pick<Actor, "spaceId" | "userId">,
  ids: string[],
): Promise<string[]> {
  const owner = { spaceId: actor.spaceId, userId: actor.userId };
  await db.inboxTodo.deleteMany({ where: { ...owner, meetingId: { in: ids } } });
  // The meeting rows go first: a follow-up filing holds their lock, so it finishes before the
  // note is looked for and cannot leave one behind.
  await db.meeting.deleteMany({ where: { ...owner, id: { in: ids } } });
  return deleteMeetingRecordings(db, owner, ids);
}

/**
 * Deletes the meetings and note items made from Omi recordings (one audio item, or every one of a
 * connection) and returns the blob keys of the removed notes. The segments go with the audio item.
 */
export async function deleteOmiOutputs(
  prisma: PrismaClient,
  actor: Pick<Actor, "spaceId" | "userId">,
  where: { audioItemId: string } | { connectionId: string },
): Promise<string[]> {
  const owner = { spaceId: actor.spaceId, userId: actor.userId };
  const segments = await prisma.omiSegment.findMany({
    where: { ...owner, ...where },
    select: { meetingId: true, noteItemId: true },
  });
  const meetingIds = segments.flatMap((s) => (s.meetingId ? [s.meetingId] : []));
  const noteIds = segments.flatMap((s) => (s.noteItemId ? [s.noteItemId] : []));
  const notes = await prisma.dataRoomItem.findMany({
    where: { ...owner, id: { in: noteIds } },
    select: { storageKey: true, thumbnailKey: true },
  });
  const recordingKeys = await prisma.$transaction(async (tx) => {
    const keys = await deleteMeetingsWithTodos(tx, owner, meetingIds);
    await tx.dataRoomItem.deleteMany({ where: { ...owner, id: { in: noteIds } } });
    return keys;
  });
  return [
    ...notes.flatMap((n) => [n.storageKey, n.thumbnailKey].filter((k): k is string => !!k)),
    ...recordingKeys,
  ];
}
