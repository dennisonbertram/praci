import type {
  AdapterContext,
  ArtifactStore,
  JobPublisher,
  MailAccount,
  MailProvider,
} from "@rakazo/adapter-kit";
import { dataRoomStepJob, MailProviderError } from "@rakazo/adapter-kit";
import type { Actor } from "@rakazo/contracts";
import {
  DATA_ROOM_STUCK_MS,
  DataRoomApiFiltersSchema,
  DataRoomApiName,
  DataRoomDocTypeSchema,
} from "@rakazo/contracts";
import { clampInt } from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import { createDataRoomRepos, eligibleWhere, IsolationError } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import { z } from "zod";
import {
  createFileDataRoomItem,
  dataRoomBlobContext,
  dataRoomFileFields,
  dataRoomQueryVector,
} from "./data-room-files.js";
import type { DataRoomAi } from "./data-room-models.js";
import type { DriveFilesDeps } from "./drive-files.js";
import { DriveFileError, streamDriveFile } from "./drive-files.js";
import type { DriveAccount } from "./drive-tools.js";
import { mailToolsAllowed } from "./mail-tools.js";
import { MEETING_CONSENT_REQUIRED_MESSAGE, wrapMeetingNotes } from "./meeting-tools.js";
import { streamChunks } from "./stream-chunks.js";
import { wrapUntrustedContent } from "./untrusted-content.js";

export const DATA_ROOM_TOOL_NAMES = new Set([
  "search_data_room",
  "read_data_room_item",
  "add_to_data_room",
  "update_scan",
]);

/** Owner-only, on a run the owner started: the same gate as the mail and Drive tools. */
export const dataRoomToolsAllowed = mailToolsAllowed;

export function describeDataRoomActivity(name: string): string | null {
  if (name === "search_data_room") return "Looking in the Data room";
  if (name === "read_data_room_item") return "Reading a Data room document";
  if (name === "add_to_data_room") return "Adding a document to the Data room";
  return null;
}

/** Shared guidance; included in a run only when add_to_data_room is offered. */
export const DATA_ROOM_GUIDANCE =
  "When you find, receive or create a document (an email attachment, a Drive file you opened, a file someone gave you, or a report you wrote), add it to the Data room with add_to_data_room. Do this without being asked. Don't choose a folder, name or tags; the Data room files and tags it on its own. Adding the same document again does nothing, so you don't need to check first. Add files only, not message text, and skip small inline images such as logos and signatures. If the tool says the Data room is off, don't add anything else and mention it at most once in the conversation.";

/**
 * The most a mail attachment can be. Unlike every other source, the mail provider contract returns
 * an attachment as one buffer (and Gmail itself caps messages near this size), so this bound stays.
 */
const MAIL_ATTACHMENT_MAX_BYTES = 50 * 1024 * 1024;

/** Images smaller than this are logos, signatures and tracking pixels, not documents. */
export const DATA_ROOM_MIN_IMAGE_BYTES = 20 * 1024;
const DEFAULT_RESULTS = 10;
const MAX_RESULTS = 20;
const MAX_LIST = 100;
const SNIPPET_CHARS = 300;
/** Same cap as drive_read. */
const MAX_TEXT_CHARS = 100_000;

const OFF = "The Data room is off for this person.";
const NOT_A_DOCUMENT = "Not a document.";

export type DataRoomToolDeps = {
  prisma: PrismaClient;
  artifacts: ArtifactStore;
  jobs: JobPublisher;
  /** The Data room's consent and embedding resolver. */
  resolveAi: (scope: { userId: string; spaceId: string }) => Promise<DataRoomAi>;
  /** From the run, never from model input. */
  scope: { spaceId: string; userId: string };
  mail?: MailProvider | null;
  /** Connected mail accounts of the bot owner, without any the user denied this agent. */
  mailAccounts: () => Promise<MailAccount[]>;
  connectors?: DriveFilesDeps["connectors"];
  /** Connected Drive accounts of the bot owner, without any the user denied this agent. */
  driveAccounts: () => Promise<DriveAccount[]>;
  /** Connections the user denied this agent; items imported through them stay hidden. */
  deniedConnectionIds?: readonly string[];
  /** The Omi agent sees only items of this connection (its own recordings). */
  onlyConnectionId?: string;
  /** Called before untrusted meeting or scan content is returned, so the run can be marked. */
  onUntrustedContent?: (source?: "scan") => Promise<void>;
  /** Restricts every item result to this source, after any model-supplied filters. */
  onlySource?: "scan";
  /** The same AI data sharing check `meetings_*` use; a meeting's notes are read only when it passes. */
  meetingConsentOk?: () => Promise<boolean>;
  /** The cap on one mail attachment; injectable so tests can use a small one. */
  maxBytes?: number;
};

