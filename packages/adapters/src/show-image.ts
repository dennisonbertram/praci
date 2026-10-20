import path from "node:path";
import type { ArtifactStore } from "@rakazo/adapter-kit";
import type { Actor, MessageBlock } from "@rakazo/contracts";
import { ATTACHMENT_MAX_BYTES, isAttachmentImageMimeType } from "@rakazo/contracts";
import { attachmentExtensionForMimeType } from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import { createDataRoomRepos, IsolationError } from "@rakazo/db";
import { dataRoomBlobContext } from "./data-room-files.js";
import { attachWorkspaceFileToThread } from "./thread-artifacts.js";
import type { SafeWebFetchOptions } from "./web-ssrf.js";
import { fetchSafeWebBytes } from "./web-ssrf.js";

export const SHOW_IMAGE_MAX = 6;
const FETCH_TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 3;

type ImageBlock = Extract<MessageBlock, { kind: "image" }>;

export type ShowImageDeps = {
  prisma: PrismaClient;
  artifacts: ArtifactStore;
  scope: {
    spaceId: string;
    userId: string;
    botId: string;
    groupId?: string;
    runId: string;
    operationId: string;
  };
  /** Absent when the bot has no computer. */
  readWorkspaceFile?: (path: string) => Promise<Uint8Array>;
  /** Present only where the Data room tools are allowed. */
  dataRoom?: { deniedConnectionIds: readonly string[] };
  fetchOptions?: SafeWebFetchOptions;
};

/** Only raster formats; SVG can carry script. Magic bytes decide, never a header or file name. */
export function sniffImageType(bytes: Uint8Array): string | null {
  const at = (i: number, ...values: number[]) => values.every((v, k) => bytes[i + k] === v);
  if (at(0, 0x89, 0x50, 0x4e, 0x47)) return "image/png";
  if (at(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (at(0, 0x47, 0x49, 0x46, 0x38)) return "image/gif";
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp";
  return null;
}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** Stores the bytes as an artifact of this bot (so the thread can fetch it) and returns the image block. */
async function store(
  deps: ShowImageDeps,
  bytes: Uint8Array,
  name: string,
  alt: string,
  caption: string,
): Promise<ImageBlock> {
  if (bytes.byteLength > ATTACHMENT_MAX_BYTES) throw new Error("image is larger than 10 MiB");
  const mimeType = sniffImageType(bytes);
  if (!mimeType) throw new Error("not a PNG, JPEG, GIF or WebP image");
  const base = path.basename(name).replace(/\.[^.]*$/, "") || "image";
  const { block } = await attachWorkspaceFileToThread(deps, {
    ...deps.scope,
    filePath: `${base}${attachmentExtensionForMimeType(mimeType)}`,
    bytes,
  });
  if (block.kind !== "image") throw new Error("not an image");
  return { ...block, ...(alt ? { alt } : {}), ...(caption ? { caption } : {}) };
}

async function load(
  deps: ShowImageDeps,
  source: Record<string, unknown>,
  alt: string,
  caption: string,
): Promise<ImageBlock> {
  const { spaceId, userId, botId, groupId } = deps.scope;
  const artifactId = text(source.artifact_id);
  const itemId = text(source.item_id);
  const filePath = text(source.path);
  const url = text(source.url);
  if ([artifactId, itemId, filePath, url].filter(Boolean).length !== 1) {
    throw new Error("pass exactly one of artifact_id, item_id, path or url");
  }

  if (artifactId) {
    const row = await deps.prisma.artifact.findFirst({
      where: { id: artifactId, spaceId, userId },
    });
    if (!row || !isAttachmentImageMimeType(row.mimeType)) throw new Error("image not found");
    const sameThread = groupId ? row.groupId === groupId : row.botId === botId;
    if (sameThread) {
      return {
        kind: "image",
        artifactId: row.id,
        mimeType: row.mimeType,
        name: row.name,
        ...(alt ? { alt } : {}),
        ...(caption ? { caption } : {}),
      };
    }
    // The thread can only fetch artifacts it owns, so an image from elsewhere is copied in.
    const bytes = await deps.artifacts.get(row.storageKey, {
      operationId: deps.scope.operationId,
      traceId: deps.scope.operationId,
      spaceId,
      userId,
      botId,
      signal: new AbortController().signal,
    });
    return store(deps, bytes, row.name, alt, caption);
  }

  if (itemId) {
    if (!deps.dataRoom) throw new Error("the Data room is not available");
    const actor: Actor = { spaceId, userId, email: "", isDeploymentOwner: false };
    const item = await createDataRoomRepos(deps.prisma)
      .getItem(actor, itemId, { excludeConnectionIds: [...deps.dataRoom.deniedConnectionIds] })
      .catch((error: unknown) => {
        if (error instanceof IsolationError) return null;
        throw error;
      });
    if (!item?.storageKey || !isAttachmentImageMimeType(item.mimeType)) {
      throw new Error("image not found");
    }
    if (Number(item.size) > ATTACHMENT_MAX_BYTES) throw new Error("image is larger than 10 MiB");
    const bytes = await deps.artifacts.get(item.storageKey, dataRoomBlobContext(actor, "agent"));
    return store(deps, bytes, item.name, alt, caption);
  }

  if (filePath) {
    if (!deps.readWorkspaceFile) throw new Error("no computer to read the file from");
    let bytes: Uint8Array;
    try {
      bytes = await deps.readWorkspaceFile(filePath);
    } catch {
      throw new Error("file not found or unreadable");
    }
    return store(deps, bytes, filePath, alt, caption);
  }

  if (!/^https:\/\//i.test(url)) throw new Error("url must start with https://");
  const fetched = await fetchSafeWebBytes(url, {
    timeoutMs: FETCH_TIMEOUT_MS,
    maxBytes: ATTACHMENT_MAX_BYTES,
    maxRedirects: MAX_REDIRECTS,
    headers: { accept: "image/png,image/jpeg,image/gif,image/webp" },
    ...deps.fetchOptions,
  });
  let name = "image";
  try {
    name = path.basename(new URL(url).pathname) || name;
  } catch {}
  return store(deps, fetched.body, name, alt, caption);
}

/** Resolves every source, each failure on its own, and returns the blocks to publish as one message. */
export async function showImages(
  deps: ShowImageDeps,
  args: Record<string, unknown>,
): Promise<{ blocks: ImageBlock[]; result: Record<string, unknown> }> {
  const sources = Array.isArray(args.images) ? args.images : [];
  if (sources.length === 0 || sources.length > SHOW_IMAGE_MAX) {
    return {
      blocks: [],
      result: { error: `Pass between 1 and ${SHOW_IMAGE_MAX} images.` },
    };
  }
  const blocks: ImageBlock[] = [];
  const errors: { index: number; error: string }[] = [];
  for (const [index, raw] of sources.entries()) {
    const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    try {
      blocks.push(
        await load(
          deps,
          source,
          text(source.alt).slice(0, 500),
          text(source.caption).slice(0, 500),
        ),
      );
    } catch (error) {
      errors.push({
        index,
        error: error instanceof Error ? error.message : "could not show image",
      });
    }
  }
  return {
    blocks,
    result: { ok: blocks.length > 0, shown: blocks.length, ...(errors.length ? { errors } : {}) },
  };
}
