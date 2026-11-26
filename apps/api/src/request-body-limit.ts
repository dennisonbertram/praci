import { LOCAL_SETTINGS_RPC } from "@rakazo/contracts";
import type { Context, Hono, MiddlewareHandler } from "hono";
import { cancelBody } from "./http-body.js";

export const MAX_AUTH_REQUEST_BYTES = 64 * 1024;
export const MAX_RPC_REQUEST_BYTES = 16 * 1024 * 1024;
/** An MCP request is one JSON-RPC message of tool arguments. */
export const MAX_MCP_REQUEST_BYTES = 256 * 1024;
/** The portal takes one link token or nothing. */
export const MAX_PORTAL_REQUEST_BYTES = 4 * 1024;

/** Bound JSON entry points before their framework parsers buffer the request. */
export function requestBodyLimit(maxSize: number): MiddlewareHandler {
  if (!Number.isSafeInteger(maxSize) || maxSize <= 0) {
    throw new Error("Request body limit must be a positive integer");
  }
  return async (c, next) => (await limitRequestBody(c, maxSize)) ?? next();
}

/** The 413 response for a body over maxSize; otherwise the body stays readable downstream. */
async function limitRequestBody(c: Context, maxSize: number): Promise<Response | undefined> {
  const request = c.req.raw;
  if (!request.body) return undefined;

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null && !request.headers.has("transfer-encoding")) {
    const declared = /^[0-9]+$/.test(contentLength) ? Number(contentLength) : Number.NaN;
    if (!Number.isSafeInteger(declared) || declared < 0 || declared > maxSize) {
      cancelBody(request.body);
      return c.json({ error: "Request body is too large." }, 413);
    }
    return undefined;
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxSize) {
        cancelBody(reader);
        return c.json({ error: "Request body is too large." }, 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  c.req.raw = new Request(request, {
    body: new ReadableStream({
      start(controller) {
        for (const chunk of chunks) controller.enqueue(chunk);
        controller.close();
      },
    }),
    duplex: "half",
  } as RequestInit & { duplex: "half" });
  return undefined;
}

/**
 * Signed out, only the bodiless `health` procedure is callable, so the body
 * is discarded unread and oRPC answers as it would anyway: 401, or health.
 */
export async function limitRpcBody(c: Context, signedIn: boolean): Promise<Response | undefined> {
  if (signedIn) return limitRequestBody(c, MAX_RPC_REQUEST_BYTES);
  const request = c.req.raw;
  if (request.body) {
    cancelBody(request.body);
    const headers = new Headers(request.headers);
    headers.delete("content-length");
    headers.delete("transfer-encoding");
    c.req.raw = new Request(request.url, {
      method: request.method,
      headers,
      signal: request.signal,
    });
  }
  return undefined;
}

/** RPC is bounded by limitRpcBody once the session is known. Install limits only on framework-parsed JSON surfaces with known payload contracts. */
export function mountApiRequestBodyLimits(app: Hono): void {
  app.use("/api/auth/*", requestBodyLimit(MAX_AUTH_REQUEST_BYTES));
  app.use(`${LOCAL_SETTINGS_RPC}/*`, requestBodyLimit(MAX_RPC_REQUEST_BYTES));
  app.use("/mcp", requestBodyLimit(MAX_MCP_REQUEST_BYTES));
  app.use("/api/portal/*", requestBodyLimit(MAX_PORTAL_REQUEST_BYTES));
  app.use("/api/share/*", requestBodyLimit(MAX_PORTAL_REQUEST_BYTES));
}