/** Omi recording and meeting text is anyone's speech: wrapped as untrusted data. */
const untrustedIf = <T extends string | null>(omi: boolean, value: T): T =>
  omi && value ? (wrapMeetingNotes(value) as T) : value;
const scanUntrustedIf = <T extends string | null>(scan: boolean, value: T): T =>
  scan && value ? (wrapUntrustedContent(value) as T) : value;
const scanUntrustedList = (scan: boolean, values: string[]) =>
  scan ? values.map(wrapUntrustedContent) : values;

/** Agents never find a meeting's notes by search or listing; they read one by id from a handoff. */
const HIDE_MEETINGS = { excludeSource: "meeting" } as const;

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** Inline parts, tiny images, calendar invites and contact cards are mail clutter. */
export function isNotADocument(file: { mimeType: string; size: number; name: string }): boolean {
  const type = file.mimeType.toLowerCase();
  return (
    (type.startsWith("image/") && file.size < DATA_ROOM_MIN_IMAGE_BYTES) ||
    type === "text/calendar" ||
    type === "text/vcard" ||
    type === "text/x-vcard" ||
    /\.(ics|vcf)$/i.test(file.name)
  );
}

/** The in-app path that opens a file's preview; the agent writes it as a markdown link on the file's name. */
const dataRoomItemLink = (id: string) => `/app/data-room?item=${encodeURIComponent(id)}`;

export async function dataRoomToolFromTool(
  name: string,
  deps: DataRoomToolDeps,
  context: AdapterContext,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const actor: Actor = { ...deps.scope, email: "", isDeploymentOwner: false };
  try {
    if (name === "search_data_room") return await search(deps, actor, args);
    if (name === "read_data_room_item") return await read(deps, actor, args);
    if (name === "add_to_data_room") return await add(deps, actor, context, args);
    if (name === "update_scan") return await updateScan(deps, actor, args);
    return { error: `Unknown Data room tool ${name}` };
  } catch (error) {
    getLogger().warn("data room tool failed", {
      tool: name,
      reason: error instanceof Error ? error.message : "unknown",
    });
    return { error: "Data room tool failed" };
  }
}

// biome-ignore lint/suspicious/noControlCharactersInRegex: search snippets mark highlights with U+0001 and U+0002.
const HIGHLIGHT_MARKS = /[\u0001\u0002]/g;

