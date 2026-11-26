// A deterministic, invented cap table for the fictional company "Northwind Robotics, Inc.".
// The demo stack seed and the Storybook fixtures load it, so it is generated from small name
// lists and fixed arithmetic rather than typed row by row: the same call returns the same data.
// Every item carries a stable `key` so items can reference each other before database ids exist;
// the keys are only used by the importer and are never wire fields.

import type {
  EquityAccessGroupKey,
  EquityAccessLevel,
  EquityCertificateCreateInput,
  EquityConvertibleCreateInput,
  EquityFundingRoundCreateInput,
  EquityOptionGrantCreateInput,
  EquityPlanCreateInput,
  EquityShareClassCreateInput,
  EquityShareClassVersionInput,
  EquityStakeholderCreateInput,
  EquityVestingTemplateCreateInput,
} from "@rakazo/contracts";
import { addMonthsClamped } from "./dates.js";
import { parseFixed, SCALE, sharesTimesPrice } from "./fixed.js";
import { pricedRoundConversion } from "./priced-round.js";

export type DemoStakeholder = EquityStakeholderCreateInput & {
  key: string;
  /** A fund's firm, by stakeholder key. */
  parentKey?: string | null;
};

export type DemoShareClass = EquityShareClassCreateInput & {
  key: string;
  /** Every version, earliest document date first; `terms` repeats the first. */
  versions: EquityShareClassVersionInput[];
};

export type DemoPlan = Omit<EquityPlanCreateInput, "shareClassId"> & {
  key: string;
  shareClassKey: string;
};

export type DemoVestingTemplate = EquityVestingTemplateCreateInput & { key: string };

export type DemoFundingRound = EquityFundingRoundCreateInput & { key: string };

export type DemoPricedRound = {
  key: string;
  convertibleKeys: string[];
  toShareClassKey: string;
  roundKey: string;
  preMoneyValuationCents: string;
  newMoneyCents: string;
  asOf: string;
};

export type DemoConvertibleBlock = { key: string; name: string; kind: "safe" | "note" };

export type DemoCertificate = Omit<
  EquityCertificateCreateInput,
  "stakeholderId" | "shareClassId" | "planId"
> & {
  key: string;
  stakeholderKey: string;
  shareClassKey: string;
  planKey?: string | null;
  roundKey?: string | null;
  parentKey?: string | null;
  /** Synthetic demo dispositions, executed by the seed through audited lifecycle stores. */
  disposition?:
    | {
        kind: "transfer";
        effectiveDate: string;
        toStakeholderKey: string;
        reason: "transfer_to_affiliated_entity";
      }
    | { kind: "cancel"; effectiveDate: string; reason: "write_off_cancel" }
    | { kind: "repurchase"; effectiveDate: string; reason: "relationship_change" }
    | {
        kind: "convert";
        effectiveDate: string;
        toShareClassKey: string;
        ratio: string;
      };
};

/** Explicit synthetic conversion and note-repayment closure dates for the demo seed. */
export type DemoConvertible = Omit<
  EquityConvertibleCreateInput,
  "stakeholderId" | "blockId" | "convertsToShareClassId" | "convertedToId" | "roundId"
> & {
  key: string;
  stakeholderKey: string;
  blockKey?: string | null;
  roundKey?: string | null;
  convertsToShareClassKey?: string | null;
  convertedToKey?: string | null;
};

export type DemoOptionGrant = Omit<
  EquityOptionGrantCreateInput,
  "stakeholderId" | "planId" | "shareClassId"
> & {
  key: string;
  stakeholderKey: string;
  planKey: string;
  vestingTemplateKey: string;
  /** Quantity for the generated exercise-history row; final counters come from all completed rows. */
  historyExerciseQuantity?: string;
};

export type DemoExercise = {
  key: string;
  optionGrantKey: string;
  quantity: string;
  exerciseDate: string;
  paymentCents?: string;
  status: "pending" | "completed";
};

export type DemoAccessGroup = { key: EquityAccessGroupKey; level: EquityAccessLevel };

export type DemoAccessGrant = {
  key: string;
  stakeholderKey: string;
  level: EquityAccessLevel | null;
  requestedLevel?: EquityAccessLevel | null;
  requestedAt?: string | null;
};

export type DemoSavedView = {
  key: string;
  page:
    | "stakeholders"
    | "securities"
    | "share-classes"
    | "plans"
    | "rounds"
    | "activity"
    | "overview";
  name: string;
  params: string;
};

export type DemoDraftSet = {
  key: string;
  name: string;
  securityKind: "certificate" | "option_grant" | "convertible";
  status?: "draft" | "issued" | "discarded";
  items?: Record<string, unknown>[];
};

export type DemoLedger = {
  companyName: string;
  stakeholders: DemoStakeholder[];
  shareClasses: DemoShareClass[];
  plans: DemoPlan[];
  vestingTemplates: DemoVestingTemplate[];
  fundingRounds: DemoFundingRound[];
  /** Invented Seed round: $15,178,500 pre-money over the 2021 fully diluted base plus the
   * SAFEs' conversion shares, and $250,000 of new money; the kernel sets the issue price. */
  pricedRounds: DemoPricedRound[];
  convertibleBlocks: DemoConvertibleBlock[];
  certificates: DemoCertificate[];
  convertibles: DemoConvertible[];
  optionGrants: DemoOptionGrant[];
  exercises: DemoExercise[];
  accessGroups: DemoAccessGroup[];
  accessGrants: DemoAccessGrant[];
  savedViews: DemoSavedView[];
  draftSets: DemoDraftSet[];
};

