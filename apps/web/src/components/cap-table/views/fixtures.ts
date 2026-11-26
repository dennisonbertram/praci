import type {
  EquityCapTableByStakeholder,
  EquityCashRaised,
  EquityFundingRound,
  EquityHealthFinding,
  EquityReport,
  EquityRoundModel,
  EquityShareClass,
} from "@rakazo/contracts";

/** Invented by-stakeholder data for stories and tests. */
export const byStakeholderFixture: EquityCapTableByStakeholder = {
  asOf: "2026-10-15",
  classes: [
    { id: "sc-common", name: "Common" },
    { id: "sc-seed", name: "Series Seed" },
  ],
  rows: [
    {
      stakeholderId: "sh-ada",
      name: "Ada Founder",
      type: "individual",
      sharesByClass: { "sc-common": "5000000" },
      options: "0",
      outstandingShares: "5000000",
      outstandingPercent: "47.6190",
      fullyDilutedShares: "5000000",
      fullyDilutedPercent: "41.6667",
      convertiblePrincipalCents: "0",
      cashPaidCents: "50000",
      securities: [
        {
          kind: "certificate",
          id: "cert-1",
          label: "CS-1",
          classOrPlanName: "Common",
          quantity: "5000000",
          principalCents: "0",
          issueDate: "2024-02-01",
        },
      ],
    },
    {
      stakeholderId: "sh-fund",
      name: "Example Ventures",
      type: "organization",
      sharesByClass: { "sc-seed": "2500000" },
      options: "0",
      outstandingShares: "2500000",
      outstandingPercent: "23.8095",
      fullyDilutedShares: "2500000",
      fullyDilutedPercent: "20.8333",
      convertiblePrincipalCents: "0",
      cashPaidCents: "200000000",
      securities: [
        {
          kind: "certificate",
          id: "cert-2",
          label: "PS-1",
          classOrPlanName: "Series Seed",
          quantity: "2500000",
          principalCents: "0",
          issueDate: "2025-05-10",
        },
      ],
    },
    {
      stakeholderId: "sh-cy",
      name: "Cy Engineer",
      type: "individual",
      sharesByClass: {},
      options: "1000000",
      outstandingShares: "0",
      outstandingPercent: "0.0000",
      fullyDilutedShares: "1000000",
      fullyDilutedPercent: "8.3333",
      convertiblePrincipalCents: "0",
      cashPaidCents: "0",
      securities: [
        {
          kind: "option_grant",
          id: "grant-1",
          label: "ES-1",
          classOrPlanName: "2024 Equity Plan",
          quantity: "1000000",
          principalCents: "0",
          issueDate: "2025-01-15",
        },
      ],
    },
    {
      stakeholderId: "sh-dee",
      name: "Dee Angel",
      type: "individual",
      sharesByClass: {},
      options: "0",
      outstandingShares: "0",
      outstandingPercent: "0.0000",
      fullyDilutedShares: "0",
      fullyDilutedPercent: "0.0000",
      convertiblePrincipalCents: "25000000",
      cashPaidCents: "0",
      securities: [
        {
          kind: "convertible",
          id: "safe-1",
          label: null,
          classOrPlanName: "2026 SAFEs",
          quantity: "0",
          principalCents: "25000000",
          issueDate: "2026-03-01",
        },
      ],
    },
  ],
  totals: {
    sharesByClass: { "sc-common": "5000000", "sc-seed": "2500000" },
    options: "1000000",
    outstandingShares: "7500000",
    outstandingPercent: "100.0000",
    fullyDilutedShares: "8500000",
    fullyDilutedPercent: "70.8333",
    convertiblePrincipalCents: "25000000",
    cashPaidCents: "200050000",
  },
  unallocatedPoolShares: "500000",
};

