import type { MeetingSource } from "@rakazo/adapter-kit";
import { MeetingSourceError } from "@rakazo/adapter-kit";
import type { MeetingSourceRef, PrismaClient } from "@rakazo/db";
import { upsertMeeting } from "@rakazo/db";

/** How far back the first pass reaches. */
export const MEETINGS_BACKFILL_DAYS = 90;
/** The incremental filter starts this far before the checkpoint, so an update at the edge is read twice, not missed. */
export const MEETINGS_SYNC_OVERLAP_MS = 5 * 60_000;
const DAY_MS = 86_400_000;

type Scope = { spaceId: string; userId: string };

/**
 * Where an unfinished pass resumes. `list` has no ordering guarantee, so the checkpoint can move
 * only when a pass has read every page, and then it moves to the pass's start: a meeting edited
 * after the pass began is listed again by the next pass, whatever the pass has read since. The
 * filter and start time are saved before the first provider call, so a retry keeps them.
 */
interface PassCursor {
  next?: string;
  createdAfter?: string;
  updatedAfter?: string;
  startedAt: string;
}

export interface MeetingSyncState {
  cursor: string | null;
  syncedThrough: Date | null;
}

export interface MeetingSyncDeps {
  prisma: PrismaClient;
  scope: Scope;
  ref: MeetingSourceRef;
  provider: string;
  source: MeetingSource;
  /** Pages read in one run; a longer pass continues in the next run. */
  maxPages: number;
  now?: () => Date;
  signal?: AbortSignal;
  /**
   * Stores the pass position (and, once it is complete, the checkpoint). Returns false when the
   * caller no longer holds the claim, which ends the run.
   */
  save(patch: { cursor: string | null; syncedThrough?: Date }): Promise<boolean>;
  /** Whether the caller still holds the claim; checked before each write. */
  holdsClaim(): Promise<boolean>;
}

export interface MeetingSyncResult {
  /** The pass is complete: the checkpoint moved. */
  done: boolean;
  /** The claim was lost mid-run. */
  lostClaim: boolean;
  fetched: number;
}

function parseCursor(raw: string | null): PassCursor | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as PassCursor;
    return typeof value.startedAt === "string" ? value : null;
  } catch {
    return null;
  }
}

/**
 * One bounded run of a sync pass. A fresh pass is a backfill (`createdAfter`, 90 days) when the
 * source has no checkpoint, and otherwise lists what was updated since the checkpoint. A source
 * error propagates after the position of the last finished page has been saved.
 */
export async function runMeetingSyncPass(
  deps: MeetingSyncDeps,
  state: MeetingSyncState,
): Promise<MeetingSyncResult> {
  const { prisma, scope, source } = deps;
  const now = (deps.now ?? (() => new Date()))();
  let pass = parseCursor(state.cursor);
  if (!pass) {
    pass = {
      startedAt: now.toISOString(),
      ...(state.syncedThrough
        ? {
            updatedAfter: new Date(
              state.syncedThrough.getTime() - MEETINGS_SYNC_OVERLAP_MS,
            ).toISOString(),
          }
        : {
            createdAfter: new Date(now.getTime() - MEETINGS_BACKFILL_DAYS * DAY_MS).toISOString(),
          }),
    };
  }
  let fetched = 0;
  if (!state.cursor && !(await deps.save({ cursor: JSON.stringify(pass) })))
    return { done: false, lostClaim: true, fetched };

  for (let page = 0; page < deps.maxPages; page++) {
    deps.signal?.throwIfAborted();
    const listed = await source.list({
      ...(pass.updatedAfter ? { updatedAfter: new Date(pass.updatedAfter) } : {}),
      ...(pass.createdAfter ? { createdAfter: new Date(pass.createdAfter) } : {}),
      ...(pass.next ? { cursor: pass.next } : {}),
    });
    for (const item of listed.items) {
      deps.signal?.throwIfAborted();
      if (await alreadyHave(prisma, scope, deps.provider, item)) continue;
      let meeting: Awaited<ReturnType<MeetingSource["get"]>>;
      try {
        meeting = await source.get(item.externalId, { includeTranscript: true });
      } catch (error) {
        // Gone between the list and the read; nothing to store.
        if (error instanceof MeetingSourceError && error.kind === "not_found") continue;
        throw error;
      }
      deps.signal?.throwIfAborted();
      if (!(await deps.holdsClaim())) return { done: false, lostClaim: true, fetched };
      await upsertMeeting(prisma, scope, deps.ref, deps.provider, meeting);
      fetched++;
    }
    if (!listed.nextCursor) {
      const kept = await deps.save({ cursor: null, syncedThrough: new Date(pass.startedAt) });
      return { done: kept, lostClaim: !kept, fetched };
    }
    pass = { ...pass, next: listed.nextCursor };
    if (!(await deps.save({ cursor: JSON.stringify(pass) })))
      return { done: false, lostClaim: true, fetched };
  }
  return { done: false, lostClaim: false, fetched };
}

/** A tombstoned meeting is never fetched again, and neither is one already stored at this update. */
async function alreadyHave(
  prisma: PrismaClient,
  scope: Scope,
  provider: string,
  item: { externalId: string; updatedAt: string },
): Promise<boolean> {
  const key = { ...scope, provider, externalId: item.externalId };
  if (await prisma.meetingTombstone.findFirst({ where: key, select: { id: true } })) return true;
  const stored = await prisma.meeting.findFirst({
    where: key,
    select: { sourceUpdatedAt: true },
  });
  return (
    !!stored?.sourceUpdatedAt && stored.sourceUpdatedAt.getTime() >= Date.parse(item.updatedAt)
  );
}