async function search(deps: DataRoomToolDeps, actor: Actor, args: Record<string, unknown>) {
  const query = text(args.query);
  const parsed = DataRoomApiFiltersSchema.safeParse(args.filters ?? {});
  if (!parsed.success) return { error: "filters are not valid" };
  const { docDateFrom, docDateTo, ...rest } = parsed.data;
  const filters = {
    ...rest,
    ...HIDE_MEETINGS,
    excludeConnectionIds: [...(deps.deniedConnectionIds ?? [])],
    ...(deps.onlyConnectionId ? { onlyConnectionId: deps.onlyConnectionId } : {}),
    ...(deps.onlySource ? { source: deps.onlySource } : {}),
    ...(docDateFrom ? { docDateFrom: new Date(docDateFrom) } : {}),
    ...(docDateTo ? { docDateTo: new Date(docDateTo) } : {}),
  };
  const repo = createDataRoomRepos(deps.prisma);
  if (!query) return await listRoom(deps, repo, actor, filters, args);
  const page = await repo.searchPage(actor, {
    query,
    filters,
    limit: clampInt(args.limit, 1, MAX_RESULTS, DEFAULT_RESULTS),
    ...(await dataRoomQueryVector(deps.resolveAi, actor, query)),
  });
  // A file still being read or indexed cannot match yet, so any answer may be incomplete, even with
  // hits (search has no relevance cutoff). A file quiet for minutes shows as failed, not pending.
  const indexing = await deps.prisma.dataRoomItem.count({
    where: {
      ...eligibleWhere(actor, filters),
      status: { in: ["pending", "extracting", "classifying", "indexing"] },
      updatedAt: { gte: new Date(Date.now() - DATA_ROOM_STUCK_MS) },
    },
  });
  if (page.results.some(({ item }) => item.source === "scan"))
    await deps.onUntrustedContent?.("scan");
  if (page.results.some(({ item }) => item.source === "omi")) await deps.onUntrustedContent?.();
  return {
    ...(indexing
      ? {
          note: `${indexing} ${indexing === 1 ? "file is" : "files are"} still being indexed, so the results may be incomplete. Tell the user and suggest asking again shortly.`,
        }
      : {}),
    results: page.results.map(({ item, snippet }) => ({
      id: item.id,
      name: scanUntrustedIf(item.source === "scan", item.name),
      link: dataRoomItemLink(item.id),
      docType: item.docType,
      docDate: item.docDate?.toISOString().slice(0, 10) ?? null,
      snippet: scanUntrustedIf(
        item.source === "scan",
        untrustedIf(
          item.source === "omi",
          snippet.replace(HIGHLIGHT_MARKS, "").slice(0, SNIPPET_CHARS),
        ),
      ),
    })),
  };
}

/**
 * Without a query the tool lists the room (newest first) with each file's folder path. Absence
 * must be judged from this list, since a keyword search misses files whose text lacks the words.
 */
async function listRoom(
  deps: DataRoomToolDeps,
  repo: ReturnType<typeof createDataRoomRepos>,
  actor: Actor,
  filters: Parameters<ReturnType<typeof createDataRoomRepos>["listItemsPage"]>[1],
  args: Record<string, unknown>,
) {
  const [page, folderRows] = await Promise.all([
    repo.listItemsPage(actor, filters, {
      limit: clampInt(args.limit, 1, MAX_LIST, MAX_LIST),
      ...(text(args.cursor) ? { cursor: text(args.cursor) } : {}),
    }),
    repo.listFolders(actor),
  ]);
  if (page.items.some((item) => item.source === "scan")) await deps.onUntrustedContent?.("scan");
  if (page.items.some((item) => item.source === "omi")) await deps.onUntrustedContent?.();
  const folders = new Map(folderRows.map((folder) => [folder.id, folder]));
  const pathOf = (folderId: string | null) => {
    const path: string[] = [];
    for (
      let folder = folderId ? folders.get(folderId) : undefined;
      folder && path.length < folders.size;
      folder = folder.parentId ? folders.get(folder.parentId) : undefined
    ) {
      path.unshift(folder.name);
    }
    return path.length ? path.join("/") : null;
  };
  return {
    results: page.items.map((item) => ({
      id: item.id,
      name: scanUntrustedIf(item.source === "scan", item.name),
      link: dataRoomItemLink(item.id),
      folder: scanUntrustedIf(item.source === "scan", pathOf(item.folderId)),
      docType: item.docType,
      docDate: item.docDate?.toISOString().slice(0, 10) ?? null,
    })),
    ...(page.nextCursor
      ? {
          nextCursor: page.nextCursor,
          note: "More files follow. Call again with this cursor (and the same filters) until there is no nextCursor before saying a file is missing.",
        }
      : {}),
  };
}

