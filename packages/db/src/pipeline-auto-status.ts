import type { PipelineAutoChange, PipelineStatus } from "@rakazo/contracts";
import { PipelineStatusSchema } from "@rakazo/contracts";
import type { PrismaClient } from "./client.js";
import type { PipelineDb } from "./pipeline-records.js";
import { savePipelineRecord } from "./pipeline-records.js";

export { FUNDRAISING_PIPELINE } from "./pipeline-records.js";

type Scope = { spaceId: string; userId: string };
type WriteDb = PipelineDb & Pick<PrismaClient, "$transaction">;

export type PipelineAutoActor = "auto:mail" | "auto:calendar";

/** The `before` half of an auto event's payload: the values the job found on the record. */
export type PipelineAutoBefore = {
  status: string;
  nextCallAt: string | null;
  nextCallHasTime: boolean;
};

/** The `set` half: what the job wrote, null where it left the field alone. */
export type PipelineAutoSet = {
  status: PipelineStatus | null;
  nextCallAt: string | null;
  nextCallHasTime: boolean;
};

export type PipelineAutoPayload = {
  before?: Partial<PipelineAutoBefore>;
  set?: Partial<PipelineAutoSet>;
  summary?: string;
  evidenceAt?: string;
  evidenceId?: string;
  /** Set by Undo: the change stays on the timeline but the job never re-applies it. */
  undoneAt?: string | null;
};

/** Reads an auto event's payload without trusting it: every field is optional. */
export const pipelineAutoPayload = (payload: unknown): PipelineAutoPayload =>
  (payload && typeof payload === "object" ? payload : {}) as PipelineAutoPayload;

export interface PipelineAutoChangeInput {
  recordId: string;
  /** The values the job read; the record write is guarded on status and nextCallAt. */
  before: { status: string; nextCallAt: Date | null; nextCallHasTime: boolean };
  status?: PipelineStatus;
  nextCall?: { at: Date; hasTime: boolean };
  /** Written when newer than the stored one; produces no event. */
  lastContactAt?: Date;
  /** Required when status or nextCall changes: what the change came from. */
  evidence?: { actor: PipelineAutoActor; summary: string; at: Date; id: string };
}

/**
 * Applies one auto-status change in a single transaction: the record through `savePipelineRecord`
 * (so a status move writes its `status` event as today), one `auto` event recording what was set
 * and the evidence behind it, and `lastContactAt` when newer. Guarded on the values the job read,
 * so a record the user touched meanwhile is left alone. Returns whether a write landed.
 */
export async function applyPipelineAutoChange(
  prisma: WriteDb,
  scope: Scope,
  input: PipelineAutoChangeInput,
): Promise<{ applied: boolean }> {
  const { recordId, before } = input;
  return prisma.$transaction(async (tx) => {
    let applied = false;
    if (input.status || input.nextCall) {
      if (!input.evidence) throw new Error("An auto-status change needs its evidence");
      applied = await savePipelineRecord(
        tx,
        scope,
        recordId,
        {
          ...(input.status ? { status: input.status } : {}),
          ...(input.nextCall
            ? { nextCallAt: input.nextCall.at, nextCallHasTime: input.nextCall.hasTime }
            : {}),
        },
        { status: before.status, nextCallAt: before.nextCallAt },
      );
      if (!applied) return { applied: false };
      const { actor, summary, at, id } = input.evidence;
      await tx.pipelineEvent.create({
        data: {
          ...scope,
          recordId,
          kind: "auto",
          actor,
          payload: {
            before: {
              status: before.status,
              nextCallAt: before.nextCallAt?.toISOString() ?? null,
              nextCallHasTime: before.nextCallHasTime,
            },
            set: {
              status: input.status ?? null,
              nextCallAt: input.nextCall?.at.toISOString() ?? null,
              nextCallHasTime: input.nextCall?.hasTime ?? before.nextCallHasTime,
            },
            summary: summary.slice(0, 200),
            evidenceAt: at.toISOString(),
            evidenceId: id,
          },
        },
      });
    }
    if (input.lastContactAt) {
      const { count } = await tx.pipelineRecord.updateMany({
        where: {
          id: recordId,
          ...scope,
          OR: [{ lastContactAt: null }, { lastContactAt: { lt: input.lastContactAt } }],
        },
        data: { lastContactAt: input.lastContactAt },
      });
      applied = applied || count > 0;
    }
    return { applied };
  });
}

/**
 * What one user undid per record, from their `auto` events: statuses and nextCallAt values a
 * change had set before it was undone. The job never re-applies those values.
 */
export function undoneAutoChanges(
  events: { recordId: string; payload: unknown }[],
): Map<string, { statuses: Set<string>; nextCalls: Set<string> }> {
  const undone = new Map<string, { statuses: Set<string>; nextCalls: Set<string> }>();
  for (const event of events) {
    const { set, undoneAt } = pipelineAutoPayload(event.payload);
    if (!undoneAt || !set) continue;
    const sets = undone.get(event.recordId) ?? {
      statuses: new Set<string>(),
      nextCalls: new Set<string>(),
    };
    if (typeof set.status === "string") sets.statuses.add(set.status);
    if (typeof set.nextCallAt === "string") sets.nextCalls.add(set.nextCallAt);
    undone.set(event.recordId, sets);
  }
  return undone;
}

/** An `auto` event as the contract's PipelineAutoChange; null when it was undone. */
export function pipelineAutoChangeOf(event: {
  id: string;
  actor: string;
  at: Date;
  payload: unknown;
}): PipelineAutoChange | null {
  const payload = pipelineAutoPayload(event.payload);
  if (payload.undoneAt) return null;
  const parsed = PipelineStatusSchema.safeParse(payload.set?.status);
  return {
    eventId: event.id,
    at: event.at.toISOString(),
    source: event.actor === "auto:calendar" ? "calendar" : "mail",
    status: parsed.success ? parsed.data : null,
    nextCallAt: typeof payload.set?.nextCallAt === "string" ? payload.set.nextCallAt : null,
    summary: typeof payload.summary === "string" ? payload.summary : "",
  };
}
