import type { PageLiveBlock } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { PageLiveContext } from "../../pages/shell/page-live";
import { PageMetricBlock, PageTableBlock } from "./PageLiveBlocks";

const at = "2026-01-01T09:00:00.000Z";
const metric = { label: "Burn / mo", source: "cash", path: "/burn", format: "usd" as const };
const table = {
  name: "Largest vendors",
  source: "spend",
  path: "/vendors",
  limit: 50,
  columns: [
    { key: "name", label: "Vendor" },
    { key: "total", label: "Total", format: "usd" as const },
  ],
};
const ok: PageLiveBlock = { status: "ok", fetchedAt: at, text: "$86K" };
const rows: PageLiveBlock = {
  status: "ok",
  fetchedAt: at,
  rows: [
    { name: "Northwind Cloud", total: 18200 },
    { name: "Example Payroll", total: 12400.5 },
    { name: "Sample Legal", total: 3100 },
  ],
};

const meta = {
  title: "Pages/Live blocks",
  component: PageMetricBlock,
  args: { block: metric, data: ok },
  decorators: [
    (Story, { parameters }) => (
      <PageLiveContext.Provider
        value={{
          loaded: parameters.loaded ?? true,
          refreshing: parameters.refreshing ?? false,
          blocks: new Map(),
          refresh: () => {},
        }}
      >
        <div className="w-[384px]">
          <Story />
        </div>
      </PageLiveContext.Provider>
    ),
  ],
} satisfies Meta<typeof PageMetricBlock>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Metric: Story = {};
/** The last good value stays; the dot opens the error and Retry. */
export const MetricFailed: Story = {
  args: { data: { ...ok, status: "failed", error: "Request timed out" } },
};
export const MetricPaused: Story = {
  args: { data: { ...ok, status: "paused", error: "Paused after 5 failures" } },
};
export const MetricPausedEmpty: Story = { args: { data: { status: "paused", fetchedAt: null } } };
/** An old value shows its date without hover. */
export const MetricFailedTwoDaysAgo: Story = {
  args: {
    data: {
      ...ok,
      status: "failed",
      error: "Request timed out",
      fetchedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
    },
  },
};
export const MetricRefreshing: Story = { parameters: { refreshing: true } };
export const MetricPending: Story = { args: { data: { status: "pending", fetchedAt: null } } };
export const MetricEmpty: Story = { args: { data: { status: "empty", fetchedAt: null } } };
export const MetricMissing: Story = { args: { data: { status: "missing", fetchedAt: null } } };

export const Table: Story = {
  render: (args) => <PageTableBlock block={table} data={args.data} />,
  args: { data: rows },
};
export const TableFailed: Story = {
  ...Table,
  args: { data: { ...rows, status: "failed", error: "Request timed out" } },
};
export const TableRefreshing: Story = { ...Table, parameters: { refreshing: true } };
export const TableEmpty: Story = {
  ...Table,
  args: { data: { status: "empty", fetchedAt: null } },
};
