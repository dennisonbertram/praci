import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { CompanyRefresh } from "./CompanyRefresh";

const gmail = {
  id: "gmail",
  sourceKind: "gmail",
  capability: "supported",
  status: "ready",
  reason: null,
  lastSuccessAt: "2026-10-21T03:00:00Z",
  nextRunAt: "2026-10-22T03:00:00Z",
  runId: null,
};
const meta = {
  title: "Company/Refresh",
  component: CompanyRefresh,
  args: { onChanged: () => {} },
  beforeEach: () => mockRpc({ "companyImport.refreshStatus": [gmail] }),
} satisfies Meta<typeof CompanyRefresh>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ready: Story = {};
export const ManualOnly: Story = {
  beforeEach: () =>
    mockRpc({
      "companyImport.refreshStatus": [
        {
          ...gmail,
          id: "slack",
          sourceKind: "slack",
          capability: "manual_only",
          status: "unavailable",
          reason: "slack_changed_items_unavailable",
          lastSuccessAt: null,
          nextRunAt: null,
        },
      ],
    }),
};
export const ExpiredCheckpoint: Story = {
  beforeEach: () =>
    mockRpc({
      "companyImport.refreshStatus": [
        { ...gmail, status: "recovery_required", reason: "gmail_history_expired", nextRunAt: null },
      ],
    }),
};
export const AwaitingConsent: Story = {
  beforeEach: () =>
    mockRpc({
      "companyImport.refreshStatus": [{ ...gmail, status: "awaiting_consent", runId: "run" }],
    }),
};
export const Empty: Story = { beforeEach: () => mockRpc({ "companyImport.refreshStatus": [] }) };
export const ErrorState: Story = {
  beforeEach: () =>
    mockRpc({ "companyImport.refreshStatus": () => Promise.reject(new Error("Unavailable")) }),
};
