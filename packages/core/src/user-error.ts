import type { ThreadSnapshot } from "@rakazo/contracts";
import {
  MISSING_TOOL_FINAL_RESPONSE_ERROR,
  PINNED_CONNECTION_LOST_MESSAGE,
} from "@rakazo/contracts";

/** Copy each client supplies in its own language. */
export type UserErrorCopy = { fallback: string; offline: string };

/** Browser, React Native, Expo, and Node wordings for a request that never got a response. */
const NETWORK_FAILURE =
  /^(?:failed to fetch|load failed|fetch failed|network ?error|network request failed)|networkerror when attempting|could not connect to the server|internet connection appears to be offline/i;
const NETWORK_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "ENOTFOUND",
  "EAI_AGAIN",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ETIMEDOUT",
]);

/** Implementation detail that should never reach the screen as-is. */
const TECHNICAL_MESSAGE = [
  /\[(?:body|query|params|headers)(?:\.[^\]]*)?\]/, // validation issue paths
  /\w+Exception\b/,
  /^\w*Error:/,
  /\(at \S+:\d+|\bat \S+ \(\S+:\d+(?::\d+)?\)|\.(?:swift|kt|java|mm?|[cm]?[jt]sx?):\d+/, // stack frames
  /^\s*[[{]/, // JSON
  /^rpc \S+ failed|\(\d{3}\)|\bstatus(?: code)? \d{3}\b/i, // HTTP status dumps
  /\bE(?:CONN[A-Z]+|TIMEDOUT|NOTFOUND|AI_AGAIN|PIPE|HOSTUNREACH|NETUNREACH)\b/,
  /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+$/, // bare internal codes
  /\d+ bytes\b/,
  /^(?:internal server error|bad gateway|service unavailable|gateway timeout)\.?$/i, // bare HTTP reason phrases
  /unexpected token|is not a function|cannot read propert|undefined is not|null is not an object|json parse error/i,
];

/** True when a thrown value means the server could not be reached at all. */
export function isNetworkFailure(error: unknown): boolean {
  let current = error;
  for (let depth = 0; current instanceof Error && depth < 4; depth += 1) {
    if (NETWORK_FAILURE.test(current.message.trim())) return true;
    const code = (current as { code?: unknown }).code;
    if (typeof code === "string" && NETWORK_CODES.has(code)) return true;
    current = current.cause;
  }
  return false;
}

/** True for the gateway answers a proxy gives while the server is down or restarting. */
export function isUnreachableStatus(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

/**
 * True when a request may never have reached the server (no connection, a timeout, or a gateway
 * error), so sending it again later is safe and right; false when the server answered.
 */
export function isServerUnreachable(error: unknown): boolean {
  if (isNetworkFailure(error)) return true;
  let current = error;
  for (let depth = 0; current instanceof Error && depth < 4; depth += 1) {
    if (current.name === "TimeoutError") return true;
    const status = (current as { status?: unknown }).status;
    if (typeof status === "number" && isUnreachableStatus(status)) return true;
    current = current.cause;
  }
  return false;
}

export function isTechnicalErrorMessage(message: string): boolean {
  return TECHNICAL_MESSAGE.some((pattern) => pattern.test(message));
}

const INTERNAL_RUN_ERROR =
  /upstream connect error|reset reason|invocation in|prisma|at Object\.|\bECONN[A-Z]*\b|(?:^|[\s(])\/(?:[\w.-]+\/)+[\w.-]+|[A-Za-z]:\\|\.[cm]?[jt]sx?:\d+|\b(?:SELECT|INSERT INTO|UPDATE \w+ SET|DELETE FROM)\b|\bat \S+ \(/i;

/** True for a stored run error that is implementation detail (database or stack-trace text). */
export function isInternalRunError(error: string): boolean {
  return error.length > 300 || INTERNAL_RUN_ERROR.test(error) || isTechnicalErrorMessage(error);
}

/** The `message` inside a provider's JSON error body (`400 {"error":{"message":"..."}}`), or null. */
export function jsonErrorMessage(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  try {
    const body: unknown = JSON.parse(text.slice(start));
    const field = (value: unknown, key: string): unknown =>
      value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined;
    const found = [
      field(field(body, "error"), "message"),
      field(body, "message"),
      field(body, "error"),
    ].find((value) => typeof value === "string" && value.trim());
    return typeof found === "string" ? found.trim() : null;
  } catch {
    return null;
  }
}

/**
 * A provider error as a person reads it: the JSON body's message without status prefix, ids or
 * JSON; plain text unchanged; the fallback when the text is JSON-like but has no message.
 */
export function providerErrorMessage(text: string, fallback: string): string {
  const message = jsonErrorMessage(text);
  if (message) return message;
  const plain = text.trim();
  return plain && !/^(?:\d{3}\s+)?[[{]/.test(plain) ? plain : fallback;
}

/**
 * The text to show for a failure: messages written for people (server copy, client copy) pass
 * through; transport failures and implementation detail become the caller's copy.
 */
export function userErrorMessage(error: unknown, copy: UserErrorCopy): string {
  if (isNetworkFailure(error)) return copy.offline;
  const message = (
    error instanceof Error ? error.message : typeof error === "string" ? error : ""
  ).trim();
  const readable = jsonErrorMessage(message) ?? message;
  return readable && !isTechnicalErrorMessage(readable) ? readable : copy.fallback;
}

export type CredentialField = "email" | "password";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Catches empty or malformed credentials before they round-trip to the server. */
export function credentialIssue(input: {
  email: string;
  password?: string;
}): CredentialField | null {
  if (!EMAIL.test(input.email.trim())) return "email";
  if (input.password !== undefined && !input.password) return "password";
  return null;
}

export type AuthErrorCopy = Record<CredentialField, string> & {
  fallback: string;
};

/**
 * Copy for a failed auth response body (`{ code, message }`). Request validation failures name
 * the rejected inputs as issue paths (`[body.email] …`), so map those to field copy.
 */
export function authErrorMessage(body: unknown, copy: AuthErrorCopy): string {
  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const message = typeof record.message === "string" ? record.message : "";
  if (record.code === "VALIDATION_ERROR") {
    const fields = new Set([...message.matchAll(/\[body\.(\w+)/g)].map((match) => match[1]));
    if (fields.has("email")) return copy.email;
    if (fields.has("password")) return copy.password;
    return copy.fallback;
  }
  return message && !isTechnicalErrorMessage(message) ? message : copy.fallback;
}

/** A provider's raw "401" for a run. */
export const KEY_REJECTED_PATTERN = /^401\b|"code":\s*401\b/;

export type RunErrorCopy = {
  keyRejected: string;
  generic: string;
  /** `resetsOn` is the limit's reset date as the reader's locale writes it, or null when unknown. */
  spendLimit: (resetsOn: string | null) => string;
  outOfCredits: string;
  rateLimited: string;
};

const RATE_WORDING = /rate.?limit|too many requests/i;
const CREDIT_WORDING =
  /insufficient (?:credits?|funds|balance)|out of credits|payment required|billing|add (?:credits|funds)|credit balance/i;
const LIMIT_WORDING = /limit exceeded|spending limit|monthly limit|usage limit|quota|budget/i;
/** Anthropic sends an exhausted balance as a 400 with this wording, not a 402. */
const EXHAUSTED_400_WORDING = /credit balance is too low/i;
/** Anthropic also sends a reached API usage limit as a 400. */
const USAGE_LIMIT_400_WORDING = /reached your (?:[a-z0-9()-]+ ){0,4}usage limits?/i;

/** The HTTP status a provider error starts with (`403: {...}`) or carries as `"code":403`. */
function runErrorStatus(error: string): number | null {
  const match = /^(\d{3})\b/.exec(error.trim()) ?? /"code":\s*(\d{3})\b/.exec(error);
  return match ? Number(match[1]) : null;
}

/** When a spending limit resets, from the error's `resets_at` field or "resets <date>" text. */
function runErrorResetDate(error: string): string | null {
  const raw =
    /"resets_at":\s*"([^"]+)"/.exec(error)?.[1] ??
    /\bresets?\s+(\d{4}-\d{2}-\d{2}\S*)/.exec(error)?.[1];
  const date = raw ? new Date(raw.replace(/[.,;)]+$/, "")) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString(undefined, {
        dateStyle: "medium",
        timeZone: "UTC",
      })
    : null;
}

type RunErrorKind = "keyRejected" | "spendLimit" | "outOfCredits" | "rateLimited" | "other";

function classifyRunError(error: string): RunErrorKind {
  if (KEY_REJECTED_PATTERN.test(error)) return "keyRejected";
  const status = runErrorStatus(error);
  // A 400 is bad input, except when it says the account itself is exhausted or over its own limit.
  // Only these two narrow wordings count; a 400 about a parameter stays as the provider wrote it.
  if (status === 400) {
    if (EXHAUSTED_400_WORDING.test(error)) return "outOfCredits";
    if (USAGE_LIMIT_400_WORDING.test(error)) return "spendLimit";
  }
  const quotaStatus = status === 402 || status === 403 || status === 429;
  if (
    /"(?:scope|limit_source)":\s*"[^"]*limit/.test(error) ||
    (quotaStatus && LIMIT_WORDING.test(error) && !RATE_WORDING.test(error))
  )
    return "spendLimit";
  if (status === 429 && RATE_WORDING.test(error)) return "rateLimited";
  if (status === 402 || (quotaStatus && CREDIT_WORDING.test(error))) return "outOfCredits";
  if (status === 429) return "rateLimited";
  return "other";
}

/** A stored run error as a person reads it; one mapping for the panel, the toast and the push. */
export function plainRunError(error: string, copy: RunErrorCopy): string {
  switch (classifyRunError(error)) {
    case "keyRejected":
      return copy.keyRejected;
    case "spendLimit":
      return copy.spendLimit(runErrorResetDate(error));
    case "outOfCredits":
      return copy.outOfCredits;
    case "rateLimited":
      return copy.rateLimited;
    default:
      return isInternalRunError(error) ? copy.generic : error;
  }
}

/**
 * The one action that fixes a failed run: "models" opens Settings > Models (a rejected key, a
 * spending limit, no credits), "retry" sends the message again (a rate limit or an unexplained
 * failure, whose copy says to try again), "connection" offers both Models and the bot's settings
 * for a pinned connection that is signed out or removed. Any other error names its own cause and has none.
 */
export function runErrorAction(
  error: string | null | undefined,
): "models" | "retry" | "connection" | undefined {
  if (!error) return undefined;
  // "connection": the bot's pinned connection is gone; sign in again or choose another.
  if (error === PINNED_CONNECTION_LOST_MESSAGE) return "connection";
  switch (classifyRunError(error)) {
    case "keyRejected":
    case "spendLimit":
    case "outOfCredits":
      return "models";
    case "rateLimited":
      return "retry";
    default:
      return isInternalRunError(error) ? "retry" : undefined;
  }
}

/** True when a delegate agent's reply reached this thread after the run began: the answer is on screen. */
function repliedAfter(snapshot: ThreadSnapshot, since: string): boolean {
  return snapshot.messages.some(
    (message) =>
      message.createdAt >= since &&
      message.blocks.some((block) => block.kind === "bot_message_received"),
  );
}

/** Reason the newest run stopped, until the reader dismisses that run's failure. */
export function threadRunError(
  snapshot: ThreadSnapshot | null,
  describe: (error: string) => string,
  dismissedRunIds?: ReadonlySet<string>,
): string | null {
  const run = snapshot?.run;
  if (!snapshot || run?.status !== "failed" || dismissedRunIds?.has(run.id)) return null;
  // The error may carry a suffix ("Nothing was sent.") when the run left an approval behind.
  if (
    run.error?.startsWith(MISSING_TOOL_FINAL_RESPONSE_ERROR) &&
    repliedAfter(snapshot, run.createdAt)
  )
    return null;
  // A run waiting on an approval is not failed: the failure belongs to an earlier run.
  if (snapshot.activeRuns?.some((active) => active.status === "waiting_input")) return null;
  // The approval can live in the thread of the agent this bot handed the work to.
  if (snapshot.delegatePending?.length) return null;
  return run.error ? describe(run.error) : null;
}

/**
 * The error of a failed last run the user dismissed. The transcript keeps it as a short note, so
 * the question that failed does not look unanswered for no reason.
 */
export function dismissedThreadRunError(
  snapshot: ThreadSnapshot | null,
  describe: (error: string) => string,
  dismissedRunIds: ReadonlySet<string>,
): string | null {
  const run = snapshot?.run;
  if (run?.status !== "failed" || !dismissedRunIds.has(run.id)) return null;
  return run.error ? describe(run.error) : "";
}
