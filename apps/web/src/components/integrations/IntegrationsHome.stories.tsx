import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  mockAssignments,
  mockConnections,
  mockIntegrations,
  mockServer,
  mockSource,
} from "../../stories/fixtures-9";
import { IntegrationsHome } from "./IntegrationsHome";

const BLANK_PIXEL = "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==";

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
  // Finance logos are remote images; keep stories offline by swapping them for a blank pixel.
  beforeEach: () => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
    if (!descriptor?.set) return;
    const { get, set } = descriptor;
    Object.defineProperty(HTMLImageElement.prototype, "src", {
      configurable: true,
      get,
      set(value: string) {
        set.call(this, /^https?:/.test(value) ? BLANK_PIXEL : value);
      },
    });
    return () => {
      Object.defineProperty(HTMLImageElement.prototype, "src", descriptor);
    };
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
