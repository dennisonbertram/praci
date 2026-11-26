import type { PrismaClient } from "@rakazo/db";
import { describe, expect, it } from "vitest";
import { legalToolFromTool } from "./legal-tools.js";

type Row = Record<string, unknown>;

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, want]) => {
    if (want && typeof want === "object" && !(want instanceof Date)) {
      const w = want as { not?: unknown; notIn?: unknown[] };
      if ("not" in w) return row[key] !== w.not;
      if ("notIn" in w) return !w.notIn?.includes(row[key]);
      return true;
    }
    return row[key] === want;
  });
}

function table(rows: Row[]) {
  const find = (where?: Row) => rows.filter((row) => matches(row, where));
  return {
    findMany: async ({ where, take }: { where?: Row; take?: number }) => find(where).slice(0, take),
    findFirst: async ({ where }: { where?: Row }) => find(where)[0] ?? null,
    findFirstOrThrow: async ({ where }: { where?: Row }) => {
      const row = find(where)[0];
      if (!row) throw new Error("not found");
      return row;
    },
    updateMany: async ({ where, data }: { where?: Row; data: Row }) => {
      const hit = find(where);
      for (const row of hit) Object.assign(row, data);
      return { count: hit.length };
    },
  };
}

const scope = { spaceId: "s1", userId: "u1" };

const contract = (id: string, status: string, expirationDate: string): Row => ({
  ...scope,
  id,
  dataRoomItemId: `item-${id}`,
  title: `Contract ${id}`,
  contractType: "services",
  counterparties: [],
  status,
  effectiveDate: null,
  expirationDate: new Date(expirationDate),
  autoRenews: false,
  renewalNoticeDays: null,
  governingLaw: null,
  valueCents: null,
  currency: null,
  summary: "",
  analyzedRevision: 1,
  analyzedAt: new Date("2026-01-01T00:00:00Z"),
});

const deadline = (id: string, status: string): Row => ({
  ...scope,
  id,
  contractId: null,
  dataRoomItemId: null,
  title: "Renewal notice",
  dueDate: new Date("2026-12-01T00:00:00Z"),
  kind: "other",
  status,
  sourceQuote: null,
  notes: null,
  removalProposedAt: null,
});

function deps(contracts: Row[], deadlines: Row[]) {
  const prisma = {
    legalContract: table(contracts),
    legalDeadline: table(deadlines),
    dataRoomItem: { findMany: async () => [] },
  } as unknown as PrismaClient;
  return { prisma, scope, allowed: async () => true };
}

describe("legal_query contracts", () => {
  it("applies the status filter before the limit", async () => {
    const contracts = [
      contract("c1", "expired", "2026-01-01"),
      contract("c2", "expired", "2026-02-01"),
      contract("c3", "active", "2027-01-01"),
    ];
    const result = (await legalToolFromTool("legal_query", deps(contracts, []), {
      view: "contracts",
      status: "active",
      limit: 1,
    })) as { contracts: { id: string }[] };
    expect(result.contracts.map((c) => c.id)).toEqual(["c3"]);
  });
});

describe("legal_upsert_deadline removal proposal", () => {
  const args = (id: string) => ({
    id,
    title: "Renewal notice",
    dueDate: "2026-12-01",
    kind: "other",
    status: "dismissed",
  });

  it("leaves a closed deadline unchanged", async () => {
    const rows = [deadline("d1", "done")];
    const result = (await legalToolFromTool(
      "legal_upsert_deadline",
      deps([], rows),
      args("d1"),
    )) as {
      note: string;
    };
    expect(rows[0]?.removalProposedAt).toBeNull();
    expect(result.note).toBe("Closed by the founder; left unchanged.");
  });

  it("proposes removal of an open deadline", async () => {
    const rows = [deadline("d1", "open")];
    const result = (await legalToolFromTool(
      "legal_upsert_deadline",
      deps([], rows),
      args("d1"),
    )) as {
      note: string;
    };
    expect(rows[0]?.removalProposedAt).toBeInstanceOf(Date);
    expect(result.note).toBe("Proposed for removal; the founder confirms.");
  });
});
