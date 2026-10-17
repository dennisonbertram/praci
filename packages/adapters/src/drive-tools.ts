import type {
  AdapterContext,
  ConnectorProxyRequest,
  ManagedConnectorProvider,
} from "@rakazo/adapter-kit";
import { clampInt } from "@rakazo/core";
import type { PrismaClient } from "@rakazo/db";
import { asRecord } from "./connector-http.js";
import {
  GoogleApiClient,
  GoogleApiError,
  isGoogleAuthFailure,
  isGoogleRateLimited,
} from "./google-api-request.js";
import { mailToolsAllowed } from "./mail-tools.js";

export const DRIVE_TOOL_NAMES = new Set([
  "drive_search",
  "drive_read",
  "drive_create_file",
  "drive_update_file",
]);

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const SHARED = "supportsAllDrives=true";
const FILE_FIELDS = "id,name,mimeType,modifiedTime,owners(emailAddress),webViewLink,size";
const WRITE_FIELDS = "id,name,webViewLink";
const DEFAULT_RESULTS = 25;
const MAX_RESULTS = 100;
const MAX_CONTENT_CHARS = 100_000;
const GOOGLE_DOC = "application/vnd.google-apps.document";
const EXPORTS: Record<string, string> = {
  [GOOGLE_DOC]: "text/plain",
  "application/vnd.google-apps.spreadsheet": "text/csv",
  "application/vnd.google-apps.presentation": "text/plain",
};
const TEXT_TYPES = new Set(["application/json", "application/xml", "application/x-yaml"]);

/** Same owner-only rule as the mail tools. */
export const driveToolsAllowed = mailToolsAllowed;

export type DriveAccount = {
  id: string;
  connectorId: string;
  app: string;
  accountRef: string;
  label: string;
  /** The Google account's address, once known. */
  email: string | null;
};

export type DriveToolDeps = {
  prisma: Pick<PrismaClient, "connection">;
  connectors: { managed(id: string): ManagedConnectorProvider | undefined };
  /** From the run, never from model input. */
  scope: { spaceId: string; userId: string };
  /** Connected Drive accounts of the bot owner. Memoized per run by the caller. */
  accounts: () => Promise<DriveAccount[]>;
  google?: GoogleApiClient;
};

class DriveToolError extends Error {}

/** Connected native Google Drive connections of one user in one space. */
export async function listDriveAccounts(
  prisma: Pick<PrismaClient, "connection">,
  scope: { spaceId: string; userId: string },
): Promise<DriveAccount[]> {
  const rows = await prisma.connection.findMany({
    where: {
      spaceId: scope.spaceId,
      userId: scope.userId,
      connectorId: "google",
      provider: "googledrive",
      status: "connected",
    },
    orderBy: { createdAt: "asc" },
  });
  return rows.flatMap((row) => {
    if (!row.providerRef) return [];
    const email = asRecord(row.metadata)?.driveEmail;
    return [
      {
        id: row.id,
        connectorId: row.connectorId,
        app: row.provider,
        accountRef: row.providerRef,
        label: row.displayName,
        email: typeof email === "string" && email ? email : null,
      },
    ];
  });
}

export async function driveToolFromTool(
  name: string,
  deps: DriveToolDeps,
  context: AdapterContext,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  try {
    const picked = await resolveAccount(deps, context, args);
    if ("error" in picked) return picked;
    const call = new DriveCall(deps, picked.account, context);
    if (name === "drive_search") return await driveSearch(call, args);
    if (name === "drive_read") return await driveRead(call, args);
    if (name === "drive_create_file") return await driveCreate(call, args);
    if (name === "drive_update_file") return await driveUpdate(call, args);
    return { error: `Unknown Drive tool ${name}` };
  } catch (error) {
    return { error: error instanceof DriveToolError ? error.message : "Drive tool failed" };
  }
}

/** The account named by `args.account` (address or name), or the only connected one. */
async function resolveAccount(
  deps: DriveToolDeps,
  context: AdapterContext,
  args: Record<string, unknown>,
): Promise<{ account: DriveAccount } | { error: string }> {
  const accounts = await deps.accounts();
  const wanted = typeof args.account === "string" ? args.account.trim().toLowerCase() : "";
  const names = () => accounts.map((a) => a.label).join(", ");
  if (!wanted && accounts.length > 1)
    return {
      error: `Pass account (the connection name) when more than one Drive account is connected: ${names()}`,
    };
  if (!wanted) {
    return accounts[0] ? { account: accounts[0] } : { error: "No connected Drive account" };
  }
  const named = (account: DriveAccount) =>
    account.label.toLowerCase() === wanted || account.email?.toLowerCase() === wanted;
  let found = accounts.find(named);
  if (!found) {
    // An address is not known until Drive has been asked once.
    for (const account of accounts) {
      if (!account.email) account.email = await fetchEmail(deps, account, context);
    }
    found = accounts.find(named);
  }
  return found
    ? { account: found }
    : {
        error: `No connected Drive account ${wanted.slice(0, 200)}${accounts.length > 1 ? `. Available: ${names()}` : ""}`,
      };
}