async function read(deps: DataRoomToolDeps, actor: Actor, args: Record<string, unknown>) {
  const id = text(args.item_id);
  if (!id) return { error: "item_id is required" };
  const repo = createDataRoomRepos(deps.prisma);
  const item = await repo
    .getItem(actor, id, {
      excludeConnectionIds: [...(deps.deniedConnectionIds ?? [])],
      ...(deps.onlyConnectionId ? { onlyConnectionId: deps.onlyConnectionId } : {}),
      ...(deps.onlySource ? { source: deps.onlySource } : {}),
    })
    .catch((error: unknown) => {
      if (error instanceof IsolationError) return null;
      throw error;
    });
  if (!item) return { error: "Item not found" };
  const meeting = item.source === "meeting";
  const scan = item.source === "scan";
  if (meeting && !(await deps.meetingConsentOk?.()))
    return { error: MEETING_CONSENT_REQUIRED_MESSAGE };
  const folders = new Map((await repo.listFolders(actor)).map((folder) => [folder.id, folder]));
  const path: string[] = [];
  for (
    let folder = item.folderId ? folders.get(item.folderId) : undefined;
    folder && path.length < folders.size;
    folder = folder.parentId ? folders.get(folder.parentId) : undefined
  ) {
    path.unshift(folder.name);
  }
  const full = (await repo.getItemText(actor, id)) ?? "";
  const truncated = full.length > MAX_TEXT_CHARS;
  const omi = item.source === "omi" || meeting;
  if (scan) await deps.onUntrustedContent?.("scan");
  if (omi) await deps.onUntrustedContent?.();
  return {
    id: item.id,
    name: scanUntrustedIf(scan, item.name),
    link: dataRoomItemLink(item.id),
    folder: scanUntrustedIf(scan, path.length ? path.join("/") : null),
    mimeType: item.mimeType,
    status: item.status,
    docType: item.docType,
    docDate: item.docDate?.toISOString().slice(0, 10) ?? null,
    parties: scan ? scanUntrustedList(true, item.parties) : item.parties,
    tags: scan ? scanUntrustedList(true, item.tags) : item.tags,
    summary: scan ? scanUntrustedIf(true, item.summary) : untrustedIf(omi, item.summary),
    text: scan
      ? scanUntrustedIf(true, truncated ? full.slice(0, MAX_TEXT_CHARS) : full)
      : untrustedIf(omi, truncated ? full.slice(0, MAX_TEXT_CHARS) : full),
    truncated,
    ...(truncated ? { note: `Text truncated to ${MAX_TEXT_CHARS} characters.` } : {}),
    ...(!full && item.status !== "failed" ? { note: "No text has been extracted yet." } : {}),
  };
}

