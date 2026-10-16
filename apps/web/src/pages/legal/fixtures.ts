import type { LegalContract, LegalDeadline, LegalGraph, LegalOverview } from "@rakazo/contracts";

/** Invented data for stories and tests. Ids are UUIDs because the contract requires them. */
export const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

export const contracts: LegalContract[] = [
  {
    id: id(1),
    dataRoomItemId: id(101),
    title: "Master Services Agreement",
    contractType: "Services",
    counterparties: ["Acme Hosting Inc.", "Example Labs LLC"],
    status: "active",
    effectiveDate: "2025-01-15",
    expirationDate: "2027-01-14",
    autoRenews: true,
    renewalNoticeDays: 60,
    governingLaw: "Delaware",
    valueCents: "5000000",
    currency: "USD",
    summary: "Hosting and support.",
    analyzedRevision: 1,
    analyzedAt: "2026-10-10T09:00:00.000Z",
    nextDeadline: "2026-11-15",
  },
  {
    id: id(2),
    dataRoomItemId: id(102),
    title: "Office lease",
    contractType: "Lease",
    counterparties: ["Sample Properties"],
    status: "expired",
    effectiveDate: "2023-03-01",
    expirationDate: "2026-02-28",
    autoRenews: false,
    renewalNoticeDays: null,
    governingLaw: null,
    valueCents: null,
    currency: null,
    summary: null,
    analyzedRevision: 1,
    analyzedAt: "2026-10-10T09:00:00.000Z",
    nextDeadline: null,
  },
];

export const deadlines: LegalDeadline[] = [
  {
    id: id(11),
    contractId: id(2),
    contractTitle: "Office lease",
    dataRoomItemId: id(102),
    title: "Return the security deposit paperwork",
    dueDate: "2026-09-30",
    kind: "filing",
    status: "open",
    sourceQuote: "Tenant shall submit the closing statement within thirty (30) days.",
    notes: null,
  },
  {
    id: id(12),
    contractId: id(1),
    contractTitle: "Master Services Agreement",
    dataRoomItemId: id(101),
    title: "Send non-renewal notice",
    dueDate: "2026-11-15",
    kind: "notice",
    status: "open",
    sourceQuote: null,
    notes: null,
  },
];

export const overview: LegalOverview = {
  contracts,
  deadlines,
  counts: {
    contracts: 2,
    activeContracts: 1,
    openDeadlines: 2,
    overdueDeadlines: 1,
    unreviewedDocuments: 3,
  },
  agent: { botId: id(900), lastScanAt: "2026-10-15T08:00:00.000Z" },
};

export const emptyOverview: LegalOverview = {
  contracts: [],
  deadlines: [],
  counts: {
    contracts: 0,
    activeContracts: 0,
    openDeadlines: 0,
    overdueDeadlines: 0,
    unreviewedDocuments: 0,
  },
  agent: { botId: null, lastScanAt: null },
};

export const graph: LegalGraph = {
  nodes: [
    { id: id(21), kind: "company", label: "Example Labs LLC", attrs: null, contractId: null },
    { id: id(22), kind: "company", label: "Acme Hosting Inc.", attrs: null, contractId: null },
    { id: id(23), kind: "person", label: "Sam Example", attrs: null, contractId: null },
    {
      id: id(24),
      kind: "contract",
      label: "Master Services Agreement",
      attrs: null,
      contractId: id(1),
    },
    { id: id(25), kind: "contract", label: "Office lease", attrs: null, contractId: id(2) },
    {
      id: id(26),
      kind: "obligation",
      label: "Monthly hosting fee",
      attrs: null,
      contractId: id(1),
    },
    { id: id(27), kind: "jurisdiction", label: "Delaware", attrs: null, contractId: null },
  ],
  edges: [
    {
      id: id(31),
      fromId: id(21),
      toId: id(24),
      relation: "party to",
      dataRoomItemId: id(101),
      sourceQuote: "by and between Example Labs LLC and Acme Hosting Inc.",
    },
    {
      id: id(32),
      fromId: id(22),
      toId: id(24),
      relation: "party to",
      dataRoomItemId: id(101),
      sourceQuote: null,
    },
    {
      id: id(33),
      fromId: id(23),
      toId: id(24),
      relation: "signed",
      dataRoomItemId: id(101),
      sourceQuote: null,
    },
    {
      id: id(34),
      fromId: id(24),
      toId: id(26),
      relation: "requires",
      dataRoomItemId: id(101),
      sourceQuote: "Customer shall pay the monthly fee.",
    },
    {
      id: id(35),
      fromId: id(24),
      toId: id(27),
      relation: "governed by",
      dataRoomItemId: null,
      sourceQuote: null,
    },
    {
      id: id(36),
      fromId: id(21),
      toId: id(25),
      relation: "party to",
      dataRoomItemId: id(102),
      sourceQuote: null,
    },
  ],
};

export const consentFixture = {
  key: "k1",
  version: "v1",
  allowed: true,
  disclosure: "Document text from your Data room is sent to the model that runs the Legal agent.",
  recipients: [{ name: "OpenRouter", detail: "Meta Muse Spark 1.2" }],
};
