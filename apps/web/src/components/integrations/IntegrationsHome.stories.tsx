import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  mockAssignments,
  mockCatalog,
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

const pipedreamApp = {
  ...mockCatalog[0]!,
  connectorId: "pipedream",
  slug: "demo-tracker",
  name: "Demo Tracker",
  description: "Track tasks and due dates.",
};

/** Catalog apps from Composio and Pipedream carry a "via" label; direct apps carry none. */
export const SourceLabels: Story = {
  args: {
    data: mockIntegrations({
      catalog: [...mockCatalog, pipedreamApp],
      connections: [
        ...mockConnections,
        {
          ...mockConnections[0]!,
          id: "conn_4",
          connectorId: "pipedream",
          provider: "demo-tracker",
          displayName: "demo-board",
        },
      ],
      servers: [mockServer("srv_1", "Demo files")],
    }),
  },
};

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
      access: {
        conn_1: {
          allAgents: false,
          botIds: ["bot_ada", "bot_bram"],
          effectiveAccess: { shared: "some", botIds: ["bot_ada", "bot_bram"] },
        },
      },
    }),
  },
};

/** A connected app whose sign-in lapsed offers Reconnect on its tile; its label equals its name. */
export const NeedsReconnect: Story = {
  args: {
    data: mockIntegrations({
      connections: [
        {
          id: "conn_slack",
          connectorId: "composio",
          provider: "slack",
          displayName: "Slack",
          status: "connected",
          error: null,
          capabilities: [],
          createdAt: "2026-01-01T00:00:00.000Z",
          needsReconnect: true,
        },
      ],
    }),
  },
};

/** A search shows matches as one flat grid and hides the Connected tiles. */
export const SearchActive: Story = {
  parameters: { initialEntries: ["/app/integrations?q=s"] },
  args: { data: mockIntegrations({ connections: mockConnections }) },
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
