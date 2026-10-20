import type {
  AdapterContext,
  ArtifactStore,
  JobPublisher,
  MailAccount,
  MailProvider,
} from "@rakazo/adapter-kit";
import { MailProviderError } from "@rakazo/adapter-kit";
import type { Actor } from "@rakazo/contracts";
import { DATA_ROOM_UPLOAD_MAX_BYTES, DataRoomApiFiltersSchema } from "@rakazo/contracts";
import { clampInt } from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import { createDataRoomRepos, IsolationError } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import {
  createFileDataRoomItem,
  dataRoomBlobContext,
  dataRoomFileFields,
  dataRoomQueryVector,
} from "./data-room-files.js";
import type { DataRoomAi } from "./data-room-models.js";
import type { DriveFilesDeps } from "./drive-files.js";
import { DriveFileError, downloadDriveFile } from "./drive-files.js";
import type { DriveAccount } from "./drive-tools.js";
import { mailToolsAllowed } from "./mail-tools.js";

export const DATA_ROOM_TOOL_NAMES = new Set([
  "search_data_room",
  "read_data_room_item",
  "add_to_data_room",
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
  "When you find, receive or create a document (an email attachment, a Drive file you opened, a file someone gave you, or a report you wrote), add it to the Data room with add_to_data_room. Do this without being asked. Don't choose a folder, name or tags; the Data room agent files it. Adding the same document again does nothing, so you don't need to check first. Add files only, not message text, and skip small inline images such as logos and signatures. If the tool says the Data room is off, don't add anything else and mention it at most once in the conversation.";

/** Images smaller than this are logos, signatures and tracking pixels, not documents. */
export const DATA_ROOM_MIN_IMAGE_BYTES = 20 * 1024;
const DEFAULT_RESULTS = 10;
const MAX_RESULTS = 20;
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
  /** Injectable so tests can use a small cap. */
  maxBytes?: number;
};

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
  if (!query) return { error: "query is required" };
  const parsed = DataRoomApiFiltersSchema.safeParse(args.filters ?? {});
  if (!parsed.success) return { error: "filters are not valid" };
  const { docDateFrom, docDateTo, ...rest } = parsed.data;
  const filters = {
    ...rest,
    excludeConnectionIds: [...(deps.deniedConnectionIds ?? [])],
    ...(docDateFrom ? { docDateFrom: new Date(docDateFrom) } : {}),
    ...(docDateTo ? { docDateTo: new Date(docDateTo) } : {}),
  };
  const repo = createDataRoomRepos(deps.prisma);
  const page = await repo.searchPage(actor, {
    query,
    filters,
    limit: clampInt(args.limit, 1, MAX_RESULTS, DEFAULT_RESULTS),
    ...(await dataRoomQueryVector(deps.resolveAi, actor, query)),
  });
  return {
    results: page.results.map(({ item, snippet }) => ({
      id: item.id,
      name: item.name,
      docType: item.docType,
      docDate: item.docDate?.toISOString().slice(0, 10) ?? null,
      snippet: snippet.replace(HIGHLIGHT_MARKS, "").slice(0, SNIPPET_CHARS),
    })),
  };
}

