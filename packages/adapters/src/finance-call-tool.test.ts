import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";
import { createFinanceCallToolFor, unwrapToolResult } from "./finance-call-tool.js";

const text = (value: string): CallToolResult => ({ content: [{ type: "text", text: value }] });

describe("unwrapToolResult", () => {
  it("prefers structured content, then parses JSON text", () => {
    expect(unwrapToolResult({ content: [], structuredContent: { a: 1 } })).toEqual({ a: 1 });
    expect(unwrapToolResult(text('{"accounts":[]}'))).toEqual({ accounts: [] });
  });

  it("throws on tool errors and on text that is not JSON", () => {
    expect(() => unwrapToolResult({ ...text("bad request"), isError: true })).toThrow(
      "Tool failed",
    );
    expect(() => unwrapToolResult(text("Result too long, truncated"))).toThrow("not JSON");
  });
});

describe("createFinanceCallToolFor", () => {
  const row = { id: "srv-1", spaceId: "space-1", userId: "user-1", enabled: true };
  const prisma = { mcpServer: { findUnique: vi.fn(async () => row) } } as unknown as Pick<
    PrismaClient,
    "mcpServer"
  >;

  it("calls read tools as the server's owner and refuses write tools", async () => {
    const callServerTool = vi.fn(async () => text('{"ok":true}'));
    const callTool = await createFinanceCallToolFor(prisma, { callServerTool })(
      { id: "srv-1", provider: "mercury", endpoint: "https://mcp.mercury.com/mcp" },
      new AbortController().signal,
    );
    expect(await callTool("getAccounts", {})).toEqual({ ok: true });
    expect(callServerTool).toHaveBeenCalledWith(
      row,
      expect.objectContaining({ spaceId: "space-1", userId: "user-1" }),
      "getAccounts",
      {},
    );
    await expect(callTool("requestSendMoney", {})).rejects.toThrow("may not call");
    await expect(callTool("getCashflowSummary", {})).rejects.toThrow("may not call");
    expect(callServerTool).toHaveBeenCalledOnce();
  });
});
