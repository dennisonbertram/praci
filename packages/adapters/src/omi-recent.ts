import type { Actor, OmiSegmentDto } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";

/**
 * The caller's stretches from recordings made in the last `days` days, newest first. The bound is
 * the recording time, so the viewer cuts it to whole local days.
 */
export async function listRecentOmiSegments(
  prisma: PrismaClient,
  actor: Actor,
  days: number,
  now = new Date(),
): Promise<OmiSegmentDto[]> {
  const rows = await prisma.omiSegment.findMany({
    where: {
      spaceId: actor.spaceId,
      userId: actor.userId,
      audioItem: { sourceUpdatedAt: { gte: new Date(now.getTime() - days * 86_400_000) } },
    },
    include: { audioItem: { select: { sourceUpdatedAt: true } } },
    orderBy: [{ audioItem: { sourceUpdatedAt: "desc" } }, { start: "desc" }],
    take: 500,
  });
  return rows.map((row) => {
    // The where clause keeps only recordings with a time.
    const recordedAt = row.audioItem.sourceUpdatedAt as Date;
    return {
      id: row.id,
      audioItemId: row.audioItemId,
      kind: row.kind as OmiSegmentDto["kind"],
      title: row.title,
      startedAt: new Date(recordedAt.getTime() + row.start * 1000).toISOString(),
      endedAt: new Date(recordedAt.getTime() + row.end * 1000).toISOString(),
      sortedBy: row.sortedBy as OmiSegmentDto["sortedBy"],
      meetingId: row.meetingId,
      noteItemId: row.noteItemId,
    };
  });
}
