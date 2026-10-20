import { isBoxEndpoint } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { asRecord } from "./connector-http.js";
import type { McpOAuthBroker } from "./mcp-oauth.js";

const API = "https://api.box.com/2.0";
const PAGE_SIZE = 100;
const FIELDS = "id,type,name,size,modified_at";
/** Box hands file bytes to a download host under this domain; nothing else is ever fetched. */
const DOWNLOAD_HOST = /(^|\.)boxcloud\.com$/;
/** Box ids are digits ("0" is the root). Anything else, a shared link included, is refused. */
const BOX_ID = /^\d{1,30}$/;
const MAX_NOT_READY_RETRIES = 3;

export type BoxFileErrorCode =
  | "not_connected"
  | "reconnect"
  | "not_found"
  | "unsupported"
  | "too_large"
  | "rate_limited"
  | "too_many"
  | "failed";

/** Why a Box file could not be listed or downloaded; `code` is stable, `message` is safe to show. */
export class BoxFileError extends Error {
  constructor(
    readonly code: BoxFileErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "BoxFileError";
  }
}

export type BoxAccount = {
  id: string;
  name: string;
  endpoint: string | null;
  secretId: string | null;
};
type Scope = { spaceId: string; userId: string };

export type BoxFilesDeps = {
  prisma: Pick<PrismaClient, "mcpServer">;
  /** A current access token for one of the caller's Box connections; null when it needs signing in again. */
  accessToken: (
    account: BoxAccount,
    scope: Scope,
    /** The token Box just refused: renew it even if its stored lifetime has not run out. */
    options?: { rejected?: string },
  ) => Promise<string | null>;
  fetch?: typeof fetch;
  /** Waits between download retries; tests pass an instant one. */
  sleep?: (ms: number) => Promise<void>;
};

/** Reads the user's own Box sign-in, the one made for the Box MCP connection, renewing it when due. */
export function boxAccessToken(
  broker: Pick<McpOAuthBroker, "providerFor">,
): BoxFilesDeps["accessToken"] {
  return async (account, scope, options) => {
    const provider = await broker.providerFor(account, scope);
    if (options?.rejected) await provider?.renew(options.rejected);
    return (await provider?.tokens())?.access_token ?? null;
  };
}

export type BoxFileSummary = {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  modifiedTime: string;
  isFolder: boolean;
};

export type BoxFileDownload = {
  name: string;
  mimeType: string;
  bytes: Uint8Array;
  webViewLink: string;
  modifiedTime: string;
};