async function fetchEmail(
  deps: DriveToolDeps,
  account: DriveAccount,
  context: AdapterContext,
): Promise<string | null> {
  try {
    const about = asRecord(
      await new DriveCall(deps, account, context).request(
        "GET",
        `${API}/about?fields=user(emailAddress)`,
      ),
    );
    const email = asRecord(about?.user)?.emailAddress;
    if (typeof email !== "string" || !email) return null;
    try {
      const where = { id: account.id, spaceId: deps.scope.spaceId, userId: deps.scope.userId };
      const row = await deps.prisma.connection.findFirst({ where });
      await deps.prisma.connection.updateMany({
        where,
        data: { metadata: { ...(asRecord(row?.metadata) ?? {}), driveEmail: email } as never },
      });
    } catch {
      // Remembering the address is optional; the next lookup asks again.
    }
    return email;
  } catch {
    return null;
  }
}

class DriveCall {
  private readonly google: GoogleApiClient;

  constructor(
    private readonly deps: DriveToolDeps,
    private readonly account: DriveAccount,
    private readonly context: AdapterContext,
  ) {
    this.google = deps.google ?? new GoogleApiClient();
  }

  /** A failed write says the outcome is unclear; GoogleApiClient never repeats a POST. */
  async request(
    method: ConnectorProxyRequest["method"],
    url: string,
    init: { body?: unknown; contentType?: string; responseType?: "text" } = {},
  ): Promise<unknown> {
    const connector = this.deps.connectors.managed(this.account.connectorId);
    if (!connector?.proxy) throw new DriveToolError("This Drive connection cannot be used");
    try {
      const response = await this.google.request({
        connector,
        account: {
          connectorId: this.account.connectorId,
          providerRef: this.account.accountRef,
          app: this.account.app,
        },
        method,
        url,
        ...(init.body === undefined ? {} : { body: init.body }),
        ...(init.contentType ? { contentType: init.contentType } : {}),
        ...(init.responseType ? { responseType: init.responseType } : {}),
        context: this.context,
      });
      return response.data;
    } catch (cause) {
      if (!(cause instanceof GoogleApiError)) throw cause;
      const response = cause.response;
      if (response && isGoogleAuthFailure(response))
        throw new DriveToolError("The Drive account needs to be reconnected");
      if (response && isGoogleRateLimited(response))
        throw new DriveToolError("Drive rate limit reached; try again later");
      if (response?.status === 404) throw new DriveToolError("File not found");
      if (response && response.status >= 400 && response.status < 500 && response.status !== 408)
        throw new DriveToolError(`Drive did not accept the request (${response.status})`);
      throw new DriveToolError(
        method === "GET"
          ? "Drive request failed"
          : "The outcome in Drive is unclear. Check Drive before trying again.",
      );
    }
  }
}

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
/** A string literal for a Drive `q` expression. */
export const driveQuote = (value: string) =>
  `'${value.replaceAll("\\", "\\\\").replaceAll("'", "\\'")}'`;

function summary(file: unknown) {
  const f = asRecord(file) ?? {};
  const owners = Array.isArray(f.owners)
    ? f.owners.flatMap((o) => {
        const email = asRecord(o)?.emailAddress;
        return typeof email === "string" ? [email] : [];
      })
    : [];
  return {
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    modifiedTime: f.modifiedTime,
    owners,
    webViewLink: f.webViewLink,
    size: f.size,
  };
}

async function driveSearch(call: DriveCall, args: Record<string, unknown>) {
  const query = text(args.query);
  const mimeType = text(args.mimeType);
  if (!query) return { error: "query is required" };
  const clauses = [
    "trashed = false",
    `(name contains ${driveQuote(query)} or fullText contains ${driveQuote(query)})`,
    ...(mimeType ? [`mimeType = ${driveQuote(mimeType)}`] : []),
  ];
  const params = new URLSearchParams({
    q: clauses.join(" and "),
    pageSize: String(clampInt(args.maxResults, 1, MAX_RESULTS, DEFAULT_RESULTS)),
    fields: `files(${FILE_FIELDS})`,
    corpora: "allDrives",
    includeItemsFromAllDrives: "true",
    supportsAllDrives: "true",
  });
  const data = asRecord(await call.request("GET", `${API}/files?${params}`));
  const files = Array.isArray(data?.files) ? data.files.map(summary) : [];
  return { files };
}

