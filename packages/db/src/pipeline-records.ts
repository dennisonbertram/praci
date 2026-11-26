import type { Contact, ContactStage, PipelineInterest, PipelineStatus } from "@rakazo/contracts";
import type { Prisma, PrismaClient } from "./client.js";
import { IsolationError } from "./scope.js";

type Scope = { spaceId: string; userId: string };
export type PipelineDb = Pick<
  PrismaClient,
  "contact" | "fundraiseRound" | "pipelineRecord" | "pipelineRecordPerson" | "pipelineEvent"
>;
type RecordRow = Prisma.PipelineRecordGetPayload<object>;

export const FUNDRAISING_PIPELINE = "fundraising";

/** The coarser stage a status rolls up to, until the stage fields leave the contact contract. */
const STAGE_OF: Record<PipelineStatus, ContactStage> = {
  not_reached: "target",
  reached_out: "target",
  intro_requested: "intro",
  intro_made: "intro",
  meeting_booked: "meeting",
  met: "meeting",
  diligence: "diligence",
  committed: "committed",
  passed: "passed",
};
const FIRST_STATUS: Record<ContactStage, PipelineStatus> = {
  target: "not_reached",
  intro: "intro_requested",
  meeting: "meeting_booked",
  diligence: "diligence",
  committed: "committed",
  passed: "passed",
};

export const stageOf = (status: string): ContactStage =>
  STAGE_OF[status as PipelineStatus] ?? "target";

/** Lowercase letters and digits only, so "Harbor Angels, LLC" and "harbor angels llc" match. */
export const normalized = (value: string | null | undefined) =>
  (value ?? "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");

/**
 * The round a status save puts a record in: the open round for Committed (none when no round is
 * open), none for any other status, and undefined (keep it) when the status is not part of the save.
 */
export async function roundIdForStage(
  prisma: Pick<PrismaClient, "fundraiseRound">,
  { spaceId, userId }: Scope,
  stage: ContactStage | null | undefined,
): Promise<string | null | undefined> {
  if (stage === undefined) return undefined;
  if (stage !== "committed") return null;
  const open = await prisma.fundraiseRound.findFirst({
    where: { spaceId, userId, closedAt: null },
    select: { id: true },
  });
  return open?.id ?? null;
}

/** The fundraising record a contact is on, if any. */
export async function recordOfContact(
  db: Pick<PrismaClient, "pipelineRecordPerson">,
  { spaceId, userId }: Scope,
  contactId: string,
): Promise<RecordRow | null> {
  const link = await db.pipelineRecordPerson.findFirst({
    where: { spaceId, userId, pipeline: FUNDRAISING_PIPELINE, contactId },
    include: { record: true },
  });
  return link?.record ?? null;
}

/**
 * The contact's fundraising record, creating a one-person record when it has none. A record with
 * no people yet and the same name takes the contact as its first person. A firm name already taken
 * gets the person's name in front, so two prospects at one firm stay two records.
 * Call inside a transaction.
 */
export async function ensureRecord(
  db: PipelineDb,
  { spaceId, userId }: Scope,
  contact: { id: string; name: string; organization: string | null },
): Promise<RecordRow> {
  const scope = { spaceId, userId };
  const own = await recordOfContact(db, scope, contact.id);
  if (own) return own;
  const pipeline = FUNDRAISING_PIPELINE;
  const organization = contact.organization?.trim() || null;
  const base = organization ?? contact.name;
  const named = organization && normalized(contact.name) !== normalized(organization);
  const candidates = [base, ...(named ? [`${contact.name}, ${organization}`] : [])];
  let record: RecordRow | undefined;
  for (const name of candidates) {
    const normalizedName = normalized(name);
    if (!normalizedName) continue;
    const taken = await db.pipelineRecord.findUnique({
      where: { spaceId_userId_pipeline_normalizedName: { ...scope, pipeline, normalizedName } },
      include: { _count: { select: { people: true } } },
    });
    if (taken?._count.people === 0) {
      record = taken;
      break;
    }
    if (taken) continue;
    [record] = await db.pipelineRecord.createManyAndReturn({
      data: { ...scope, pipeline, name, normalizedName },
      skipDuplicates: true,
    });
    if (record) break;
  }
  record ??= (
    await db.pipelineRecord.createManyAndReturn({
      data: {
        ...scope,
        pipeline,
        name: base,
        normalizedName: `${normalized(base)}:${contact.id}`,
      },
    })
  )[0] as RecordRow;
  await db.pipelineRecordPerson.create({
    data: { ...scope, pipeline, recordId: record.id, contactId: contact.id, isPrimary: true },
  });
  return record;
}

