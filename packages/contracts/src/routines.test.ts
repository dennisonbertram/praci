import { describe, expect, it } from "vitest";
import { CreateRoutineInput, ScratchpadItemSchema } from "./domain.js";
import { CheckInSetInput, connectorToolLabel, WatchSpecSchema } from "./routines.js";

describe("WatchSpecSchema", () => {
  const ok = { kind: "page", url: "https://example.com/pricing", intervalMinutes: 60 };
  it("accepts a page watch", () => {
    expect(WatchSpecSchema.parse(ok)).toEqual(ok);
    expect(WatchSpecSchema.safeParse({ ...ok, url: "http://example.com" }).success).toBe(true);
  });
  it("rejects other schemes, long urls and odd intervals", () => {
    expect(WatchSpecSchema.safeParse({ ...ok, url: "ftp://example.com" }).success).toBe(false);
    expect(WatchSpecSchema.safeParse({ ...ok, url: "not a url" }).success).toBe(false);
    expect(
      WatchSpecSchema.safeParse({ ...ok, url: `https://e.com/${"a".repeat(2048)}` }).success,
    ).toBe(false);
    expect(WatchSpecSchema.safeParse({ ...ok, intervalMinutes: 5 }).success).toBe(false);
    expect(WatchSpecSchema.safeParse({ ...ok, kind: "app" }).success).toBe(false);
  });
});

describe("connector watch", () => {
  const connector = {
    kind: "connector",
    connectorId: "composio",
    connectionId: "conn_1",
    toolName: "mcp__mercury__get_accounts",
    arguments: { account: "main" },
    appName: "Mercury",
    intervalMinutes: 60,
  };
  it("is part of WatchSpecSchema but never accepted when a routine is created", () => {
    expect(WatchSpecSchema.safeParse(connector).success).toBe(true);
    expect(
      CreateRoutineInput.safeParse({ botId: "b", name: "n", prompt: "p", watch: connector })
        .success,
    ).toBe(false);
  });
  it("rejects a tool name that is not plain, and oversized arguments", () => {
    expect(
      WatchSpecSchema.safeParse({ ...connector, toolName: "get accounts; drop" }).success,
    ).toBe(false);
    expect(
      WatchSpecSchema.safeParse({ ...connector, arguments: { q: "x".repeat(5000) } }).success,
    ).toBe(false);
  });
});

describe("routine and scratchpad shapes", () => {
  it("a watch alone is a valid trigger for a new routine", () => {
    const base = { botId: "b1", name: "n", prompt: "p" };
    expect(CreateRoutineInput.safeParse(base).success).toBe(false);
    const parsed = CreateRoutineInput.parse({
      ...base,
      watch: { kind: "page", url: "https://example.com", intervalMinutes: 15 },
    });
    expect(parsed.quiet).toBeUndefined();
  });
  it("scratchpad items carry dueAt, waitingOn and resolvedReason", () => {
    const item = ScratchpadItemSchema.parse({
      id: "i1",
      botId: "b1",
      title: "t",
      status: "open",
      notes: "",
      createdAt: "x",
      updatedAt: "x",
      dueAt: "2026-02-01T00:00:00Z",
      waitingOn: "Acme legal",
      resolvedReason: null,
    });
    expect(item.waitingOn).toBe("Acme legal");
  });
  it("check-in set takes a cadence", () => {
    expect(CheckInSetInput.safeParse({ botId: "b", cadence: "every_4h" }).success).toBe(true);
    expect(CheckInSetInput.safeParse({ botId: "b", cadence: "hourly" }).success).toBe(false);
  });
});

it("words a tool name, splitting camelCase too", () => {
  expect(connectorToolLabel("mcp__finance-mercury__getAccounts")).toBe("get accounts");
  expect(connectorToolLabel("mcp__x__list_transactions")).toBe("list transactions");
});