async function read(deps: DataRoomToolDeps, actor: Actor, args: Record<string, unknown>) {
  const id = text(args.item_id);
  if (!id) return { error: "item_id is required" };
  const repo = createDataRoomRepos(deps.prisma);
  const item = await repo
    .getItem(actor, id, { excludeConnectionIds: [...(deps.deniedConnectionIds ?? [])] })
    .catch((error: unknown) => {
      if (error instanceof IsolationError) return null;
      throw error;
    });
  if (!item) return { error: "Item not found" };
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
  return {
    id: item.id,
    name: item.name,
    folder: path.length ? path.join("/") : null,
    mimeType: item.mimeType,
    status: item.status,
    docType: item.docType,
    docDate: item.docDate?.toISOString().slice(0, 10) ?? null,
    parties: item.parties,
    tags: item.tags,
    summary: item.summary,
    text: truncated ? full.slice(0, MAX_TEXT_CHARS) : full,
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

  const maxBytes = deps.maxBytes ?? DATA_ROOM_UPLOAD_MAX_BYTES;
  const files = createFileDataRoomItem(deps, createDataRoomRepos(deps.prisma));
  const filed = (result: { item: { name: string }; created: boolean }) => ({
    text: result.created
      ? `Added ${result.item.name} to the Data room.`
      : `${result.item.name} is already in the Data room.`,
  });

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
    if (row.size > maxBytes) return { error: "The file is too large to add." };
    const bytes = await deps.artifacts.get(row.storageKey, dataRoomBlobContext(actor, "agent"));
    return filed(
      await files.fileItem(actor, {
        source: "chat",
        ...dataRoomFileFields({ name: row.name, mimeType: row.mimeType, bytes }, "artifact"),
        folderId: null,
        externalId,
      }),
    );
  }

  if (driveFileId) {
    const accounts = await deps.driveAccounts();
    if (!deps.connectors || !accounts.length) return { error: "No connected Drive account" };
    for (const account of accounts) {
      const existing = await files.known(actor, driveFileId, account.id);
      if (existing) return filed({ item: existing, created: false });
      let file: Awaited<ReturnType<typeof downloadDriveFile>>;
      try {
        file = await downloadDriveFile(
          { prisma: deps.prisma, connectors: deps.connectors },
          dataRoomBlobContext(actor, "agent"),
          driveFileId,
          { connectionId: account.id, maxBytes },
        );
      } catch (error) {
        if (!(error instanceof DriveFileError)) throw error;
        if (error.code === "not_found") continue;
        return { error: error.message };
      }
      if (isNotADocument({ ...file, size: file.bytes.byteLength })) return { text: NOT_A_DOCUMENT };
      const modified = new Date(file.modifiedTime);
      return filed(
        await files.fileItem(actor, {
          source: "drive",
          ...dataRoomFileFields(file, "file"),
          folderId: null,
          sourceConnectionId: account.id,
          externalId: driveFileId,
          ...(file.webViewLink ? { sourceUrl: file.webViewLink } : {}),
          ...(Number.isNaN(modified.getTime()) ? {} : { sourceUpdatedAt: modified }),
        }),
      );
    }
    return { error: "File not found" };
  }

  const accounts = await deps.mailAccounts();
  if (!deps.mail || !accounts.length) return { error: "No connected mail account" };
  for (const account of accounts) {
    const result = await fileMailAttachment(
      { ...deps, mail: deps.mail, maxBytes },
      actor,
      context,
      account,
      messageId,
      attachmentId,
    );
    if (result.kind === "filed") return filed(result);
    if (result.kind === "no_message") continue;
    if (result.kind === "no_attachment") return { error: "Attachment not found on that message" };
    if (result.kind === "not_a_document") return { text: NOT_A_DOCUMENT };
    return { error: "The attachment is too large to add." };
  }
  return { error: "Message not found" };
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
  | { kind: "filed"; item: { name: string }; created: boolean }
  | { kind: "no_message" | "no_attachment" | "not_a_document" | "too_large" }
> {
  const maxBytes = deps.maxBytes ?? DATA_ROOM_UPLOAD_MAX_BYTES;
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
  if (existing) return { kind: "filed", item: existing, created: false };
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
  const result = await files.fileItem(actor, {
    source: "gmail",
    ...dataRoomFileFields(
      { name: file.filename, mimeType: file.mimeType, bytes: file.bytes },
      "attachment",
    ),
    folderId: null,
    sourceConnectionId: account.id,
    externalId,
    ...(cached ? { sourceUrl: `/app/inbox?mail=${cached.id}` } : {}),
  });
  return { kind: "filed", ...result };
}
