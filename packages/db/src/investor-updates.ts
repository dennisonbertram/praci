import type {
  InvestorAudience,
  InvestorDeliveryState,
  InvestorUpdate,
  InvestorUpdateSaveInput,
  InvestorUpdateStatus,
} from "@rakazo/contracts";
import type { Prisma, PrismaClient } from "./client.js";
import { IsolationError } from "./scope.js";

type Scope = { spaceId: string; userId: string };
/** Only space and user: callers may pass a whole actor, which must not reach a Prisma query. */
const ownerOf = ({ spaceId, userId }: Scope): Scope => ({ spaceId, userId });
type Db = Pick<PrismaClient, "investorUpdate" | "contact" | "composeSend" | "space">;

/** A sending update with no recorded movement for this long is shown as Partly sent. */
export const SENDING_STALE_MS = 10 * 60_000;

/** Raised when a sent (or sending) update is edited or deleted. */
export class InvestorUpdateLockedError extends Error {
  constructor(message = "A sent update cannot be changed.") {
    super(message);
    this.name = "InvestorUpdateLockedError";
  }
}

/** One send attempt to one contact. Its outcome is the ComposeSend row named by `attemptKey`. */
type Attempt = { n: number; at: string; delivered?: true };
type Deliveries = Record<string, Attempt[]>;

/** The idempotency key of attempt n: the `clientId` of its ComposeSend row. */
export const attemptKey = (updateId: string, contactId: string, n: number) =>
  `${updateId}:${contactId}:${n}`;

const deliveriesOf = (row: { deliveries: Prisma.JsonValue }): Deliveries =>
  row.deliveries && typeof row.deliveries === "object" && !Array.isArray(row.deliveries)
    ? (row.deliveries as unknown as Deliveries)
    : {};

type Row = Prisma.InvestorUpdateGetPayload<object>;

/** The audience's contact kind: investor updates go to investors, board updates to the board. */
const kindOf = (audience: string) => (audience === "board" ? "board" : "investor");

const isStale = (row: Pick<Row, "updatedAt">, now: Date) =>
  now.getTime() - row.updatedAt.getTime() > SENDING_STALE_MS;

/** What each recipient's last attempt amounts to. `composeStates` maps attempt keys to ComposeSend states. */
export function deliveryStates(
  row: Row,
  composeStates: ReadonlyMap<string, string>,
  now: Date,
): Map<string, InvestorDeliveryState> {
  const states = new Map<string, InvestorDeliveryState>();
  if (row.status === "draft" || row.status === "posted") return states;
  const live = row.status === "sending" && !isStale(row, now);
  const deliveries = deliveriesOf(row);
  for (const contactId of row.recipientContactIds) {
    const last = deliveries[contactId]?.at(-1);
    if (!last) {
      // Never attempted: still waiting its turn while the loop runs, otherwise it failed to start.
      states.set(contactId, live ? "sending" : "failed");
      continue;
    }
    if (last.delivered) {
      states.set(contactId, "sent");
      continue;
    }
    const state = composeStates.get(attemptKey(row.id, contactId, last.n));
    if (state === "sent") states.set(contactId, "sent");
    else if (state === "failed" || state === "abandoned") states.set(contactId, "failed");
    else if (state === "unknown") states.set(contactId, "unknown");
    // No row yet, or one still pending: the loop is on it, unless the process that held it is gone.
    else states.set(contactId, live ? "sending" : "unknown");
  }
  return states;
}

export function statusOf(
  row: Row,
  states: ReadonlyMap<string, InvestorDeliveryState>,
  now: Date,
): InvestorUpdateStatus {
  if (row.status === "draft" || row.status === "posted") return row.status;
  if (row.status === "sending" && !isStale(row, now)) return "sending";
  const values = [...states.values()];
  return values.some((s) => s === "failed" || s === "unknown" || s === "sending")
    ? "partly_sent"
    : "sent";
}

async function composeStatesFor(
  prisma: Db,
  scope: Scope,
  rows: readonly Row[],
): Promise<Map<string, string>> {
  const keys = rows.flatMap((row) =>
    row.status === "draft" || row.status === "posted"
      ? []
      : Object.entries(deliveriesOf(row)).flatMap(([contactId, attempts]) =>
          attempts.map((a) => attemptKey(row.id, contactId, a.n)),
        ),
  );
  if (keys.length === 0) return new Map();
  const found = await prisma.composeSend.findMany({
    where: { ...scope, clientId: { in: keys } },
    select: { clientId: true, state: true },
  });
  return new Map(found.map((c) => [c.clientId, c.state]));
}

