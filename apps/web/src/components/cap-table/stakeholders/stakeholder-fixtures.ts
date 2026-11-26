import type { EquityStakeholderDetail, EquityStakeholderPage } from "@rakazo/contracts";

/** Invented stakeholders for stories and tests. */
export function fixtureStakeholder(
  overrides: Partial<EquityStakeholderDetail> = {},
): EquityStakeholderDetail {
  return {
    id: "sh-1",
    createdAt: "2026-01-05T10:00:00.000Z",
    updatedAt: "2026-01-05T10:00:00.000Z",
    type: "individual",
    name: "Maya Fenwick",
    firstName: "Maya",
    lastName: "Fenwick",
    contactEmail: "maya@example.test",
    portfolioEmail: "maya@example.test",
    portfolioEmailLocked: false,
    otherEmails: [],
    dateOfBirth: "1990-04-12",
    taxId: "000-00-1234",
    employeeId: "E-101",
    payrollId: null,
    addresses: [
      {
        country: "USA",
        street: "1 Example Way",
        city: "Springfield",
        state: "OR",
        postalCode: "97000",
      },
    ],
    customValues: {},
    parentId: null,
    contactId: null,
    majorInvestor: false,
    relationship: "employee",
    jobTitle: "Engineer",
    costCenter: "R&D",
    department: "Engineering",
    terminatedOn: null,
    mergedIntoId: null,
    addressCompleteness: "complete",
    properties: [
      { id: "p-2", kind: "relationship", effectiveDate: "2025-01-01", value: "employee" },
      { id: "p-1", kind: "relationship", effectiveDate: "2024-03-01", value: "consultant" },
    ],
    ...overrides,
  };
}

const NAMES: [string, EquityStakeholderDetail["relationship"], string | null][] = [
  ["Maya Fenwick", "employee", "R&D"],
  ["Orchard Seed Fund", "investor", null],
  ["Tomas Reyes", "founder", null],
  ["Lena Okafor", "advisor", null],
  ["Priya Natarajan", "ex_employee", "Sales"],
  ["Birchwood Ventures", "investor", null],
  ["Sam Whitlock", "consultant", "Ops"],
  ["Noor Haddad", null, null],
];

export function fixturePage(count = NAMES.length): EquityStakeholderPage {
  const items = NAMES.slice(0, count).map(([name, relationship, costCenter], index) => {
    const { properties: _properties, ...row } = fixtureStakeholder({
      id: `sh-${index + 1}`,
      name,
      type: relationship === "investor" ? "organization" : "individual",
      contactEmail: `${name.split(" ")[0]!.toLowerCase()}@example.test`,
      relationship,
      costCenter,
    });
    return row;
  });
  return { items, total: items.length, page: 1, pageSize: 25 };
}
