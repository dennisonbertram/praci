import type {
  EquityAccessGrant,
  EquityAccessGroup,
  EquityAccessHolder,
  EquityStakeholder,
} from "@rakazo/contracts";

/** Invented access data for stories. */
export const demoGroups: EquityAccessGroup[] = [
  { key: "founders", level: "full_detail", memberCount: 2, updatedAt: null },
  { key: "investors", level: "advanced", memberCount: 2, updatedAt: null },
  { key: "employees", level: "basic", memberCount: 1, updatedAt: null },
  { key: "former_employees", level: "basic", memberCount: 1, updatedAt: null },
  { key: "other", level: "basic", memberCount: 0, updatedAt: null },
];

const stakeholder = (id: string, name: string, relationship: string | null) =>
  ({ id, name, relationship }) as unknown as EquityStakeholder;

export const demoStakeholders: EquityStakeholder[] = [
  stakeholder("s1", "Avery Sample", "founder"),
  stakeholder("s2", "Blue Example Fund", "investor"),
  stakeholder("s3", "Casey Placeholder", "employee"),
  stakeholder("s4", "Drew Former", "ex_employee"),
];

export const demoGrants: EquityAccessGrant[] = [
  {
    id: "g1",
    createdAt: "2026-09-01T10:00:00.000Z",
    updatedAt: "2026-09-01T10:00:00.000Z",
    stakeholderId: "s3",
    stakeholderName: "Casey Placeholder",
    level: "restricted",
    requestedLevel: null,
    requestedAt: null,
  },
];

export const page = <T>(items: T[]) => ({ items, total: items.length, page: 1, pageSize: 500 });

export const demoRequest: EquityAccessHolder = {
  stakeholderId: "s2",
  name: "Blue Example Fund",
  relationship: "investor",
  group: "investors",
  email: "ir@blue-example.test",
  contactId: "c2",
  majorInvestor: true,
  ownershipPercent: "18.5000",
  classCodes: ["PA"],
  groupLevel: "advanced",
  overrideLevel: null,
  effectiveLevel: "advanced",
  requestedLevel: "full_detail",
  requestedAt: "2026-10-20T09:00:00.000Z",
  lastSeenAt: "2026-10-20T08:55:00.000Z",
};
