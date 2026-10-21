import type { McpServer } from "@rakazo/contracts";
import { ZERNIO_MCP_ENDPOINT } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Navigate, Route, Routes } from "react-router-dom";
import { userEvent, within } from "storybook/test";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { makeBot, mockAssignments, mockIntegrations, mockServer } from "../../stories/fixtures";
import { McpDetail } from "./McpDetail";

const meta = {
  title: "Integrations/McpDetail",
  component: McpDetail,
  parameters: { layout: "fullscreen" },
  // McpDetail reads :serverId from the route, so mount it at its real path.
  render: (args, { parameters }) => (
    <Routes>
      <Route path="/app/integrations/mcp/:serverId" element={<McpDetail {...args} />} />
      <Route path="*" element={<Navigate to={parameters.entry ?? "/"} replace />} />
    </Routes>
  ),
} satisfies Meta<typeof McpDetail>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Connected: Story = {
  parameters: { entry: "/app/integrations/mcp/srv_1" },
  args: {
    data: mockIntegrations({
      servers: [mockServer("srv_1", "Demo files")],
      mcpAssignments: mockAssignments,
    }),
  },
};

export const ZernioReadOnly: Story = {
  parameters: { entry: "/app/integrations/mcp/srv_1" },
  args: {
    data: mockIntegrations({
      servers: [
        mockServer("srv_1", "Zernio", {
          endpoint: "https://mcp.zernio.com/mcp",
          agentBotId: "gtm_demo",
          agentExclusive: true,
          writesEnabled: false,
        }),
      ],
      bots: [makeBot({ id: "gtm_demo", name: "GTM agent", spawnKey: "gtm-agent:user_demo" })],
    }),
  },
};

export const ZernioNeedsReconnect: Story = {
  parameters: { entry: "/app/integrations/mcp/srv_1" },
  args: {
    data: mockIntegrations({
      servers: [
        mockServer("srv_1", "Zernio", {
          endpoint: ZERNIO_MCP_ENDPOINT,
          hasSecret: false,
          oauthStatus: "none",
          oauthAttempted: false,
          agentBotId: "gtm_demo",
          agentExclusive: true,
          writesEnabled: false,
        }),
      ],
      bots: [makeBot({ id: "gtm_demo", name: "GTM agent", spawnKey: "gtm-agent:user_demo" })],
    }),
  },
};

const cartaServer = (writesEnabled: boolean) =>
  mockServer("srv_1", "Carta", {
    endpoint: "https://mcp.app.carta.com/mcp",
    writesEnabled,
    agentBotId: "bot_carta",
    agentExclusive: true,
  });

const cartaBot = makeBot({
  id: "bot_carta",
  name: "Carta agent",
  spawnKey: "carta-agent:user_demo",
});

export const CartaCanCreateAgent: Story = {
  parameters: { entry: "/app/integrations/mcp/srv_1" },
  args: {
    data: mockIntegrations({
      servers: [{ ...cartaServer(false), agentBotId: null, agentExclusive: false }],
    }),
  },
};

export const CartaWritesOff: Story = {
  parameters: { entry: "/app/integrations/mcp/srv_1" },
  args: { data: mockIntegrations({ servers: [cartaServer(false)], bots: [cartaBot] }) },
};

export const CartaWritesOn: Story = {
  parameters: { entry: "/app/integrations/mcp/srv_1" },
  args: { data: mockIntegrations({ servers: [cartaServer(true)], bots: [cartaBot] }) },
};

const mercury = (extra: Partial<McpServer> = {}) =>
  mockServer("srv_1", "Mercury", { endpoint: "https://mcp.mercury.com/mcp", ...extra });

export const CanCreateAgent: Story = {
  parameters: { entry: "/app/integrations/mcp/srv_1" },
  args: { data: mockIntegrations({ servers: [mercury()] }) },
};

/** While the agent is being created every header button is disabled. */
export const CreatingAgent: Story = {
  parameters: { entry: "/app/integrations/mcp/srv_1" },
  beforeEach: () => mockRpc({ "integrationAgents.create": () => new Promise(() => undefined) }),
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole("button", { name: "Create agent" }),
    );
  },
  args: { data: mockIntegrations({ servers: [mercury()] }) },
};

export const WithAgent: Story = {
  parameters: { entry: "/app/integrations/mcp/srv_1" },
  args: {
    data: mockIntegrations({
      servers: [mercury({ agentBotId: "bot_ada", agentExclusive: true })],
      mcpAssignments: mockAssignments,
    }),
  },
};

export const WithAgentShared: Story = {
  parameters: { entry: "/app/integrations/mcp/srv_1" },
  args: {
    data: mockIntegrations({
      servers: [mercury({ agentBotId: "bot_ada", agentExclusive: false, writesEnabled: true })],
      mcpAssignments: mockAssignments,
    }),
  },
};

export const NeedsReconnect: Story = {
  parameters: { entry: "/app/integrations/mcp/srv_1" },
  args: {
    data: mockIntegrations({
      servers: [mockServer("srv_1", "Demo files", { oauthStatus: "reconnect" })],
    }),
  },
};

export const LocalCommand: Story = {
  parameters: { entry: "/app/integrations/mcp/srv_1" },
  args: {
    data: mockIntegrations({
      servers: [
        mockServer("srv_1", "Demo local tool", {
          transport: "stdio",
          endpoint: null,
          command: "demo-mcp-server",
          oauthStatus: "none",
        }),
      ],
    }),
  },
};

export const NotFound: Story = {
  parameters: { entry: "/app/integrations/mcp/missing" },
  args: { data: mockIntegrations() },
};
