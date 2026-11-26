import type { SecretStore } from "@rakazo/adapter-kit";
import type { HttpSourceCall } from "@rakazo/contracts";
import { HttpSourceCallSchema, PAGE_SOURCE_VALUE_MAX_BYTES } from "@rakazo/contracts";
import type { ActionApprovalRule } from "@rakazo/core";
import { resolveActionApprovalDetail } from "@rakazo/core";
import { urlSite } from "@rakazo/core/egress";
import type { PrismaClient } from "@rakazo/db";
import { listApprovalRules } from "@rakazo/db";
import { findBotSecret, requestWithBotSecret } from "./bot-secrets.js";
import { redactConnectorPayload } from "./connector-safety.js";
import type { ResolveHostname } from "./network-address.js";
import { defaultResolveHostname, isPrivateAddress } from "./network-address.js";
import type { RemoteTransportDependencies } from "./remote-mcp.js";
import { fetchSafeWebBytes, isBlockedHostname } from "./web-ssrf.js";

export const HTTP_SOURCE_MAX_BYTES = 1_000_000;
export const HTTP_SOURCE_CSV_MAX_ROWS = 5_000;
export const HTTP_SOURCE_CSV_MAX_COLUMNS = 50;
const TIMEOUT_MS = 15_000;
const CSV_HEADER_MAX = 200;
/** Added per cell when sizing the parsed rows (quotes, colon, comma). */
const CSV_CELL_OVERHEAD = 6;

type Scope = { spaceId: string; botId: string; userId: string };

/** A message safe to show the owner or the model: fixed words, no response content. */
export class HttpSourceError extends Error {}

/** Every message in an error's cause chain, for logs. Never includes a response body. */
export function errorChain(error: unknown): string {
  const parts: string[] = [];
  for (let e = error, depth = 0; e instanceof Error && depth < 5; e = e.cause, depth++) {
    parts.push(e.message);
  }
  return parts.join(" <- ");
}

/**
 * The checks the fetch applies, minus DNS (made at fetch time): the shape of the URL and a
 * private or internal host written out in it. Returns the parsed call, or the reason it is refused.
 */
export function checkHttpSourceCall(input: unknown): HttpSourceCall | string {
  const parsed = HttpSourceCallSchema.safeParse(input);
  if (!parsed.success) return parsed.error.issues[0]?.message ?? "The request is not valid.";
  const url = new URL(parsed.data.url);
  if (isBlockedHostname(url.hostname.replace(/^\[|\]$/g, ""))) {
    return "The URL targets a private or internal host.";
  }
  return parsed.data;
}

/**
 * Why this call may not run now, or null: a Block rule for the URL's site (same resolution as
 * web_fetch), a secret that is gone or unusable, or a secret saved for another origin.
 */
export async function httpSourceRefusal(
  prisma: PrismaClient,
  scope: Scope,
  call: HttpSourceCall,
): Promise<string | null> {
  const rules = (await listApprovalRules(prisma, scope)) as ActionApprovalRule[];
  const site = urlSite(call.url);
  const resolved = resolveActionApprovalDetail({
    toolName: "web_fetch",
    viaConnector: false,
    site,
    rules,
    botId: scope.botId,
  });
  if (resolved.decision === "block") return "A Block rule covers this site.";
  if (call.secret) {
    const secret = await findBotSecret(prisma, scope, call.secret);
    if (!secret) return `There is no saved key named "${call.secret}".`;
    if (secret.auth.type === "login" || secret.auth.type === "command") {
      return `The key "${call.secret}" cannot be sent in a request.`;
    }
    if (secret.origin !== new URL(call.url).origin) {
      return `The key "${call.secret}" is saved for a different site (${secret.origin}).`;
    }
  }
  return null;
}

const NUMBER = /^-?(0|[1-9]\d*)(\.\d+)?$/;

