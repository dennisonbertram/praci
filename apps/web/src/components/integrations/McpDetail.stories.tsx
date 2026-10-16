import type { Meta, StoryObj } from "@storybook/react-vite";
import { Navigate, Route, Routes } from "react-router-dom";
import { mockAssignments, mockIntegrations, mockServer } from "../../stories/fixtures";
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
  mockServer("srv_1", "Carta", { endpoint: "https://mcp.app.carta.com/mcp", writesEnabled });

export const CartaWritesOff: Story = {
  parameters: { entry: "/app/integrations/mcp/srv_1" },
  args: { data: mockIntegrations({ servers: [cartaServer(false)] }) },
};

export const CartaWritesOn: Story = {
  parameters: { entry: "/app/integrations/mcp/srv_1" },
  args: { data: mockIntegrations({ servers: [cartaServer(true)] }) },
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
