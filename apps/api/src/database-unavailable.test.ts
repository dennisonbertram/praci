import { ORPCError } from "@orpc/server";
import { createLogger, installLogger } from "@rakazo/logging";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { afterEach, describe, expect, it } from "vitest";
import { logUnexpectedRpcError } from "./app.js";
import { handleHttpError, withRetryAfter } from "./database-unavailable.js";

const failover = () => Object.assign(new Error("Connection terminated unexpectedly"), {});

function appThrowing(error: Error) {
  const app = new Hono();
  app.onError(handleHttpError);
  app.get("/x", () => {
    throw error;
  });
  return app;
}

describe("database failover answers", () => {
  afterEach(() => {
    installLogger(createLogger({ service: "rakazo-api", level: "off", sinks: [] }));
  });

  it("answers 503 with Retry-After on a plain route", async () => {
    installLogger(createLogger({ service: "rakazo-api", level: "off", sinks: [] }));
    const response = await appThrowing(failover()).request("/x");
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("5");
  });

  it("keeps 500 for other errors and HTTPException responses", async () => {
    installLogger(createLogger({ service: "rakazo-api", level: "off", sinks: [] }));
    expect((await appThrowing(new Error("boom")).request("/x")).status).toBe(500);
    expect((await appThrowing(new HTTPException(404)).request("/x")).status).toBe(404);
  });

  it("turns a database failover in an RPC procedure into a retryable 503", () => {
    installLogger(createLogger({ service: "rakazo-api", level: "off", sinks: [] }));
    expect(() => logUnexpectedRpcError(failover(), ["bots", "list"])).toThrow(ORPCError);
    try {
      logUnexpectedRpcError(failover(), ["bots", "list"]);
    } catch (error) {
      expect((error as ORPCError<string, unknown>).code).toBe("SERVICE_UNAVAILABLE");
    }
  });

  it("adds Retry-After to a 503 RPC response only", () => {
    expect(withRetryAfter(new Response("", { status: 503 })).headers.get("Retry-After")).toBe("5");
    expect(withRetryAfter(new Response("", { status: 500 })).headers.has("Retry-After")).toBe(
      false,
    );
  });
});
