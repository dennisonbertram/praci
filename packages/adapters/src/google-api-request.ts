import {
  type AdapterContext,
  ConnectorProxyError,
  type ConnectorProxyRequest,
  type ConnectorProxyResponse,
  type ManagedConnectorProvider,
} from "@rakazo/adapter-kit";
import { asRecord } from "./connector-http.js";

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;
// A longer Retry-After is not slept through (it would hold the caller); the error carries it instead.
const MAX_RETRY_AFTER_MS = 30_000;
// Measured through the Composio proxy (about 290 ms per get): 4 in flight hydrates 11 messages/s,
// 12 gives about 30/s and more adds nothing. 30 gets/s is 150 of Gmail's 250 quota units/s per user.
export const GOOGLE_API_CONCURRENCY = 12;
const AUTH_REASONS = new Set(["authError", "insufficientPermissions"]);
const RATE_REASONS = new Set(["rateLimitExceeded", "userRateLimitExceeded"]);

export type GoogleApiSleep = (ms: number, signal: AbortSignal) => Promise<void>;

export const defaultGoogleApiSleep: GoogleApiSleep = (ms, signal) =>
  new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", done, { once: true });
  });

/** The connected account a call is made as: `Connection.connectorId`, `providerRef` and `provider`. */
export interface GoogleApiAccount {
  connectorId: string;
  providerRef: string;
  app: string;
}

/**
 * Why `googleApiRequest` gave up. `response` carries the last non-2xx answer (and its Retry-After),
 * so the caller maps it to its own error type; `aborted` and `transport` have no response.
 * `transport` keeps only the connector's sanitized error as `detail`: other errors can carry credentials.
 */
export class GoogleApiError extends Error {
  constructor(
    readonly kind: "response" | "aborted" | "transport",
    readonly response?: ConnectorProxyResponse,
    readonly detail?: string,
  ) {
    super(kind === "response" ? `Google API returned ${response?.status}` : `Google API ${kind}`);
    this.name = "GoogleApiError";
  }
}

function errorReasons(data: unknown): string[] {
  const errors = asRecord(asRecord(data)?.error)?.errors;
  return (Array.isArray(errors) ? errors : []).flatMap((entry: unknown) => {
    const reason = asRecord(entry)?.reason;
    return typeof reason === "string" ? [reason] : [];
  });
}

/** 401, or a 403 whose reason says the grant lacks access: the user must reconnect. */
export function isGoogleAuthFailure(response: ConnectorProxyResponse): boolean {
  return (
    response.status === 401 ||
    (response.status === 403 && errorReasons(response.data).some((r) => AUTH_REASONS.has(r)))
  );
}

/** A 429, or a 403 for quota. Google did nothing, so every method may be retried. */
export function isGoogleRateLimited(response: ConnectorProxyResponse): boolean {
  if (isGoogleAuthFailure(response)) return false;
  const exhausted = asRecord(asRecord(response.data)?.error)?.status === "RESOURCE_EXHAUSTED";
  return (
    response.status === 429 ||
    (response.status === 403 &&
      (exhausted || errorReasons(response.data).some((r) => RATE_REASONS.has(r))))
  );
}

/** Log text for a failed proxy call: the sanitized connector error, or only the class of any other. */
function describeProxyError(cause: unknown): string {
  if (!(cause instanceof ConnectorProxyError))
    return cause instanceof Error ? cause.name : "unknown";
  const status = cause.status === undefined ? "" : ` status=${cause.status}`;
  return `${cause.code ?? cause.name}${status}: ${cause.message.slice(0, 300)}`;
}

export interface GoogleApiCall {
  connector: ManagedConnectorProvider;
  account: GoogleApiAccount;
  method: ConnectorProxyRequest["method"];
  url: string;
  body?: unknown;
  /** Media type of a raw string `body`; omit for JSON. */
  contentType?: string;
  responseType?: "text" | "bytes";
  /** Required with `responseType: "bytes"`. */
  maxBytes?: number;
  /** Only `signal` is read here; the whole context goes to the connector. */
  context: AdapterContext;
}

