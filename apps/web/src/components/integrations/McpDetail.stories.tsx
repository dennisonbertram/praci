import type { McpServer } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Navigate, Route, Routes } from "react-router-dom";
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
  mockServer("srv_1", "Mercury", { endpoint: "https://mcp.mercury.example.com/mcp", ...extra });

export const CanCreateAgent: Story = {
  parameters: { entry: "/app/integrations/mcp/srv_1" },
  args: { data: mockIntegrations({ servers: [mercury()] }) },
};

export const WithAgent: Story = {
  parameters: { entry: "/app/integrations/mcp/srv_1" },
  args: {
    data: mockIntegrations({
      servers: [mercury({ agentBotId: "bot_ada" })],
      mcpAssignments: mockAssignments,
    }),
  },
};

export const WithAgentOnlyThisAgent: Story = {
  parameters: { entry: "/app/integrations/mcp/srv_1" },
  args: {
    data: mockIntegrations({
      servers: [mercury({ agentBotId: "bot_ada", agentExclusive: true, writesEnabled: true })],
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