async function toViews(
  prisma: Db,
  scope: Scope,
  rows: readonly Row[],
  now: Date,
): Promise<InvestorUpdate[]> {
  const composeStates = await composeStatesFor(prisma, scope, rows);
  const contactIds = [...new Set(rows.flatMap((row) => row.recipientContactIds))];
  const contacts = contactIds.length
    ? await prisma.contact.findMany({
        where: { ...scope, id: { in: contactIds } },
        select: { id: true, name: true },
      })
    : [];
  const names = new Map(contacts.map((c) => [c.id, c.name]));
  return rows.map((row) => {
    const states = deliveryStates(row, composeStates, now);
    return {
      id: row.id,
      audience: row.audience as InvestorAudience,
      subject: row.subject,
      period: row.period,
      body: row.body,
      status: statusOf(row, states, now),
      recipientContactIds: row.recipientContactIds,
      fromConnectionId: row.fromConnectionId,
      deliveries: [...states].map(([contactId, state]) => ({
        contactId,
        name: names.get(contactId) ?? "Removed contact",
        state,
      })),
      sentAt: row.sentAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

async function ownRow(prisma: Db, scope: Scope, id: string): Promise<Row> {
  const row = await prisma.investorUpdate.findFirst({ where: { id, ...scope } });
  if (!row) throw new IsolationError();
  return row;
}

/** Every update, newest first; a sent update ranks by when it went out. */
export async function listInvestorUpdates(
  prisma: Db,
  actor: Scope,
  now = new Date(),
): Promise<InvestorUpdate[]> {
  const scope = ownerOf(actor);
  const rows = await prisma.investorUpdate.findMany({
    where: scope,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
  // Stable sort keeps the createdAt order among equal keys.
  const at = (r: Row) => (r.sentAt ?? r.createdAt).getTime();
  return toViews(
    prisma,
    scope,
    rows.sort((a, b) => at(b) - at(a)),
    now,
  );
}

/** One update; IsolationError when it is not the user's. */
export async function getInvestorUpdate(
  prisma: Db,
  actor: Scope,
  id: string,
  now = new Date(),
): Promise<InvestorUpdate> {
  const scope = ownerOf(actor);
  const [view] = await toViews(prisma, scope, [await ownRow(prisma, scope, id)], now);
  return view as InvestorUpdate;
}

/** The previous calendar month as YYYY-MM, in UTC. */
export function previousPeriod(now: Date): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Only contacts of the audience's kind that belong to the user can be recipients. */
async function ownRecipients(
  prisma: Db,
  scope: Scope,
  audience: string,
  ids: readonly string[],
): Promise<string[]> {
  if (ids.length === 0) return [];
  const found = await prisma.contact.findMany({
    where: { ...scope, id: { in: [...ids] }, kind: kindOf(audience) },
    select: { id: true },
  });
  const ok = new Set(found.map((c) => c.id));
  return ids.filter((id, i) => ok.has(id) && ids.indexOf(id) === i);
}

/**
 * Adds a draft (no `id`) or saves one. A new draft defaults to every contact of the audience that has
 * an email, the subject "<Company> · <Period> update" and the previous month. Only a draft can change.
 */
export async function saveInvestorUpdate(
  prisma: Db,
  actor: Scope,
  input: InvestorUpdateSaveInput,
  now = new Date(),
): Promise<InvestorUpdate> {
  const scope = ownerOf(actor);
  if (!input.id) {
    if (!input.audience) throw new Error("An audience is required for a new update.");
    const audience = input.audience;
    const period = input.period ?? previousPeriod(now);
    const space = await prisma.space.findUnique({
      where: { id: scope.spaceId },
      select: { name: true },
    });
    const recipients = input.recipientContactIds
      ? await ownRecipients(prisma, scope, audience, input.recipientContactIds)
      : (
          await prisma.contact.findMany({
            where: { ...scope, kind: kindOf(audience), email: { not: null } },
            select: { id: true },
            orderBy: [{ name: "asc" }, { id: "asc" }],
          })
        ).map((c) => c.id);
    const row = await prisma.investorUpdate.create({
      data: {
        ...scope,
        audience,
        period,
        subject: input.subject || `${space?.name ?? "Company"} · ${period} update`,
        body: input.body ?? "",
        recipientContactIds: recipients,
        fromConnectionId: input.fromConnectionId ?? null,
      },
    });
    return getInvestorUpdate(prisma, scope, row.id, now);
  }
  const existing = await ownRow(prisma, scope, input.id);
  const recipients = input.recipientContactIds
    ? await ownRecipients(prisma, scope, existing.audience, input.recipientContactIds)
    : undefined;
  // The status check is part of the write, so a send that starts meanwhile wins.
  const { count } = await prisma.investorUpdate.updateMany({
    where: { id: existing.id, ...scope, status: "draft" },
    data: {
      ...(input.subject === undefined ? {} : { subject: input.subject }),
      ...(input.period === undefined ? {} : { period: input.period }),
      ...(input.body === undefined ? {} : { body: input.body }),
      ...(recipients === undefined ? {} : { recipientContactIds: recipients }),
      ...(input.fromConnectionId === undefined ? {} : { fromConnectionId: input.fromConnectionId }),
    },
  });
  if (count === 0) throw new InvestorUpdateLockedError();
  return getInvestorUpdate(prisma, scope, existing.id, now);
}

/** A new draft with the same audience, subject, period, body and recipients. */
export async function duplicateInvestorUpdate(
  prisma: Db,
  actor: Scope,
  id: string,
  now = new Date(),
): Promise<InvestorUpdate> {
  const scope = ownerOf(actor);
  const source = await ownRow(prisma, scope, id);
  const row = await prisma.investorUpdate.create({
    data: {
      ...scope,
      audience: source.audience,
      subject: source.subject,
      period: source.period,
      body: source.body,
      recipientContactIds: source.recipientContactIds,
      fromConnectionId: source.fromConnectionId,
    },
  });
  return getInvestorUpdate(prisma, scope, row.id, now);
}

/** Deletes a draft or a finished update; one still sending cannot be deleted. */
export async function deleteInvestorUpdate(
  prisma: Db,
  actor: Scope,
  id: string,
  now = new Date(),
): Promise<void> {
  const scope = ownerOf(actor);
  const row = await ownRow(prisma, scope, id);
  const { count } = await prisma.investorUpdate.deleteMany({
    where: {
      id: row.id,
      ...scope,
      OR: [
        { status: { not: "sending" } },
        { updatedAt: { lt: new Date(now.getTime() - SENDING_STALE_MS) } },
      ],
    },
  });
  if (count === 0) throw new InvestorUpdateLockedError("This update is still sending.");
}

/**
 * Draft to sending, once: the update's recipients are the ones ticked, narrowed to contacts of the
 * audience. Returns the row, or null when another request already started the send.
 */
export async function claimInvestorUpdateSend(
  prisma: Db,
  actor: Scope,
  id: string,
): Promise<Row | null> {
  const scope = ownerOf(actor);
  const { count } = await prisma.investorUpdate.updateMany({
    where: { id, ...scope, status: "draft" },
    data: { status: "sending" },
  });
  return count === 0 ? null : prisma.investorUpdate.findFirst({ where: { id, ...scope } });
}

/** Narrows a claimed update's recipients, so ones that cannot be emailed never wait forever. */
export async function setInvestorUpdateRecipients(
  prisma: Db,
  actor: Scope,
  id: string,
  recipientContactIds: readonly string[],
): Promise<void> {
  await prisma.investorUpdate.updateMany({
    where: { id, ...ownerOf(actor), status: "sending" },
    data: { recipientContactIds: [...recipientContactIds] },
  });
}

/**
 * Starts a retry: a sent update, or one that stopped sending, goes back to sending. Returns the
 * recipients to send to (failed ones, and Unknown ones only when `resendUnknown`), or null when a send
 * is running or the claim was lost.
 */
export async function claimInvestorUpdateRetry(
  prisma: Db,
  actor: Scope,
  id: string,
  options: { contactIds?: readonly string[]; resendUnknown?: boolean },
  now = new Date(),
): Promise<{ row: Row; contactIds: string[] } | null> {
  const scope = ownerOf(actor);
  const row = await ownRow(prisma, scope, id);
  if (row.status === "draft") return null;
  const states = deliveryStates(row, await composeStatesFor(prisma, scope, [row]), now);
  const wanted = options.contactIds ? new Set(options.contactIds) : null;
  const targets = [...states]
    .filter(
      ([contactId, state]) =>
        (!wanted || wanted.has(contactId)) &&
        (state === "failed" || (state === "unknown" && options.resendUnknown === true)),
    )
    .map(([contactId]) => contactId);
  if (targets.length === 0) return null;
  const { count } = await prisma.investorUpdate.updateMany({
    where: {
      id,
      ...scope,
      updatedAt: row.updatedAt,
      // A send still moving owns the update; only a finished or stalled one can be retried.
      OR: [
        { status: "sent" },
        { status: "sending", updatedAt: { lt: new Date(now.getTime() - SENDING_STALE_MS) } },
      ],
    },
    data: { status: "sending" },
  });
  if (count === 0) return null;
  return { row: (await ownRow(prisma, scope, id)) as Row, contactIds: targets };
}

/**
 * Records that attempt n is about to be made, before the message goes out, and returns n. The result
 * is recorded by the send itself in its ComposeSend row under `attemptKey(id, contactId, n)`.
 */
export async function recordInvestorAttempt(
  prisma: Db,
  actor: Scope,
  id: string,
  contactId: string,
  now = new Date(),
): Promise<number> {
  const scope = ownerOf(actor);
  const row = await ownRow(prisma, scope, id);
  const deliveries = deliveriesOf(row);
  const n = (deliveries[contactId]?.length ?? 0) + 1;
  deliveries[contactId] = [...(deliveries[contactId] ?? []), { n, at: now.toISOString() }];
  await prisma.investorUpdate.updateMany({
    where: { id, ...scope, status: "sending" },
    data: { deliveries: deliveries as unknown as Prisma.InputJsonValue },
  });
  return n;
}

/** Ends the send loop: the update is sent (Partly sent is derived from the deliveries). */
export async function finishInvestorUpdateSend(
  prisma: Db,
  actor: Scope,
  id: string,
  now = new Date(),
): Promise<void> {
  const scope = ownerOf(actor);
  const row = await ownRow(prisma, scope, id);
  await prisma.investorUpdate.updateMany({
    where: { id, ...scope, status: "sending" },
    data: { status: "sent", sentAt: row.sentAt ?? now },
  });
}

/**
 * Records every Unknown recipient as Sent. A sending update that stopped moving becomes sent, since
 * nothing is left to wait for.
 */
export async function markInvestorUpdateDelivered(
  prisma: Db,
  actor: Scope,
  id: string,
  contactIds?: readonly string[],
  now = new Date(),
): Promise<InvestorUpdate> {
  const scope = ownerOf(actor);
  const row = await ownRow(prisma, scope, id);
  const states = deliveryStates(row, await composeStatesFor(prisma, scope, [row]), now);
  const deliveries = deliveriesOf(row);
  for (const [contactId, state] of states) {
    if (contactIds && !contactIds.includes(contactId)) continue;
    const attempts = deliveries[contactId];
    const last = attempts?.at(-1);
    if (state === "unknown" && attempts && last)
      attempts[attempts.length - 1] = { ...last, delivered: true };
  }
  await prisma.investorUpdate.updateMany({
    where: { id, ...scope, status: { not: "draft" }, updatedAt: row.updatedAt },
    data: {
      deliveries: deliveries as unknown as Prisma.InputJsonValue,
      ...(row.status === "sending" && isStale(row, now)
        ? { status: "sent", sentAt: row.sentAt ?? now }
        : {}),
    },
  });
  return getInvestorUpdate(prisma, scope, id, now);
}

/**
 * Post to portal: an investors draft becomes Posted, visible to every investor contact with portal
 * access, with no email. Returns null when the update is not a draft (a second call changes nothing).
 */
export async function claimInvestorUpdatePost(
  prisma: Db,
  actor: Scope,
  id: string,
  now = new Date(),
): Promise<InvestorUpdate | null> {
  const scope = ownerOf(actor);
  const row = await ownRow(prisma, scope, id);
  if (row.audience !== "investors")
    throw new InvestorUpdateLockedError("Only investor updates can be posted.");
  const { count } = await prisma.investorUpdate.updateMany({
    where: { id, ...scope, audience: "investors", status: "draft" },
    data: { status: "posted", sentAt: now },
  });
  return count === 0 ? null : getInvestorUpdate(prisma, scope, id, now);
}
