import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";
import { builtinAgentTools } from "./builtin-tools.js";
import {
  callMcpReadTool,
  MCP_READ_EXCEPTIONS,
  MCP_READ_TOOLS,
  MCP_WRITE_TOOLS,
  mcpReadToolDescriptors,
  mcpWriteToolDescriptors,
  wrapUntrustedText,
} from "./mcp-read-tools.js";

/** Allowlisted tools that are not bot tools: they read or start a bot thread instead. */
const NOT_BOT_TOOLS = ["thread_read", "agent_send", "agent_run_status"];

describe("MCP read tools", () => {
  it("exposes only bot tools that are marked read-only, or listed with a reason", () => {
    const names = Object.keys(MCP_READ_TOOLS);
    const descriptors = mcpReadToolDescriptors();
    expect(descriptors.map((tool) => tool.name).sort()).toEqual([...names].sort());
    for (const name of names.filter((n) => !NOT_BOT_TOOLS.includes(n))) {
      const tool = builtinAgentTools.find((candidate) => candidate.name === name);
      expect(tool, name).toBeDefined();
      if (MCP_READ_EXCEPTIONS[name]) expect(tool?.readOnly, name).not.toBe(true);
      else expect(tool?.readOnly, name).toBe(true);
    }
    for (const [name, reason] of Object.entries(MCP_READ_EXCEPTIONS)) {
      expect(Object.keys(MCP_READ_TOOLS), name).toContain(name);
      expect(reason, name).toBeTruthy();
    }
    for (const tool of descriptors) {
      expect(tool.description, tool.name).toBeTruthy();
      expect(tool.inputSchema.type, tool.name).toBe("object");
    }
  });

  it("lists write tools that exist, are not read-only, and never overlap the read tools", () => {
    const names = Object.keys(MCP_WRITE_TOOLS);
    expect(
      mcpWriteToolDescriptors()
        .map((tool) => tool.name)
        .sort(),
    ).toEqual([...names].sort());
    for (const name of names.filter((n) => !NOT_BOT_TOOLS.includes(n))) {
      const tool = builtinAgentTools.find((candidate) => candidate.name === name);
      expect(tool, name).toBeDefined();
      expect(tool?.readOnly, name).not.toBe(true);
      expect(Object.keys(MCP_READ_TOOLS), name).not.toContain(name);
    }
  });

  it("asks scratchpad tools for a botId and hides arguments an outside client may not set", () => {
    const byName = Object.fromEntries(
      [...mcpReadToolDescriptors(), ...mcpWriteToolDescriptors()].map((t) => [t.name, t]),
    );
    for (const name of ["scratchpad_list", "scratchpad_add", "scratchpad_update"]) {
      expect(byName[name]?.inputSchema.required, name).toContain("botId");
    }
    const add = byName.scratchpad_add?.inputSchema.properties as Record<string, unknown>;
    expect(add.botId).toBeDefined();
    for (const hidden of ["category", "channel", "forAgent", "target"]) {
      expect(add[hidden], hidden).toBeUndefined();
    }
  });

  it("moves free-text fields at any depth under untrusted_text", () => {
    expect(
      wrapUntrustedText({ rows: [{ id: "1", name: "Ada", notes: "hi" }], total: 2 }, ["name"]),
    ).toEqual({ rows: [{ id: "1", notes: "hi", untrusted_text: { name: "Ada" } }], total: 2 });
  });

  it("keeps a prospect's list text under untrusted_text for fundraising_read", () => {
    const row = {
      name: "Sam",
      group: "Wave 1",
      people: [{ name: "Sam" }],
      referredBy: "Ana",
      lastCall: { outcome: "spoke", at: "2026-01-01", note: "call note" },
      details: [{ label: "Why them", value: "cell text" }],
    };
    expect(wrapUntrustedText(row, MCP_READ_TOOLS.fundraising_read)).toEqual({
      people: [{ untrusted_text: { name: "Sam" } }],
      lastCall: { outcome: "spoke", at: "2026-01-01", untrusted_text: { note: "call note" } },
      details: [{ untrusted_text: { label: "Why them", value: "cell text" } }],
      untrusted_text: { name: "Sam", group: "Wave 1", referredBy: "Ana" },
    });
  });

  describe("agent_run_status", () => {
    const scope = { spaceId: "space-1", userId: "user-1" };
    const fake = (run: unknown) => {
      const findFirst = vi.fn(async (_query: unknown) => run);
      const findMany = vi.fn(async () => [
        { blocks: [{ kind: "text", text: "Done: 3 invoices." }] },
      ]);
      const prisma = { run: { findFirst }, message: { findMany } } as unknown as PrismaClient;
      return { prisma, findFirst };
    };

    it("returns a completed run with its reply under untrusted_text, scoped to the member", async () => {
      const { prisma, findFirst } = fake({
        id: "run-1",
        threadId: "thread-1",
        status: "completed",
      });
      const result = await callMcpReadTool(
        "agent_run_status",
        { prisma, scope },
        { runId: "run-1" },
      );
      expect(result).toEqual({
        status: "completed",
        runId: "run-1",
        threadId: "thread-1",
        untrusted_text: { reply: "Done: 3 invoices." },
      });
      expect(findFirst.mock.calls[0]?.[0]).toMatchObject({
        where: { id: "run-1", spaceId: "space-1", userId: "user-1" },
      });
    });

    it("reports a missing run and a missing runId", async () => {
      const { prisma } = fake(null);
      expect(await callMcpReadTool("agent_run_status", { prisma, scope }, { runId: "x" })).toEqual({
        error: "Run not found",
      });
      expect(await callMcpReadTool("agent_run_status", { prisma, scope }, {})).toEqual({
        error: "runId is required",
      });
    });
  });
});
