import type { ArtifactStore, JobPublisher } from "@rakazo/adapter-kit";
import { accountExportJob } from "@rakazo/adapter-kit";
import type { AccountExport, Actor } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import { Zip, ZipDeflate } from "fflate";
import { dataRoomBlobContext } from "./data-room-files.js";
import { streamChunks } from "./stream-chunks.js";

/**
 * "Export my data": a readable zip of what one user owns, built in the background and kept in the
 * artifact store until it expires. It is portable JSON plus the original Data room files, not a
 * restorable backup.
 *
 * Scope rule: a row is exported only when its `userId` is the requester and its space is one the
 * requester is still a member of. In a shared space that means the requester's own bots, threads,
 * memories, files and so on; other members' rows are never read, even when the requester could see
 * them in the app. Secrets, credentials, tokens, mail bodies and run logs are not exported.
 */
export const ACCOUNT_EXPORT_SCHEMA_VERSION = 1;
export const ACCOUNT_EXPORT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** A running export whose row has not changed for this long is taken as dead, so a new one may start. */
const STALE_MS = 60 * 60 * 1000;
const BUILD_TIMEOUT_MS = 2 * 60 * 60 * 1000;
const PAGE = 500;

export const accountExportDownloadPath = (id: string) => `/api/account/exports/${id}/download`;

type Db = Pick<PrismaClient, "accountExport">;
type Row = { updatedAt: Date; id: string; status: string; progress: number; expiresAt: Date };

export const accountExportDto = (row: Row): AccountExport => ({
  id: row.id,
  status: row.status as AccountExport["status"],
  progress: row.progress,
  expiresAt: row.expiresAt.toISOString(),
});

/** Starts an export, or returns the one already pending or running. At most one is active per user. */
export async function requestAccountExport(
  deps: { prisma: PrismaClient; jobs: JobPublisher },
  actor: Pick<Actor, "userId" | "spaceId">,
  now = new Date(),
): Promise<AccountExport> {
  const { prisma } = deps;
  const active = { userId: actor.userId, status: { in: ["pending", "running"] } };
  await prisma.accountExport.updateMany({
    where: { ...active, updatedAt: { lt: new Date(now.getTime() - STALE_MS) } },
    data: { status: "failed" },
  });
  const existing = await prisma.accountExport.findFirst({ where: active });
  if (existing) return accountExportDto(existing);
  let row: Row;
  try {
    row = await prisma.accountExport.create({
      data: {
        userId: actor.userId,
        spaceId: actor.spaceId,
        expiresAt: new Date(now.getTime() + ACCOUNT_EXPORT_TTL_MS),
      },
    });
  } catch (error) {
    // A concurrent request won the partial unique index; hand back its export.
    const raced = await prisma.accountExport.findFirst({ where: active });
    if (raced) return accountExportDto(raced);
    throw error;
  }
  await deps.jobs.enqueue(accountExportJob(row.id)).catch(async (error: unknown) => {
    await prisma.accountExport.update({ where: { id: row.id }, data: { status: "failed" } });
    throw error;
  });
  return accountExportDto(row);
}

/** The user's newest export that is running or has not expired. */
export async function latestAccountExport(
  prisma: Db,
  userId: string,
  now = new Date(),
): Promise<AccountExport | null> {
  const row = await prisma.accountExport.findFirst({
    where: { userId, OR: [{ status: { in: ["pending", "running"] } }, { expiresAt: { gt: now } }] },
    orderBy: { createdAt: "desc" },
  });
  return row && accountExportDto(row);
}

const blobContext = (row: { userId: string; spaceId: string }, operation: string) =>
  dataRoomBlobContext(
    { userId: row.userId, spaceId: row.spaceId, email: "", isDeploymentOwner: false },
    operation,
  );

/** Deletes expired exports, rows and zips. A zip that cannot be removed keeps its row for the next run. */
export async function cleanupAccountExports(
  deps: { prisma: PrismaClient; artifacts: ArtifactStore },
  now = new Date(),
): Promise<number> {
  const expired = await deps.prisma.accountExport.findMany({
    where: { expiresAt: { lt: now } },
    take: 200,
  });
  let removed = 0;
  for (const row of expired) {
    try {
      if (row.storageKey)
        await deps.artifacts.remove(row.storageKey, blobContext(row, "account-export.cleanup"));
      await deps.prisma.accountExport.delete({ where: { id: row.id } });
      removed += 1;
    } catch (error) {
      getLogger().error("account export cleanup failed", error);
    }
  }
  return removed;
}

