import { describe, expect, it } from "vitest";
import type { LegalContract } from "./legal.js";
import { groupLegalContracts, legalGroupKey, legalGroupName } from "./legal-groups.js";

const make = (n: number, over: Partial<LegalContract> = {}): LegalContract => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  dataRoomItemId: `00000000-0000-4000-8000-${String(n + 100).padStart(12, "0")}`,
  title: `Series Z - Warrant (Holder ${n}) (warrant)`,
  contractType: "Warrant",
  counterparties: ["Example Corp", `Holder ${n}`],
  status: "active",
  effectiveDate: "2021-07-09",
  expirationDate: "2031-07-09",
  autoRenews: null,
  renewalNoticeDays: null,
  governingLaw: null,
  valueCents: null,
  currency: null,
  summary: null,
  analyzedRevision: 1,
  analyzedAt: "2026-10-10T09:00:00.000Z",
  nextDeadline: null,
  ...over,
});

describe("legalGroupName", () => {
  it("drops trailing parentheticals and a trailing counterparty suffix", () => {
    expect(legalGroupName(make(1))).toBe("Series Z - Warrant");
    expect(
      legalGroupName({ title: "SAFE - Holder 2", counterparties: ["Example Corp", "holder 2"] }),
    ).toBe("SAFE");
    expect(legalGroupName({ title: "SAFE - Seed", counterparties: ["Other"] })).toBe("SAFE - Seed");
  });
});

describe("groupLegalContracts", () => {
  it("collapses three or more with one key, at the first member's place", () => {
    const lone = make(9, { title: "Office lease", contractType: "Lease" });
    const rows = groupLegalContracts([lone, make(1), make(2), make(3)]);
    expect(rows.map((r) => r.kind)).toEqual(["single", "group"]);
    const group = rows[1];
    expect(group?.kind === "group" && group.contracts).toHaveLength(3);
    expect(group?.kind === "group" && group.name).toBe("Series Z - Warrant");
  });

  it("leaves two alike as single rows", () => {
    expect(groupLegalContracts([make(1), make(2)]).map((r) => r.kind)).toEqual([
      "single",
      "single",
    ]);
  });

  it("separates by type and by term dates", () => {
    const keys = new Set([
      legalGroupKey(make(1)),
      legalGroupKey(make(2, { contractType: "Option" })),
      legalGroupKey(make(3, { expirationDate: "2032-07-09" })),
    ]);
    expect(keys.size).toBe(3);
    expect(legalGroupKey(make(1))).toBe(legalGroupKey(make(2, { contractType: " warrant " })));
  });
});