const FIRST_NAMES = [
  "Ada",
  "Bram",
  "Cora",
  "Dev",
  "Elin",
  "Florian",
  "Greta",
  "Hugo",
  "Imani",
  "Jonas",
  "Kira",
  "Liam",
  "Mira",
  "Niko",
  "Olive",
  "Pia",
  "Quinn",
  "Rosa",
  "Sami",
  "Tess",
] as const;

const LAST_NAMES = [
  "Example",
  "Sample",
  "Placeholder",
  "Testing",
  "Preview",
  "Mockford",
  "Specimen",
  "Drafted",
  "Invented",
  "Fictional",
] as const;

const COMPANIES = [
  "Northwind Ventures",
  "Harborline Capital",
  "Cobalt Ridge Partners",
  "Beacon Hill Angels",
  "Sundial Growth",
  "Tidewater Fund",
  "Orbit Lane Capital",
  "Kestrel Network",
  "Grayline Holdings",
  "Pinecrest Trust",
  "Meridian Seed",
  "Lantern Bay Partners",
] as const;

const FUND_NAMES = ["Alpha Fund I", "Alpha Fund II", "Alpha Opportunities"] as const;

const BASE_DATE = "2019-03-01";

function pad(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/** A date offset from the ledger's first day, keeping the day inside the month. */
function dateFrom(monthOffset: number, day: number): string {
  const months = 2 + monthOffset; // March 2019 is month 2 of 2019
  const year = 2019 + Math.floor(months / 12);
  const month = months % 12;
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

// Exercise history ends here; contractual expirations are intentionally tested separately.
const DEMO_EXERCISE_HISTORY_END = "2026-09-30";

function person(index: number): { name: string; firstName: string; lastName: string } {
  const firstName = FIRST_NAMES[index % FIRST_NAMES.length] ?? "Ada";
  const lastName =
    LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length] ?? "Example";
  return { name: `${firstName} ${lastName}`, firstName, lastName };
}

function emailFor(name: string): string {
  return `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.test`;
}

function addresses(kind: 0 | 1 | 2): EquityStakeholderCreateInput["addresses"] {
  if (kind === 2) return [];
  if (kind === 0) {
    return [
      {
        country: "US",
        street: "100 Example Way",
        city: "Sampletown",
        state: "CA",
        postalCode: "94000",
      },
    ];
  }
  return [{ country: "US", city: "Draftville", state: "NY" }];
}

const FOUNDERS = [
  { key: "founder-ada", index: 0, shares: "6000000", start: 0 },
  { key: "founder-bram", index: 1, shares: "4000000", start: 0 },
  { key: "founder-cora", index: 2, shares: "3500000", start: 0 },
] as const;

const INVESTOR_COUNT = 20;
const EMPLOYEE_COUNT = 22;

function buildStakeholders(): DemoStakeholder[] {
  const list: DemoStakeholder[] = [];

  // 3 founders.
  for (const founder of FOUNDERS) {
    const { name, firstName, lastName } = person(founder.index);
    list.push({
      key: founder.key,
      type: "individual",
      name,
      firstName,
      lastName,
      contactEmail: emailFor(name),
      portfolioEmail: emailFor(name),
      addresses: addresses(0),
      majorInvestor: false,
      properties: [
        { kind: "relationship", effectiveDate: dateFrom(founder.start, 1), value: "founder" },
        {
          kind: "job_title",
          effectiveDate: dateFrom(founder.start, 1),
          value: "Chief Executive Officer",
        },
        { kind: "department", effectiveDate: dateFrom(founder.start, 1), value: "Executive" },
        { kind: "cost_center", effectiveDate: dateFrom(founder.start, 1), value: "CC-100" },
      ],
    });
  }

  // The pair the health check flags as a duplicate: same name and contact email, two records.
  list.push({
    key: "founder-ada-duplicate",
    type: "individual",
    name: "Ada Example",
    firstName: "Ada",
    lastName: "Example",
    contactEmail: "ada.example@example.test",
    addresses: addresses(1),
    properties: [
      { kind: "relationship", effectiveDate: dateFrom(6, 1), value: "founder" },
      { kind: "job_title", effectiveDate: dateFrom(6, 1), value: "Chief Executive Officer" },
    ],
  });

  // Employees, ex-employees, advisors, consultants and board members with dated properties.
  const relationships = [
    "employee",
    "employee",
    "executive",
    "employee",
    "advisor",
    "board_member",
    "employee",
    "consultant",
    "employee",
    "officer",
    "ex_employee",
    "employee",
    "advisor",
    "employee",
    "employee",
    "ex_advisor",
    "employee",
    "consultant",
    "employee",
    "ex_employee",
    "board_member",
    "employee",
  ] as const;
  const titles = [
    "Software Engineer",
    "Senior Software Engineer",
    "Chief Technology Officer",
    "Product Designer",
    "Advisor",
    "Board Chair",
    "Data Engineer",
    "Operations Consultant",
    "Robotics Engineer",
    "Chief Operating Officer",
    "Software Engineer",
    "Staff Engineer",
    "Advisor",
    "Engineering Manager",
    "Recruiter",
    "Advisor",
    "Finance Lead",
    "Design Consultant",
    "Hardware Engineer",
    "Support Engineer",
    "Board Member",
    "Account Executive",
  ] as const;
  const departments = [
    "Engineering",
    "Engineering",
    "Engineering",
    "Product",
    "Board",
    "Board",
  ] as const;

  for (let i = 0; i < EMPLOYEE_COUNT; i += 1) {
    const { name, firstName, lastName } = person(i + 3);
    const relationship = relationships[i] ?? "employee";
    const startMonth = 2 + (i % 30);
    const isEx = relationship.startsWith("ex_");
    const properties: NonNullable<EquityStakeholderCreateInput["properties"]> = [
      { kind: "relationship", effectiveDate: dateFrom(startMonth, 1), value: relationship },
      { kind: "job_title", effectiveDate: dateFrom(startMonth, 1), value: titles[i] ?? "Employee" },
      {
        kind: "department",
        effectiveDate: dateFrom(startMonth, 1),
        value: departments[i % departments.length] ?? "Engineering",
      },
      {
        kind: "cost_center",
        effectiveDate: dateFrom(startMonth, 1),
        value: `CC-${(200 + i * 10).toString()}`,
      },
    ];
    if (isEx) {
      const exMonth = startMonth + 18;
      properties.push(
        { kind: "relationship", effectiveDate: dateFrom(exMonth, 15), value: "ex_employee" },
        { kind: "job_title", effectiveDate: dateFrom(exMonth, 15), value: titles[i] ?? "Employee" },
      );
    }
    const addressKind = (i % 3) as 0 | 1 | 2;
    list.push({
      key: `person-${i + 1}`,
      type: "individual",
      name,
      firstName,
      lastName,
      contactEmail: emailFor(name),
      portfolioEmail: i % 4 === 0 ? emailFor(name) : null,
      otherEmails: i % 5 === 0 ? [`${firstName.toLowerCase()}.alt@example.test`] : undefined,
      dateOfBirth: i % 3 === 0 ? `19${85 + (i % 10)}-0${(i % 9) + 1}-1${i % 9}` : null,
      employeeId: isEx ? null : `NW-${(100 + i).toString()}`,
      payrollId: isEx ? null : `PAY-${(4000 + i).toString()}`,
      addresses: addresses(addressKind),
      properties,
    });
  }

  for (let i = 1; i <= 4; i += 1) {
    list.push({
      key: `former-demo-employee-${i}`,
      type: "individual",
      name: `Former Demo Employee ${i}`,
      firstName: "Former",
      lastName: `Demo Employee ${i}`,
      contactEmail: `former.demo.employee.${i}@example.test`,
      addresses: addresses(0),
      properties: [{ kind: "relationship", effectiveDate: "2019-03-01", value: "ex_employee" }],
    });
  }
  list.push({
    key: "affiliated-family-trust",
    type: "organization",
    name: "Northwind Family Trust",
    contactEmail: "family.trust@example.test",
    addresses: addresses(0),
  });

  // One firm with three funds, and the rest individual angels and organizations.
  const firmKey = "investor-firm-alpha";
  list.push({
    key: firmKey,
    type: "organization",
    name: "Alpha Fund Management LLC",
    contactEmail: "alpha.funds@example.test",
    addresses: addresses(0),
    majorInvestor: true,
  });
  for (let i = 0; i < FUND_NAMES.length; i += 1) {
    const name = `${COMPANIES[i] ?? "Alpha"} (${FUND_NAMES[i] ?? "Fund"})`;
    list.push({
      key: `investor-fund-${i + 1}`,
      type: "organization",
      name,
      contactEmail: `fund.${i + 1}@example.test`,
      addresses: addresses(i === 1 ? 1 : 0),
      parentKey: firmKey,
      majorInvestor: true,
    });
  }
  const used = list.length;
  const remaining = INVESTOR_COUNT - 3;
  for (let i = 0; i < remaining; i += 1) {
    const index = used + 3 + i;
    const isOrganization = i % 4 === 2;
    if (isOrganization) {
      const name = COMPANIES[(i + 3) % COMPANIES.length] ?? "Sample Capital";
      list.push({
        key: `investor-${i + 1}`,
        type: "organization",
        name,
        contactEmail: `investing${i + 1}@example.test`,
        addresses: addresses((i % 3) as 0 | 1 | 2),
        majorInvestor: i % 2 === 0,
      });
    } else {
      const { name, firstName, lastName } = person(index);
      list.push({
        key: `investor-${i + 1}`,
        type: "individual",
        name,
        firstName,
        lastName,
        contactEmail: emailFor(name),
        addresses: addresses((i % 3) as 0 | 1 | 2),
        properties: [
          { kind: "relationship", effectiveDate: dateFrom(14 + (i % 20), 1), value: "investor" },
        ],
      });
    }
  }
  return list;
}

function buildShareClasses(seedIssuePrice: string): DemoShareClass[] {
  const commonV1: EquityShareClassVersionInput = {
    documentDate: "2019-03-01",
    authorizedShares: "14000000",
    votesPerShare: "1",
    certificated: true,
    parValue: "0.0001",
    seniority: 4,
    pariPassu: true,
    originalIssuePrice: "0.0001",
    conversionRatio: "1",
    multiplier: "1",
    participating: false,
  };
  const commonV2: EquityShareClassVersionInput = {
    ...commonV1,
    documentDate: "2022-05-10",
    authorizedShares: "20000000",
  };
  const seed: EquityShareClassVersionInput = {
    documentDate: "2021-02-15",
    authorizedShares: "3000000",
    votesPerShare: "1",
    certificated: true,
    parValue: "0.0001",
    seniority: 3,
    pariPassu: true,
    originalIssuePrice: seedIssuePrice,
    conversionPrice: seedIssuePrice,
    conversionRatio: "1",
    multiplier: "1",
    participating: true,
    participationCap: "2.5",
  };
  const seriesAV1: EquityShareClassVersionInput = {
    documentDate: "2022-05-10",
    authorizedShares: "3500000",
    votesPerShare: "1",
    certificated: true,
    parValue: "0.0001",
    seniority: 2,
    pariPassu: true,
    originalIssuePrice: "3.20",
    conversionPrice: "3.20",
    conversionRatio: "1",
    multiplier: "1",
    participating: false,
  };
  const seriesAV2: EquityShareClassVersionInput = {
    ...seriesAV1,
    documentDate: "2023-01-20",
    authorizedShares: "4000000",
  };
  const seriesB: EquityShareClassVersionInput = {
    documentDate: "2024-06-28",
    authorizedShares: "5000000",
    votesPerShare: "1",
    certificated: true,
    parValue: "0.0001",
    seniority: 1,
    pariPassu: true,
    originalIssuePrice: "8.50",
    conversionPrice: "8.50",
    conversionRatio: "1",
    multiplier: "1",
    participating: false,
  };
  const seriesB1: EquityShareClassVersionInput = {
    ...seriesB,
    documentDate: "2025-03-14",
    authorizedShares: "1500000",
    pariPassu: true,
  };
  return [
    {
      key: "class-common",
      name: "Common",
      prefix: "CS",
      classType: "common",
      terms: commonV1,
      versions: [commonV1, commonV2],
    },
    {
      key: "class-seed",
      name: "Series Seed Preferred",
      prefix: "PSS",
      classType: "preferred",
      terms: seed,
      versions: [seed],
    },
    {
      key: "class-series-a",
      name: "Series A Preferred",
      prefix: "PSA",
      classType: "preferred",
      terms: seriesAV1,
      versions: [seriesAV1, seriesAV2],
    },
    {
      key: "class-series-b",
      name: "Series B Preferred",
      prefix: "PSB",
      classType: "preferred",
      terms: seriesB,
      versions: [seriesB],
    },
    {
      key: "class-series-b1",
      name: "Series B-1 Preferred",
      prefix: "PSB1",
      classType: "preferred",
      terms: seriesB1,
      versions: [seriesB1],
    },
  ];
}

function buildPlans(): DemoPlan[] {
  return [
    {
      key: "plan-2019",
      name: "2019 Stock Plan",
      status: "active",
      shareClassKey: "class-common",
      reservedShares: "1500000",
      boardApprovedOn: "2019-03-15",
    },
    {
      key: "plan-2023",
      name: "2023 Equity Incentive Plan",
      status: "active",
      shareClassKey: "class-common",
      reservedShares: "2000000",
      boardApprovedOn: "2023-04-01",
    },
  ];
}

function buildVestingTemplates(): DemoVestingTemplate[] {
  return [
    {
      key: "vesting-standard",
      name: "4 years, 1 year cliff, monthly",
      totalMonths: 48,
      cliffMonths: 12,
      frequencyMonths: 1,
      tranches: null,
    },
    {
      key: "vesting-no-cliff",
      name: "4 years monthly, no cliff",
      totalMonths: 48,
      cliffMonths: 0,
      frequencyMonths: 1,
      tranches: null,
    },
    {
      key: "vesting-quarterly-2y", // gitleaks:allow -- deterministic demo row identifier, not a credential
      name: "2 years, quarterly",
      totalMonths: 24,
      cliffMonths: 6,
      frequencyMonths: 3,
      tranches: null,
    },
  ];
}

function buildRounds(seedIssuePrice: string): DemoFundingRound[] {
  return [
    {
      key: "round-safes",
      name: "Seed",
      startDate: "2020-01-15",
      closingDate: "2020-09-30",
      endDate: "2020-09-30",
      originalIssuePrice: null,
      preMoneyValuationCents: "600000000",
    },
    {
      key: "round-seed",
      name: "Series Seed",
      startDate: "2021-02-01",
      closingDate: "2021-03-31",
      endDate: "2021-03-31",
      originalIssuePrice: seedIssuePrice,
      preMoneyValuationCents: "1517850000",
    },
    {
      key: "round-series-a",
      name: "Series A",
      startDate: "2022-05-01",
      closingDate: "2022-06-15",
      endDate: "2022-06-15",
      originalIssuePrice: "3.20",
      preMoneyValuationCents: "9600000000",
    },
    {
      key: "round-series-b",
      name: "Series B",
      startDate: "2024-06-01",
      closingDate: "2024-06-28",
      endDate: "2024-06-28",
      originalIssuePrice: "8.50",
      preMoneyValuationCents: "59500000000",
    },
  ];
}

function buildConvertibleBlocks(): DemoConvertibleBlock[] {
  return [
    { key: "block-2020-safes", name: "2020 SAFEs", kind: "safe" },
    { key: "block-2023-notes", name: "2023 Bridge Notes", kind: "note" },
  ];
}

type CertificateSpec = Omit<DemoCertificate, "label" | "key">;

function buildCertificates(): { certificates: DemoCertificate[]; seedIssuePrice: string } {
  const certs: DemoCertificate[] = [];
  const perPrefix = new Map<string, number>();
  const push = (spec: CertificateSpec) => {
    const prefix =
      spec.shareClassKey === "class-common"
        ? "CS"
        : spec.shareClassKey === "class-seed"
          ? "PSS"
          : spec.shareClassKey === "class-series-a"
            ? "PSA"
            : spec.shareClassKey === "class-series-b"
              ? "PSB"
              : "PSB1";
    const next = (perPrefix.get(prefix) ?? 0) + 1;
    perPrefix.set(prefix, next);
    certs.push({
      key: `certificate-${prefix}-${next}`,
      label: `${prefix}-${next}`,
      ...spec,
    });
  };

  // Founders' common stock, from incorporation.
  FOUNDERS.forEach((founder, i) => {
    push({
      stakeholderKey: founder.key,
      shareClassKey: "class-common",
      quantity: founder.shares,
      status: "outstanding",
      acceptanceStatus: "accepted",
      paperStatus: i === 0 ? "electronic" : "paper",
      issueDate: "2019-03-01",
      originalAcquisitionDate: "2019-03-01",
      pricePerShare: "0.0001",
      pricePaidPerShare: "0.0001",
      cashPaidCents: "0",
      ipTransferredCents: "100000",
      issuedBy: "Northwind Robotics, Inc.",
      boardApprovedOn: "2019-03-01",
      roundKey: null,
      personnel: {
        name: person(founder.index).name,
        email: emailFor(person(founder.index).name),
        relationship: "founder",
        dateOfBirth: null,
        taxId: null,
        employeeId: `NW-${(10 + i).toString()}`,
        payrollId: null,
      },
    });
  });

  // The 2021 seed round converts these SAFEs through the priced-round transaction below.
  // Series A: 5 institutional certificates, one later converted.
  for (let i = 0; i < 5; i += 1) {
    const quantity = 420000 + i * 30000;
    push({
      stakeholderKey: i < 3 ? `investor-fund-${i + 1}` : `investor-${i + 9}`,
      shareClassKey: "class-series-a",
      quantity: quantity.toString(),
      status: i === 4 ? "converted" : "outstanding",
      ...(i === 4
        ? {
            disposition: {
              kind: "convert" as const,
              effectiveDate: "2024-06-30",
              toShareClassKey: "class-series-b",
              ratio: "1",
            },
          }
        : {}),
      acceptanceStatus: "accepted",
      paperStatus: "electronic",
      issueDate: "2022-06-15",
      pricePerShare: "3.20",
      pricePaidPerShare: "3.20",
      cashPaidCents: (quantity * 320).toString(),
      boardApprovedOn: "2022-05-05",
      roundKey: "round-series-a",
      federalExemption: "Rule 506(b)",
    });
  }
  // A small Series A bridge purchase, still awaiting holder acceptance.
  push({
    stakeholderKey: "investor-7",
    shareClassKey: "class-series-a",
    quantity: "30000",
    status: "waiting_for_acceptance",
    acceptanceStatus: "awaiting_holder_signature",
    paperStatus: "electronic",
    issueDate: "2022-07-01",
    pricePerShare: "3.20",
    pricePaidPerShare: "3.20",
    cashPaidCents: "9600000",
    boardApprovedOn: "2022-06-20",
    roundKey: "round-series-a",
  });

  // Series B and B-1.
  for (let i = 0; i < 4; i += 1) {
    const quantity = 380000 + i * 40000;
    push({
      stakeholderKey: i < 2 ? `investor-fund-${i + 1}` : `investor-${i + 11}`,
      shareClassKey: "class-series-b",
      quantity: quantity.toString(),
      status: "outstanding",
      acceptanceStatus: "accepted",
      paperStatus: "electronic",
      issueDate: "2024-06-28",
      pricePerShare: "8.50",
      pricePaidPerShare: "8.50",
      cashPaidCents: (quantity * 850).toString(),
      boardApprovedOn: "2024-06-14",
      roundKey: "round-series-b",
    });
  }
  push({
    stakeholderKey: "investor-fund-3", // gitleaks:allow -- deterministic demo row identifier, not a credential
    shareClassKey: "class-series-b",
    quantity: "400000",
    status: "outstanding",
    acceptanceStatus: "accepted",
    paperStatus: "electronic",
    issueDate: "2024-06-28",
    pricePerShare: "8.50",
    pricePaidPerShare: "8.50",
    cashPaidCents: (400000 * 850).toString(),
    boardApprovedOn: "2024-06-14",
    roundKey: "round-series-b",
  });
  push({
    stakeholderKey: "investor-3",
    shareClassKey: "class-series-b1",
    quantity: "300000",
    status: "outstanding",
    acceptanceStatus: "accepted",
    paperStatus: "electronic",
    issueDate: "2025-03-14",
    pricePerShare: "8.50",
    pricePaidPerShare: "8.50",
    cashPaidCents: (300000 * 850).toString(),
    boardApprovedOn: "2025-02-20",
    roundKey: "round-series-b",
  });
  push({
    stakeholderKey: "investor-12",
    shareClassKey: "class-series-b1",
    quantity: "250000",
    status: "waiting_for_acceptance",
    acceptanceStatus: "awaiting_holder_signature",
    paperStatus: "electronic",
    issueDate: "2025-03-14",
    pricePerShare: "8.50",
    pricePaidPerShare: "8.50",
    cashPaidCents: (250000 * 850).toString(),
    boardApprovedOn: "2025-02-20",
    roundKey: "round-series-b",
  });

  // Common from exercised options and plan grants, with the mixed statuses.
  for (let i = 0; i < 40; i += 1) {
    const quantity = 1000 + i * 750;
    const status =
      i === 6
        ? "transferred"
        : i === 12
          ? "repurchased"
          : i === 19
            ? "canceled"
            : i === 25
              ? "repurchased"
              : "outstanding";
    const planKey = i < 18 ? "plan-2019" : "plan-2023";
    const issueMonth = 4 + i;
    push({
      stakeholderKey:
        status === "transferred" ? "affiliated-family-trust" : `person-${(i % EMPLOYEE_COUNT) + 1}`,
      shareClassKey: "class-common",
      planKey,
      quantity: quantity.toString(),
      status,
      acceptanceStatus: i % 11 === 0 ? "awaiting_holder_signature" : "accepted",
      paperStatus: i % 7 === 0 ? "paper" : "electronic",
      issueDate: dateFrom(issueMonth, 10),
      pricePerShare: "0.10",
      pricePaidPerShare: "0.10",
      cashPaidCents: (quantity * 10).toString(),
      boardApprovedOn: dateFrom(issueMonth, 1),
      roundKey: null,
      canceledOn: status === "canceled" ? dateFrom(issueMonth + 2, 1) : null,
      ...(status === "transferred"
        ? {
            disposition: {
              kind: "transfer" as const,
              effectiveDate: "2025-01-15",
              toStakeholderKey: `person-${(i % EMPLOYEE_COUNT) + 1}`,
              reason: "transfer_to_affiliated_entity" as const,
            },
          }
        : {}),
      ...(status === "repurchased"
        ? {
            disposition: {
              kind: "repurchase" as const,
              effectiveDate: dateFrom(issueMonth + 12, 1),
              reason: "relationship_change" as const,
            },
          }
        : status === "canceled"
          ? {
              disposition: {
                kind: "cancel" as const,
                effectiveDate: dateFrom(issueMonth + 2, 1),
                reason: "write_off_cancel" as const,
              },
            }
          : {}),
    });
  }

  // The holder's certificate after transfer from an affiliated family trust.
  const transferred = certs.find((cert) => cert.status === "transferred");
  if (transferred) {
    push({
      stakeholderKey:
        transferred.disposition?.kind === "transfer"
          ? transferred.disposition.toStakeholderKey
          : transferred.stakeholderKey,
      shareClassKey: "class-common",
      planKey: transferred.planKey ?? null,
      quantity: transferred.quantity,
      status: "outstanding",
      acceptanceStatus: "accepted",
      paperStatus: "electronic",
      issueDate: "2025-01-15",
      pricePerShare: "0.10",
      pricePaidPerShare: "0.00",
      cashPaidCents: "0",
      roundKey: null,
      parentKey: transferred.key,
      adminNotes: "Transferred from an affiliated family trust.",
    });
  }

  // One canceled Series A certificate from a withdrawn investor.
  push({
    stakeholderKey: "investor-4",
    shareClassKey: "class-series-a",
    quantity: "15000",
    status: "canceled",
    acceptanceStatus: "accepted",
    paperStatus: "electronic",
    issueDate: "2022-06-20",
    pricePerShare: "3.20",
    pricePaidPerShare: "0.00",
    cashPaidCents: "0",
    boardApprovedOn: "2022-06-15",
    canceledOn: "2022-07-05",
    roundKey: "round-series-a",
    disposition: {
      kind: "cancel",
      effectiveDate: "2022-07-05",
      reason: "write_off_cancel",
    },
  });

  const roundDate = "2021-03-31";
  // The priced round prices the base the ledger reports on its date: a plan's reserve counts from
  // its board approval, so the 2023 plan is not in the 2021 round's share count.
  const baseShares =
    certs
      .filter((row) => row.shareClassKey !== "class-seed" && row.issueDate <= roundDate)
      .reduce((sum, row) => sum + BigInt(row.quantity), 0n) +
    buildPlans()
      .filter((row) => row.boardApprovedOn != null && row.boardApprovedOn <= roundDate)
      .reduce((sum, row) => sum + BigInt(row.reservedShares), 0n);
  const safes = buildConvertibles().filter((row) => row.status === "converted");
  const conversion = pricedRoundConversion({
    preMoneyValuationCents: baseShares * 100n,
    newMoneyCents: 25_000_000n,
    preRoundFullyDilutedShares: baseShares,
    asOf: roundDate,
    convertibles: safes.map((row) => ({
      id: row.key,
      kind: "safe" as const,
      principalCents: BigInt(row.principalCents),
      valuationCapCents: row.valuationCapCents ? BigInt(row.valuationCapCents) : null,
      capType: row.valuationCapType ?? null,
      discountPercent: row.discountPercent ? parseFixed(row.discountPercent) : null,
    })),
  });
  safes.forEach((safe, index) => {
    const result = conversion.convertibles[index]!;
    push({
      stakeholderKey: safe.stakeholderKey,
      shareClassKey: "class-seed",
      quantity: result.shares.toString(),
      status: "outstanding",
      acceptanceStatus: "accepted",
      paperStatus: "electronic",
      issueDate: roundDate,
      pricePerShare: result.conversionPrice,
      pricePaidPerShare: result.conversionPrice,
      cashPaidCents: "0",
      debtCanceledCents: result.amountConvertedCents.toString(),
      roundKey: "round-seed",
    });
  });
  push({
    stakeholderKey: "investor-16",
    shareClassKey: "class-seed",
    quantity: conversion.newMoneyShares.toString(),
    status: "outstanding",
    acceptanceStatus: "accepted",
    paperStatus: "paper",
    issueDate: roundDate,
    pricePerShare: conversion.pricePerShare,
    pricePaidPerShare: conversion.pricePerShare,
    cashPaidCents: "25000000",
    boardApprovedOn: "2021-02-10",
    roundKey: "round-seed",
  });

  const convertedSource = certs.find((row) => row.disposition?.kind === "convert");
  if (convertedSource?.disposition?.kind !== "convert")
    throw new Error("Synthetic Series A conversion terms are missing");
  const convertedShares =
    BigInt(convertedSource.quantity) * parseFixed(convertedSource.disposition.ratio);
  if (convertedShares % SCALE !== 0n)
    throw new Error("Synthetic Series A conversion creates fractional shares");
  push({
    stakeholderKey: convertedSource.stakeholderKey,
    shareClassKey: convertedSource.disposition.toShareClassKey,
    quantity: (convertedShares / SCALE).toString(),
    status: "outstanding",
    acceptanceStatus: convertedSource.acceptanceStatus,
    paperStatus: convertedSource.paperStatus,
    issueDate: convertedSource.disposition.effectiveDate,
    originalAcquisitionDate: convertedSource.originalAcquisitionDate ?? convertedSource.issueDate,
    pricePerShare: convertedSource.pricePerShare,
    pricePaidPerShare: convertedSource.pricePaidPerShare,
    cashPaidCents: "0",
    issuedBy: convertedSource.issuedBy,
    boardApprovedOn: convertedSource.boardApprovedOn,
    roundKey: convertedSource.roundKey,
    parentKey: convertedSource.key,
    federalExemption: convertedSource.federalExemption,
    stateOfResidency: convertedSource.stateOfResidency,
  });

  return { certificates: certs, seedIssuePrice: conversion.pricePerShare };
}

function buildConvertibles(): DemoConvertible[] {
  const list: DemoConvertible[] = [];
  for (let i = 0; i < 12; i += 1) {
    const converted = i < 9;
    list.push({
      key: `convertible-safe-${i + 1}`,
      label: `SAFE-${i + 1}`,
      stakeholderKey: i < 3 ? `investor-fund-${i + 1}` : `investor-${i}`,
      blockKey: "block-2020-safes",
      kind: "safe",
      status: converted ? "converted" : "outstanding",
      closedOn: converted ? "2021-03-31" : null,
      principalCents: (5000000 + i * 250000).toString(),
      issueDate: dateFrom(i % 8, 20),
      issuedBy: "Northwind Robotics, Inc.",
      boardApprovedOn: dateFrom(0, 1),
      interestRate: null,
      maturityDate: null,
      valuationCapCents: "1600000000",
      valuationCapType: "post_money",
      discountPercent: i % 3 === 0 ? "15" : null,
      convertsToShareClassKey: "class-seed",
      convertedToKey: converted ? `certificate-PSS-${i + 1}` : null,
      // The 2020 SAFEs are the Seed round, converted or not.
      roundKey: "round-safes",
      proRata: i % 2 === 0,
      mfn: i % 5 === 0,
      federalExemption: "Rule 506(b)",
      stateOfResidency: "CA",
    });
  }
  for (let i = 0; i < 6; i += 1) {
    const outstanding = i % 3 !== 2;
    list.push({
      key: `convertible-note-${i + 1}`,
      label: `CN-${i + 1}`,
      stakeholderKey: `investor-${i + 3}`,
      blockKey: "block-2023-notes",
      kind: "note",
      status: outstanding ? "outstanding" : "repaid",
      principalCents: (25000000 + i * 5000000).toString(),
      issueDate: dateFrom(48 + i, 5),
      maturityDate: dateFrom(72 + i, 5),
      // Closed synthetic notes are repaid at their stated maturity date.
      closedOn: outstanding ? null : dateFrom(72 + i, 5),
      interestStartDate: dateFrom(48 + i, 5),
      interestRate: i % 2 === 0 ? "8" : "6.5",
      interestType: i % 2 === 0 ? "simple" : "compound",
      dayCountConvention: "actual_365",
      valuationCapCents: i % 2 === 0 ? "3000000000" : null,
      valuationCapType: i % 2 === 0 ? "pre_money" : null,
      discountPercent: i % 2 === 0 ? null : "20",
      convertsToShareClassKey: "class-series-b",
      convertedToKey: null,
      roundKey: null,
      boardApprovedOn: dateFrom(47, 1),
      proRata: false,
      mfn: false,
    });
  }
  return list;
}

function buildOptionGrants(): DemoOptionGrant[] {
  const templates = [
    { key: "vesting-standard", totalMonths: 48, cliffMonths: 12, frequencyMonths: 1 },
    { key: "vesting-no-cliff", totalMonths: 48, cliffMonths: 0, frequencyMonths: 1 },
    { key: "vesting-quarterly-2y", totalMonths: 24, cliffMonths: 6, frequencyMonths: 3 }, // gitleaks:allow -- deterministic demo row identifier, not a credential
  ] as const;
  const grants: DemoOptionGrant[] = [];
  for (let i = 0; i < 47; i += 1) {
    const planIndex = i % 2;
    const planKey = planIndex === 0 ? "plan-2019" : "plan-2023";
    const fullyExercised = i % 13 === 4;
    const template =
      fullyExercised && planIndex === 1
        ? templates[2]
        : (templates[i % templates.length] ?? templates[0]);
    const quantity = (planIndex === 0 ? 6000 : 9000) + i * 500;
    const grantMonth = planIndex === 0 ? 2 + (i % 24) : 50 + (i % 22);
    const scheduledGrantDate = dateFrom(grantMonth, planIndex === 0 ? 8 : 12);
    // Fully exercised synthetic grants must vest within the bounded demo history.
    const fullyVestedByHistoryEnd = addMonthsClamped(
      DEMO_EXERCISE_HISTORY_END,
      -template.totalMonths,
    );
    const grantDate =
      fullyExercised && scheduledGrantDate > fullyVestedByHistoryEnd
        ? fullyVestedByHistoryEnd
        : scheduledGrantDate;
    let status: "outstanding" | "exercised" | "forfeited" | "canceled" | "expired" = "outstanding";
    let historyExerciseQuantity = 0;
    if (fullyExercised) {
      status = "exercised";
      historyExerciseQuantity = quantity;
    } else if (i % 13 === 6) {
      status = "forfeited";
    } else if (i % 17 === 9) {
      status = "canceled";
    } else if (i % 19 === 11) {
      status = "expired";
    } else if (i % 7 === 3) {
      status = "outstanding";
      historyExerciseQuantity = Math.floor(quantity / 2);
    }
    grants.push({
      key: `grant-${i + 1}`,
      label: `ES-${i + 1}`,
      stakeholderKey:
        status === "forfeited"
          ? `former-demo-employee-${Math.floor(i / 13) + 1}`
          : `person-${(i % EMPLOYEE_COUNT) + 1}`,
      planKey,
      vestingTemplateKey: template.key,
      status,
      optionType: i % 3 === 2 ? "nso" : "iso",
      quantity: quantity.toString(),
      exercisePrice: planIndex === 0 ? "0.10" : i % 3 === 0 ? "0.85" : "2.40",
      grantDate,
      // Ten-year term; an expired grant expires on the day it was closed out.
      expirationDate:
        status === "expired" ? dateFrom(80 + (i % 10), 1) : dateFrom(grantMonth + 120, 8),
      boardApprovedOn: grantDate,
      postTerminationExerciseMonths: 3,
      earlyExercise: false,
      acceptanceStatus: i % 9 === 0 ? "awaiting_holder_signature" : "accepted",
      canceledOn: status === "canceled" || status === "expired" ? dateFrom(80 + (i % 10), 1) : null,
      historyExerciseQuantity:
        historyExerciseQuantity > 0 ? String(historyExerciseQuantity) : undefined,
      vesting: {
        startDate: grantDate,
        totalMonths: template.totalMonths,
        cliffMonths: template.cliffMonths,
        frequencyMonths: template.frequencyMonths,
        tranches: null,
      },
    });
  }
  return grants;
}

function buildExercises(grants: DemoOptionGrant[]): DemoExercise[] {
  const historical = grants.flatMap((grant) => {
    if (!grant.historyExerciseQuantity || grant.historyExerciseQuantity === "0") return [];
    const fullyVestedDate = addMonthsClamped(grant.grantDate, grant.vesting?.totalMonths ?? 0);
    return [
      {
        key: `exercise-history-${grant.key}`,
        optionGrantKey: grant.key,
        quantity: grant.historyExerciseQuantity,
        exerciseDate:
          fullyVestedDate > DEMO_EXERCISE_HISTORY_END ? DEMO_EXERCISE_HISTORY_END : fullyVestedDate,
        paymentCents: sharesTimesPrice(
          BigInt(grant.historyExerciseQuantity),
          parseFixed(grant.exercisePrice),
        ).toString(),
        status: "completed" as const,
      },
    ];
  });
  const specs = [
    { grant: "grant-1", quantity: 1500, status: "completed" as const, date: "2024-05-01" },
    { grant: "grant-3", quantity: 2000, status: "completed" as const, date: "2025-02-14" },
    { grant: "grant-5", quantity: 1200, status: "pending" as const, date: "2026-01-12" },
    { grant: "grant-4", quantity: 500, status: "pending" as const, date: "2026-02-03" },
  ];
  return [
    ...historical,
    ...specs.map((spec, i) => {
      const grant = grants.find((item) => item.key === spec.grant);
      const price = grant?.exercisePrice ?? "0.10";
      return {
        key: `exercise-${i + 1}`,
        optionGrantKey: spec.grant,
        quantity: String(spec.quantity),
        exerciseDate: spec.date,
        paymentCents: sharesTimesPrice(BigInt(spec.quantity), parseFixed(price)).toString(),
        status: spec.status,
      };
    }),
  ];
}

function buildAccessGroups(): DemoAccessGroup[] {
  return [
    { key: "founders", level: "full_detail" },
    { key: "investors", level: "basic" },
    { key: "employees", level: "restricted" },
    { key: "former_employees", level: "none" },
    { key: "other", level: "none" },
  ];
}

function buildAccessGrants(): DemoAccessGrant[] {
  return [
    { key: "access-1", stakeholderKey: "founder-cora", level: "advanced" },
    { key: "access-2", stakeholderKey: "investor-fund-1", level: "advanced" }, // gitleaks:allow -- deterministic demo row identifier, not a credential
    { key: "access-3", stakeholderKey: "person-5", level: "basic" },
    {
      key: "access-4",
      stakeholderKey: "investor-2",
      level: null,
      requestedLevel: "advanced",
      requestedAt: "2026-01-08",
    },
    {
      key: "access-5",
      stakeholderKey: "person-7",
      level: null,
      requestedLevel: "basic",
      requestedAt: "2026-02-02",
    },
  ];
}

function buildSavedViews(): DemoSavedView[] {
  return [
    {
      key: "view-employees",
      page: "stakeholders",
      name: "Current employees",
      params: "relationship=employee&sort=name",
    },
    {
      key: "view-outstanding-pref",
      page: "securities",
      name: "Preferred outstanding",
      params: "status=outstanding&sort=issueDate",
    },
    {
      key: "view-2024-grants",
      page: "overview",
      name: "2024 grants",
      params: "from=2024-01-01&to=2024-12-31",
    },
  ];
}

function buildDraftSets(): DemoDraftSet[] {
  return [
    {
      key: "draft-set-new-hires",
      name: "New hires, October",
      securityKind: "option_grant",
      items: [1, 2, 3].map((i) => ({
        stakeholderKey: `person-${i}`,
        planKey: "plan-2023",
        optionType: "iso",
        quantity: String(4000 + i * 500),
        exercisePrice: "2.40",
        grantDate: "2026-09-15",
        vestingTemplateKey: "vesting-standard",
      })),
    },
  ];
}

export function demoLedger(): DemoLedger {
  const optionGrants = buildOptionGrants();
  const { certificates, seedIssuePrice } = buildCertificates();
  return {
    companyName: "Northwind Robotics, Inc.",
    stakeholders: buildStakeholders(),
    shareClasses: buildShareClasses(seedIssuePrice),
    plans: buildPlans(),
    vestingTemplates: buildVestingTemplates(),
    fundingRounds: buildRounds(seedIssuePrice),
    pricedRounds: [
      {
        key: "demo-seed-safe-conversion",
        convertibleKeys: Array.from({ length: 9 }, (_, i) => `convertible-safe-${i + 1}`),
        toShareClassKey: "class-seed",
        roundKey: "round-seed",
        preMoneyValuationCents: "1517850000",
        newMoneyCents: "25000000",
        asOf: "2021-03-31",
      },
    ],
    convertibleBlocks: buildConvertibleBlocks(),
    certificates,
    convertibles: buildConvertibles(),
    optionGrants,
    exercises: buildExercises(optionGrants),
    accessGroups: buildAccessGroups(),
    accessGrants: buildAccessGrants(),
    savedViews: buildSavedViews(),
    draftSets: buildDraftSets(),
  };
}

/** The first day any invented record may use, kept for tests and fixtures. */
export const DEMO_LEDGER_START_DATE = BASE_DATE;