/** Removes every zip a user has, before their account is deleted (the rows go with the user). */
export async function removeAccountExportBlobs(
  deps: { prisma: PrismaClient; artifacts: ArtifactStore },
  userId: string,
): Promise<void> {
  const rows = await deps.prisma.accountExport.findMany({
    where: { userId, storageKey: { not: null } },
  });
  for (const row of rows)
    if (row.storageKey)
      await deps.artifacts.remove(row.storageKey, blobContext(row, "account-export.delete"));
}

type Chunks = AsyncIterable<Uint8Array>;
type ZipEntry = { path: string; data: Chunks };

/** Zips entries one at a time into a stream of chunks; no file is held whole in memory. */
export async function* zipStream(entries: AsyncIterable<ZipEntry>): AsyncGenerator<Uint8Array> {
  const out: Uint8Array[] = [];
  let failure: Error | undefined;
  const zip = new Zip((error, chunk) => {
    if (error) failure = error;
    else out.push(chunk);
  });
  const drain = function* () {
    if (failure) throw failure;
    while (out.length) yield out.shift() as Uint8Array;
  };
  for await (const entry of entries) {
    const file = new ZipDeflate(entry.path, { level: 6 });
    zip.add(file);
    for await (const chunk of entry.data) {
      file.push(chunk);
      yield* drain();
    }
    file.push(new Uint8Array(0), true);
    yield* drain();
  }
  zip.end();
  yield* drain();
}

const encoder = new TextEncoder();
const json = (value: unknown) =>
  JSON.stringify(value, (_key, v) => (typeof v === "bigint" ? v.toString() : v), 2);

type Rows = Record<string, unknown> & { id: string };
type Pager = (after: string | undefined) => Promise<Rows[]>;
const after = (id: string | undefined) => (id ? { cursor: { id }, skip: 1 } : {});

/** A JSON array written page by page, so a large table never sits in memory. */
async function* jsonArray(pager: Pager, onRows: (n: number) => void): Chunks {
  yield encoder.encode("[");
  let last: string | undefined;
  let first = true;
  for (;;) {
    const rows = await pager(last);
    if (rows.length === 0) break;
    for (const row of rows) {
      yield encoder.encode(`${first ? "\n" : ",\n"}${json(row)}`);
      first = false;
    }
    onRows(rows.length);
    last = rows[rows.length - 1]?.id;
    if (rows.length < PAGE) break;
  }
  yield encoder.encode(first ? "]\n" : "\n]\n");
}

const safeSegment = (name: string) =>
  name.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120) || "file";
/** Where an original file sits in the zip; also written into that item's metadata row. */
const dataRoomFilePath = (item: { id: string; spaceId: string; name: string }) =>
  `data-room/files/${safeSegment(item.spaceId)}/${item.id}-${safeSegment(item.name)}`;

const README = `Praci data export

Everything in this zip belongs to you: the rows you own in the spaces you belong to.
Other people's data in shared spaces is not included. It is readable JSON, not a backup
that can be restored.

manifest.json          Schema version, when it was made, and how many rows each file holds.
profile.json           Your account profile and preferences.
spaces.json            The spaces you belong to and your role in each.
bots.json              Your agents and their settings. Secrets are not included.
bot-folders.json       Your sidebar folders for agents.
groups.json            Your group chats.
threads.json           Your conversations.
messages.json          Every message in your conversations.
memories.json          Your agents' memory documents.
skills.json            Your skills.
routines.json          Your routines, with their cron schedules.
contacts.json          Your contacts.
meetings.json          Your synced meetings, with notes and transcripts.
cap-table.json         The latest cap table snapshot.
legal-*.json           The legal graph: contracts, deadlines, nodes and edges.
data-room/             folders.json, items.json (metadata) and files/ (the original files).
notification-preferences.json
sidebar-pages.json     The optional sidebar pages you added.
connections.json       The names of your connected apps. Credentials are not included.
ai-consent.json        How many AI recipients you allowed in each space.

Not included: secrets, passwords, tokens, run logs, mail bodies (they stay in your mail account)
and files that are not stored in Praci.
`;

