import type { AuditRequest } from "@rakazo/contracts";
import type { Prisma, PrismaClient } from "./client.js";
import { IsolationError } from "./scope.js";

type Scope = { spaceId: string; userId: string };
/** Only space and user: callers may pass a whole actor, which must not reach a Prisma query. */
const ownerOf = ({ spaceId, userId }: Scope): Scope => ({ spaceId, userId });
type Db = Pick<PrismaClient, "auditRequest" | "$transaction">;
type Row = Prisma.AuditRequestGetPayload<object>;

/** Drafting runs the intake job may start per user per day; the Draft reply button is not capped. */
export const AUDIT_DRAFTS_PER_DAY = 10;
/** A drafting run that started this recently is still going, so Draft reply is hidden. */
export const AUDIT_DRAFTING_MS = 10 * 60_000;

/** How the agent's upsert finds the same request again: case and spacing do not matter. */
export const normalizeFund = (fund: string) => fund.trim().replace(/\s+/g, " ").toLowerCase();

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
const toDate = (value: string | null | undefined) =>
  value === undefined ? undefined : value === null ? null : new Date(`${value}T00:00:00.000Z`);

export function auditRequestOut(row: Row, now = new Date()): AuditRequest {
  return {
    id: row.id,
    fund: row.fund,
    asOf: day(row.asOf),
    asOfMatched: row.asOfMatched,
    dueDate: day(row.dueDate),
    status: row.status as AuditRequest["status"],
    mailThreadId: row.mailThreadId,
    connectionId: row.connectionId,
    draftRef: row.draftRef,
    senderKnown: row.senderKnown,
    notes: row.notes,
    dataRoomItemId: row.dataRoomItemId,
    drafting:
      row.status === "open" &&
      row.draftStartedAt !== null &&
      now.getTime() - row.draftStartedAt.getTime() < AUDIT_DRAFTING_MS,
    newMail: row.draftedAt !== null && row.lastMailAt > row.draftedAt,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Due date first (rows without one last), then newest. */
function byDueThenNewest(a: Row, b: Row): number {
  if (a.dueDate && b.dueDate && a.dueDate.getTime() !== b.dueDate.getTime())
    return a.dueDate.getTime() - b.dueDate.getTime();
  if (!!a.dueDate !== !!b.dueDate) return a.dueDate ? -1 : 1;
  return b.createdAt.getTime() - a.createdAt.getTime();
}

/** Open and drafted requests; `includeDone` adds the done ones. Dismissed rows are never listed. */
export async function listAuditRequests(
  prisma: Pick<PrismaClient, "auditRequest">,
  scope: Scope,
  includeDone = false,
  now = new Date(),
): Promise<AuditRequest[]> {
  const rows = await prisma.auditRequest.findMany({
    where: {
      ...ownerOf(scope),
      status: { in: includeDone ? ["open", "drafted", "done"] : ["open", "drafted"] },
    },
  });
  return rows.sort(byDueThenNewest).map((row) => auditRequestOut(row, now));
}

export type AuditMailInput = {
  fund: string;
  mailThreadId: string;
  connectionId: string;
  senderKnown: boolean;
  dataRoomItemId: string | null;
  receivedAt: Date;
};

/**
 * Files one arriving message. A message in a thread that already has a row (open, done or dismissed)
 * only moves `lastMailAt` forward, so a closed row is never reopened and a reminder never adds a row.
 * `created` is false for such a message.
 */
export async function fileAuditRequestFromMail(
  prisma: Pick<PrismaClient, "auditRequest">,
  scope: Scope,
  input: AuditMailInput,
): Promise<{ id: string; created: boolean }> {
  const where = { ...ownerOf(scope), mailThreadId: input.mailThreadId };
  const touch = async () => {
    const known = await prisma.auditRequest.findFirst({ where, select: { id: true } });
    if (!known) return null;
    await prisma.auditRequest.updateMany({
      where: { ...where, lastMailAt: { lt: input.receivedAt } },
      data: { lastMailAt: input.receivedAt },
    });
    return { id: known.id, created: false };
  };
  const existing = await touch();
  if (existing) return existing;
  try {
    const row = await prisma.auditRequest.create({
      data: {
        ...ownerOf(scope),
        fund: input.fund,
        fundKey: normalizeFund(input.fund),
        mailThreadId: input.mailThreadId,
        connectionId: input.connectionId,
        senderKnown: input.senderKnown,
        dataRoomItemId: input.dataRoomItemId,
        lastMailAt: input.receivedAt,
      },
      select: { id: true },
    });
    return { id: row.id, created: true };
  } catch (error) {
    // Two messages of one thread filed at once: the unique thread key lets one win.
    const raced = (error as { code?: string }).code === "P2002" ? await touch() : null;
    if (raced) return raced;
    throw error;
  }
}

/**
 * Takes the right to start one drafting run for an open row, under a per-user lock so concurrent
 * intakes cannot pass `dailyLimit`. `dailyLimit` null means no cap (the Draft reply button).
 * False when the row is not open, a run is still going, or the day's limit is used.
 * ponytail: the day is the UTC day; use the account time zone if that matters.
 */
export async function claimAuditDraft(
  prisma: Db,
  scope: Scope,
  id: string,
  dailyLimit: number | null,
  now = new Date(),
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('audit-draft'), hashtext(${`${scope.spaceId}:${scope.userId}`}))`;
    if (dailyLimit !== null) {
      const startOfDay = new Date(now);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const started = await tx.auditRequest.count({
        where: { ...ownerOf(scope), draftStartedAt: { gte: startOfDay } },
      });
      if (started >= dailyLimit) return false;
    }
    const { count } = await tx.auditRequest.updateMany({
      where: {
        id,
        ...ownerOf(scope),
        status: "open",
        OR: [
          { draftStartedAt: null },
          { draftStartedAt: { lt: new Date(now.getTime() - AUDIT_DRAFTING_MS) } },
        ],
      },
      data: { draftStartedAt: now },
    });
    return count === 1;
  });
}

/** Gives the claim back after the run could not be started, so the row can try again. */
export async function releaseAuditDraft(
  prisma: Pick<PrismaClient, "auditRequest">,
  scope: Scope,
  id: string,
): Promise<void> {
  await prisma.auditRequest.updateMany({
    where: { id, ...ownerOf(scope) },
    data: { draftStartedAt: null },
  });
}

export async function getAuditRequest(
  prisma: Pick<PrismaClient, "auditRequest">,
  scope: Scope,
  id: string,
): Promise<AuditRequest> {
  const row = await prisma.auditRequest.findFirst({ where: { id, ...ownerOf(scope) } });
  if (!row) throw new IsolationError("Audit request not found");
  return auditRequestOut(row);
}

export type AuditUpsertInput = {
  id?: string;
  fund?: string;
  asOf?: string | null;
  asOfMatched?: boolean;
  dueDate?: string | null;
  notes?: string;
  draftRef?: string | null;
  dataRoomItemId?: string | null;
  /** The agent finished the Gmail draft: open becomes drafted. Nothing moves back. */
  drafted?: boolean;
};

/**
 * The agent's write. With an id it corrects that row (a done or dismissed row is returned as it is).
 * Without one it returns the open or drafted row with the same fund and as-of date, or adds a row
 * for a request that did not arrive by mail.
 */
export async function upsertAuditRequest(
  prisma: Pick<PrismaClient, "auditRequest">,
  scope: Scope,
  input: AuditUpsertInput,
  now = new Date(),
): Promise<{ request: AuditRequest; created: boolean }> {
  const fields = {
    ...(input.fund ? { fund: input.fund.trim(), fundKey: normalizeFund(input.fund) } : {}),
    ...(input.asOf !== undefined ? { asOf: toDate(input.asOf) } : {}),
    ...(input.asOfMatched !== undefined ? { asOfMatched: input.asOfMatched } : {}),
    ...(input.dueDate !== undefined ? { dueDate: toDate(input.dueDate) } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    ...(input.draftRef !== undefined ? { draftRef: input.draftRef } : {}),
    ...(input.dataRoomItemId !== undefined ? { dataRoomItemId: input.dataRoomItemId } : {}),
  };
  if (input.id) {
    const where = { id: input.id, ...ownerOf(scope), status: { in: ["open", "drafted"] } };
    await prisma.auditRequest.updateMany({ where, data: fields });
    if (input.drafted)
      await prisma.auditRequest.updateMany({
        where: { ...where, status: "open" },
        data: { status: "drafted", draftedAt: now },
      });
    return { request: await getAuditRequest(prisma, scope, input.id), created: false };
  }
  const fund = input.fund?.trim();
  if (!fund) throw new Error("fund is required");
  const asOf = toDate(input.asOf ?? null) ?? null;
  const same = await prisma.auditRequest.findFirst({
    where: {
      ...ownerOf(scope),
      fundKey: normalizeFund(fund),
      asOf,
      status: { in: ["open", "drafted"] },
    },
  });
  if (same) return { request: auditRequestOut(same, now), created: false };
  const row = await prisma.auditRequest.create({
    data: {
      ...ownerOf(scope),
      ...fields,
      fund,
      fundKey: normalizeFund(fund),
      lastMailAt: now,
      ...(input.drafted ? { status: "drafted", draftedAt: now } : {}),
    },
  });
  return { request: auditRequestOut(row, now), created: true };
}

/** Mark done or Dismiss. Only an open or drafted row closes; a closed one is returned unchanged. */
export async function closeAuditRequest(
  prisma: Pick<PrismaClient, "auditRequest">,
  scope: Scope,
  id: string,
  status: "done" | "dismissed",
  now = new Date(),
): Promise<AuditRequest> {
  await prisma.auditRequest.updateMany({
    where: { id, ...ownerOf(scope), status: { in: ["open", "drafted"] } },
    data: { status, doneAt: now },
  });
  return getAuditRequest(prisma, scope, id);
}
