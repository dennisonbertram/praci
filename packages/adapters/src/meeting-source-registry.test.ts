import { describe, expect, it } from "vitest";
import { connectorFailure } from "./mcp-connector.js";
import { McpReauthorizationRequiredError } from "./mcp-oauth.js";
import { createMeetingSourceRegistry } from "./meeting-source-registry.js";

describe("meeting source registry", () => {
  it("ends every provider request when the run's signal aborts", async () => {
    let seen: AbortSignal | null | undefined;
    const hanging = ((_url: unknown, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        seen = init?.signal;
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      })) as typeof fetch;
    const controller = new AbortController();
    const source = createMeetingSourceRegistry({ fetch: hanging }).granola?.create(
      { spaceId: "s", userId: "u", connectionId: "c", apiKey: "k" },
      controller.signal,
    );
    const call = source?.list({});
    controller.abort();
    await expect(call).rejects.toMatchObject({ kind: "unavailable" });
    expect(seen?.aborted).toBe(true);
  });

  it("reports an expired or rejected Wispr Flow sign-in as an auth error, not a retryable outage", async () => {
    const server = { id: "srv", endpoint: "https://api.wisprflow.ai/connect/mcp" };
    const prisma = { mcpServer: { findFirst: async () => server } } as never;
    const sourceFor = (error: unknown) =>
      createMeetingSourceRegistry({
        mcp: {
          prisma,
          connector: {
            callServerTool: async () => {
              throw error;
            },
          },
        },
      }).wisprflow?.create(
        { spaceId: "s", userId: "u", mcpServerId: "srv" },
        new AbortController().signal,
      );
    // What the real connector throws keeps the classification of the failure it wraps.
    expect(connectorFailure(new McpReauthorizationRequiredError("srv"), "m")).toMatchObject({
      expected: "reconnect",
    });
    expect(connectorFailure(new Error("down"), "m")).not.toHaveProperty("expected", "reconnect");
    const auth = sourceFor(
      Object.assign(new Error("MCP authorization expired."), { expected: "reconnect" }),
    );
    await expect(auth?.list({})).rejects.toMatchObject({ kind: "auth" });
    await expect(sourceFor(new Error("boom (HTTP 429)"))?.list({})).rejects.toMatchObject({
      kind: "rate_limit",
    });
    await expect(sourceFor(new Error("boom"))?.list({})).rejects.toMatchObject({
      kind: "unavailable",
    });
  });
});