/**
 * Adds a contact to one named record of the user: primary if the record has no one primary yet.
 * Throws IsolationError for a record that is not the user's. Call inside a transaction.
 */
export async function joinRecord(
  db: PipelineDb,
  { spaceId, userId }: Scope,
  recordId: string,
  contactId: string,
): Promise<void> {
  const scope = { spaceId, userId };
  const record = await db.pipelineRecord.findFirst({
    where: { id: recordId, ...scope, pipeline: FUNDRAISING_PIPELINE },
    select: { id: true },
  });
  if (!record) throw new IsolationError("Record not found");
  const primary = await db.pipelineRecordPerson.count({ where: { recordId, isPrimary: true } });
  await db.pipelineRecordPerson.create({
    data: {
      ...scope,
      pipeline: FUNDRAISING_PIPELINE,
      recordId,
      contactId,
      isPrimary: primary === 0,
    },
  });
}

/** A save whose parts contradict each other, such as Out on a status other than Passed. */
export class PipelineInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PipelineInputError";
  }
}

export type PipelineChanges = {
  /** A status, or a stage, which keeps the current status when it is already in that stage. */
  status?: PipelineStatus;
  stage?: ContactStage | null;
  amountCents?: number | null;
  nextStep?: string | null;
  /** Replaces the round the status would pick; only a caller that has checked the round's owner. */
  roundId?: string | null;
  waitingSince?: Date | null;
  /** Out moves a record to Passed and clears its next call; In or Maybe on a Passed record restores its earlier status. */
  interest?: PipelineInterest | null;
  nextCallAt?: Date | null;
  nextCallHasTime?: boolean;
  /** A contact of the user, or null; anything else throws IsolationError. */
  referredByContactId?: string | null;
  group?: string | null;
  listOrder?: number | null;
  details?: Prisma.InputJsonValue;
};

/**
 * The only code that writes pipeline fields. Committed joins the open round and any other status
 * leaves it; Committed sets Interest to In and Passed to Out, and leaving Passed clears Out.
 * `guard` narrows the write, for a caller that must not replace a newer value. Returns false when
 * the guard stopped it. Throws IsolationError for a record that is not the user's.
 */