const version = {
  votesPerShare: "1",
  certificated: true,
  parValue: "0.0001",
  pariPassu: true,
  originalIssuePrice: null,
  conversionPrice: null,
  conversionRatio: "1",
  multiplier: "1",
  participating: false,
  participationCap: null,
  dividend: false,
  dividendYield: null,
  cumulative: false,
  dividendAccrual: null,
  compoundingInterest: false,
  dayCountConvention: null,
};

/** Invented share classes: common with two document versions and a seed preferred. */
export const shareClassesFixture: EquityShareClass[] = [
  {
    id: "sc-seed",
    createdAt: "2025-05-01T00:00:00.000Z",
    updatedAt: "2025-05-01T00:00:00.000Z",
    name: "Series Seed",
    prefix: "PS",
    classType: "preferred",
    current: {
      ...version,
      id: "v-seed",
      documentDate: "2025-05-01",
      authorizedShares: "2000000",
      seniority: 1,
      originalIssuePrice: "0.80",
      conversionPrice: "0.80",
    },
    versions: [],
  },
  {
    id: "sc-common",
    createdAt: "2024-02-01T00:00:00.000Z",
    updatedAt: "2025-05-01T00:00:00.000Z",
    name: "Common",
    prefix: "CS",
    classType: "common",
    current: {
      ...version,
      id: "v-common-2",
      documentDate: "2025-05-01",
      authorizedShares: "12000000",
      seniority: 2,
    },
    versions: [],
  },
];
shareClassesFixture[0]!.versions = [shareClassesFixture[0]!.current];
shareClassesFixture[1]!.versions = [
  shareClassesFixture[1]!.current,
  {
    ...shareClassesFixture[1]!.current,
    id: "v-common-1",
    documentDate: "2024-02-01",
    authorizedShares: "10000000",
  },
];

const round = (
  id: string,
  name: string,
  startDate: string,
  cashRaisedCents: string,
  preMoneyValuationCents: string | null,
): EquityFundingRound => ({
  id,
  createdAt: `${startDate}T00:00:00.000Z`,
  updatedAt: `${startDate}T00:00:00.000Z`,
  name,
  startDate,
  endDate: null,
  closingDate: startDate,
  originalIssuePrice: null,
  preMoneyValuationCents,
  overrides: {},
  cashRaisedCents,
  sharesIssued: "1000000",
  securityCount: 3,
  shareClassCount: 1,
});

/** Invented funding rounds, oldest first. */
export const roundsFixture: EquityFundingRound[] = [
  round("round-pre", "Pre-seed SAFEs", "2024-06-01", "50000000", null),
  round("round-seed", "Seed", "2025-05-01", "200000000", "800000000"),
];

/** An invented cap table report by share class. */
export const reportFixture: EquityReport = {
  kind: "cap_table",
  asOf: "2026-10-15",
  columns: [
    { key: "name", label: "Share class", numeric: false, format: "text" },
    { key: "authorized", label: "Authorized shares", numeric: true, format: "shares" },
    { key: "shares", label: "Fully diluted shares", numeric: true, format: "shares" },
    { key: "percent", label: "Ownership %", numeric: true, format: "percent" },
    { key: "raised", label: "Raised", numeric: true, format: "cents" },
  ],
  rows: [
    {
      name: "Common",
      authorized: "10000000",
      shares: "8000000",
      percent: "66.6667",
      raised: "6397500",
    },
    {
      name: "Series Seed",
      authorized: "2500000",
      shares: "2500000",
      percent: "20.8333",
      raised: "200000000",
    },
  ],
  csv: "Share class,Authorized shares,Fully diluted shares,Ownership %\r\nCommon,10000000,8000000,66.6667\r\nSeries Seed,2500000,2500000,20.8333\r\n",
};

