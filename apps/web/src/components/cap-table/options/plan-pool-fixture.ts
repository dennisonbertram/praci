import type { EquityPlanPool } from "@rakazo/contracts";

/** An invented plan pool for stories and tests. */
export const demoPlanPool = (overrides: Partial<EquityPlanPool> = {}): EquityPlanPool => ({
  planId: "plan-1",
  name: "2026 Stock Plan",
  status: "active",
  reservedShares: "1000000",
  grantedShares: "400000",
  outstandingShares: "300000",
  exercisedShares: "50000",
  returnedShares: "50000",
  issuedShares: "0",
  availableShares: "650000",
  increases: [],
  ...overrides,
});
