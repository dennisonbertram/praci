import type { PrismaClient } from "./client.js";
import { Prisma } from "./client.js";
import { lockMeeting, lockMeetingOwner } from "./meetings.js";
import { deleteMeetingRecordings } from "./omi-outputs.js";
import { IsolationError } from "./scope.js";

type Scope = { spaceId: string; userId: string };
type Db = PrismaClient | Prisma.TransactionClient;

/** The previous meeting may end at most this long before the next one starts. */
export const MERGE_MAX_GAP_MS = 30 * 60_000;

/**
 * The meeting before this one (by start time, same user and space) when it is from the same
 * provider and ended no more than 30 minutes before this one started; otherwise null.
 */
export async function findMergeablePrevious(
  db: Db,
  scope: Scope,
  meeting: { id: string; provider: string; startedAt: Date },
): Promise<{ id: string; endedAt: Date } | null> {
  const owner = { spaceId: scope.spaceId, userId: scope.userId };
  const previous = await db.meeting.findFirst({
    where: {
      ...owner,
      deletedAt: null,
      id: { not: meeting.id },
      startedAt: { lt: meeting.startedAt },
    },
    orderBy: [{ startedAt: "desc" }, { id: "desc" }],
    select: { id: true, provider: true, endedAt: true },
  });
  if (
    !previous?.endedAt ||
    previous.provider !== meeting.provider ||
    meeting.startedAt.getTime() - previous.endedAt.getTime() > MERGE_MAX_GAP_MS
  )
    return null;
  return { id: previous.id, endedAt: previous.endedAt };
}

const joined = (a: string | null, b: string | null) => [a, b].filter((x) => x).join("\n\n");

/**
 * Merges a meeting into the one before it (see `findMergeablePrevious`). The earlier meeting keeps
 * its row: its span runs to the later end, transcript and notes are joined in time order, and the
 * later meeting's to-dos, Omi segments, captures and recording move to it. The later meeting is
 * deleted with a tombstone, so a re-sync does not bring it back. Returns the surviving meeting's
 * id and the blob keys of recordings dropped. IsolationError when the meeting is not the
 * caller's or has nothing to merge into.
 */
export async function mergeMeetingWithPrevious(
  prisma: PrismaClient,
  scope: Scope,
  id: string,
): Promise<{ meetingId: string; blobKeys: string[] }> {
  const owner = { spaceId: scope.spaceId, userId: scope.userId };
  return prisma.$transaction(async (tx) => {
    await lockMeetingOwner(tx, owner);
    const later = await tx.meeting.findFirst({ where: { id, ...owner, deletedAt: null } });
    if (!later) throw new IsolationError();
    const found = await findMergeablePrevious(tx, owner, later);
    if (!found) throw new IsolationError();
    const earlier = await tx.meeting.findFirst({ where: { id: found.id, ...owner } });
    if (!earlier) throw new IsolationError();
    const key = { ...owner, provider: later.provider, externalId: later.externalId };
    await lockMeeting(tx, key);
    const laterEnd = later.endedAt ?? later.startedAt;
    await tx.meeting.update({
      where: { id: earlier.id },
      data: {
        endedAt: laterEnd > found.endedAt ? laterEnd : found.endedAt,
        transcript: joined(earlier.transcript, later.transcript) || null,
        transcriptIndexed: earlier.transcriptIndexed || later.transcriptIndexed,
        summary: joined(earlier.summary, later.summary),
        privateNotes: joined(earlier.privateNotes, later.privateNotes),
        // Read again for the whole span by the next digest.
        digest: Prisma.DbNull,
        digestStatus: null,
      },
    });
    const moved = { where: { meetingId: later.id, ...owner }, data: { meetingId: earlier.id } };
    await tx.inboxTodo.updateMany(moved);
    await tx.omiSegment.updateMany(moved);
    await tx.meetingCapture.updateMany(moved);
    const recording = (meetingId: string) => ({
      ...owner,
      source: "meeting",
      sourceConnectionId: null,
      externalId: `meeting:${meetingId}`,
    });
    let blobKeys: string[] = [];
    if (await tx.dataRoomItem.count({ where: recording(earlier.id) }))
      blobKeys = await deleteMeetingRecordings(tx, owner, [later.id]);
    else
      await tx.dataRoomItem.updateMany({
        where: recording(later.id),
        data: { externalId: `meeting:${earlier.id}` },
      });
    await tx.meetingTombstone.upsert({
      where: { spaceId_userId_provider_externalId: key },
      create: key,
      update: {},
    });
    await tx.meeting.delete({ where: { id: later.id } });
    return { meetingId: earlier.id, blobKeys };
  });
}
