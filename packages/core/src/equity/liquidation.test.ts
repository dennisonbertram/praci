import { describe, expect, it } from "vitest";
import type { CapClass } from "./cap-table.js";
import { seniorityOrder } from "./liquidation.js";

function capClass(id: string, overrides: Partial<CapClass> = {}): CapClass {
  return {
    id,
    name: id,
    classType: "preferred",
    authorizedShares: 1_000_000n,
    ...overrides,
  };
}

describe("seniorityOrder", () => {
  it("orders ranks most senior first, lowest seniority number first", () => {
    const seed = capClass("seed");
    const seedPrime = capClass("seed-prime");
    const preferredB = capClass("preferred-b", { seniority: 2 });
    const common = capClass("common", { classType: "common", seniority: 3 });
    const ranks = seniorityOrder([preferredB, common, seed, seedPrime]);
    expect(ranks.map((rank) => rank.map((shareClass) => shareClass.id))).toEqual([
      ["seed", "seed-prime"],
      ["preferred-b"],
      ["common"],
    ]);
  });

  it("keeps same-seniority classes in separate ranks unless all are pari passu", () => {
    const first = capClass("first", { pariPassu: true });
    const second = capClass("second", { pariPassu: false });
    const third = capClass("third");
    const ranks = seniorityOrder([first, second, third]);
    expect(ranks.map((rank) => rank.map((shareClass) => shareClass.id))).toEqual([
      ["first"],
      ["second"],
      ["third"],
    ]);
  });

  it("shares a rank when every class at that seniority is pari passu", () => {
    const ranks = seniorityOrder([
      capClass("a", { pariPassu: true }),
      capClass("b", { pariPassu: true }),
      capClass("c"),
    ]);
    expect(ranks).toHaveLength(1);
    expect(ranks[0]?.map((shareClass) => shareClass.id)).toEqual(["a", "b", "c"]);
  });

  it("treats a missing seniority as the schema default of 1", () => {
    const ranks = seniorityOrder([
      capClass("defaulted"),
      capClass("senior", { seniority: 1 }),
      capClass("junior", { seniority: 2 }),
    ]);
    expect(ranks.map((rank) => rank.map((shareClass) => shareClass.id))).toEqual([
      ["defaulted", "senior"],
      ["junior"],
    ]);
  });

  it("returns no ranks for no classes and does not mutate the input", () => {
    expect(seniorityOrder([])).toEqual([]);
    const input = [capClass("b", { seniority: 2 }), capClass("a", { seniority: 1 })];
    const snapshot = [...input];
    seniorityOrder(input);
    expect(input).toEqual(snapshot);
  });
});
