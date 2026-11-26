import type {
  Contact,
  FundraiseRound,
  FundraiseRoundSaveInput,
  FundraisingOverview,
  PipelineAutoChange,
  PipelineCallLogInput,
  PipelineCallLogResult,
  PipelineCallOutcome,
  ProspectSaveInput,
} from "@rakazo/contracts";
import {
  PipelineCallOutcomeSchema,
  PipelineDetailSchema,
  PipelineStatusSchema,
} from "@rakazo/contracts";
import { isActiveSafe } from "@rakazo/core";
import * as z from "zod";
import type { Prisma, PrismaClient } from "./client.js";
import { contactInclude, toContact } from "./contacts.js";
import type { PipelineAutoBefore, PipelineAutoSet } from "./pipeline-auto-status.js";
import { pipelineAutoChangeOf, pipelineAutoPayload } from "./pipeline-auto-status.js";
import type { PipelineDb } from "./pipeline-records.js";
import {
  ensureRecord,
  FUNDRAISING_PIPELINE,
  personlessRow,
  recordOfContact,
  savePipelineRecord,
} from "./pipeline-records.js";

export { PipelineInputError } from "./pipeline-records.js";

import { isUniqueViolation } from "./prisma-errors.js";
import { hasActiveSafe, SafeActiveError, safeInRecordRound, toSafe } from "./safes.js";
import { IsolationError } from "./scope.js";

type Scope = { spaceId: string; userId: string };
type Db = PipelineDb & Pick<PrismaClient, "safe">;
type WriteDb = Db & Pick<PrismaClient, "$transaction">;
/** Only space and user: callers may pass a whole actor, which must not reach a Prisma query. */
const ownerOf = ({ spaceId, userId }: Scope): Scope => ({ spaceId, userId });

export class FundraiseRoundOpenError extends Error {
  constructor() {
    super("Another round is already open.");
    this.name = "FundraiseRoundOpenError";
  }
}

const PipelineDetailsSchema = z.array(PipelineDetailSchema);

const toRound = (row: Prisma.FundraiseRoundGetPayload<object>): FundraiseRound => ({
  id: row.id,
  name: row.name,
  targetCents: Number(row.targetCents),
  capCents: Number(row.capCents),
  closedAt: row.closedAt?.toISOString() ?? null,
});