/**
 * Authenticated Google API calls with per-account concurrency, retry and backoff. Retried: 429, a
 * 403 rate-limit reason, and (not for POST) 408, 5xx and transient transport errors; up to
 * MAX_ATTEMPTS, backing off exponentially with jitter or for the server's Retry-After, and failing
 * at once when that is over MAX_RETRY_AFTER_MS.
 *
 * A POST is never repeated after an unclear failure (5xx, timeout, dropped connection): the request
 * may have reached Google, so a repeat could send twice. A rate limit proves Google did nothing, so
 * it is retried for every method.
 */
export class GoogleApiClient {
  private readonly slots = new Map<string, { active: number; queue: Array<() => void> }>();
  private readonly sleep: GoogleApiSleep;
  private readonly random: () => number;

  constructor(options: { sleep?: GoogleApiSleep; random?: () => number } = {}) {
    this.sleep = options.sleep ?? defaultGoogleApiSleep;
    this.random = options.random ?? Math.random;
  }

  /** Resolves with the 2xx response; throws `GoogleApiError` for anything else. */
  async request(call: GoogleApiCall): Promise<ConnectorProxyResponse> {
    const { connector, account, method, url, body, contentType, responseType, maxBytes, context } =
      call;
    const repeatable = method !== "POST";
    const proxy = connector.proxy?.bind(connector);
    if (!proxy) throw new GoogleApiError("transport", undefined, "connector has no proxy");
    const key = `${account.connectorId}:${account.providerRef}:${account.app}`;
    for (let attempt = 1; ; attempt++) {
      if (context.signal.aborted) throw new GoogleApiError("aborted");
      let failure: { error: GoogleApiError; retry: boolean; retryAfterMs?: number };
      try {
        const response = await this.limit(key, () =>
          proxy(
            {
              app: account.app,
              accountRef: account.providerRef,
              method,
              url,
              ...(body === undefined ? {} : { body }),
              ...(contentType ? { contentType } : {}),
              ...(responseType ? { responseType } : {}),
              ...(maxBytes ? { maxBytes } : {}),
            },
            context,
          ),
        );
        if (response.status >= 200 && response.status < 300) return response;
        failure = {
          error: new GoogleApiError("response", response),
          retryAfterMs: response.retryAfterMs,
          retry:
            isGoogleRateLimited(response) ||
            (repeatable && (response.status >= 500 || response.status === 408)),
        };
      } catch (cause) {
        failure = context.signal.aborted
          ? { error: new GoogleApiError("aborted"), retry: false }
          : {
              error: new GoogleApiError("transport", undefined, describeProxyError(cause)),
              retry: repeatable && cause instanceof ConnectorProxyError && cause.transient,
            };
      }
      if (!failure.retry || attempt >= MAX_ATTEMPTS || context.signal.aborted) throw failure.error;
      const wait = failure.retryAfterMs ?? BASE_DELAY_MS * 2 ** (attempt - 1) + this.random() * 250;
      if (wait > MAX_RETRY_AFTER_MS) throw failure.error;
      await this.sleep(wait, context.signal);
      if (context.signal.aborted) throw failure.error;
    }
  }

  // ponytail: per-process limiter; move to a Postgres-backed limit per connection if 429s become common.
  private async limit<T>(key: string, run: () => Promise<T>): Promise<T> {
    let slot = this.slots.get(key);
    if (!slot) {
      slot = { active: 0, queue: [] };
      this.slots.set(key, slot);
    }
    const mine = slot;
    if (mine.active >= GOOGLE_API_CONCURRENCY)
      await new Promise<void>((resolve) => mine.queue.push(resolve));
    else mine.active++;
    try {
      return await run();
    } finally {
      const waiting = mine.queue.shift();
      if (waiting) waiting();
      else if (--mine.active === 0) this.slots.delete(key);
    }
  }
}