/** The caller's connected Box accounts in one space, oldest first. Each is the caller's own MCP server. */
export async function listBoxAccounts(
  prisma: Pick<PrismaClient, "mcpServer">,
  scope: Scope,
): Promise<BoxAccount[]> {
  const rows = await prisma.mcpServer.findMany({
    where: {
      spaceId: scope.spaceId,
      userId: scope.userId,
      enabled: true,
      endpoint: { startsWith: "https://" },
    },
    select: { id: true, name: true, endpoint: true, secretId: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.filter((row) => isBoxEndpoint(row.endpoint));
}

const webLink = (id: string) => `https://app.box.com/file/${id}`;

function assertBoxId(id: string): string {
  if (!BOX_ID.test(id)) throw new BoxFileError("not_found", "Not a Box file or folder id");
  return id;
}

function summary(value: unknown): BoxFileSummary | null {
  const item = asRecord(value);
  // Web links and anything else are not files of the user's account: never followed.
  if (!item || (item.type !== "file" && item.type !== "folder")) return null;
  const size = Number(item.size);
  return {
    id: String(item.id ?? ""),
    name: typeof item.name === "string" ? item.name : "",
    mimeType: "",
    ...(item.type === "file" && item.size !== undefined && Number.isFinite(size) ? { size } : {}),
    modifiedTime: typeof item.modified_at === "string" ? item.modified_at : "",
    isFolder: item.type === "folder",
  };
}

function mapStatus(status: number): BoxFileError {
  if (status === 401)
    return new BoxFileError("reconnect", "The Box account needs to be reconnected");
  if (status === 403 || status === 404) return new BoxFileError("not_found", "File not found");
  if (status === 413) return new BoxFileError("too_large", "The file is too large to import");
  if (status === 429)
    return new BoxFileError("rate_limited", "Box rate limit reached; try again later");
  return new BoxFileError("failed", `Box did not accept the request (${status})`);
}

/** The caller's own Box account; `scope` supplies the space and user, never the input. */
async function connect(deps: BoxFilesDeps, scope: Scope, connectionId?: string) {
  const accounts = await listBoxAccounts(deps.prisma, scope);
  const account = connectionId
    ? accounts.find((candidate) => candidate.id === connectionId)
    : accounts.length === 1
      ? accounts[0]
      : undefined;
  if (!account)
    throw new BoxFileError(
      "not_connected",
      accounts.length > 1 && !connectionId
        ? "Choose which Box account to use"
        : "No connected Box account",
    );
  const doFetch = deps.fetch ?? fetch;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)));
  const send = (url: string, token: string, signal: AbortSignal) =>
    // Never a BoxApi shared-link header: only the user's own content is reachable.
    doFetch(url, {
      headers: { authorization: `Bearer ${token}` },
      redirect: "manual",
      signal,
    }).catch(() => {
      throw new BoxFileError("failed", "Box request failed");
    });
  /** One authorized request to the Box API. A 401 renews the token and retries once. */
  const call = async (url: string, signal: AbortSignal): Promise<Response> => {
    const token = await deps.accessToken(account, scope);
    if (!token) throw new BoxFileError("reconnect", "The Box account needs to be reconnected");
    const response = await send(url, token, signal);
    if (response.status !== 401) return response;
    await response.body?.cancel().catch(() => undefined);
    const renewed = await deps.accessToken(account, scope, { rejected: token });
    if (!renewed || renewed === token)
      throw new BoxFileError("reconnect", "The Box account needs to be reconnected");
    return send(url, renewed, signal);
  };
  const json = async (path: string, signal: AbortSignal): Promise<unknown> => {
    const response = await call(`${API}${path}`, signal);
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw mapStatus(response.status);
    }
    return response.json().catch(() => {
      throw new BoxFileError("failed", "Box returned an unreadable answer");
    });
  };
  return { json, call, doFetch, sleep, account };
}

/**
 * Files and folders of the caller's Box for a picker: a text search, or the children of `folderId`
 * (the root when neither is given). The page token is Box's marker for a folder and an offset for a search.
 */
export async function listBoxFiles(
  deps: BoxFilesDeps,
  scope: Scope & { signal: AbortSignal },
  input: { connectionId?: string; query?: string; folderId?: string; pageToken?: string } = {},
): Promise<{ files: BoxFileSummary[]; nextPageToken?: string }> {
  const { json } = await connect(deps, scope, input.connectionId);
  const query = input.query?.trim();
  if (query) {
    const offset = input.pageToken ? Number(input.pageToken) : 0;
    if (!Number.isInteger(offset) || offset < 0) throw new BoxFileError("failed", "Bad page token");
    const params = new URLSearchParams({
      query,
      limit: String(PAGE_SIZE),
      offset: String(offset),
      fields: FIELDS,
    });
    const data = asRecord(await json(`/search?${params}`, scope.signal));
    const entries = Array.isArray(data?.entries) ? data.entries : [];
    const total = Number(data?.total_count);
    const next = offset + entries.length;
    return {
      files: entries.flatMap((entry) => summary(entry) ?? []),
      ...(entries.length > 0 && Number.isFinite(total) && next < total
        ? { nextPageToken: String(next) }
        : {}),
    };
  }
  const params = new URLSearchParams({
    limit: String(PAGE_SIZE),
    usemarker: "true",
    fields: FIELDS,
    ...(input.pageToken ? { marker: input.pageToken } : {}),
  });
  const data = asRecord(
    await json(`/folders/${assertBoxId(input.folderId ?? "0")}/items?${params}`, scope.signal),
  );
  const entries = Array.isArray(data?.entries) ? data.entries : [];
  const marker = data?.next_marker;
  return {
    files: entries.flatMap((entry) => summary(entry) ?? []),
    ...(typeof marker === "string" && marker ? { nextPageToken: marker } : {}),
  };
}