/** The open round, else the latest closed one, and the prospect pipeline. */
export async function getFundraisingOverview(
  prisma: Db,
  actor: Scope,
): Promise<Omit<FundraisingOverview, "mercury">> {
  const scope = ownerOf(actor);
  const row =
    (await prisma.fundraiseRound.findFirst({ where: { ...scope, closedAt: null } })) ??
    (await prisma.fundraiseRound.findFirst({
      where: scope,
      orderBy: [{ closedAt: "desc" }, { id: "desc" }],
    }));
  const pipeline = FUNDRAISING_PIPELINE;
  const [records, people, contacts, safeRows, callEvents, autoEvents] = await Promise.all([
    prisma.pipelineRecord.findMany({ where: { ...scope, pipeline }, orderBy: { id: "asc" } }),
    prisma.pipelineRecordPerson.findMany({
      where: { ...scope, pipeline },
      select: {
        recordId: true,
        contactId: true,
        contact: { select: { kind: true, name: true } },
      },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }, { id: "asc" }],
    }),
    // One row per record, its primary person. A prospect not on a record yet still shows.
    prisma.contact.findMany({
      where: {
        ...scope,
        OR: [
          { pipelinePeople: { some: { pipeline, isPrimary: true } } },
          { kind: "prospect", pipelinePeople: { none: { pipeline } } },
        ],
      },
      include: contactInclude,
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    prisma.safe.findMany({ where: scope, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }),
    // The newest call of each record: Last call is read, never stored.
    prisma.pipelineEvent.findMany({
      where: { ...scope, kind: "call" },
      distinct: ["recordId"],
      orderBy: [{ recordId: "asc" }, { at: "desc" }, { id: "desc" }],
    }),
    // Every auto-status event, newest first: the newest non-undone one is each record's lastAuto.
    prisma.pipelineEvent.findMany({
      where: { ...scope, kind: "auto" },
      orderBy: [{ at: "desc" }, { id: "desc" }],
    }),
  ]);
  const referrerIds = [
    ...new Set(records.flatMap((r) => (r.referredByContactId ? [r.referredByContactId] : []))),
  ];
  const referrers = new Map<string, string>(
    referrerIds.length === 0
      ? []
      : (
          await prisma.contact.findMany({
            where: { ...scope, id: { in: referrerIds } },
            select: { id: true, name: true },
          })
        ).map((contact) => [contact.id, contact.name]),
  );
  const recordById = new Map(records.map((record) => [record.id, record]));
  const lastCallOf = new Map(
    callEvents.map((event) => {
      const payload = event.payload as { outcome?: string; note?: string | null } | null;
      return [
        event.recordId,
        { outcome: payload?.outcome, at: event.at.toISOString(), note: payload?.note ?? null },
      ];
    }),
  );
  const lastAutoOf = new Map<string, PipelineAutoChange>();
  for (const event of autoEvents) {
    if (lastAutoOf.has(event.recordId)) continue;
    const change = pipelineAutoChangeOf(event);
    if (change) lastAutoOf.set(event.recordId, change);
  }
  /** What the table needs beyond the contact: referrer, people, fund details and the last call. */
  const withExtras = (row: Contact): Contact => {
    const info = row.pipelineRecord;
    const record = info && recordById.get(info.id);
    if (!info || !record) return row;
    const call = lastCallOf.get(record.id);
    return {
      ...row,
      pipelineRecord: {
        ...info,
        referredBy: record.referredByContactId
          ? {
              id: record.referredByContactId,
              name: referrers.get(record.referredByContactId) ?? "",
            }
          : null,
        people: people
          .filter((person) => person.recordId === record.id)
          .map((person) => ({ id: person.contactId, name: person.contact.name })),
        details: PipelineDetailsSchema.catch([]).parse(record.details),
        lastCall:
          call && PipelineCallOutcomeSchema.safeParse(call.outcome).success
            ? { ...call, outcome: call.outcome as PipelineCallOutcome }
            : null,
        lastAuto: lastAutoOf.get(record.id) ?? null,
      },
    };
  };
  const safes = safeRows.map((safe) => toSafe(safe));
  const open = row && !row.closedAt ? row : null;
  const created = new Map(records.map((record) => [record.id, record.createdAt]));
  const personOf = new Map(people.map((person) => [person.contactId, person]));
  // A record leaves the pipeline while it has an active SAFE in the open round (any round when none
  // is open). It returns once every SAFE is canceled, expired or deleted. The one exception is as it
  // always was: a lone prospect who signed became an investor, which ends its place in that round.
  // A firm with other people still has someone to raise from.
  const leftRecords = new Set(
    safes.flatMap((safe) => {
      const person = safe.contactId ? personOf.get(safe.contactId) : undefined;
      const since = person && created.get(person.recordId);
      if (!person || !since || !safeInRecordRound(safe, since, open)) return [];
      const signedAlone =
        safe.signedByOwnerAt &&
        safe.signedByInvestorAt &&
        person.contact.kind === "investor" &&
        people.filter((other) => other.recordId === person.recordId).length === 1;
      return isActiveSafe(safe.status) || signedAlone ? [person.recordId] : [];
    }),
  );
  const withSafe = new Set(
    safes.filter((s) => s.contactId && isActiveSafe(s.status)).map((s) => s.contactId),
  );
  const peopled = new Set(people.map((person) => person.recordId));
  const rows = contacts
    .filter((contact) => {
      const record = contact.pipelinePeople[0]?.record;
      return record ? !leftRecords.has(record.id) : !withSafe.has(contact.id);
    })
    .map(toContact);
  const personless = records.filter((record) => !peopled.has(record.id)).map(personlessRow);
  // A prospect not yet on a record reads as Target.
  const withStage = [...rows, ...personless].map((p) =>
    withExtras({ ...p, stage: p.stage ?? "target" }),
  );
  // The list's own order first; a row with no order goes last. Ties break on the row's name.
  const orderOf = (row: Contact) =>
    row.pipelineRecord ? (recordById.get(row.pipelineRecord.id)?.listOrder ?? null) : null;
  const nameOf = (row: Contact) => row.pipelineRecord?.name ?? row.name;
  withStage.sort((a, b) => {
    const orderA = orderOf(a);
    const orderB = orderOf(b);
    const byOrder =
      orderA == null || orderB == null
        ? Number(orderA == null) - Number(orderB == null)
        : orderA - orderB;
    return byOrder || nameOf(a).localeCompare(nameOf(b)) || a.id.localeCompare(b.id);
  });
  const inRound = safes.filter((s) => row && s.roundId === row.id);
  const sumOf = (...statuses: string[]) =>
    inRound.filter((s) => statuses.includes(s.status)).reduce((sum, s) => sum + s.amountCents, 0);
  // A Committed record counts only in the round that was open when its status was saved, and once,
  // however many people it has; a Sent or Draft SAFE of the open round counts at its amount instead.
  const pendingCents = open
    ? records
        .filter(
          (record) =>
            record.status === "committed" &&
            record.roundId === open.id &&
            !leftRecords.has(record.id),
        )
        .reduce((sum, record) => sum + Number(record.amountCents ?? 0), 0) + sumOf("sent", "draft")
    : 0;
  return {
    round: row ? toRound(row) : null,
    pendingCents,
    signedCents: sumOf("signed"),
    fundedCents: sumOf("funded"),
    prospects: withStage,
    safes,
  };
}

