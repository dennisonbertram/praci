import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";
import {
  auditRequestToolFromTool,
  investorUpdateToolFromTool,
  investorUpdateToolsAllowed,
} from "./investor-tools.js";

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

const auditRow = (over: Record<string, unknown> = {}) => ({
  id: "ar1",
  ...scope,
  fund: "Example Fund I",
  fundKey: "example fund i",
  asOf: null,
  asOfMatched: true,
  dueDate: null,
  status: "open",
  dataRoomItemId: null,
  mailThreadId: "t1",
  connectionId: "c1",
  draftRef: null,
  senderKnown: false,
  notes: "",
  draftStartedAt: null,
  draftedAt: null,
  doneAt: null,
  lastMailAt: new Date("2026-10-20T10:00:00Z"),
  createdAt: new Date("2026-10-20T10:00:00Z"),
  ...over,
});

function auditFake(rows: ReturnType<typeof auditRow>[]) {
  const matches = (r: ReturnType<typeof auditRow>, where: Record<string, any>) =>
    Object.entries(where).every(([k, v]) =>
      v && typeof v === "object" && "in" in v
        ? v.in.includes((r as any)[k])
        : v instanceof Date
          ? (r as any)[k]?.getTime() === v.getTime()
          : (r as any)[k] === v,
    );
  const prisma = {
    run: { findMany: async () => [] },
    auditRequest: {
      findFirst: async ({ where }: { where: Record<string, any> }) =>
        rows.find((r) => matches(r, where)) ?? null,
      updateMany: async ({ where, data }: { where: Record<string, any>; data: object }) => {
        const hit = rows.filter((r) => matches(r, where));
        for (const r of hit) Object.assign(r, data);
        return { count: hit.length };
      },
      create: async ({ data }: { data: object }) => {
        const made = auditRow({ id: `new${rows.length}`, ...data });
        rows.push(made);
        return made;
      },
    },
  };
  return { deps: { prisma: prisma as never, scope }, rows };
}

describe("audit_request_upsert", () => {
  it("corrects the row it was given and moves it to drafted with the draft id", async () => {
    const { deps } = auditFake([auditRow()]);
    const result = await auditRequestToolFromTool(deps, {
      id: "ar1",
      fund: "Corrected Fund",
      asOf: "2026-09-30",
      dueDate: "2026-11-15",
      drafted: true,
      draftRef: "draft-9",
    });
    expect(result.request).toMatchObject({
      id: "ar1",
      fund: "Corrected Fund",
      asOf: "2026-09-30",
      dueDate: "2026-11-15",
      status: "drafted",
    });
  });

  it("without an id returns the open row with the same fund and as-of date instead of adding one", async () => {
    const { deps, rows } = auditFake([auditRow({ asOf: new Date("2026-09-30T00:00:00Z") })]);
    const result = await auditRequestToolFromTool(deps, {
      fund: "  EXAMPLE   fund i ",
      asOf: "2026-09-30",
    });
    expect(result).toMatchObject({ created: false, request: { id: "ar1" } });
    expect(rows).toHaveLength(1);
    const other = await auditRequestToolFromTool(deps, {
      fund: "Example Fund I",
      asOf: "2026-12-31",
    });
    expect(other).toMatchObject({ created: true });
    expect(rows).toHaveLength(2);
  });

  it("state only moves forward: it neither reopens nor changes a closed request", async () => {
    const { deps, rows } = auditFake([auditRow({ status: "dismissed" })]);
    const result = await auditRequestToolFromTool(deps, { id: "ar1", fund: "X", drafted: true });
    expect(result.request).toMatchObject({ status: "dismissed", fund: "Example Fund I" });
    expect(rows[0]?.status).toBe("dismissed");
  });

  it("cannot read or change another user's request, and has no way to close one", async () => {
    const { deps } = auditFake([auditRow({ userId: "user-2" })]);
    expect(await auditRequestToolFromTool(deps, { id: "ar1", fund: "X" })).toEqual({
      error: "No audit request with this id.",
    });
    expect(await auditRequestToolFromTool(deps, { id: "ar1", status: "done" })).toBeDefined();
  });

  it("needs a fund when there is no id", async () => {
    const { deps } = auditFake([]);
    expect(await auditRequestToolFromTool(deps, {})).toEqual({
      error: "fund is required without an id",
    });
  });
});
