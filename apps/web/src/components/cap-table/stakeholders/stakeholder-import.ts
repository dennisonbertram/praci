import type {
  EquityCustomProperty,
  EquityRelationship,
  EquityStakeholder,
  EquityStakeholderCreateInput,
  EquityStakeholderUpdateInput,
} from "@rakazo/contracts";
import { EQUITY_RELATIONSHIP_LABELS, EQUITY_RELATIONSHIPS } from "@rakazo/contracts";
import { todayIso } from "../../../lib/legal-format";
import { csvDate, headerKey, toCsv } from "./stakeholder-csv";

/** The template's columns, in order, and the field each fills. */
export const TEMPLATE_FIELDS = [
  ["id", "ID"],
  ["name", "Name"],
  ["type", "Type"],
  ["firstName", "First name"],
  ["lastName", "Last name"],
  ["contactEmail", "Contact email"],
  ["relationship", "Relationship"],
  ["startDate", "Relationship start date"],
  ["jobTitle", "Job title"],
  ["costCenter", "Cost center"],
  ["department", "Department"],
  ["employeeId", "Employee ID"],
  ["taxId", "Tax ID"],
  ["dateOfBirth", "Date of birth"],
  ["country", "Country"],
  ["street", "Street"],
  ["city", "City"],
  ["state", "State"],
  ["postalCode", "Postal code"],
] as const;
export type ImportField = (typeof TEMPLATE_FIELDS)[number][0] | `custom:${string}` | "";

const SYNONYMS: Record<string, ImportField> = {
  email: "contactEmail",
  fullname: "name",
  stakeholder: "name",
  stakeholdername: "name",
  title: "jobTitle",
  startdate: "startDate",
  zip: "postalCode",
  birthdate: "dateOfBirth",
};

export function templateCsv(customProperties: EquityCustomProperty[], withId = false): string {
  const header = TEMPLATE_FIELDS.filter(([field]) => withId || field !== "id").map(
    ([, label]) => label,
  );
  return toCsv([[...header, ...customProperties.map((property) => property.name)]]);
}

/** A field guess for each header; "" leaves the column out. */
export function autoMap(
  headers: string[],
  customProperties: EquityCustomProperty[],
): ImportField[] {
  return headers.map((header): ImportField => {
    const key = headerKey(header);
    const field = TEMPLATE_FIELDS.find(
      ([name, label]) => headerKey(label) === key || name.toLowerCase() === key,
    );
    if (field) return field[0];
    const custom = customProperties.find((property) => headerKey(property.name) === key);
    if (custom) return `custom:${custom.id}`;
    return SYNONYMS[key] ?? "";
  });
}

function relationshipOf(value: string): EquityRelationship | undefined {
  const key = headerKey(value);
  return EQUITY_RELATIONSHIPS.find(
    (relationship) =>
      headerKey(relationship) === key ||
      headerKey(EQUITY_RELATIONSHIP_LABELS[relationship]) === key,
  );
}

type RowError = { row: number; message: string };

/** One row's mapped values; errors name the spreadsheet row (the header is row 1). */
function readRow(cells: string[], mapping: ImportField[], index: number, errors: RowError[]) {
  const value: Record<string, string> = {};
  const custom: Record<string, string> = {};
  mapping.forEach((field, column) => {
    const cell = (cells[column] ?? "").trim();
    if (!field || !cell) return;
    if (field.startsWith("custom:")) custom[field.slice(7)] = cell;
    else value[field] = cell;
  });
  const row = index + 2;
  const fail = (message: string) => errors.push({ row, message });
  const relationship = value.relationship ? relationshipOf(value.relationship) : undefined;
  if (value.relationship && !relationship) fail(`Unknown relationship "${value.relationship}"`);
  for (const field of ["startDate", "dateOfBirth"])
    if (value[field] && !csvDate(value[field]))
      fail(`${field === "startDate" ? "Start date" : "Date of birth"} is not a date`);
  const type = value.type && /^org/i.test(value.type) ? "organization" : "individual";
  const name = value.name ?? [value.firstName, value.lastName].filter(Boolean).join(" ").trim();
  const address = {
    country: value.country ?? null,
    street: value.street ?? null,
    city: value.city ?? null,
    state: value.state ?? null,
    postalCode: value.postalCode ?? null,
  };
  const today = todayIso();
  const effectiveDate = csvDate(value.startDate) ?? today;
  const properties = [
    ...(relationship
      ? [{ kind: "relationship" as const, effectiveDate, value: relationship }]
      : []),
    ...(value.jobTitle
      ? [{ kind: "job_title" as const, effectiveDate, value: value.jobTitle }]
      : []),
    ...(value.costCenter
      ? [{ kind: "cost_center" as const, effectiveDate, value: value.costCenter }]
      : []),
    ...(value.department
      ? [{ kind: "department" as const, effectiveDate, value: value.department }]
      : []),
  ];
  return {
    id: value.id,
    fields: {
      type,
      ...(name ? { name } : {}),
      ...(value.firstName ? { firstName: value.firstName } : {}),
      ...(value.lastName ? { lastName: value.lastName } : {}),
      ...(value.contactEmail ? { contactEmail: value.contactEmail.toLowerCase() } : {}),
      ...(value.employeeId ? { employeeId: value.employeeId } : {}),
      ...(value.taxId ? { taxId: value.taxId } : {}),
      ...(csvDate(value.dateOfBirth) ? { dateOfBirth: csvDate(value.dateOfBirth) } : {}),
      ...(Object.values(address).some(Boolean) ? { addresses: [address] } : {}),
      ...(Object.keys(custom).length ? { customValues: custom } : {}),
    } as const,
    properties,
    hasName: Boolean(name),
    fail,
  };
}

export function rowsToCreateInputs(rows: string[][], mapping: ImportField[]) {
  const errors: RowError[] = [];
  const inputs: EquityStakeholderCreateInput[] = [];
  rows.forEach((cells, index) => {
    const row = readRow(cells, mapping, index, errors);
    if (!row.hasName) {
      row.fail("Name is missing");
      return;
    }
    inputs.push({ ...row.fields, name: row.fields.name ?? "", properties: row.properties });
  });
  return { inputs, errors };
}

/** Matches by the ID column, else by contact email; only filled cells change. */
export function rowsToUpdateInputs(
  rows: string[][],
  mapping: ImportField[],
  existing: EquityStakeholder[],
) {
  const errors: RowError[] = [];
  const inputs: EquityStakeholderUpdateInput[] = [];
  rows.forEach((cells, index) => {
    const row = readRow(cells, mapping, index, errors);
    const email = row.fields.contactEmail;
    const target =
      existing.find((stakeholder) => row.id && stakeholder.id === row.id) ??
      existing.find((stakeholder) => email && stakeholder.contactEmail === email);
    if (!target) {
      row.fail("No stakeholder with this ID or email");
      return;
    }
    const { type: _type, ...fields } = row.fields;
    // Dated values are added to the history as of their start date (today when none is given).
    inputs.push({
      id: target.id,
      ...fields,
      ...(row.properties.length ? { addProperties: row.properties } : {}),
    });
  });
  return { inputs, errors };
}