/** Starts a round, or edits the open round when `id` is given. */
export async function saveRound(
  prisma: Db,
  actor: Scope,
  input: FundraiseRoundSaveInput,
): Promise<FundraiseRound> {
  const scope = ownerOf(actor);
  const { id, ...fields } = input;
  if (id) {
    const { count } = await prisma.fundraiseRound.updateMany({
      where: { id, ...scope, closedAt: null },
      data: fields,
    });
    if (count === 0) throw new IsolationError("Round not found");
    return toRound(await prisma.fundraiseRound.findUniqueOrThrow({ where: { id } }));
  }
  try {
    return toRound(await prisma.fundraiseRound.create({ data: { ...scope, ...fields } }));
  } catch (error) {
    // The partial unique index allows one open round per space and user.
    throw isUniqueViolation(error) ? new FundraiseRoundOpenError() : error;
  }
}

async function setClosedAt(
  prisma: Db,
  actor: Scope,
  id: string,
  from: { closedAt: null } | { closedAt: { not: null } },
  closedAt: Date | null,
): Promise<FundraiseRound> {
  const { count } = await prisma.fundraiseRound.updateMany({
    where: { id, ...ownerOf(actor), ...from },
    data: { closedAt },
  });
  if (count === 0) throw new IsolationError("Round not found");
  return toRound(await prisma.fundraiseRound.findUniqueOrThrow({ where: { id } }));
}

/** Send SAFE through Mercury needs the prospect's email: it is how the next sync attaches the SAFE. */
export class ProspectEmailRequiredError extends Error {
  constructor() {
    super("Add an email first.");
    this.name = "ProspectEmailRequiredError";
  }
}

/**
 * A person on a fundraising record, of any kind, and that record. A prospect with no record gets one.
 * Throws IsolationError for any other contact.
 */
