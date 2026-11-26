import { describe, expect, it } from "vitest";
import { MEMORY_MIN_STRENGTH, memoryStrength } from "./memory-strength.js";

const now = new Date("2026-11-05T12:00:00.000Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();

describe("memory strength", () => {
  it("ranks an old unused task below a fresh one", () => {
    const old = memoryStrength({ kind: "task", updatedAt: daysAgo(60) }, now);
    const fresh = memoryStrength({ kind: "task", updatedAt: daysAgo(1) }, now);
    expect(old).toBeLessThan(fresh);
    expect(old).toBeLessThan(MEMORY_MIN_STRENGTH);
    expect(fresh).toBeGreaterThan(0.9);
  });

  it("fades preferences slower than facts, and facts slower than tasks", () => {
    const at = (kind: "preference" | "fact" | "task") =>
      memoryStrength({ kind, updatedAt: daysAgo(90) }, now);
    expect(at("preference")).toBeGreaterThan(at("fact"));
    expect(at("fact")).toBeGreaterThan(at("task"));
  });

  it("keeps a recently used preference strong where an unused one has faded", () => {
    const used = memoryStrength(
      { kind: "preference", updatedAt: daysAgo(1500), lastUsedAt: daysAgo(2), useCount: 40 },
      now,
    );
    const unused = memoryStrength({ kind: "preference", updatedAt: daysAgo(1500) }, now);
    expect(used).toBeGreaterThan(0.5);
    expect(unused).toBeLessThan(MEMORY_MIN_STRENGTH);
  });

  it("stops crediting use once the last use is older than a half-life", () => {
    const lapsed = memoryStrength(
      { kind: "task", updatedAt: daysAgo(60), lastUsedAt: daysAgo(30), useCount: 40 },
      now,
    );
    expect(lapsed).toBe(memoryStrength({ kind: "task", updatedAt: daysAgo(60) }, now));
  });

  it("never fades a pinned memory and treats a missing kind as a fact", () => {
    expect(memoryStrength({ kind: "task", updatedAt: daysAgo(900), pinned: true }, now)).toBe(1);
    expect(memoryStrength({ updatedAt: daysAgo(90) }, now)).toBeCloseTo(0.5, 5);
    expect(memoryStrength({}, now)).toBe(1);
  });
});
