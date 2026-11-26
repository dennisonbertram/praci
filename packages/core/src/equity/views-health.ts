// Health checks: rules that find problems in the cap table ledger. Each check yields one finding
// with the offending rows, each row naming the record to fix. Pure functions, no I/O.

import type { CapTableInput } from "./cap-table.js";
import { isOutstandingCertificate, outstandingOptionQuantity } from "./cap-table.js";

/** Same values as EQUITY_HEALTH_TAGS and EQUITY_HEALTH_SEVERITIES in the contracts. */
export type HealthTag = "share_classes" | "company" | "securities" | "documents" | "stakeholder";
export type HealthSeverity = "required" | "recommended";
export type HealthRecordKind =
  | "stakeholder"
  | "share_class"
  | "certificate"
  | "plan"
  | "option_grant";

export type HealthRow = {
  recordKind: HealthRecordKind;
  recordId: string;
  name: string;
  detail: string;
};
export type HealthFinding = {
  check: string;
  tag: HealthTag;
  severity: HealthSeverity;
  rows: HealthRow[];
};

export type HealthInput = CapTableInput & {
  stakeholders: readonly { id: string; name: string; email: string | null }[];
  /** Security labels by id (e.g. CS-12), shown in place of the id. */
  labels?: Readonly<Record<string, string>>;
};

const fmt = (value: bigint) => value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");

export function runHealthChecks(input: HealthInput): HealthFinding[] {
  const findings: HealthFinding[] = [];
  const add = (check: string, tag: HealthTag, severity: HealthSeverity, rows: HealthRow[]) => {
    if (rows.length)
      findings.push({
        check,
        tag,
        severity,
        rows: rows.sort((a, b) => a.recordId.localeCompare(b.recordId)),
      });
  };
  const outstanding = input.certificates.filter((row) => isOutstandingCertificate(row.status));

  // Issued shares plus plan reserves above a class's authorized shares.
  add(
    "class-over-issued",
    "share_classes",
    "required",
    input.classes.flatMap((shareClass) => {
      const issued =
        outstanding
          .filter((row) => row.shareClassId === shareClass.id)
          .reduce((sum, row) => sum + row.quantity, 0n) +
        input.plans
          .filter((plan) => plan.shareClassId === shareClass.id)
          .reduce((sum, plan) => sum + plan.reservedShares, 0n);
      return issued > shareClass.authorizedShares
        ? [
            {
              recordKind: "share_class" as const,
              recordId: shareClass.id,
              name: shareClass.name,
              detail: `${fmt(issued)} issued or reserved of ${fmt(shareClass.authorizedShares)} authorized`,
            },
          ]
        : [];
    }),
  );

  // Options granted beyond the plan's reserved shares.
  add(
    "options-above-pool",
    "securities",
    "required",
    input.plans.flatMap((plan) => {
      const granted = input.optionGrants
        .filter((grant) => grant.planId === plan.id)
        .reduce(
          (sum, grant) =>
            sum +
            grant.exercisedQuantity +
            (grant.status === "outstanding" ? outstandingOptionQuantity(grant) : 0n),
          0n,
        );
      return granted > plan.reservedShares
        ? [
            {
              recordKind: "plan" as const,
              recordId: plan.id,
              name: plan.name,
              detail: `${fmt(granted)} granted of ${fmt(plan.reservedShares)} reserved`,
            },
          ]
        : [];
    }),
  );

  // Securities with no quantity or no issue date.
  add("security-missing-data", "securities", "required", [
    ...input.certificates
      .filter((row) => row.quantity <= 0n || !row.issueDate)
      .map((row) => ({
        recordKind: "certificate" as const,
        recordId: row.id,
        name: row.id,
        detail: row.quantity <= 0n ? "No shares" : "No issue date",
      })),
    ...input.optionGrants
      .filter((row) => row.quantity <= 0n || !row.grantDate)
      .map((row) => ({
        recordKind: "option_grant" as const,
        recordId: row.id,
        name: row.id,
        detail: row.quantity <= 0n ? "No options" : "No grant date",
      })),
  ]);

  // Holders with no email cannot be reached or invited.
  const holders = new Set([
    ...outstanding.map((row) => row.stakeholderId),
    ...input.optionGrants
      .filter((row) => row.status === "outstanding")
      .map((row) => row.stakeholderId),
    ...input.convertibles
      .filter((row) => row.status === "outstanding")
      .map((row) => row.stakeholderId),
  ]);
  add(
    "holder-missing-email",
    "stakeholder",
    "recommended",
    input.stakeholders
      .filter((row) => holders.has(row.id) && !row.email)
      .map((row) => ({
        recordKind: "stakeholder" as const,
        recordId: row.id,
        name: row.name,
        detail: "No email",
      })),
  );

  // Two or more stakeholders with the same email.
  const byEmail = new Map<string, { id: string; name: string }[]>();
  for (const row of input.stakeholders) {
    if (!row.email) continue;
    const key = row.email.trim().toLowerCase();
    byEmail.set(key, [...(byEmail.get(key) ?? []), row]);
  }
  add(
    "duplicated-stakeholder",
    "stakeholder",
    "required",
    [...byEmail.entries()].flatMap(([email, rows]) =>
      rows.length > 1
        ? rows.map((row) => ({
            recordKind: "stakeholder" as const,
            recordId: row.id,
            name: row.name,
            detail: `${rows.length} stakeholders share ${email}`,
          }))
        : [],
    ),
  );

  const severity = (value: HealthSeverity) => (value === "required" ? 0 : 1);
  return findings.sort(
    (a, b) => severity(a.severity) - severity(b.severity) || a.check.localeCompare(b.check),
  );
}