async function prospectOf(prisma: WriteDb, scope: Scope, id: string) {
  const row = await prisma.contact.findFirst({ where: { id, ...scope } });
  if (!row) throw new IsolationError("Contact not found");
  const record =
    (await recordOfContact(prisma, scope, id)) ??
    (row.kind === "prospect"
      ? await prisma.$transaction((tx) => ensureRecord(tx, scope, row))
      : null);
  if (!record) throw new IsolationError("Contact not found");
  return { row, record };
}

const contactRow = async (prisma: Db, scope: Scope, id: string) =>
  toContact(
    await prisma.contact.findFirstOrThrow({ where: { id, ...scope }, include: contactInclude }),
  );

/**
 * Send SAFE with Mercury: the record is Waiting for Mercury until a SAFE attaches or Not sent.
 * Throws IsolationError for any other contact, ProspectEmailRequiredError without an email and
 * SafeActiveError while its record has an active SAFE in the open round (Canceled and Expired ones
 * do not block).
 */
export async function markWaiting(prisma: WriteDb, actor: Scope, id: string): Promise<Contact> {
  const scope = ownerOf(actor);
  const { row, record } = await prospectOf(prisma, scope, id);
  if (!row.email?.trim()) throw new ProspectEmailRequiredError();
  const open = await prisma.fundraiseRound.findFirst({
    where: { ...scope, closedAt: null },
    select: { id: true },
  });
  if (await hasActiveSafe(prisma, scope, id, open?.id ?? null)) throw new SafeActiveError();
  await savePipelineRecord(prisma, scope, record.id, { waitingSince: new Date() });
  return contactRow(prisma, scope, id);
}

/** Not sent: restores the normal prospect row. */
export async function notSent(prisma: WriteDb, actor: Scope, id: string): Promise<Contact> {
  const scope = ownerOf(actor);
  const { record } = await prospectOf(prisma, scope, id);
  await savePipelineRecord(prisma, scope, record.id, { waitingSince: null });
  return contactRow(prisma, scope, id);
}

export const closeRound = (prisma: Db, actor: Scope, id: string) =>
  setClosedAt(prisma, actor, id, { closedAt: null }, new Date());

/** Throws FundraiseRoundOpenError while another round is open. */
export const reopenRound = (prisma: Db, actor: Scope, id: string) =>
  setClosedAt(prisma, actor, id, { closedAt: { not: null } }, null).catch((error: unknown) => {
    throw isUniqueViolation(error) ? new FundraiseRoundOpenError() : error;
  });

/**
 * Changes the pipeline fields of one of the user's prospects, named by its contact or, for a record
 * with no person yet, by the record. Throws IsolationError for anything else.
 */
export async function saveProspect(
  prisma: WriteDb,
  actor: Scope,
  { id, ...fields }: ProspectSaveInput,
): Promise<Contact> {
  const scope = ownerOf(actor);
  const changes = {
    ...(fields.stage === undefined ? {} : { stage: fields.stage }),
    ...(fields.status === undefined ? {} : { status: fields.status }),
    ...(fields.interest === undefined ? {} : { interest: fields.interest }),
    ...(fields.nextCallAt === undefined
      ? {}
      : { nextCallAt: fields.nextCallAt === null ? null : new Date(fields.nextCallAt) }),
    ...(fields.nextCallHasTime === undefined ? {} : { nextCallHasTime: fields.nextCallHasTime }),
    ...(fields.referredByContactId === undefined
      ? {}
      : { referredByContactId: fields.referredByContactId }),
    ...(fields.checkSizeCents === undefined ? {} : { amountCents: fields.checkSizeCents }),
    ...(fields.nextStep === undefined ? {} : { nextStep: fields.nextStep }),
  };
  const personless = await prisma.pipelineRecord.findFirst({
    where: { id, ...scope, people: { none: {} } },
    select: { id: true },
  });
  const guard: Prisma.PipelineRecordWhereInput = {
    ...(fields.expect?.status === undefined ? {} : { status: fields.expect.status }),
    ...(fields.expect?.interest === undefined ? {} : { interest: fields.expect.interest }),
    ...(fields.expect?.nextCallAt === undefined
      ? {}
      : {
          nextCallAt: fields.expect.nextCallAt === null ? null : new Date(fields.expect.nextCallAt),
        }),
  };
  // One transaction, so a manual status never lands while the job's earlier changes stay
  // applicable — it would move the record back to them on the next run.
  const save = async (tx: PipelineDb, recordId: string) => {
    if (await savePipelineRecord(tx, scope, recordId, changes, guard)) {
      await overrideAutoStatus(tx, scope, recordId, fields.status);
    }
  };
  if (personless) {
    await prisma.$transaction((tx) => save(tx, id));
    return personlessRow(await prisma.pipelineRecord.findFirstOrThrow({ where: { id, ...scope } }));
  }
  const { record } = await prospectOf(prisma, scope, id);
  await prisma.$transaction((tx) => save(tx, record.id));
  return contactRow(prisma, scope, id);
}

