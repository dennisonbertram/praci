import type { SourceMeeting } from "@rakazo/contracts";
import { formatMeetingTranscript } from "@rakazo/contracts";
import type { PrismaClient } from "./client.js";
import { Prisma } from "./client.js";
import { IsolationError } from "./scope.js";

type Scope = { spaceId: string; userId: string };
/** Exactly one of the two; the meeting outlives the source row. */
export type MeetingSourceRef = { connectionId: string } | { mcpServerId: string };
export type UpsertMeetingResult = "created" | "updated" | "stale" | "tombstoned";

/** Only space and user: callers may pass a whole actor, which must not reach a query. */
const ownerOf = ({ spaceId, userId }: Scope): Scope => ({ spaceId, userId });

function sourceColumns(source: MeetingSourceRef) {
  const connectionId = "connectionId" in source ? source.connectionId : null;
  const mcpServerId = "mcpServerId" in source ? source.mcpServerId : null;
  if ((connectionId === null) === (mcpServerId === null)) {
    throw new Error("A meeting needs exactly one source");
  }
  return { connectionId, mcpServerId };
}

/**
 * Idempotent by (space, user, provider, externalId). A newer source update replaces the row,
 * an older or equal one is ignored, and a meeting the user deleted stays deleted.
 */
export async function upsertMeeting(
  prisma: PrismaClient,
  scope: Scope,
  source: MeetingSourceRef,
  provider: string,
  meeting: SourceMeeting,
): Promise<UpsertMeetingResult> {
  const owner = ownerOf(scope);
  const columns = sourceColumns(source);
  const key = { ...owner, provider, externalId: meeting.externalId };
  if (
    await prisma.meetingTombstone.findUnique({ where: { spaceId_userId_provider_externalId: key } })
  ) {
    return "tombstoned";
  }
  const existing = await prisma.meeting.findUnique({
    where: { spaceId_userId_provider_externalId: key },
    select: { sourceUpdatedAt: true },
  });
  const sourceUpdatedAt = new Date(meeting.updatedAt);
  if (existing && existing.sourceUpdatedAt >= sourceUpdatedAt) return "stale";
  const data = {
    ...columns,
    title: meeting.title,
    startedAt: new Date(meeting.startedAt),
    endedAt: meeting.endedAt ? new Date(meeting.endedAt) : null,
    attendees: meeting.attendees.map((a) => ({ ...a, email: a.email?.toLowerCase() })),
    organizerEmail: meeting.organizerEmail,
    sourceUrl: meeting.sourceUrl,
    folders: meeting.folders,
    summary: meeting.summary,
    privateNotes: meeting.privateNotes,
    sourceUpdatedAt,
    deletedAt: meeting.deleted ? new Date() : null,
    // A listing-only update has no transcript; keep the one already stored.
    ...(meeting.transcript
      ? { transcript: formatMeetingTranscript(meeting.transcript), transcriptIndexed: true }
      : {}),
  };
  await prisma.meeting.upsert({
    where: { spaceId_userId_provider_externalId: key },
    create: { ...key, ...data },
    update: data,
  });
  return existing ? "updated" : "created";
}

export type MeetingFilter = {
  text?: string;
  from?: Date;
  to?: Date;
  attendeeEmail?: string;
  folder?: string;
  provider?: string;
  limit?: number;
};

/**
 * The user's meetings, newest first (best match first with `text`). Always scoped to space and
 * user, and never returns a row a provider marked deleted.
 */
