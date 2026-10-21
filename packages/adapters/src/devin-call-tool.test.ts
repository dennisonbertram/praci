import { readFileSync } from "node:fs";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { DEVIN_MCP_ENDPOINT } from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";
import { createDevinCallTool, devinFailureOf } from "./devin-call-tool.js";

// Every fixture is synthetic: invented data in the documented format (issue #516 replaces them).
const fixture = (name: string) =>
  readFileSync(new URL(`./__fixtures__/devin/${name}`, import.meta.url), "utf8");
const text = (value: string): CallToolResult => ({ content: [{ type: "text", text: value }] });

const row = {
  id: "srv-1",
  spaceId: "space-1",
  userId: "user-1",
  enabled: true,
  endpoint: DEVIN_MCP_ENDPOINT,
};

function setup(result: CallToolResult = text("ok"), serverRow: object | null = row) {
  const prisma = { mcpServer: { findUnique: vi.fn(async () => serverRow) } } as unknown as Pick<
    PrismaClient,
    "mcpServer"
  >;
  const callServerTool = vi.fn(async () => result);
  return { call: createDevinCallTool(prisma, { callServerTool }), callServerTool };
}

describe("createDevinCallTool", () => {
  it("the Devin caller allows search, get and get_messages, refuses every other tool or action before the call, and throws on an isError result", async () => {
    const { call, callServerTool } = setup(text(fixture("get-waiting.txt")));
    const signal = new AbortController().signal;

    await call("srv-1", "devin_session_search", { first: 100 }, signal);
    await call("srv-1", "devin_session_interact", { action: "get", session_id: "d" }, signal);
    await call(
      "srv-1",
      "devin_session_interact",
      { action: "get_messages", session_id: "d" },
      signal,
    );
    expect(callServerTool).toHaveBeenCalledTimes(3);
    expect(callServerTool).toHaveBeenCalledWith(
      row,
      expect.objectContaining({ spaceId: "space-1", userId: "user-1", signal }),
      "devin_session_search",
      { first: 100 },
    );

    for (const [name, args] of [
      ["devin_session_create", { prompt: "x" }],
      ["devin_session_interact", { action: "message", message: "x" }],
      ["devin_session_interact", { action: "sleep" }],
      ["devin_session_interact", {}],
      ["devin_session_events", {}],
      ["devin_knowledge_manage", {}],
      ["nope", {}],
    ] as const) {
      await expect(call("srv-1", name, args, signal), name).rejects.toThrow("may not call");
    }
    expect(callServerTool).toHaveBeenCalledTimes(3);

    const errored = setup(JSON.parse(fixture("is-error.json")) as CallToolResult);
    await expect(errored.call("srv-1", "devin_session_search", {}, signal)).rejects.toThrow(
      "Tool failed: Invalid cursor",
    );
  });

  it("returns the tool's text", async () => {
    const page = fixture("search-page-1.txt");
    const { call } = setup(text(page));
    expect(await call("srv-1", "devin_session_search", {})).toBe(page);
  });

  it("refuses a missing or disabled server and one that is not Devin", async () => {
    for (const serverRow of [
      null,
      { ...row, enabled: false },
      { ...row, endpoint: "https://mcp.example.test/mcp" },
    ]) {
      const { call, callServerTool } = setup(text("ok"), serverRow);
      await expect(call("srv-1", "devin_session_search", {})).rejects.toThrow("not available");
      expect(callServerTool).not.toHaveBeenCalled();
    }
  });
});

describe("devinFailureOf", () => {
  const errors = JSON.parse(fixture("errors.json")) as Record<string, string>;
  const fail = (status: string, phase: "listing" | "session") =>
    devinFailureOf(new Error(errors[status]), { phase });

  it("classifies the text a fake server produces", () => {
    expect(fail("401", "listing")).toBe("rejected");
    expect(fail("401", "session")).toBe("rejected");
    expect(fail("403", "listing")).toBe("rejected");
    expect(fail("403", "session")).toBe("session_forbidden");
    expect(fail("429", "listing")).toBe("rate_limited");
    expect(fail("429", "session")).toBe("rate_limited");
  });

  it("treats timeouts and anything else as unreachable", () => {
    const timeout = new DOMException("The operation timed out.", "TimeoutError");
    expect(devinFailureOf(timeout, { phase: "listing" })).toBe("unreachable");
    expect(devinFailureOf(new Error("fetch failed"), { phase: "listing" })).toBe("unreachable");
    expect(devinFailureOf(new Error("boom (HTTP 500)"), { phase: "session" })).toBe("unreachable");
    expect(devinFailureOf("odd", { phase: "session" })).toBe("unreachable");
  });

  it("does not take a status from the middle of a message", () => {
    expect(devinFailureOf(new Error("body says (HTTP 401) here"), { phase: "listing" })).toBe(
      "unreachable",
    );
  });
});
