import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  mockAssignments,
  mockConnections,
  mockIntegrations,
  mockServer,
  mockSource,
} from "../../stories/fixtures";
import { IntegrationsHome } from "./IntegrationsHome";

const meta = {
  title: "Integrations/IntegrationsHome",
  component: IntegrationsHome,
  parameters: {
    layout: "fullscreen",
    docs: {
      description: {
        component:
          "Also shows: Card, CardHead, UsedBy, McpCard, AppCard, SourceCard, AppTile, SectionTitle",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="h-[820px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof IntegrationsHome>;
export default meta;

type Story = StoryObj<typeof meta>;

/** Connected apps (connected, failed, connecting), MCP servers and a source, plus the catalog. */
export const WithConnections: Story = {
  args: {
    data: mockIntegrations({
      connections: mockConnections,
      servers: [
        mockServer("srv_1", "Demo files"),
        mockServer("srv_2", "Demo calendar", {
          oauthStatus: "reconnect",
          endpoint: "https://calendar.example.com/mcp",
        }),
      ],
      mcpAssignments: mockAssignments,
      sources: [mockSource],
      access: { conn_1: { allAgents: false, botIds: ["bot_ada", "bot_bram"] } },
    }),
  },
};

export const NothingConnected: Story = {
  args: { data: mockIntegrations() },
};

export const NotSetUpForOwner: Story = {
  args: {
    data: mockIntegrations({
      catalog: [],
      setup: {
        canConfigure: true,
        needsSetup: true,
        webUrl: "https://app.example.com",
        providers: [],
      },
    }),
  },
};

export const NotSetUpForMember: Story = {
  args: {
    data: mockIntegrations({
      catalog: [],
      setup: {
        canConfigure: false,
        needsSetup: true,
        webUrl: "https://app.example.com",
        providers: [],
      },
    }),
  },
};

export const LoadError: Story = {
  args: { data: mockIntegrations({ catalog: [], catalogFailed: true }) },
};