/** One file's or folder's details, from the caller's own Box. */
export async function getBoxItem(
  deps: BoxFilesDeps,
  scope: Scope & { signal: AbortSignal },
  id: string,
  kind: "file" | "folder",
  connectionId?: string,
): Promise<BoxFileSummary> {
  const { json } = await connect(deps, scope, connectionId);
  const item = summary(await json(`/${kind}s/${assertBoxId(id)}?fields=${FIELDS}`, scope.signal));
  if (!item) throw new BoxFileError("not_found", "File not found");
  return item;
}

/** Reads a body into one buffer and gives up the moment it passes `max` bytes. */
async function readCapped(response: Response, max: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) {
    await response.body?.cancel().catch(() => undefined);
    throw new BoxFileError("too_large", "The file is too large to import");
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = response.body?.getReader();
  while (reader) {
    const { done, value } = await reader.read().catch(() => {
      throw new BoxFileError("failed", "Box download failed");
    });
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => undefined);
      throw new BoxFileError("too_large", "The file is too large to import");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  return bytes;
}

/** One file's bytes. Throws `BoxFileError`: `unsupported` for folders, `too_large` over `maxBytes`. */
export async function downloadBoxFile(
  deps: BoxFilesDeps,
  scope: Scope & { signal: AbortSignal },
  fileId: string,
  options: { connectionId?: string; maxBytes: number },
): Promise<BoxFileDownload> {
  const { json, call, doFetch, sleep } = await connect(deps, scope, options.connectionId);
  const id = assertBoxId(fileId);
  const file = summary(await json(`/files/${id}?fields=${FIELDS}`, scope.signal));
  if (!file || file.isFolder) throw new BoxFileError("unsupported", "Only files can be imported");
  if (file.size !== undefined && file.size > options.maxBytes)
    throw new BoxFileError("too_large", "The file is too large to import");
  let response = await call(`${API}/files/${id}/content`, scope.signal);
  // 202: Box is still preparing the file and says how long to wait.
  for (let tries = 0; response.status === 202 && tries < MAX_NOT_READY_RETRIES; tries++) {
    await response.body?.cancel().catch(() => undefined);
    const wait = Number(response.headers.get("retry-after"));
    await sleep(Math.min(Number.isFinite(wait) && wait > 0 ? wait * 1000 : 1000, 10_000));
    response = await call(`${API}/files/${id}/content`, scope.signal);
  }
  if (response.status >= 300 && response.status < 400) {
    await response.body?.cancel().catch(() => undefined);
    const location = response.headers.get("location") ?? "";
    let target: URL;
    try {
      target = new URL(location);
    } catch {
      throw new BoxFileError("failed", "Box sent an unusable download link");
    }
    // The link carries its own access: no bearer token goes to it, and only Box's host is allowed.
    if (target.protocol !== "https:" || !DOWNLOAD_HOST.test(target.hostname))
      throw new BoxFileError("failed", "Box sent an unusable download link");
    response = await doFetch(target, { redirect: "error", signal: scope.signal }).catch(() => {
      throw new BoxFileError("failed", "Box download failed");
    });
  }
  // 202 is a 2xx but carries no file: Box is still preparing it. Store nothing; the job retries.
  if (!response.ok || response.status === 202) {
    await response.body?.cancel().catch(() => undefined);
    throw response.status === 202
      ? new BoxFileError("failed", "Box is not ready to send this file")
      : mapStatus(response.status);
  }
  const bytes = await readCapped(response, options.maxBytes);
  return {
    name: file.name,
    mimeType:
      response.headers.get("content-type")?.split(";")[0]?.trim() || "application/octet-stream",
    bytes,
    webViewLink: webLink(id),
    modifiedTime: file.modifiedTime,
  };
}
