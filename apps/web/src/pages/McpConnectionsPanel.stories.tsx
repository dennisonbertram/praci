import type { McpConnectionList } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { contactAction } from "./McpActionCard.stories";
import { McpConnectionsPanel } from "./McpConnectionsPanel";

const spaces = [
  { id: "space-1", name: "Northwind", current: true },
  { id: "space-2", name: "Side project", current: false },
];

export const list: McpConnectionList = {
  mcpUrl: "https://example.ts.net/mcp",
  spaces,
  connections: [
    {
      id: "c1",
      kind: "oauth",
      label: "Claude",
      spaceId: "space-1",
      spaceName: "Northwind",
      readOnly: false,
      tokenPrefix: null,
      createdAt: "2026-10-20T12:00:00.000Z",
      lastUsedAt: "2026-10-27T09:30:00.000Z",
    },
    {
      id: "c2",
      kind: "pat",
      label: "Laptop",
      spaceId: "space-1",
      spaceName: "Northwind",
      readOnly: true,
      tokenPrefix: "praci_pat_Ab12",
      createdAt: "2026-10-26T12:00:00.000Z",
      lastUsedAt: null,
    },
    {
      id: "c3",
      kind: "pat",
      label: "CI reader",
      spaceId: "space-2",
      spaceName: "Side project",
      readOnly: true,
      tokenPrefix: "praci_pat_Zy98",
      createdAt: "2026-10-22T12:00:00.000Z",
      lastUsedAt: "2026-10-25T18:00:00.000Z",
    },
  ],
};

const meta = {
  title: "Settings/Connections panel",
  component: McpConnectionsPanel,
  decorators: [
    (Story) => (
      <div className="w-[720px] max-w-full">
        <Story />
      </div>
    ),
  ],
  beforeEach: () => mockRpc({ "mcpConnections.list": list }),
} satisfies Meta<typeof McpConnectionsPanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithConnections: Story = {};

export const RecentlyUsed: Story = {
  beforeEach: () =>
    mockRpc({
      "mcpConnections.list": {
        ...list,
        connections: [
          {
            ...list.connections[0]!,
            lastUsedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
          },
          ...list.connections.slice(1),
        ],
      },
    }),
};

export const WaitingForApproval: Story = {
  beforeEach: () =>
    mockRpc({ "mcpConnections.list": list, "mcpConnections.pendingActions": [contactAction] }),
};

export const Empty: Story = {
  beforeEach: () => mockRpc({ "mcpConnections.list": { ...list, connections: [] } }),
};

export const Loading: Story = {
  beforeEach: () => mockRpc({ "mcpConnections.list": () => new Promise(() => undefined) }),
};

export const LoadFailed: Story = {
  beforeEach: () => mockRpc({ "mcpConnections.list": () => Promise.reject(new Error("offline")) }),
};
