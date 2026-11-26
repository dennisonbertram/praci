import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";
import {
  generateToken,
  hashToken,
  listActivity,
  McpConnectionNotFound,
  PAT_PREFIX,
} from "./mcp-connections.js";

describe("personal access tokens", () => {
  it("has the praci_pat_ format with at least 256 random bits", () => {
    const { token } = generateToken();
    expect(token).toMatch(/^praci_pat_[A-Za-z0-9_-]{43,}$/);
    expect(Buffer.from(token.slice(PAT_PREFIX.length), "base64url")).toHaveLength(32);
  });

  it("stores a sha256 hash and a short prefix, never the token", () => {
    const { token, tokenHash, tokenPrefix } = generateToken();
    expect(tokenHash).toBe(hashToken(token));
    expect(tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(tokenHash).not.toContain(token);
    expect(token.startsWith(tokenPrefix)).toBe(true);
    expect(tokenPrefix).toHaveLength(PAT_PREFIX.length + 4);
  });

  it("is different every time", () => {
    expect(generateToken().token).not.toBe(generateToken().token);
  });
});

describe("listActivity", () => {
  const actor = { userId: "user-1" };
  const setup = (owned: { id: string } | null, logs: unknown[] = []) => {
    const findFirst = vi.fn().mockResolvedValue(owned);
    const findMany = vi.fn().mockResolvedValue(logs);
    const prisma = {
      mcpConnection: { findFirst },
      mcpCallLog: { findMany },
    } as unknown as PrismaClient;
    return { prisma, findFirst, findMany };
  };

  it("reads the latest 20 calls, newest first with id as tiebreaker", async () => {
    const { prisma, findFirst, findMany } = setup({ id: "c1" });
    await listActivity(prisma, actor, "c1");
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "c1", userId: "user-1" },
      select: { id: true },
    });
    expect(findMany).toHaveBeenCalledWith({
      where: { connectionId: "c1" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 20,
      select: { tool: true, outcome: true, createdAt: true },
    });
  });

  it("rejects a connection the member does not own without reading the log", async () => {
    const { prisma, findFirst, findMany } = setup(null);
    await expect(listActivity(prisma, actor, "c2")).rejects.toBeInstanceOf(McpConnectionNotFound);
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: "c2", userId: "user-1" },
      select: { id: true },
    });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("passes known outcomes through and maps unknown ones to error", async () => {
    const createdAt = new Date("2026-01-02T03:04:05.000Z");
    const outcomes = ["ok", "error", "rate_limited", "pending", "blocked", "weird"];
    const { prisma } = setup(
      { id: "c1" },
      outcomes.map((outcome) => ({ tool: "t", outcome, createdAt })),
    );
    const calls = await listActivity(prisma, actor, "c1");
    expect(calls.map((c) => c.outcome)).toEqual([
      "ok",
      "error",
      "rate_limited",
      "pending",
      "blocked",
      "error",
    ]);
    expect(calls[0]).toEqual({ tool: "t", outcome: "ok", createdAt: "2026-01-02T03:04:05.000Z" });
  });
});
