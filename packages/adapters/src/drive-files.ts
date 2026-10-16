import type { AdapterContext, ManagedConnectorProvider } from "@rakazo/adapter-kit";
import type { PrismaClient } from "@rakazo/db";
import { asRecord } from "./connector-http.js";
import { driveQuote, listDriveAccounts } from "./drive-tools.js";
import { GoogleApiClient, GoogleApiError, isGoogleAuthFailure } from "./google-api-request.js";

const API = "https://www.googleapis.com/drive/v3";
const GOOGLE_APPS = "application/vnd.google-apps.";
const FOLDER = `${GOOGLE_APPS}folder`;
// Drive exports these to PDF. Forms, Sites, shortcuts and the rest have nothing to download.
const PDF_EXPORTS = new Set(
  ["document", "spreadsheet", "presentation", "drawing"].map((kind) => GOOGLE_APPS + kind),
);
const FIELDS = "id,name,mimeType,size,modifiedTime,webViewLink";
const PAGE_SIZE = 50;
const SHARED = "supportsAllDrives=true";

export type DriveFileErrorCode =
  | "not_connected"
  | "reconnect"
  | "not_found"
  | "unsupported"
  | "too_large"
  | "rate_limited"
  | "failed";

/** Why a Drive file could not be listed or downloaded; `code` is stable, `message` is safe to show. */
export class DriveFileError extends Error {
  constructor(
    readonly code: DriveFileErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DriveFileError";
  }
}

export type DriveFilesDeps = {
  prisma: Pick<PrismaClient, "connection">;
  connectors: { managed(id: string): ManagedConnectorProvider | undefined };
  google?: GoogleApiClient;
};

export type DriveFileSummary = {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  modifiedTime: string;
  webViewLink: string;
  isFolder: boolean;
};

export type DriveFileDownload = {
  name: string;
  mimeType: string;
  bytes: Uint8Array;
  webViewLink: string;
  modifiedTime: string;
};

type Target = { connectionId?: string };

/** The caller's own connected Drive account; `context` supplies the space and user, never the input. */
async function connect(deps: DriveFilesDeps, context: AdapterContext, target: Target) {
  const accounts = await listDriveAccounts(deps.prisma, {
    spaceId: context.spaceId,
    userId: context.userId,
  });
  const account = target.connectionId
    ? accounts.find((candidate) => candidate.id === target.connectionId)
    : accounts.length === 1
      ? accounts[0]
      : undefined;
  if (!account)
    throw new DriveFileError(
      "not_connected",
      accounts.length > 1 && !target.connectionId
        ? "Choose which Google Drive account to use"
        : "No connected Google Drive account",
    );
  const connector = deps.connectors.managed(account.connectorId);
  if (!connector?.proxy) throw new DriveFileError("failed", "This Drive connection cannot be used");
  const google = deps.google ?? new GoogleApiClient();
  return (
    url: string,
    init: { bytes?: { maxBytes: number } } = {},
  ): Promise<{ data: unknown; contentType?: string }> =>
    google
      .request({
        connector,
        account: {
          connectorId: account.connectorId,
          providerRef: account.accountRef,
          app: account.app,
        },
        method: "GET",
        url,
        ...(init.bytes ? { responseType: "bytes" as const, maxBytes: init.bytes.maxBytes } : {}),
        context,
      })
      .catch((cause: unknown) => {
        throw mapError(cause);
      });
}

function mapError(cause: unknown): DriveFileError {
  if (!(cause instanceof GoogleApiError))
    return new DriveFileError("failed", "Drive request failed");
  const response = cause.response;
  if (!response) return new DriveFileError("failed", "Drive request failed");
  if (isGoogleAuthFailure(response))
    return new DriveFileError("reconnect", "The Drive account needs to be reconnected");
  if (response.status === 404) return new DriveFileError("not_found", "File not found");
  if (response.status === 413 || hasReason(response.data, "exportSizeLimitExceeded"))
    return new DriveFileError("too_large", "The file is too large to import");
  if (response.status === 429 || hasReason(response.data, "rateLimitExceeded"))
    return new DriveFileError("rate_limited", "Drive rate limit reached; try again later");
  return new DriveFileError("failed", `Drive did not accept the request (${response.status})`);
}

