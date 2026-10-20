import { isIP } from "node:net";
import { CLOUD_METADATA_HOSTNAMES } from "@rakazo/contracts";
import { abortError, readBoundedResponseBytes, withAbort } from "@rakazo/core";
import { Agent } from "undici";
import { combineSignals } from "./connector-safety.js";
import type { ResolvedAddress, ResolveHostname } from "./network-address.js";
import {
  createAddressCheckedLookup,
  defaultResolveHostname,
  isPrivateAddress,
} from "./network-address.js";
import { fetchPairedWithDispatcher } from "./undici-fetch.js";

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 5;

export type { ResolveHostname } from "./network-address.js";

export interface SafeWebFetchOptions {
  fetch?: typeof globalThis.fetch;
  resolveHostname?: ResolveHostname;
  timeoutMs?: number;
  maxBytes?: number;
  userAgent?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  maxRedirects?: number;
  /** Default GET. A POST sends `body` once, with no cookies or credentials, and follows no redirect. */
  method?: "GET" | "POST";
  /** The request body of a POST. */
  body?: string;
  /** Keep the first `maxBytes` of a longer body instead of rejecting it. */
  truncate?: boolean;
  /** Refuse any hop, redirects included, whose port is not listed. */
  allowedPorts?: readonly number[];
  /**
   * Test seam for dispatcher teardown. Defaults to `Agent.close()`.
   * Always raced against the shared operation deadline.
   */
  cleanup?: () => Promise<void>;
  /**
   * Test seam for force-teardown after cleanup. Defaults to `Agent.destroy()`.
   * Invoked without awaiting so a hanging destroy cannot extend the deadline.
   * May return a Promise (`Agent.destroy()` does); rejections are swallowed.
   */
  destroy?: () => void | Promise<void>;
}

export async function assertSafeWebUrl(
  value: string,
  resolve: ResolveHostname = defaultResolveHostname,
  signal?: AbortSignal,
  allowedPorts?: readonly number[],
): Promise<URL> {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("URL is invalid");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http: and https: URLs are allowed");
  }
  if (url.username || url.password) {
    throw new Error("URL must not contain credentials");
  }
  const port = Number(url.port || (url.protocol === "https:" ? 443 : 80));
  if (allowedPorts && !allowedPorts.includes(port)) {
    throw new Error("URL port is not allowed");
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  if (isBlockedHostname(hostname)) {
    throw new Error("URL targets a private or internal host");
  }
  assertPublicAddresses(await withAbort(resolve(hostname), signal));
  return url;
}

export function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized.endsWith(".internal") ||
    CLOUD_METADATA_HOSTNAMES.has(normalized)
  ) {
    return true;
  }
  if (isIP(normalized) !== 0) return isPrivateAddress(normalized);
  return false;
}

type SafeWebResponse<Body> = { url: string; body: Body; contentType: string | null };

export async function fetchSafeWebText(
  url: string,
  options: SafeWebFetchOptions = {},
): Promise<SafeWebResponse<string>> {
  const response = await fetchSafeWebBytes(url, options);
  return { ...response, body: new TextDecoder().decode(response.body) };
}

export async function fetchSafeWebBytes(
  url: string,
  options: SafeWebFetchOptions = {},
): Promise<SafeWebResponse<Uint8Array>> {
  const resolve = options.resolveHostname ?? defaultResolveHostname;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
  const baseFetch = fetchPairedWithDispatcher(options.fetch);
  const dispatcher = new Agent({
    connect: { lookup: createAddressCheckedLookup(resolve, assertPublicAddresses) },
  });
  // One deadline for the whole redirect chain + body read + cleanup, not per hop.
  const signal = combineSignals(options.signal, AbortSignal.timeout(timeoutMs));
  const cleanup =
    options.cleanup ??
    (() =>
      dispatcher.close().then(
        () => undefined,
        () => undefined,
      ));
  const destroy = options.destroy ?? (() => dispatcher.destroy());

  try {
    return await followRedirects(url, {
      baseFetch,
      resolve,
      dispatcher,
      maxBytes,
      userAgent: options.userAgent ?? "Rakazo/0.1 (+https://github.com/elie222/rakazo)",
      headers: options.headers,
      signal,
      redirectsRemaining: options.maxRedirects ?? MAX_REDIRECTS,
      truncate: options.truncate ?? false,
      allowedPorts: options.allowedPorts,
      method: options.method ?? "GET",
      body: options.body,
    });
  } finally {
    // Race graceful close against the shared deadline. Do not wait unbounded on close().
    await withAbort(cleanup(), signal).catch(() => undefined);
    // If the deadline aborted (close hung or already timed out), force-destroy
    // without awaiting so sockets/FDs cannot leak past the timeout.
    // Agent.destroy() returns a Promise — swallow async rejection (sync try/catch cannot).
    if (signal.aborted) {
      try {
        void Promise.resolve(destroy()).catch(() => undefined);
      } catch {
        // sync throw from destroy seam
      }
    }
  }
}