async function add(
  deps: DataRoomToolDeps,
  actor: Actor,
  context: AdapterContext,
  args: Record<string, unknown>,
) {
  const messageId = text(args.message_id);
  const attachmentId = text(args.attachment_id);
  const driveFileId = text(args.drive_file_id);
  const artifactId = text(args.artifact_id);
  const sources = [messageId || attachmentId, driveFileId, artifactId].filter(Boolean).length;
  if (sources !== 1 || Boolean(messageId) !== Boolean(attachmentId)) {
    return {
      error: "Pass exactly one of: message_id with attachment_id, drive_file_id, or artifact_id.",
    };
  }
  // Nothing is filed, and no source is read, until the owner has accepted the Data room consent.
  if (!(await deps.resolveAi(actor)).allowed) return { text: OFF };

  const files = createFileDataRoomItem(deps, createDataRoomRepos(deps.prisma));
  /** `item` is null for a zip, which is unpacked in the background under the name it was given. */
  const filed = (
    result: { item: { name: string } | null; created: boolean },
    fallbackName = "The zip",
  ) => {
    const name = result.item?.name ?? fallbackName;
    return {
      text: !result.created
        ? `${name} is already in the Data room.`
        : result.item
          ? `Added ${name} to the Data room.`
          : `Added ${name} to the Data room; its files are being unpacked.`,
    };
  };

  if (artifactId) {
    const externalId = `artifact:${artifactId}`;
    const existing = await files.known(actor, externalId);
    if (existing) return filed({ item: existing, created: false });
    const row = await deps.prisma.artifact.findFirst({
      where: { id: artifactId, spaceId: deps.scope.spaceId, userId: deps.scope.userId },
    });
    if (!row) return { error: "Artifact not found" };
    if (isNotADocument({ mimeType: row.mimeType, size: row.size, name: row.name })) {
      return { text: NOT_A_DOCUMENT };
    }
    // Copied store to store, so the artifact is never held whole in memory.
    const blobContext = dataRoomBlobContext(actor, "agent");
    const fields = dataRoomFileFields({ name: row.name, mimeType: row.mimeType }, "artifact");
    return filed(
      await files.fileItem(actor, {
        source: "chat",
        ...fields,
        content: {
          stream: streamChunks(await deps.artifacts.getStream(row.storageKey, blobContext)),
        },
        folderId: null,
        externalId,
      }),
      fields.name,
    );
  }

  if (driveFileId) {
    const accounts = await deps.driveAccounts();
    if (!deps.connectors || !accounts.length) return { error: "No connected Drive account" };
    for (const account of accounts) {
      const existing = await files.known(actor, driveFileId, account.id);
      if (existing) return filed({ item: existing, created: false });
      let file: Awaited<ReturnType<typeof streamDriveFile>>;
      try {
        file = await streamDriveFile(
          { prisma: deps.prisma, connectors: deps.connectors },
          dataRoomBlobContext(actor, "agent"),
          driveFileId,
          { connectionId: account.id },
        );
      } catch (error) {
        if (!(error instanceof DriveFileError)) throw error;
        if (error.code === "not_found") continue;
        return { error: error.message };
      }
      // Drive does not size an exported Google document; it is a real document, never a tiny image.
      if (isNotADocument({ ...file, size: file.size ?? Number.MAX_SAFE_INTEGER })) {
        await file.stream.cancel().catch(() => undefined);
        return { text: NOT_A_DOCUMENT };
      }
      const modified = new Date(file.modifiedTime);
      const fields = dataRoomFileFields(file, "file");
      return filed(
        await files.fileItem(actor, {
          source: "drive",
          ...fields,
          content: { stream: streamChunks(file.stream) },
          folderId: null,
          sourceConnectionId: account.id,
          externalId: driveFileId,
          ...(file.webViewLink ? { sourceUrl: file.webViewLink } : {}),
          ...(Number.isNaN(modified.getTime()) ? {} : { sourceUpdatedAt: modified }),
        }),
        fields.name,
      );
    }
    return { error: "File not found" };
  }

  const accounts = await deps.mailAccounts();
  if (!deps.mail || !accounts.length) return { error: "No connected mail account" };
  for (const account of accounts) {
    const result = await fileMailAttachment(
      { ...deps, mail: deps.mail },
      actor,
      context,
      account,
      messageId,
      attachmentId,
    );
    if (result.kind === "filed") return filed(result, result.fileName);
    if (result.kind === "no_message") continue;
    if (result.kind === "no_attachment") return { error: "Attachment not found on that message" };
    if (result.kind === "not_a_document") return { text: NOT_A_DOCUMENT };
    return { error: "The attachment is too large to add." };
  }
  return { error: "Message not found" };
}

const UpdateScanInputSchema = z
  .strictObject({
    item_id: z.string().min(1),
    name: DataRoomApiName.refine((value) => value.toLowerCase().endsWith(".pdf"), {
      message: "Scan names must keep the PDF extension",
    }).optional(),
    doc_type: DataRoomDocTypeSchema.optional(),
  })
  .refine((input) => input.name !== undefined || input.doc_type !== undefined);