function hasReason(data: unknown, reason: string): boolean {
  const errors = asRecord(asRecord(data)?.error)?.errors;
  return Array.isArray(errors) && errors.some((entry) => asRecord(entry)?.reason === reason);
}

function summary(value: unknown): DriveFileSummary {
  const file = asRecord(value) ?? {};
  const mimeType = typeof file.mimeType === "string" ? file.mimeType : "";
  const size = Number(file.size);
  return {
    id: String(file.id ?? ""),
    name: typeof file.name === "string" ? file.name : "",
    mimeType,
    ...(file.size !== undefined && Number.isFinite(size) ? { size } : {}),
    modifiedTime: typeof file.modifiedTime === "string" ? file.modifiedTime : "",
    webViewLink: typeof file.webViewLink === "string" ? file.webViewLink : "",
    isFolder: mimeType === FOLDER,
  };
}

/**
 * Files of the caller's Drive for a picker: a text search across Drive, or the children of `folderId`
 * (My Drive root when neither is given). Folders are included so the picker can browse.
 */
export async function listDriveFiles(
  deps: DriveFilesDeps,
  context: AdapterContext,
  input: Target & { query?: string; folderId?: string; pageToken?: string } = {},
): Promise<{ files: DriveFileSummary[]; nextPageToken?: string }> {
  const request = await connect(deps, context, input);
  const query = input.query?.trim();
  const clauses = [
    "trashed = false",
    ...(query ? [`name contains ${driveQuote(query)}`] : []),
    ...(input.folderId || !query ? [`${driveQuote(input.folderId || "root")} in parents`] : []),
  ];
  const params = new URLSearchParams({
    q: clauses.join(" and "),
    pageSize: String(PAGE_SIZE),
    orderBy: "folder,name",
    fields: `nextPageToken,files(${FIELDS})`,
    corpora: "allDrives",
    includeItemsFromAllDrives: "true",
    supportsAllDrives: "true",
    ...(input.pageToken ? { pageToken: input.pageToken } : {}),
  });
  const data = asRecord((await request(`${API}/files?${params}`)).data);
  const next = data?.nextPageToken;
  return {
    files: (Array.isArray(data?.files) ? data.files : []).map(summary),
    ...(typeof next === "string" && next ? { nextPageToken: next } : {}),
  };
}

/**
 * One file's bytes. Google Docs, Sheets, Slides and Drawings are exported as PDF (Drive caps an
 * export at 10 MB); other files are downloaded as they are. Throws `DriveFileError`: `unsupported` for
 * folders, shortcuts, Forms and other files with no content, `too_large` over `maxBytes`.
 */
export async function downloadDriveFile(
  deps: DriveFilesDeps,
  context: AdapterContext,
  fileId: string,
  options: Target & { maxBytes: number },
): Promise<DriveFileDownload> {
  const request = await connect(deps, context, options);
  const id = encodeURIComponent(fileId);
  const file = summary((await request(`${API}/files/${id}?fields=${FIELDS}&${SHARED}`)).data);
  const exported = PDF_EXPORTS.has(file.mimeType);
  if (file.mimeType.startsWith(GOOGLE_APPS) && !exported)
    throw new DriveFileError("unsupported", "This kind of Google file can't be imported");
  if (file.size !== undefined && file.size > options.maxBytes)
    throw new DriveFileError("too_large", "The file is too large to import");
  const url = exported
    ? `${API}/files/${id}/export?mimeType=application%2Fpdf`
    : `${API}/files/${id}?alt=media&${SHARED}`;
  const { data, contentType } = await request(url, { bytes: { maxBytes: options.maxBytes } });
  if (!(data instanceof Uint8Array))
    throw new DriveFileError("failed", "This Drive connection cannot download files");
  // A connector that ignores maxBytes must not get past the cap.
  if (data.byteLength > options.maxBytes)
    throw new DriveFileError("too_large", "The file is too large to import");
  return {
    name: exported && !/\.pdf$/i.test(file.name) ? `${file.name}.pdf` : file.name,
    mimeType: exported
      ? "application/pdf"
      : file.mimeType || contentType || "application/octet-stream",
    bytes: data,
    webViewLink: file.webViewLink,
    modifiedTime: file.modifiedTime,
  };
}
