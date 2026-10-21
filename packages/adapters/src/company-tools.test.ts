import type { Actor } from "@rakazo/contracts";
import {
  CalendarQueryInputSchema,
  CompanyFactUpsertInputSchema,
  CompanyGetInputSchema,
  CompanyImportStartInputSchema,
  CompanySearchInputSchema,
  TimelineQueryInputSchema,
} from "@rakazo/contracts";
import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it, vi } from "vitest";
import { companyToolFromTool, companyToolsForRun } from "./company-tools.js";

const actor: Actor = {
  userId: "owner-1",
  spaceId: "space-1",
  email: "owner@example.test",
  isDeploymentOwner: false,
};

describe("Company tools", () => {
  it("rejects caller-supplied scope, visibility, and review fields", () => {
    expect(CompanySearchInputSchema.safeParse({ text: "Acme", ownerUserId: "other" }).success).toBe(
      false,
    );
    expect(
      CompanyGetInputSchema.safeParse({ kind: "entity", id: "x", status: "confirmed" }).success,
    ).toBe(false);
    expect(
      TimelineQueryInputSchema.safeParse({
        from: "2026-01-01",
        to: "2026-12-31",
        spaceId: "other",
      }).success,
    ).toBe(false);
    expect(
      CalendarQueryInputSchema.safeParse({
        from: "2026-01-01",
        to: "2026-12-31",
        ownerUserId: "other",
      }).success,
    ).toBe(false);
    expect(
      CompanyFactUpsertInputSchema.safeParse({ operation: "create", ownerUserId: "other" }).success,
    ).toBe(false);
    expect(CompanyImportStartInputSchema.safeParse({ runId: "run-1", consent: true }).success).toBe(
      false,
    );
  });

  it("offers shared reads only through the owner and data-room authorization seam", () => {
    const authorized = companyToolsForRun({
      ownerRun: true,
      companyAgent: false,
      importer: false,
      dataRoomAllowed: true,
    });
    expect(authorized.map((tool) => tool.name)).toEqual([
      "company_search",
      "company_get",
      "timeline_query",
      "calendar_query",
    ]);
    expect(
      companyToolsForRun({
        ownerRun: false,
        companyAgent: false,
        importer: false,
        dataRoomAllowed: true,
      }),
    ).toEqual([]);
    expect(
      companyToolsForRun({
        ownerRun: false,
        companyAgent: true,
        importer: false,
        dataRoomAllowed: true,
      }),
    ).toEqual([]);
    expect(
      companyToolsForRun({
        ownerRun: false,
        companyAgent: false,
        importer: true,
        dataRoomAllowed: true,
      }),
    ).toEqual([]);
    expect(
      companyToolsForRun({
        ownerRun: true,
        companyAgent: false,
        importer: false,
        dataRoomAllowed: false,
      }),
    ).toEqual([]);
  });

  it("requires an owner run and a server-recorded approval for mutations", async () => {
    const prisma = {} as PrismaClient;
    const outsideOwnerRead = await companyToolFromTool(
      {
        prisma,
        actor,
        ownerRun: false,
        companyAgent: true,
        importer: false,
        dataRoomAllowed: async () => true,
      },
      "company_search",
      { text: "Company" },
    );
    expect(outsideOwnerRead.error).toMatch(/owner-started foreground run/i);

    const outsideOwner = await companyToolFromTool(
      {
        prisma,
        actor,
        ownerRun: false,
        companyAgent: true,
        importer: false,
        dataRoomAllowed: async () => true,
      },
      "company_fact_upsert",
      {},
    );
    expect(outsideOwner.error).toMatch(/owner-started/i);

    const noApproval = await companyToolFromTool(
      {
        prisma,
        actor,
        ownerRun: true,
        companyAgent: true,
        importer: false,
        dataRoomAllowed: async () => true,
      },
      "company_fact_upsert",
      {},
      { approvedByCard: false },
    );
    expect(noApproval.error).toMatch(/explicit owner approval/i);

    const noImportApproval = await companyToolFromTool(
      {
        prisma,
        actor,
        ownerRun: true,
        companyAgent: false,
        importer: true,
        dataRoomAllowed: async () => true,
      },
      "company_import_start",
      { runId: "run-1" },
      { approvedByCard: false },
    );
    expect(noImportApproval.error).toMatch(/explicitly approved/i);
  });

  it("does not let tool arguments choose the Company actor", async () => {
    const dataRoomAllowed = vi.fn(async () => false);
    const companyTools = await import("./company-tools.js");
    const result = await companyTools.companyToolFromTool(
      {
        prisma: {} as PrismaClient,
        actor,
        ownerRun: true,
        companyAgent: false,
        importer: false,
        dataRoomAllowed,
      },
      "company_search",
      { text: "Acme", userId: "other", spaceId: "other" },
    );
    expect(result.error).toBeDefined();
    expect(dataRoomAllowed).not.toHaveBeenCalled();
  });
});