/** Invented health findings: one required, one recommended. */
export const healthFindingsFixture: EquityHealthFinding[] = [
  {
    id: "hf-1",
    check: "class-over-issued",
    tag: "share_classes",
    severity: "required",
    status: "open",
    fingerprint: "a",
    rows: [
      {
        recordKind: "share_class",
        recordId: "sc-seed",
        name: "Series Seed",
        detail: "2,500,000 issued or reserved of 2,000,000 authorized",
      },
    ],
    detectedAt: "2026-10-15T08:00:00.000Z",
    dismissedAt: null,
    updatedAt: "2026-10-15T08:00:00.000Z",
  },
  {
    id: "hf-2",
    check: "holder-missing-email",
    tag: "stakeholder",
    severity: "recommended",
    status: "open",
    fingerprint: "b",
    rows: [
      { recordKind: "stakeholder", recordId: "sh-cy", name: "Cy Engineer", detail: "No email" },
    ],
    detectedAt: "2026-10-15T08:00:00.000Z",
    dismissedAt: null,
    updatedAt: "2026-10-15T08:00:00.000Z",
  },
];

const security = (
  id: string,
  label: string,
  stakeholderName: string,
  issueDate: string,
  cashPaidCents: string,
  shares: string,
  kind: "certificate" | "convertible" = "certificate",
) => ({
  kind,
  id,
  label,
  stakeholderId: `sh-${id}`,
  stakeholderName,
  roundId: id === "cert-2" ? "round-seed" : null,
  issueDate,
  cashPaidCents,
  debtCanceledCents: "0",
  ipTransferredCents: "0",
  otherConsiderationCents: "0",
  shares,
});

/** Invented cash raised: common, a seed class and one SAFE. */
export const cashRaisedFixture: EquityCashRaised = {
  asOf: "2026-10-15",
  totalCents: "225050000",
  byClass: [
    { shareClassId: "sc-common", name: "Common", cashRaisedCents: "50000" },
    { shareClassId: "sc-seed", name: "Series Seed", cashRaisedCents: "200000000" },
    { shareClassId: null, name: "Convertibles", cashRaisedCents: "25000000" },
  ],
  byHolder: [
    { stakeholderId: "sh-fund", name: "Example Ventures", cashRaisedCents: "200000000" },
    { stakeholderId: "sh-dee", name: "Dee Angel", cashRaisedCents: "25000000" },
    { stakeholderId: "sh-ada", name: "Ada Founder", cashRaisedCents: "50000" },
  ],
  securities: [
    security("safe-1", "SAFE-1", "Dee Angel", "2026-03-01", "25000000", "0", "convertible"),
    security("cert-2", "PS-1", "Example Ventures", "2025-05-10", "200000000", "2500000"),
    security("cert-1", "CS-1", "Ada Founder", "2024-02-01", "50000", "5000000"),
  ],
};

/** An invented pro forma for a Series A. */
export const roundModelFixture: EquityRoundModel = {
  asOf: "2026-10-15",
  pricePerShare: "1.6000000000",
  preMoneyFullyDilutedShares: "12500000",
  poolIncreaseShares: "500000",
  newMoneyShares: "3125000",
  conversionShares: "312500",
  postMoneyFullyDilutedShares: "15625000",
  postMoneyValuationCents: "2500000000",
  rows: [
    {
      id: "sh-ada",
      name: "Ada Founder",
      kind: "existing",
      preShares: "5000000",
      postShares: "5000000",
      prePercent: "40.0000",
      postPercent: "32.0000",
    },
    {
      id: "__pool",
      name: "Unallocated pool",
      kind: "pool",
      preShares: "1000000",
      postShares: "1000000",
      prePercent: "8.0000",
      postPercent: "6.4000",
    },
    {
      id: "safe-1",
      name: "Dee Angel SAFE",
      kind: "conversion",
      preShares: "312500",
      postShares: "312500",
      prePercent: "2.5000",
      postPercent: "2.0000",
    },
    {
      id: "investment-0",
      name: "Lead Fund",
      kind: "new_money",
      preShares: "0",
      postShares: "3125000",
      prePercent: "0.0000",
      postPercent: "20.0000",
    },
  ],
};
