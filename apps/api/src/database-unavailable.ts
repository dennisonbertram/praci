import { isDatabaseInterruption } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

/** How long a client waits before asking again while the database fails over. */
export const DATABASE_RETRY_AFTER_SECONDS = 5;

/** A short failover answers 503 so clients try again, instead of a 500 that reads as a bug. */
export function handleHttpError(error: Error, c: Context): Response {
  if (error instanceof HTTPException) return error.getResponse();
  if (isDatabaseInterruption(error)) {
    getLogger().warn("http request failed: database unavailable", {
      "error.message": error.message,
    });
    return c.text("Service Unavailable", 503, {
      "Retry-After": String(DATABASE_RETRY_AFTER_SECONDS),
    });
  }
  getLogger().error("http.request.failed", error);
  return c.text("Internal Server Error", 500);
}

/** Adds the retry hint to an RPC response that failed because the database is unavailable. */
export function withRetryAfter(response: Response): Response {
  if (response.status === 503 && !response.headers.has("Retry-After")) {
    response.headers.set("Retry-After", String(DATABASE_RETRY_AFTER_SECONDS));
  }
  return response;
}