/** The collectors, in the order they are written. Every one filters on the requester and their spaces. */
function collectors(prisma: PrismaClient, userId: string, spaceIds: string[]) {
  const own = { userId, spaceId: { in: spaceIds } };
  const page = (args: object) => ({ ...args, take: PAGE, orderBy: { id: "asc" as const } });
  const arrays: [string, Pager][] = [
    [
      "bots.json",
      (a) =>
        prisma.bot.findMany(page({ where: own, omit: { webhookSecretId: true }, ...after(a) })),
    ],
    ["bot-folders.json", (a) => prisma.botSection.findMany(page({ where: own, ...after(a) }))],
    [
      "groups.json",
      (a) =>
        prisma.chatGroup.findMany(
          page({
            where: own,
            include: { members: { select: { botId: true } } },
            ...after(a),
          }),
        ),
    ],
    ["threads.json", (a) => prisma.thread.findMany(page({ where: own, ...after(a) }))],
    [
      "messages.json",
      (a) =>
        prisma.message.findMany(
          page({ where: { thread: own }, omit: { clientNonce: true }, ...after(a) }),
        ),
    ],
    ["memories.json", (a) => prisma.memoryDocument.findMany(page({ where: own, ...after(a) }))],
    ["skills.json", (a) => prisma.agentSkill.findMany(page({ where: own, ...after(a) }))],
    ["routines.json", (a) => prisma.routine.findMany(page({ where: own, ...after(a) }))],
    ["contacts.json", (a) => prisma.contact.findMany(page({ where: own, ...after(a) }))],
    ["meetings.json", (a) => prisma.meeting.findMany(page({ where: own, ...after(a) }))],
    ["cap-table.json", (a) => prisma.capTableSnapshot.findMany(page({ where: own, ...after(a) }))],
    [
      "legal-contracts.json",
      (a) => prisma.legalContract.findMany(page({ where: own, ...after(a) })),
    ],
    [
      "legal-deadlines.json",
      (a) => prisma.legalDeadline.findMany(page({ where: own, ...after(a) })),
    ],
    ["legal-nodes.json", (a) => prisma.legalNode.findMany(page({ where: own, ...after(a) }))],
    ["legal-edges.json", (a) => prisma.legalEdge.findMany(page({ where: own, ...after(a) }))],
    [
      "data-room/folders.json",
      (a) => prisma.dataRoomFolder.findMany(page({ where: own, ...after(a) })),
    ],
    [
      "data-room/items.json",
      async (a) => {
        const items = await prisma.dataRoomItem.findMany(
          page({
            where: own,
            omit: {
              thumbnailKey: true,
              thumbnailTriedAt: true,
              leaseUntil: true,
              failures: true,
              revision: true,
            },
            ...after(a),
          }),
        );
        // The storage key is internal; the row says where the original file sits in the zip.
        return items.map(({ storageKey, ...item }) => ({
          ...item,
          exportedFile: storageKey ? dataRoomFilePath(item) : null,
        }));
      },
    ],
    [
      "notification-preferences.json",
      (a) => prisma.notificationPreference.findMany(page({ where: own, ...after(a) })),
    ],
    ["sidebar-pages.json", (a) => prisma.sidebarPage.findMany(page({ where: own, ...after(a) }))],
    [
      "connections.json",
      (a) =>
        prisma.connection.findMany(
          page({
            where: own,
            select: {
              id: true,
              spaceId: true,
              connectorId: true,
              provider: true,
              displayName: true,
              status: true,
              createdAt: true,
            },
            ...after(a),
          }),
        ),
    ],
  ];
  return arrays;
}