async function followRedirects(
  rawUrl: string,
  state: {
    baseFetch: typeof globalThis.fetch;
    resolve: ResolveHostname;
    dispatcher: Agent;
    maxBytes: number;
    userAgent: string;
    headers?: Record<string, string>;
    signal: AbortSignal;
    redirectsRemaining: number;
    truncate: boolean;
    allowedPorts?: readonly number[];
    method: "GET" | "POST";
    body?: string;
  },
): Promise<SafeWebResponse<Uint8Array>> {
  if (state.signal.aborted) {
    throw abortError(state.signal);
  }
  const validated = await assertSafeWebUrl(rawUrl, state.resolve, state.signal, state.allowedPorts);
  // Race fetch against the deadline — injected fetch may ignore init.signal.
  const response = await withAbort(
    state.baseFetch(validated.href, {
      method: state.method,
      redirect: "manual",
      signal: state.signal,
      headers: {
        "user-agent": state.userAgent,
        accept:
          state.method === "GET"
            ? "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5"
            : "*/*",
        ...state.headers,
      },
      ...(state.method === "POST" ? { body: state.body, credentials: "omit" as const } : {}),
      dispatcher: state.dispatcher,
    } as RequestInit & { dispatcher: Agent }),
    state.signal,
  );

  if (response.status >= 300 && response.status < 400) {
    // A POST is never replayed at another address: the caller treats the redirect as a failure.
    if (state.method !== "GET") {
      await cancelResponseBody(response, state.signal);
      throw new Error("Redirects are not followed");
    }
    if (state.redirectsRemaining <= 0) {
      await cancelResponseBody(response, state.signal);
      throw new Error("Too many redirects");
    }
    const location = response.headers.get("location");
    if (!location) {
      await cancelResponseBody(response, state.signal);
      throw new Error("Redirect missing Location header");
    }
    const next = new URL(location, validated.href);
    const headers = next.origin === validated.origin ? state.headers : undefined;
    // Release this hop before following — do not leave the body open across recursion.
    await cancelResponseBody(response, state.signal);
    return followRedirects(next.href, {
      ...state,
      headers,
      redirectsRemaining: state.redirectsRemaining - 1,
    });
  }

  if (!response.ok) {
    await cancelResponseBody(response, state.signal);
    throw new Error(`Request failed: HTTP ${response.status}`);
  }

  const contentLength = response.headers.get("content-length");
  if (!state.truncate && contentLength && Number(contentLength) > state.maxBytes) {
    await cancelResponseBody(response, state.signal);
    throw new Error("Response is too large");
  }

  const body = state.truncate
    ? await readBodyPrefix(response, state.maxBytes, state.signal)
    : await readBodyCapped(response, state.maxBytes, state.signal);

  return { url: validated.href, body, contentType: response.headers.get("content-type") };
}

async function cancelResponseBody(response: Response, signal: AbortSignal): Promise<void> {
  const cancel = response.body?.cancel() ?? Promise.resolve();
  // A hanging cancel must not outlive the shared deadline.
  await withAbort(
    cancel.catch(() => undefined),
    signal,
  ).catch(() => undefined);
}

/** Read the body as a stream and abort once maxBytes is exceeded (DoS guard). */
export async function readBodyCapped(
  response: Response,
  maxBytes: number,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  return readBoundedResponseBytes(response, {
    maxBytes,
    tooLargeMessage: "Response is too large",
    read: (operation) => {
      if (response.body && signal?.aborted) throw abortError(signal);
      return withAbort(operation(), signal);
    },
  });
}

/** Read at most maxBytes and release the rest of the stream unread. */
async function readBodyPrefix(
  response: Response,
  maxBytes: number,
  signal: AbortSignal,
): Promise<Uint8Array> {
  if (!response.body) {
    const buffer = await withAbort(response.arrayBuffer(), signal);
    return new Uint8Array(buffer).slice(0, maxBytes);
  }
  const reader = response.body.getReader();
  const prefix = new Uint8Array(maxBytes);
  let total = 0;
  try {
    while (total < maxBytes) {
      const { done, value } = await withAbort(reader.read(), signal);
      if (done) break;
      const take = Math.min(value.byteLength, maxBytes - total);
      prefix.set(value.subarray(0, take), total);
      total += take;
    }
  } finally {
    void Promise.resolve(reader.cancel()).catch(() => undefined);
  }
  return prefix.slice(0, total);
}

/**
 * POSTs a form body to an https URL on port 443 with every GET protection kept (DNS pinning,
 * private ranges, one deadline) and nothing more: no cookies, no credentials, no redirect, and the
 * answer is read only up to 16 KiB because a 2xx is all that counts. Resolves on 2xx, else throws.
 */
export async function postSafeWebForm(
  url: string,
  body: string,
  options: SafeWebFetchOptions = {},
): Promise<void> {
  if (!url.toLowerCase().startsWith("https:")) throw new Error("Only https: URLs are allowed");
  await fetchSafeWebBytes(url, {
    allowedPorts: [443],
    timeoutMs: 10_000,
    maxBytes: 16 * 1024,
    truncate: true,
    ...options,
    method: "POST",
    body,
    maxRedirects: 0,
    headers: { ...options.headers, "content-type": "application/x-www-form-urlencoded" },
  });
}

function assertPublicAddresses(addresses: ResolvedAddress[]): void {
  if (addresses.length === 0 || addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new Error("URL resolves to a private address");
  }
}

export { withAbort };