/** RFC 4180-ish: quoted fields, "" for a quote, CR/LF/CRLF rows. Plain integers and decimals become numbers. */
export function parseCsv(text: string): Record<string, string | number>[] {
  const table: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let any = false;
  const endField = () => {
    row.push(field);
    field = "";
    if (row.length > HTTP_SOURCE_CSV_MAX_COLUMNS) {
      throw new HttpSourceError(`The CSV has more than ${HTTP_SOURCE_CSV_MAX_COLUMNS} columns.`);
    }
  };
  const endRow = () => {
    endField();
    if (row.length > 1 || row[0] !== "") table.push(row);
    row = [];
    any = false;
    if (table.length > HTTP_SOURCE_CSV_MAX_ROWS + 1) {
      throw new HttpSourceError(`The CSV has more than ${HTTP_SOURCE_CSV_MAX_ROWS} rows.`);
    }
  };
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < source.length; i++) {
    const char = source[i] as string;
    if (quoted) {
      if (char !== '"') field += char;
      else if (source[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = false;
    } else if (char === '"' && field === "") {
      quoted = true;
      any = true;
    } else if (char === ",") {
      endField();
      any = true;
    } else if (char === "\r" || char === "\n") {
      if (char === "\r" && source[i + 1] === "\n") i++;
      endRow();
    } else {
      field += char;
      any = true;
    }
  }
  if (quoted) throw new HttpSourceError("The CSV has an unclosed quote.");
  if (any || field !== "") endRow();
  const [header, ...rows] = table;
  if (!header) throw new HttpSourceError("The CSV is empty.");
  if (header.some((name) => name.length > CSV_HEADER_MAX)) {
    throw new HttpSourceError(`A CSV header is longer than ${CSV_HEADER_MAX} characters.`);
  }
  // Every row repeats every header as a key, so size the output before building each row.
  const headerBytes = header.reduce((sum, name) => sum + name.length + CSV_CELL_OVERHEAD, 0);
  let bytes = 0;
  return rows.map((cells) => {
    bytes += headerBytes + cells.reduce((sum, cell) => sum + cell.length, 0);
    if (bytes > PAGE_SOURCE_VALUE_MAX_BYTES) {
      throw new HttpSourceError("The CSV is larger than 1 MB.");
    }
    return Object.fromEntries(
      header.map((name, index) => {
        const cell = cells[index] ?? "";
        return [name, NUMBER.test(cell) ? Number(cell) : cell];
      }),
    );
  });
}

function statusError(status: number, cause?: unknown): HttpSourceError {
  return status >= 300 && status < 400
    ? new HttpSourceError("The API redirected; update the source URL.", { cause })
    : new HttpSourceError(`The API returned ${status}.`, { cause });
}

function parseBody(accept: "json" | "csv", body: unknown): unknown {
  if (accept === "csv") {
    if (typeof body !== "string") throw new HttpSourceError("The response is not CSV.");
    return parseCsv(body);
  }
  if (typeof body === "string") throw new HttpSourceError("The response is not JSON.");
  return body;
}

export interface HttpSourceRunDeps {
  prisma: PrismaClient;
  secretStore?: SecretStore;
  network?: RemoteTransportDependencies;
}

/**
 * One GET of an approved http source. `beforeSend` runs as the last step before the request goes
 * out and throws when the approval no longer holds. Errors carry fixed text only: never a response
 * body or header.
 */
export async function runHttpSource(
  deps: HttpSourceRunDeps,
  scope: Scope,
  call: HttpSourceCall,
  beforeSend: () => Promise<void>,
): Promise<unknown> {
  // Resolve once and check the addresses first. The approval check then comes after the only slow
  // lookup, and the request is sent to exactly these addresses (connect-time checks still run).
  const resolve = deps.network?.resolveHostname ?? defaultResolveHostname;
  const addresses = await resolve(new URL(call.url).hostname.replace(/^\[|\]$/g, ""));
  if (addresses.length === 0 || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new HttpSourceError("The URL targets a private or internal host.");
  }
  const pinned: ResolveHostname = async () => addresses;
  const network = { fetch: deps.network?.fetch, resolveHostname: pinned };
  if (call.secret) {
    if (!deps.secretStore) throw new HttpSourceError("Saved keys are not available.");
    let stopped: unknown;
    let redactions: string[] = [];
    const result = (await requestWithBotSecret({
      prisma: deps.prisma,
      secretStore: deps.secretStore,
      scope,
      request: { name: call.secret, url: call.url, method: "GET" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      remote: network,
      maxOutputChars: HTTP_SOURCE_MAX_BYTES,
      registerRedactions: (values) => {
        redactions = values;
      },
      beforeSend: () =>
        beforeSend().catch((error: unknown) => {
          stopped = error;
          throw error;
        }),
    }).catch(() => ({ error: "The request failed." }))) as {
      error?: string;
      redirected?: boolean;
      status?: number;
      body?: unknown;
      truncated?: boolean;
    };
    if (stopped) throw stopped;
    if (result.redirected) throw statusError(302);
    if (typeof result.status !== "number") {
      throw new HttpSourceError(
        result.error?.startsWith("This credential cannot")
          ? "The key cannot be sent to that URL."
          : "The request failed.",
      );
    }
    if (result.status < 200 || result.status >= 300) throw statusError(result.status);
    if (result.truncated) throw new HttpSourceError("The response is larger than 1 MB.");
    // Redact again after parsing: decoding (CSV quotes, JSON escapes) can rebuild a key that the
    // raw text did not contain.
    return redactConnectorPayload(parseBody(call.accept, result.body), redactions);
  }
  await beforeSend();
  let response: Awaited<ReturnType<typeof fetchSafeWebBytes>>;
  try {
    response = await fetchSafeWebBytes(call.url, {
      method: "GET",
      maxRedirects: 0,
      timeoutMs: TIMEOUT_MS,
      maxBytes: HTTP_SOURCE_MAX_BYTES,
      headers: { accept: call.accept === "csv" ? "text/csv" : "application/json" },
      fetch: network.fetch,
      resolveHostname: pinned,
    });
  } catch (error) {
    // The safe fetch wraps transport errors, so read the whole chain.
    const message = errorChain(error);
    const fail = (text: string) => new HttpSourceError(text, { cause: error });
    const status = /HTTP (\d{3})/.exec(message)?.[1];
    if (status) throw statusError(Number(status), error);
    if (/Too many redirects|Redirects are not followed|Redirect missing/.test(message)) {
      throw statusError(302, error);
    }
    if (/Response is too large/.test(message)) throw fail("The response is larger than 1 MB.");
    if (/private|internal/.test(message)) throw fail("The URL targets a private or internal host.");
    throw fail("The request failed.");
  }
  const text = new TextDecoder().decode(response.body);
  if (call.accept === "csv") return parseCsv(text);
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpSourceError("The response is not JSON.");
  }
}