/**
 * A status the user sets by hand overrides the auto-status job: its standing status changes on the
 * record count as undone, so the job never moves the record forward to them again.
 */
async function overrideAutoStatus(
  prisma: Pick<PrismaClient, "pipelineEvent">,
  scope: Scope,
  recordId: string,
  status: string | undefined,
) {
  if (status === undefined) return;
  const events = await prisma.pipelineEvent.findMany({
    where: { ...scope, recordId, kind: "auto" },
    select: { id: true, payload: true },
  });
  const undoneAt = new Date().toISOString();
  for (const event of events) {
    const payload = pipelineAutoPayload(event.payload);
    if (payload.undoneAt || typeof payload.set?.status !== "string") continue;
    await prisma.pipelineEvent.updateMany({
      where: { id: event.id, ...scope },
      data: { payload: { ...payload, undoneAt } as Prisma.InputJsonValue },
    });
  }
}

/** The record a contact or a person-less record id names; throws IsolationError for anything else. */
async function recordFor(prisma: WriteDb, scope: Scope, id: string) {
  const personless = await prisma.pipelineRecord.findFirst({
    where: { id, ...scope, people: { none: {} } },
  });
  return personless ?? (await prospectOf(prisma, scope, id)).record;
}

type CallBefore = { status: string; nextCallAt: string | null; nextCallHasTime: boolean };
/** What a logged call wrote, so Undo reverses only that, and only while it still holds. */
type CallSet = { status: "met" | null; next: { at: string | null; hasTime: boolean } | null };

/**
 * Logs a call: one `call` event, and the status moves forward only. Spoke moves a record that has
 * not reached Met to Met, decided at the write itself so a record that has advanced meanwhile is
 * left alone. Left message and No answer leave the status alone. `keep` leaves the next call as it
 * is, so the row stays due. The event keeps what it set and what was there before, for Undo.
 */
