import { createHash } from "node:crypto";
import type {
  AdapterContext,
  ArtifactStore,
  BackgroundJobPayloads,
  ContactPhotoSource,
  JobPublisher,
} from "@rakazo/adapter-kit";
import { contactPhotosJob } from "@rakazo/adapter-kit";
import type { Prisma, PrismaClient } from "@rakazo/db";
import { CONTACTS_OTHER_READONLY, CONTACTS_READONLY } from "./google-connector.js";

export const PHOTO_MAX_BYTES = 200 * 1024;
const REFRESH_MS = 24 * 60 * 60 * 1000;
/** ponytail: photos are fetched one at a time and capped per run; parallel downloads if big address books matter. */
const MAX_PHOTOS_PER_RUN = 2000;
const JOB_TIMEOUT_MS = 10 * 60 * 1000;

const SIGNATURES: Array<{ type: string; matches: (b: Uint8Array) => boolean }> = [
  { type: "image/jpeg", matches: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    type: "image/png",
    matches: (b) => [0x89, 0x50, 0x4e, 0x47].every((byte, i) => b[i] === byte),
  },
  {
    type: "image/webp",
    matches: (b) =>
      String.fromCharCode(...b.subarray(0, 4)) === "RIFF" &&
      String.fromCharCode(...b.subarray(8, 12)) === "WEBP",
  },
];

/** The image type when the declared type is allowed, the size is within the cap and the bytes agree. */
export function checkPhoto(image: { bytes: Uint8Array; contentType: string }): string | null {
  if (image.bytes.byteLength === 0 || image.bytes.byteLength > PHOTO_MAX_BYTES) return null;
  const sniffed = SIGNATURES.find((s) => s.matches(image.bytes))?.type;
  return sniffed && sniffed === image.contentType ? sniffed : null;
}

/** Whether the connection's grant includes a contacts scope; accounts connected earlier read as no. */
function hasContactsScope(metadata: unknown): boolean {
  const scope = (metadata as { scope?: unknown } | null)?.scope;
  const granted = typeof scope === "string" ? scope.split(" ") : [];
  return granted.includes(CONTACTS_READONLY) || granted.includes(CONTACTS_OTHER_READONLY);
}

/**
 * Queues a photo fetch for each of the user's connected Google accounts that were granted a contacts
 * scope and were not fetched within the day. Called when contacts are listed; the job is deduplicated.
 */
export async function requestContactPhotos(
  deps: { prisma: PrismaClient; jobs: JobPublisher },
  scope: { spaceId: string; userId: string },
  now: Date = new Date(),
): Promise<void> {
  const rows = await deps.prisma.connection.findMany({
    where: {
      ...scope,
      connectorId: "google",
      status: "connected",
      provider: { equals: "gmail", mode: "insensitive" },
    },
    select: { id: true, metadata: true, contactPhotoSync: { select: { fetchedAt: true } } },
  });
  for (const row of rows) {
    const fetchedAt = row.contactPhotoSync?.fetchedAt;
    if (
      !hasContactsScope(row.metadata) ||
      (fetchedAt && now.getTime() - fetchedAt.getTime() < REFRESH_MS)
    )
      continue;
    await deps.jobs.enqueue(contactPhotosJob({ ...scope, connectionId: row.id }));
  }
}

/**
 * Run in the transaction that revokes a Google login: forgets its fetch state and, when no other
 * connected Google login can still read contacts, deletes the user's Google photo rows. Returns the
 * blob keys the caller must delete after the commit.
 */
export async function deleteContactPhotosForConnection(
  tx: Prisma.TransactionClient,
  scope: { spaceId: string; userId: string; connectionId: string },
): Promise<string[]> {
  const { spaceId, userId, connectionId } = scope;
  await tx.contactPhotoSync.deleteMany({
    where: { connectionId, connection: { spaceId, userId } },
  });
  if (await otherContactsLogin(tx, scope)) return [];
  const where = { spaceId, userId, source: "google" };
  const rows = await tx.contactPhoto.findMany({ where, select: { storageKey: true } });
  await tx.contactPhoto.deleteMany({ where });
  return rows.map((row) => row.storageKey);
}

/** Another connected Google login of the user that can read contacts, so shared photo rows stay. */
async function otherContactsLogin(
  db: Pick<Prisma.TransactionClient, "connection">,
  scope: { spaceId: string; userId: string; connectionId: string },
): Promise<boolean> {
  const others = await db.connection.findMany({
    where: {
      spaceId: scope.spaceId,
      userId: scope.userId,
      connectorId: "google",
      status: "connected",
      provider: { equals: "gmail", mode: "insensitive" },
      id: { not: scope.connectionId },
    },
    select: { metadata: true },
  });
  return others.some((other) => hasContactsScope(other.metadata));
}