/** Builds the zip for one export row and stores it. Failures mark the row failed; they are not retried. */
export async function runAccountExport(
  deps: { prisma: PrismaClient; artifacts: ArtifactStore },
  exportId: string,
): Promise<void> {
  const { prisma, artifacts } = deps;
  const claimed = await prisma.accountExport.updateMany({
    where: { id: exportId, status: { in: ["pending", "running"] } },
    data: { status: "running", progress: 0 },
  });
  if (claimed.count === 0) return;
  const row = await prisma.accountExport.findUniqueOrThrow({ where: { id: exportId } });
  const { userId } = row;
  const context = {
    ...blobContext(row, "account-export.build"),
    signal: AbortSignal.timeout(BUILD_TIMEOUT_MS),
  };
  let stored: { id: string; size: number } | undefined;
  try {
    const memberships = await prisma.spaceMember.findMany({
      where: { userId },
      include: { space: { select: { name: true, isDefault: true, createdAt: true } } },
    });
    const spaceIds = memberships.map((m) => m.spaceId);
    const own = { userId, spaceId: { in: spaceIds } };
    const arrays = collectors(prisma, userId, spaceIds);
    const fileItems = await prisma.dataRoomItem.findMany({
      where: { ...own, storageKey: { not: null } },
      select: { id: true, spaceId: true, name: true, storageKey: true },
      orderBy: { id: "asc" },
    });
    const total = arrays.length + 3 + fileItems.length;
    let done = 0;
    let shown = 0;
    const step = async () => {
      done += 1;
      const pct = Math.min(99, Math.floor((done / total) * 100));
      if (pct > shown) {
        shown = pct;
        await prisma.accountExport.update({ where: { id: exportId }, data: { progress: pct } });
      }
    };
    const counts: Record<string, number> = {};
    const missingFiles: string[] = [];
    let fileCount = 0;

    async function* entries(): AsyncGenerator<ZipEntry> {
      const value = async function* (text: string): Chunks {
        yield encoder.encode(text);
      };
      yield { path: "README.txt", data: value(README) };
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { name: true, email: true, image: true, avatarStyle: true, timezone: true },
      });
      counts["profile.json"] = 1;
      yield { path: "profile.json", data: value(`${json({ id: userId, ...user })}\n`) };
      await step();
      const spaces = memberships.map((m) => ({
        id: m.spaceId,
        name: m.space.name,
        isDefault: m.space.isDefault,
        createdAt: m.space.createdAt,
        role: m.role,
        joinedAt: m.createdAt,
      }));
      counts["spaces.json"] = spaces.length;
      yield { path: "spaces.json", data: value(`${json(spaces)}\n`) };
      await step();
      const consent = await prisma.aiDataConsent.groupBy({
        by: ["spaceId"],
        where: own,
        _count: { _all: true },
      });
      const consentSummary = consent.map((c) => ({
        spaceId: c.spaceId,
        allowedRecipients: c._count._all,
      }));
      counts["ai-consent.json"] = consentSummary.length;
      yield { path: "ai-consent.json", data: value(`${json(consentSummary)}\n`) };
      await step();
      for (const [path, pager] of arrays) {
        counts[path] = 0;
        yield {
          path,
          data: jsonArray(pager, (n) => {
            counts[path] = (counts[path] ?? 0) + n;
          }),
        };
        await step();
      }
      for (const item of fileItems) {
        const path = dataRoomFilePath(item);
        let stream: ReadableStream<Uint8Array>;
        try {
          stream = await artifacts.getStream(
            item.storageKey as string,
            dataRoomBlobContext(
              { userId, spaceId: item.spaceId, email: "", isDeploymentOwner: false },
              "account-export.file",
              context.signal,
            ),
          );
        } catch {
          missingFiles.push(item.id);
          await step();
          continue;
        }
        fileCount += 1;
        yield { path, data: streamChunks(stream) };
        await step();
      }
      const manifest = {
        schemaVersion: ACCOUNT_EXPORT_SCHEMA_VERSION,
        product: "Praci",
        generatedAt: new Date().toISOString(),
        counts,
        files: { included: fileCount, missing: missingFiles },
      };
      yield { path: "manifest.json", data: value(`${json(manifest)}\n`) };
    }

    stored = await artifacts.putStream(
      zipStream(entries()),
      { name: `praci-export-${exportId}.zip`, mimeType: "application/zip" },
      context,
    );
    await prisma.accountExport.update({
      where: { id: exportId },
      data: {
        status: "ready",
        progress: 100,
        storageKey: stored.id,
        size: BigInt(stored.size),
        expiresAt: new Date(Date.now() + ACCOUNT_EXPORT_TTL_MS),
      },
    });
  } catch (error) {
    getLogger().error("account export failed", error);
    if (stored)
      await artifacts
        .remove(stored.id, blobContext(row, "account-export.cleanup"))
        .catch(() => undefined);
    await prisma.accountExport
      .updateMany({ where: { id: exportId }, data: { status: "failed" } })
      .catch(() => undefined);
  }
}
