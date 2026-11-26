import { t } from "@lingui/core/macro";
import type { EquityDatedPropertyInput, EquityDatedPropertyKind } from "@rakazo/contracts";

/** Section heading and message text for each dated property kind. */
export const DATED_PROPERTY_KIND_LABELS: Record<EquityDatedPropertyKind, string> = {
  relationship: t`Relationship`,
  job_title: t`Job title`,
  cost_center: t`Cost center`,
  department: t`Department`,
};

/** One editable dated entry: the kind it belongs to, its effective date and its value. */
export type DatedRow = {
  kind: EquityDatedPropertyKind;
  effectiveDate: string;
  value: string;
};

/** What is wrong with the rows: a missing date or value, or two entries of one kind on one date. */
export function validateDatedRows(rows: DatedRow[]): string[] {
  const errors: string[] = [];
  const seen = new Map<string, EquityDatedPropertyKind>();
  for (const row of rows) {
    const label = DATED_PROPERTY_KIND_LABELS[row.kind];
    if (!row.effectiveDate) errors.push(t`Enter a date for ${label}`);
    if (!row.value.trim()) errors.push(t`Enter a value for ${label}`);
    if (row.effectiveDate && row.value.trim()) {
      const earlier = seen.get(`${row.kind} ${row.effectiveDate}`);
      if (earlier === undefined) {
        seen.set(`${row.kind} ${row.effectiveDate}`, row.kind);
      } else {
        errors.push(t`Two ${label} entries are dated ${row.effectiveDate}`);
      }
    }
  }
  return errors;
}

/** The rows as the server's update input expects them. */
export function toUpdateProperties(rows: DatedRow[]): EquityDatedPropertyInput[] {
  return rows.map((row) => ({
    kind: row.kind,
    effectiveDate: row.effectiveDate,
    value: row.value.trim(),
  }));
}