function isTextType(mimeType: string): boolean {
  return mimeType.startsWith("text/") || TEXT_TYPES.has(mimeType);
}

async function driveRead(call: DriveCall, args: Record<string, unknown>) {
  const fileId = text(args.fileId);
  if (!fileId) return { error: "fileId is required" };
  const id = encodeURIComponent(fileId);
  const meta = asRecord(
    await call.request("GET", `${API}/files/${id}?fields=${FILE_FIELDS}&${SHARED}`),
  );
  const file = summary(meta);
  const mimeType = typeof file.mimeType === "string" ? file.mimeType : "";
  const exportType = EXPORTS[mimeType];
  if (!exportType && !isTextType(mimeType))
    return { ...file, note: "The content of this file type can't be read as text." };
  const url = exportType
    ? `${API}/files/${id}/export?mimeType=${encodeURIComponent(exportType)}`
    : `${API}/files/${id}?alt=media&${SHARED}`;
  const data = await call.request("GET", url, { responseType: "text" });
  const full = typeof data === "string" ? data : JSON.stringify(data);
  const truncated = full.length > MAX_CONTENT_CHARS;
  return {
    ...file,
    content: truncated ? full.slice(0, MAX_CONTENT_CHARS) : full,
    truncated,
    ...(truncated ? { note: `Content truncated to ${MAX_CONTENT_CHARS} characters.` } : {}),
  };
}

function written(data: unknown) {
  const f = asRecord(data) ?? {};
  return { id: f.id, name: f.name, webViewLink: f.webViewLink };
}

async function driveCreate(call: DriveCall, args: Record<string, unknown>) {
  const name = text(args.name);
  if (!name) return { error: "name is required" };
  if (typeof args.content !== "string") return { error: "content is required" };
  if (args.kind !== "doc" && args.kind !== "text") return { error: 'kind must be "doc" or "text"' };
  const mimeType = text(args.mimeType);
  if (mimeType && !isTextType(mimeType)) return { error: "mimeType must be a text type" };
  const parent = text(args.parentFolderId);
  const fileType = args.kind === "doc" ? GOOGLE_DOC : mimeType || "text/plain";
  const created = asRecord(
    await call.request("POST", `${API}/files?fields=${WRITE_FIELDS}&${SHARED}`, {
      body: { name, mimeType: fileType, ...(parent ? { parents: [parent] } : {}) },
    }),
  );
  if (typeof created?.id !== "string") throw new DriveToolError("Unexpected Drive response");
  try {
    return written(
      await call.request("PATCH", uploadUrl(created.id), {
        body: args.content,
        contentType: args.kind === "doc" ? "text/plain" : fileType,
      }),
    );
  } catch (error) {
    const reason = error instanceof DriveToolError ? ` (${error.message})` : "";
    throw new DriveToolError(
      `The file was created (id ${created.id}) but its content was not saved${reason}. Check Drive.`,
    );
  }
}

const uploadUrl = (id: string) =>
  `${UPLOAD}/files/${encodeURIComponent(id)}?uploadType=media&fields=${WRITE_FIELDS}&${SHARED}`;

async function driveUpdate(call: DriveCall, args: Record<string, unknown>) {
  const fileId = text(args.fileId);
  const name = text(args.name);
  if (!fileId) return { error: "fileId is required" };
  const hasContent = typeof args.content === "string";
  if (!hasContent && !name) return { error: "Pass content or name" };
  let current = "";
  if (hasContent) {
    const meta = asRecord(
      await call.request(
        "GET",
        `${API}/files/${encodeURIComponent(fileId)}?fields=mimeType&${SHARED}`,
      ),
    );
    current = typeof meta?.mimeType === "string" ? meta.mimeType : "";
    if (current !== GOOGLE_DOC && !isTextType(current))
      return { error: "The content of this file type can't be replaced with text." };
  }
  let result: unknown;
  if (name)
    result = await call.request(
      "PATCH",
      `${API}/files/${encodeURIComponent(fileId)}?fields=${WRITE_FIELDS}&${SHARED}`,
      { body: { name } },
    );
  if (hasContent) {
    // Drive converts text/plain into a Google Doc; a text file keeps its own type.
    result = await call.request("PATCH", uploadUrl(fileId), {
      body: args.content,
      contentType: current === GOOGLE_DOC ? "text/plain" : current,
    });
  }
  return written(result);
}