export async function savePipelineRecord(
  db: PipelineDb,
  { spaceId, userId }: Scope,
  id: string,
  changes: PipelineChanges,
  guard: Prisma.PipelineRecordWhereInput = {},
): Promise<boolean> {
  const scope = { spaceId, userId };
  const current = await db.pipelineRecord.findFirst({ where: { id, ...scope } });
  if (!current) throw new IsolationError("Record not found");
  let asked =
    changes.status ??
    (changes.stage === undefined
      ? undefined
      : stageOf(current.status) === (changes.stage ?? "target")
        ? (current.status as PipelineStatus)
        : FIRST_STATUS[changes.stage ?? "target"]);
  const data: Prisma.PipelineRecordUncheckedUpdateManyInput = {};
  // Out and Passed go together: the rule that Out moves to Passed cannot be bypassed.
  if (
    asked &&
    changes.interest !== undefined &&
    (changes.interest === "out") !== (asked === "passed")
  )
    throw new PipelineInputError(
      asked === "passed" ? "Passed goes with Out." : "Out goes with Passed.",
    );
  if (changes.interest === "out" && !asked && current.status !== "passed") {
    asked = "passed";
    data.nextCallAt = null;
    data.nextCallHasTime = false;
  }
  if (
    changes.interest !== undefined &&
    changes.interest !== "out" &&
    !asked &&
    current.status === "passed"
  )
    asked = (current.statusBeforePassed as PipelineStatus | null) ?? "not_reached";
  if (asked) {
    data.status = asked;
    data.roundId = await roundIdForStage(db, scope, stageOf(asked));
    if (asked === "committed") data.interest = "in";
    if (asked === "passed" && current.status !== "passed") {
      data.interest = "out";
      data.statusBeforePassed = current.status;
    }
    if (asked !== "passed" && current.status === "passed") {
      if (current.interest === "out" && asked !== "committed") data.interest = null;
      data.statusBeforePassed = null;
    }
  }
  if (changes.interest !== undefined) data.interest = changes.interest;
  if (changes.nextCallAt !== undefined) data.nextCallAt = changes.nextCallAt;
  if (changes.nextCallHasTime !== undefined) data.nextCallHasTime = changes.nextCallHasTime;
  if (changes.referredByContactId) {
    const referrer = await db.contact.findFirst({
      where: { id: changes.referredByContactId, ...scope },
      select: { id: true },
    });
    if (!referrer) throw new IsolationError("Contact not found");
  }
  if (changes.referredByContactId !== undefined)
    data.referredByContactId = changes.referredByContactId;
  if (changes.roundId !== undefined) data.roundId = changes.roundId;
  if (changes.amountCents !== undefined)
    data.amountCents = changes.amountCents === null ? null : BigInt(changes.amountCents);
  if (changes.nextStep !== undefined) data.nextStep = changes.nextStep;
  if (changes.waitingSince !== undefined) data.waitingSince = changes.waitingSince;
  if (changes.group !== undefined) data.group = changes.group;
  if (changes.listOrder !== undefined) data.listOrder = changes.listOrder;
  if (changes.details !== undefined) data.details = changes.details;
  const { count } = await db.pipelineRecord.updateMany({
    where: { id, ...scope, ...guard },
    data,
  });
  if (count === 0) return false;
  if (asked && asked !== current.status)
    await db.pipelineEvent.create({
      data: {
        ...scope,
        recordId: id,
        kind: "status",
        payload: { from: current.status, to: asked },
      },
    });
  return true;
}

/** After a person leaves a record: the longest-standing person left becomes primary, if none is. */
export async function promoteNextPerson(
  db: Pick<PrismaClient, "pipelineRecordPerson">,
  recordId: string,
): Promise<void> {
  const people = await db.pipelineRecordPerson.findMany({
    where: { recordId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const [first] = people;
  if (first && !people.some((person) => person.isPrimary))
    await db.pipelineRecordPerson.update({ where: { id: first.id }, data: { isPrimary: true } });
}

/** Fields of a contact read from its record; all empty for a contact with no record. */
export const pipelineFields = (record: RecordRow | null) => ({
  stage: record ? stageOf(record.status) : null,
  checkSizeCents: record?.amountCents == null ? null : Number(record.amountCents),
  nextStep: record?.nextStep ?? null,
  roundId: record?.roundId ?? null,
  mercurySentAt: record?.waitingSince?.toISOString() ?? null,
  pipelineRecord: record
    ? {
        id: record.id,
        name: record.name,
        status: record.status as PipelineStatus,
        interest: record.interest as PipelineInterest | null,
        nextCallAt: record.nextCallAt?.toISOString() ?? null,
        nextCallHasTime: record.nextCallHasTime,
        lastContactAt: record.lastContactAt?.toISOString() ?? null,
        group: record.group,
      }
    : null,
});

/**
 * A record with no person yet, as a Fundraising row: `id` is the record's. The row has no email, so
 * Send SAFE and Edit add its first person instead of acting on it.
 */
export const personlessRow = (record: RecordRow): Contact => ({
  id: record.id,
  name: record.name,
  email: null,
  organization: null,
  kind: "prospect",
  notes: null,
  ...pipelineFields(record),
  addedBy: null,
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
});