export interface ContactPhotosDeps {
  prisma: PrismaClient;
  artifacts: ArtifactStore;
  source: ContactPhotoSource;
  now?: () => Date;
}

/**
 * Stores the profile photos of one connected Google account's contacts for its owner. An account
 * that was not granted a contacts scope, or was fetched within the day, is skipped silently.
 * Re-running changes nothing when the photos have not changed.
 */
export async function runContactPhotosJob(
  deps: ContactPhotosDeps,
  payload: BackgroundJobPayloads["contacts.photos"],
): Promise<void> {
  const { prisma, artifacts, source } = deps;
  const { spaceId, userId, connectionId } = payload;
  const now = (deps.now ?? (() => new Date()))();
  const connection = await prisma.connection.findFirst({
    where: {
      id: connectionId,
      spaceId,
      userId,
      status: "connected",
      provider: { equals: "gmail", mode: "insensitive" },
    },
    select: { connectorId: true, provider: true, providerRef: true, metadata: true },
  });
  if (!connection?.providerRef || connection.connectorId !== "google") return;
  if (!hasContactsScope(connection.metadata)) return;
  const last = await prisma.contactPhotoSync.findUnique({ where: { connectionId } });
  if (last && now.getTime() - last.fetchedAt.getTime() < REFRESH_MS) return;

  const operationId = `contacts.photos:${connectionId}`;
  const context: AdapterContext = {
    operationId,
    traceId: operationId,
    spaceId,
    userId,
    signal: AbortSignal.timeout(JOB_TIMEOUT_MS),
  };
  const account = {
    connectorId: connection.connectorId,
    app: connection.provider,
    accountRef: connection.providerRef,
  };
  const seen = new Set<string>();
  const kept = new Set<string>();
  let stored = 0;
  let complete = true;
  for await (const ref of source.list(account, context)) {
    if (stored >= MAX_PHOTOS_PER_RUN) {
      complete = false;
      break;
    }
    const emails = ref.emails.filter((email) => !seen.has(email));
    if (emails.length === 0) continue;
    for (const email of emails) seen.add(email);
    const image = await source.download(ref.url, PHOTO_MAX_BYTES, context);
    const contentType = image && checkPhoto(image);
    if (!image || !contentType) continue;
    stored++;
    const contentHash = createHash("sha256").update(image.bytes).digest("hex");
    for (const email of emails) {
      kept.add(email);
      const owner = { spaceId, userId, email };
      const existing = await prisma.contactPhoto.findUnique({
        where: { spaceId_userId_email: owner },
      });
      if (existing?.contentHash === contentHash) {
        await prisma.contactPhoto.update({
          where: { spaceId_userId_email: owner },
          data: { fetchedAt: now },
        });
        continue;
      }
      const blob = await artifacts.put(
        {
          name: `contact-photo-${contentHash.slice(0, 16)}`,
          mimeType: contentType,
          bytes: image.bytes,
        },
        context,
      );
      const data = {
        storageKey: blob.id,
        source: "google",
        contentType,
        contentHash,
        fetchedAt: now,
      };
      await prisma.contactPhoto.upsert({
        where: { spaceId_userId_email: owner },
        create: { ...owner, ...data },
        update: data,
      });
      if (existing) await artifacts.remove(existing.storageKey, context).catch(() => undefined);
    }
  }
  // A listing that ended early must not prune. With another Google login the rows may be its photos.
  // ponytail: rows do not record their connection; per-connection pruning needs a connectionId column.
  if (complete && !(await otherContactsLogin(prisma, { spaceId, userId, connectionId }))) {
    const stale = await prisma.contactPhoto.findMany({
      where: { spaceId, userId, source: "google", email: { notIn: [...kept] } },
      select: { email: true, storageKey: true },
    });
    for (const row of stale) {
      await prisma.contactPhoto.deleteMany({
        where: { spaceId, userId, email: row.email, storageKey: row.storageKey },
      });
      await artifacts.remove(row.storageKey, context).catch(() => undefined);
    }
  }
  await prisma.contactPhotoSync.upsert({
    where: { connectionId },
    create: { connectionId, fetchedAt: now },
    update: { fetchedAt: now },
  });
}
