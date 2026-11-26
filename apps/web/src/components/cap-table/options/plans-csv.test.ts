import { expect, it } from "vitest";
import { demoPlanPool } from "./plan-pool-fixture";
import { PLANS_CSV_HEADER, plansCsv } from "./plans-csv";

it("writes a header row and one row per pool", () => {
  const csv = plansCsv([demoPlanPool(), demoPlanPool({ planId: "plan-2", name: "2027 Plan" })]);
  const [header, first, second] = csv.split("\r\n");
  expect(header).toBe(
    "Plan name,Status,Reserved,Granted,Outstanding,Exercised,Returned,Issued,Available",
  );
  expect(header).toBe(PLANS_CSV_HEADER.join(","));
  expect(first).toBe("2026 Stock Plan,active,1000000,400000,300000,50000,50000,0,650000");
  expect(second).toContain("2027 Plan");
});

it("quotes plan names with a comma or a quote, doubling the quotes", () => {
  const csv = plansCsv([demoPlanPool({ name: '2026 Plan, "restated"' })]);
  expect(csv.split("\r\n")[1]).toBe(
    '"2026 Plan, ""restated""",active,1000000,400000,300000,50000,50000,0,650000',
  );
});

it("writes only the header when there are no plans", () => {
  expect(plansCsv([])).toBe(PLANS_CSV_HEADER.join(","));
});