export async function logCall(
  prisma: WriteDb,
  actor: Scope,
  { id, outcome, note, nextCall }: PipelineCallLogInput,
): Promise<PipelineCallLogResult> {
  const scope = ownerOf(actor);
  const record = await recordFor(prisma, scope, id);
  const before: CallBefore = {
    status: record.status,
    nextCallAt: record.nextCallAt?.toISOString() ?? null,
    nextCallHasTime: record.nextCallHasTime,
  };
  const order = PipelineStatusSchema.options;
  const earlier = order.slice(0, order.indexOf("met"));
  const next =
    nextCall === "keep"
      ? null
      : {
          at: nextCall.at ? new Date(nextCall.at).toISOString() : null,
          hasTime: Boolean(nextCall.at) && nextCall.hasTime,
        };
  // One transaction, so a failure never leaves the record moved without its call event.
  return prisma.$transaction(async (tx) => {
    const moved =
      outcome === "spoke"
        ? (
            await tx.pipelineRecord.updateMany({
              where: { id: record.id, ...scope, status: { in: earlier } },
              data: { status: "met", roundId: null },
            })
          ).count > 0
        : false;
    if (next)
      await tx.pipelineRecord.updateMany({
        where: { id: record.id, ...scope },
        data: { nextCallAt: next.at ? new Date(next.at) : null, nextCallHasTime: next.hasTime },
      });
    const set: CallSet = { status: moved ? "met" : null, next };
    const event = await tx.pipelineEvent.create({
      data: {
        ...scope,
        recordId: record.id,
        kind: "call",
        payload: { outcome, note: note?.trim() || null, before, set },
      },
    });
    if (moved)
      await tx.pipelineEvent.create({
        data: {
          ...scope,
          recordId: record.id,
          kind: "status",
          payload: { from: before.status, to: "met" },
        },
      });
    return { eventId: event.id, movedToMet: moved };
  });
}

/**
 * Undo of a logged call: removes it and puts back the status and next call it set, each only while
 * the record still has the value the call set. The round is never touched.
 */
export async function undoCall(prisma: WriteDb, actor: Scope, eventId: string): Promise<void> {
  const scope = ownerOf(actor);
  const event = await prisma.pipelineEvent.findFirst({
    where: { id: eventId, ...scope, kind: "call" },
  });
  if (!event) throw new IsolationError("Call not found");
  const { before, set } = event.payload as { before?: CallBefore; set?: CallSet };
  const where = { id: event.recordId, ...scope };
  if (before && set?.status)
    await prisma.pipelineRecord.updateMany({
      where: { ...where, status: set.status },
      data: { status: before.status },
    });
  if (before && set?.next)
    await prisma.pipelineRecord.updateMany({
      where: {
        ...where,
        nextCallAt: set.next.at ? new Date(set.next.at) : null,
        nextCallHasTime: set.next.hasTime,
      },
      data: {
        nextCallAt: before.nextCallAt ? new Date(before.nextCallAt) : null,
        nextCallHasTime: before.nextCallHasTime,
      },
    });
  await prisma.pipelineEvent.deleteMany({ where: { id: eventId, ...scope } });
}

/**
 * Undo of an automatic change the auto-status job wrote: each field goes back to `before` only
 * while the record still holds what `set` wrote. The event is never deleted; it is marked undone
 * instead, so the job never re-applies the same change.
 */
export async function undoAutoChange(
  prisma: WriteDb,
  actor: Scope,
  eventId: string,
): Promise<void> {
  const scope = ownerOf(actor);
  const event = await prisma.pipelineEvent.findFirst({
    where: { id: eventId, ...scope, kind: "auto" },
  });
  if (!event) throw new IsolationError("Change not found");
  const payload = event.payload as {
    before?: PipelineAutoBefore;
    set?: PipelineAutoSet;
    undoneAt?: string | null;
  } | null;
  if (payload?.undoneAt) return;
  const { before, set } = payload ?? {};
  const where = { id: event.recordId, ...scope };
  await prisma.$transaction(async (tx) => {
    if (before?.status && set?.status)
      await tx.pipelineRecord.updateMany({
        where: { ...where, status: set.status },
        data: { status: before.status },
      });
    if (set?.nextCallAt)
      await tx.pipelineRecord.updateMany({
        where: {
          ...where,
          nextCallAt: new Date(set.nextCallAt),
          nextCallHasTime: set.nextCallHasTime,
        },
        data: {
          nextCallAt: before?.nextCallAt ? new Date(before.nextCallAt) : null,
          nextCallHasTime: before?.nextCallHasTime ?? false,
        },
      });
    await tx.pipelineEvent.updateMany({
      where: { id: eventId, ...scope },
      data: {
        payload: { ...(payload ?? {}), undoneAt: new Date().toISOString() },
      },
    });
  });
}
