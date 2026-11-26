import { expect, it } from "vitest";
import type { EquityCertificateLineage, EquityExerciseLineageRecord } from "./plan-accounting.js";
import { indexEquityCertificateLineage } from "./plan-accounting.js";

const cert = (
  id: string,
  parentId: string | null = null,
  planId: string | null = "plan-a",
): EquityCertificateLineage => ({
  id,
  parentId,
  planId,
  status: "outstanding",
  quantity: 100n,
});

const origin = (
  overrides: Partial<EquityExerciseLineageRecord> = {},
): EquityExerciseLineageRecord => ({
  certificateId: "root",
  exerciseId: "exercise",
  optionGrantId: "grant",
  planId: "plan-a",
  quantity: 100n,
  status: "completed",
  grantExercisedQuantity: 100n,
  ...overrides,
});

it("validates unknown ancestors and cycles through exercise roots", () => {
  expect(() => indexEquityCertificateLineage([cert("child", "missing")], [])).toThrow(
    "unknown origin",
  );
  expect(() =>
    indexEquityCertificateLineage([cert("root", "child"), cert("child", "root")], [origin()]),
  ).toThrow("cycle");
});

it("classifies deep valid chains iteratively", () => {
  const chain = Array.from({ length: 20_000 }, (_, index) =>
    cert(`cert-${index}`, index === 0 ? null : `cert-${index - 1}`),
  );
  for (const certificates of [chain, [...chain].reverse()]) {
    const unlinked = indexEquityCertificateLineage(certificates, []);
    expect(unlinked.isExerciseOrigin("cert-19999")).toBe(false);

    const exerciseLinked = indexEquityCertificateLineage(certificates, [
      origin({ certificateId: "cert-0" }),
    ]);
    expect(exerciseLinked.isExerciseOrigin("cert-19999")).toBe(true);
    expect(exerciseLinked.originFor("cert-19999")).toMatchObject({
      optionGrantId: "grant",
      planId: "plan-a",
    });
  }
});

it("preserves legacy null-plan origins and rejects inconsistent origins", () => {
  const legacy = indexEquityCertificateLineage([cert("root", null, null)], [origin()]);
  expect(legacy.originFor("root")?.planId).toBe("plan-a");
  expect(() => indexEquityCertificateLineage([cert("root", null, "plan-b")], [origin()])).toThrow(
    "plan does not match",
  );
});

it("requires completed linked exercises within the grant counter", () => {
  expect(() =>
    indexEquityCertificateLineage([cert("root")], [origin({ status: "pending" })]),
  ).toThrow("Only completed");
  expect(() =>
    indexEquityCertificateLineage([cert("root")], [origin({ grantExercisedQuantity: 99n })]),
  ).toThrow("exceed the grant");
});
