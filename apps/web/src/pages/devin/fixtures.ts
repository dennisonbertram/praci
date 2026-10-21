import type { DevinSessionsOutput, DevinSessionView } from "@rakazo/contracts";

/** Invented data for stories and tests: organization "acme", repos acme/web, acme/api, acme/mobile. */
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

export const QUESTION =
  "Should the retry limit live in the API config or stay a constant in the worker? " +
  "The two existing callers disagree, and changing it affects every queue.";

export const sessions: DevinSessionView[] = [
  {
    id: "devin-1001",
    title: "Add retry limit to the export worker",
    kind: "needs_you",
    status: "blocked",
    statusDetail: "waiting_for_user",
    question: QUESTION,
    prs: [],
    origin: "slack",
    updatedAt: minutesAgo(25),
  },
  {
    id: "devin-1002",
    title: "Fix flaky checkout test",
    kind: "error",
    status: "failed",
    statusDetail: null,
    question: null,
    prs: [{ url: "https://github.com/acme/web/pull/88", state: "draft" }],
    origin: "webapp",
    updatedAt: minutesAgo(3 * 60),
  },
  {
    id: "devin-1003",
    title: "Migrate invoices endpoint to the new schema",
    kind: "working",
    status: "working",
    statusDetail: null,
    question: null,
    prs: [
      { url: "https://github.com/acme/api/pull/212", state: "open" },
      { url: "https://github.com/acme/mobile/pull/41", state: "open" },
    ],
    origin: "linear",
    updatedAt: minutesAgo(12),
  },
  {
    id: "devin-1004",
    title: "Bump the TypeScript version",
    kind: "finished",
    status: "finished",
    statusDetail: "finish",
    question: null,
    prs: [{ url: "https://github.com/acme/api/pull/207", state: "merged" }],
    origin: "code_scan",
    updatedAt: minutesAgo(26 * 60),
  },
  {
    id: "devin-1005",
    title: "",
    kind: "suspended",
    status: "suspended",
    statusDetail: null,
    question: null,
    prs: [],
    origin: "carrier_pigeon",
    updatedAt: minutesAgo(5 * 24 * 60),
  },
  {
    id: "devin-1006",
    title: "Tidy the onboarding copy",
    kind: "unknown",
    status: "daydreaming",
    statusDetail: null,
    question: null,
    prs: [],
    origin: "api",
    updatedAt: minutesAgo(6 * 24 * 60),
  },
];

const connection = {
  status: "ok",
  manage: true,
  canConnect: false,
  isConnector: true,
  agentBotId: "bot-devin",
} as const;

export const overview: DevinSessionsOutput = {
  connection,
  fetchedAt: minutesAgo(1),
  stale: false,
  partial: false,
  sessions,
};

export const emptyOverview: DevinSessionsOutput = { ...overview, sessions: [] };

export const notConnected: DevinSessionsOutput = {
  connection: {
    ...connection,
    status: "none",
    canConnect: true,
    isConnector: false,
    agentBotId: null,
  },
  fetchedAt: null,
  stale: false,
  partial: false,
  sessions: [],
};

export const notConnectedMember: DevinSessionsOutput = {
  ...notConnected,
  connection: { ...notConnected.connection, manage: false, canConnect: false },
};

export const rejected: DevinSessionsOutput = {
  ...overview,
  connection: { ...connection, status: "rejected" },
  stale: true,
  fetchedAt: minutesAgo(90),
};

export const connectorGone: DevinSessionsOutput = {
  ...overview,
  connection: { ...connection, status: "connector_gone", isConnector: false },
  stale: true,
  fetchedAt: minutesAgo(90),
};