async function updateScan(deps: DataRoomToolDeps, actor: Actor, args: Record<string, unknown>) {
  const parsed = UpdateScanInputSchema.safeParse(args);
  if (!parsed.success) return { error: "Pass item_id and a valid name and/or doc_type." };
  const { item_id, name, doc_type } = parsed.data;
  const data = {
    ...(name !== undefined ? { name } : {}),
    ...(doc_type !== undefined ? { docType: doc_type } : {}),
  };
  const changed = await deps.prisma.dataRoomItem.updateMany({
    where: { id: item_id, spaceId: actor.spaceId, userId: actor.userId, source: "scan" },
    data,
  });
  if (!changed.count) return { error: "Scan not found." };

  const repo = createDataRoomRepos(deps.prisma);
  const moved = await repo.reindexItems(actor, [item_id]);
  for (const id of moved) {
    await deps.jobs.enqueue(dataRoomStepJob("dataroom.index", actor, id));
  }
  const item = await repo.getItem(actor, item_id, { source: "scan" });
  const folders = new Map((await repo.listFolders(actor)).map((folder) => [folder.id, folder]));
  const path: string[] = [];
  for (
    let folder = item.folderId ? folders.get(item.folderId) : undefined;
    folder && path.length < folders.size;
    folder = folder.parentId ? folders.get(folder.parentId) : undefined
  ) {
    path.unshift(folder.name);
  }
  await deps.onUntrustedContent?.("scan");
  return {
    ok: true,
    id: item.id,
    name: scanUntrustedIf(true, item.name),
    link: dataRoomItemLink(item.id),
    folder: scanUntrustedIf(true, path.length ? path.join("/") : null),
    docType: scanUntrustedIf(true, item.docType),
  };
}

/**
 * Files one attachment of a mail message into the owner's Data room: the single path behind
 * `add_to_data_room` and the automatic filing of new mail. It reads the message and the bytes
 * only for the actor's own account, and a repeat (`gmail:<message>:<attachment>`) returns the
 * existing item. It does not check Data room consent; the callers decide that.
 */
export async function fileMailAttachment(
  deps: Pick<DataRoomToolDeps, "prisma" | "artifacts" | "jobs" | "scope"> & {
    mail: MailProvider;
    maxBytes?: number;
  },
  actor: Actor,
  context: AdapterContext,
  account: MailAccount,
  messageId: string,
  attachmentId: string,
  /** The message, when the caller already read it. */
  loaded?: Awaited<ReturnType<MailProvider["getMessage"]>>,
): Promise<
  | { kind: "filed"; item: { id: string; name: string } | null; created: boolean; fileName: string }
  | { kind: "no_message" | "no_attachment" | "not_a_document" | "too_large" }
> {
  const maxBytes = deps.maxBytes ?? MAIL_ATTACHMENT_MAX_BYTES;
  const files = createFileDataRoomItem(deps, createDataRoomRepos(deps.prisma));
  let message = loaded;
  if (!message) {
    try {
      message = await deps.mail.getMessage(account, messageId, context);
    } catch (error) {
      if (error instanceof MailProviderError && error.kind === "not_found")
        return { kind: "no_message" };
      throw error;
    }
  }
  const info = message.attachments.find((part) => part.id === attachmentId);
  if (!info) return { kind: "no_attachment" };
  if (info.inline || isNotADocument({ ...info, name: info.filename })) {
    return { kind: "not_a_document" };
  }
  const externalId = `gmail:${messageId}:${attachmentId}`;
  const existing = await files.known(actor, externalId, account.id);
  if (existing) return { kind: "filed", item: existing, created: false, fileName: existing.name };
  let file: Awaited<ReturnType<MailProvider["getAttachment"]>>;
  try {
    file = await deps.mail.getAttachment(account, messageId, attachmentId, maxBytes, context);
  } catch (error) {
    if (error instanceof MailProviderError && error.kind === "too_large") {
      return { kind: "too_large" };
    }
    throw error;
  }
  if (isNotADocument({ ...file, name: file.filename, size: file.bytes.byteLength })) {
    return { kind: "not_a_document" };
  }
  const cached = await deps.prisma.cachedMailMessage.findFirst({
    where: {
      spaceId: deps.scope.spaceId,
      userId: deps.scope.userId,
      connectionId: account.id,
      providerMessageId: messageId,
    },
    select: { id: true },
  });
  const fields = dataRoomFileFields({ name: file.filename, mimeType: file.mimeType }, "attachment");
  const result = await files.fileItem(actor, {
    source: "gmail",
    ...fields,
    content: { bytes: file.bytes },
    folderId: null,
    sourceConnectionId: account.id,
    externalId,
    ...(cached ? { sourceUrl: `/app/inbox?mail=${cached.id}` } : {}),
  });
  return { kind: "filed", ...result, fileName: fields.name };
}
