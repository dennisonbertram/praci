import type {
  CompanyImportCatalog,
  CompanyImportModelConsentStatus,
  CompanyImportSession,
} from "@rakazo/contracts";

export const importCatalog: CompanyImportCatalog = {
  sources: [
    {
      key: "data_room",
      sourceKind: "data_room",
      connectionId: null,
      label: "Data room",
      available: true,
      reason: null,
      itemCount: 30,
      defaultScope: {},
      connectPath: null,
    },
    {
      key: "gmail",
      sourceKind: "gmail",
      connectionId: null,
      label: "Gmail",
      available: false,
      reason: "not_connected",
      itemCount: null,
      defaultScope: { after: "2023-10-21" },
      connectPath: "/app/integrations?connect=gmail&returnTo=%2Fapp%2Fcompany%2Fimport",
    },
    {
      key: "slack",
      sourceKind: "slack",
      connectionId: "synthetic-slack",
      label: "Slack",
      available: false,
      reason: "unsupported",
      itemCount: null,
      defaultScope: {},
      connectPath: null,
    },
  ],
  folders: [
    { id: "company-docs", name: "Company documents" },
    { id: "funding", name: "Funding" },
  ],
};
export const importSession: CompanyImportSession = {
  mode: "sample",
  progress: {
    runId: "synthetic-import",
    status: "draft",
    tokenCap: 1_000_000,
    reservedTokens: 0,
    inputTokensUsed: 0,
    outputTokensUsed: 0,
    budgetWarning: false,
    counts: { waiting: 1 },
    createdAt: "2026-10-21T00:00:00.000Z",
    updatedAt: "2026-10-21T00:00:00.000Z",
    sources: [
      {
        id: "source-documents",
        sourceKind: "data_room",
        status: "waiting",
        units: 1,
        itemsDiscovered: 0,
        itemsRead: 0,
        factsFound: 0,
        reservedTokens: 0,
        inputTokensUsed: 0,
        outputTokensUsed: 0,
        lastError: null,
      },
    ],
  },
  sources: [
    {
      id: "source-documents",
      label: "Data room",
      sourceKind: "data_room",
      connectionId: null,
      scope: {},
      plan: { itemCount: 30, tokensLower: 0, tokensUpper: 1_000_000, estimateBasis: "budget_cap" },
    },
  ],
};
export const importConsent: CompanyImportModelConsentStatus = {
  allowed: false,
  consentKey: "synthetic-consent",
  sourceKind: "data_room",
  version: "2026-09-14",
  recipient: {
    key: "synthetic",
    name: "Example model provider",
    detail: "Synthetic extraction model",
    privacyUrl: null,
  },
};