export async function listMeetings(prisma: PrismaClient, scope: Scope, filter: MeetingFilter = {}) {
  const { spaceId, userId } = ownerOf(scope);
  const text = filter.text?.trim();
  const where = [
    Prisma.sql`"spaceId" = ${spaceId}`,
    Prisma.sql`"userId" = ${userId}`,
    Prisma.sql`"deletedAt" IS NULL`,
  ];
  if (text) where.push(Prisma.sql`"tsv" @@ websearch_to_tsquery('english', ${text})`);
  if (filter.from) where.push(Prisma.sql`"startedAt" >= ${filter.from}`);
  if (filter.to) where.push(Prisma.sql`"startedAt" < ${filter.to}`);
  if (filter.provider) where.push(Prisma.sql`"provider" = ${filter.provider}`);
  if (filter.folder) where.push(Prisma.sql`${filter.folder} = ANY("folders")`);
  if (filter.attendeeEmail) {
    where.push(
      Prisma.sql`"attendees" @> jsonb_build_array(jsonb_build_object('email', ${filter.attendeeEmail.toLowerCase()}::text))`,
    );
  }
  const order = text
    ? Prisma.sql`ts_rank("tsv", websearch_to_tsquery('english', ${text})) DESC, "startedAt" DESC`
    : Prisma.sql`"startedAt" DESC`;
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
  const ids = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`SELECT "id" FROM "meetings" WHERE ${Prisma.join(where, " AND ")} ORDER BY ${order} LIMIT ${limit}`,
  );
  const rows = await prisma.meeting.findMany({
    where: { id: { in: ids.map((r) => r.id) }, spaceId, userId },
  });
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap(({ id }) => byId.get(id) ?? []);
}

export const searchMeetings = (
  prisma: PrismaClient,
  scope: Scope,
  text: string,
  filter: Omit<MeetingFilter, "text"> = {},
) => listMeetings(prisma, scope, { ...filter, text });

/** One of the user's meetings, or null. */
export function getMeeting(prisma: PrismaClient, scope: Scope, id: string) {
  return prisma.meeting.findFirst({ where: { id, ...ownerOf(scope), deletedAt: null } });
}

/**
 * The user deletes a meeting: it, its Inbox to-dos and a tombstone (so sync does not bring it
 * back) change together.
 */
export async function deleteMeeting(prisma: PrismaClient, scope: Scope, id: string) {
  const owner = ownerOf(scope);
  await prisma.$transaction(async (tx) => {
    const meeting = await tx.meeting.findFirst({
      where: { id, ...owner },
      select: { provider: true, externalId: true },
    });
    if (!meeting) throw new IsolationError();
    const key = { ...owner, provider: meeting.provider, externalId: meeting.externalId };
    await tx.inboxTodo.deleteMany({ where: { meetingId: id, ...owner } });
    await tx.meetingTombstone.upsert({
      where: { spaceId_userId_provider_externalId: key },
      create: key,
      update: {},
    });
    await tx.meeting.delete({ where: { id } });
  });
}

const syncKey = (source: MeetingSourceRef) =>
  "connectionId" in source
    ? { connectionId: source.connectionId }
    : { mcpServerId: source.mcpServerId };

/** The sync state of one source, scoped to its owner. */
export function getMeetingSyncState(prisma: PrismaClient, scope: Scope, source: MeetingSourceRef) {
  return prisma.meetingSyncState.findFirst({ where: { ...syncKey(source), ...ownerOf(scope) } });
}

export type MeetingSyncPatch = Partial<
  Pick<
    Prisma.MeetingSyncStateUncheckedUpdateInput,
    | "externalAccountId"
    | "cursor"
    | "syncedThrough"
    | "claimedAt"
    | "claimToken"
    | "lastSyncedAt"
    | "error"
  >
>;

/** Creates the source's sync state or applies the patch to it. */
export async function upsertMeetingSyncState(
  prisma: PrismaClient,
  scope: Scope,
  source: MeetingSourceRef,
  provider: string,
  patch: MeetingSyncPatch = {},
) {
  const owner = ownerOf(scope);
  const existing = await getMeetingSyncState(prisma, owner, source);
  if (existing) {
    return prisma.meetingSyncState.update({ where: { id: existing.id }, data: patch });
  }
  return prisma.meetingSyncState.create({
    data: {
      ...owner,
      ...sourceColumns(source),
      ...(patch as Prisma.MeetingSyncStateUncheckedCreateInput),
      provider,
    },
  });
}
