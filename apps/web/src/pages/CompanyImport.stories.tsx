import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { CompanyImportPage } from "./CompanyImport";
import { importCatalog, importConsent, importSession } from "./company-import-fixtures";

const meta = {
  title: "Company/Import",
  component: CompanyImportPage,
  args: { onOpenSettings: () => {} },
} satisfies Meta<typeof CompanyImportPage>;
export default meta;
type Story = StoryObj<typeof meta>;
function mocks(status?: string) {
  const session = structuredClone(importSession);
  session.progress.status = status ?? "draft";
  if (status && status !== "draft") {
    session.progress.sources[0] = {
      ...session.progress.sources[0]!,
      status: "reading",
      itemsDiscovered: 25,
      itemsRead: 19,
      factsFound: 8,
      inputTokensUsed: 1200,
      outputTokensUsed: 200,
    };
    session.progress.inputTokensUsed = 1200;
    session.progress.outputTokensUsed = 200;
  }
  if (status === "completed") session.mode = "full";
  if (status === "preview_ready" || status === "completed") {
    const source = session.progress.sources[0]!;
    source.itemsRead = source.itemsDiscovered = status === "completed" ? 30 : 25;
    source.status = "completed";
    session.sources[0]!.plan = {
      itemCount: 30,
      tokensLower: 840,
      tokensUpper: 3360,
      estimateBasis: "sample",
    };
  }
  mockRpc({
    "companyImport.catalog": importCatalog,
    "companyImport.session": status ? session : null,
    "companyImport.consentStatus": { ...importConsent, allowed: status !== "draft" },
    "companyImport.subscribe": async function* () {
      yield session.progress;
    },
    "companyImport.sample": [
      {
        sourceId: "source-documents",
        items: [
          {
            sourceItemId: "sample-document",
            facts: [
              {
                kind: "entity",
                title: "Northwind Robotics",
                quote: "Northwind Robotics builds warehouse robots.",
                confidence: 0.94,
              },
            ],
          },
        ],
      },
    ],
  });
}
export const Sources: Story = { beforeEach: () => mocks() };
export const Review: Story = { beforeEach: () => mocks("draft") };
export const Running: Story = { beforeEach: () => mocks("running") };
export const Paused: Story = { beforeEach: () => mocks("paused") };
export const Partial: Story = { beforeEach: () => mocks("partial") };
export const Sample: Story = { beforeEach: () => mocks("preview_ready") };
export const Completed: Story = { beforeEach: () => mocks("completed") };
export const NoModel: Story = {
  beforeEach: () => {
    mocks("draft");
    mockRpc({
      "companyImport.consentStatus": { ...importConsent, recipient: null, consentKey: null },
    });
  },
};
export const ErrorState: Story = {
  beforeEach: () => {
    mocks();
    mockRpc({ "companyImport.catalog": () => Promise.reject(new Error("Unavailable")) });
  },
};
