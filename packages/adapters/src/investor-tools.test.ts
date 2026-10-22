import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";
import { investorUpdateToolFromTool, investorUpdateToolsAllowed } from "./investor-tools.js";

const scope = { spaceId: "space-1", userId: "user-1" };

const row = (over: Record<string, unknown> = {}) => ({
  id: "u1",
  ...scope,
  audience: "investors",
  subject: "Acme · 2026-09 update",
  period: "2026-09",
  body: "September went well.",
  status: "sent",
  recipientContactIds: [],
  fromConnectionId: null,
  deliveries: {},
  sentAt: new Date("2026-10-01T09:00:00Z"),
  createdAt: new Date("2026-10-01T08:00:00Z"),
  updatedAt: new Date("2026-10-01T09:00:00Z"),
  ...over,
});

function fake(rows: ReturnType<typeof row>[]) {
  const updateMany = vi.fn(async ({ where }: { where: Record<string, unknown> }) => ({
    count: rows.filter((r) => r.id === where.id && r.status === where.status).length,
  }));
  const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
    const made = row({ id: "new", status: "draft", sentAt: null, ...data });
    rows.push(made);
    return made;
  });
  const prisma = {
    investorUpdate: {
      findMany: async () => rows,
      findFirst: async ({ where }: { where: { id: string; spaceId: string; userId: string } }) =>
        rows.find(
          (r) => r.id === where.id && r.spaceId === where.spaceId && r.userId === where.userId,
        ) ?? null,
      updateMany,
      create,
    },
    contact: { findMany: async () => [] },
    composeSend: { findMany: async () => [] },
    space: { findUnique: async () => ({ name: "Acme" }) },
  };
  return { deps: { prisma: prisma as unknown as PrismaClient, scope }, updateMany, create };
}

describe("investor_update_draft", () => {
  it("history lists recent sent updates with their bodies and leaves out drafts", async () => {
    const { deps } = fake([row(), row({ id: "d1", status: "draft", sentAt: null })]);
    const result = await investorUpdateToolFromTool(deps, { action: "history" });
    expect(result.updates).toEqual([
      expect.objectContaining({ id: "u1", body: "September went well.", status: "sent" }),
    ]);
  });

  it("get reads one update and does not read another user's", async () => {
    const { deps } = fake([row({ userId: "user-2" }), row({ id: "mine" })]);
    expect(
      (await investorUpdateToolFromTool(deps, { action: "get", id: "mine" })).update,
    ).toMatchObject({ id: "mine" });
    expect(await investorUpdateToolFromTool(deps, { action: "get", id: "u1" })).toEqual({
      error: "No update with this id.",
    });
  });

  it("save changes a draft's body and refuses a sent update", async () => {
    const { deps, updateMany } = fake([row({ id: "d1", status: "draft", sentAt: null }), row()]);
    const saved = await investorUpdateToolFromTool(deps, {
      action: "save",
      id: "d1",
      body: "New body",
    });
    expect(saved.update).toMatchObject({ id: "d1" });
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "d1", ...scope, status: "draft" }),
      }),
    );
    const refused = await investorUpdateToolFromTool(deps, { action: "save", id: "u1", body: "x" });
    expect(String(refused.error)).toContain("already sent");
  });

  it("create adds a draft and never sends", async () => {
    const { deps, create } = fake([]);
    const made = await investorUpdateToolFromTool(deps, { action: "create", body: "Draft" });
    expect(create).toHaveBeenCalledOnce();
    expect(made.update).toMatchObject({ status: "draft", audience: "investors" });
  });

  it("is offered to the Investors agent only, on an owner-started run", () => {
    const run = {
      hasProvider: true,
      runUserId: "u",
      botUserId: "u",
      groupId: null,
      trigger: "user",
      messagingChannelRun: false,
    };
    expect(investorUpdateToolsAllowed({ ...run, botSpawnKey: "investors-agent:u" })).toBe(true);
    for (const key of ["carta-agent:u", "legal-agent:u", null])
      expect(investorUpdateToolsAllowed({ ...run, botSpawnKey: key })).toBe(false);
  });
});
