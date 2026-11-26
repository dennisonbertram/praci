import type { McpActivityCall } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { McpConnectionActivity } from "./McpConnectionActivity";

export const calls: McpActivityCall[] = [
  { tool: "finance_overview", outcome: "ok", createdAt: "2026-10-27T09:31:10.000Z" },
  { tool: "contacts_list", outcome: "ok", createdAt: "2026-10-27T09:30:40.000Z" },
  { tool: "finance_breakdown", outcome: "error", createdAt: "2026-10-27T09:30:12.000Z" },
  { tool: "search_data_room", outcome: "rate_limited", createdAt: "2026-10-27T09:30:01.000Z" },
  { tool: "contacts_add", outcome: "pending", createdAt: "2026-10-27T09:29:40.000Z" },
  { tool: "contacts_add", outcome: "blocked", createdAt: "2026-10-27T09:29:10.000Z" },
];

const meta = {
  title: "Settings/Connection activity",
  component: McpConnectionActivity,
  args: { connectionId: "c1" },
  decorators: [
    (Story) => (
      <div className="w-[480px] max-w-full">
        <Story />
      </div>
    ),
  ],
  beforeEach: () => mockRpc({ "mcpConnections.activity": calls }),
} satisfies Meta<typeof McpConnectionActivity>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithCalls: Story = {};

export const Empty: Story = {
  beforeEach: () => mockRpc({ "mcpConnections.activity": [] }),
};

export const Loading: Story = {
  beforeEach: () => mockRpc({ "mcpConnections.activity": () => new Promise(() => undefined) }),
};

export const LoadFailed: Story = {
  beforeEach: () =>
    mockRpc({ "mcpConnections.activity": () => Promise.reject(new Error("offline")) }),
};
