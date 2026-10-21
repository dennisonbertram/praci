import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { makeBot, mockIntegrations, mockServer } from "../../stories/fixtures";
import { GranolaPage } from "./GranolaPage";

const granolaServer = mockServer("srv_granola", "Granola", {
  endpoint: "https://mcp.granola.ai/mcp",
  agentBotId: "bot_granola",
  agentExclusive: true,
});
const agent = makeBot({ id: "bot_granola", name: "Granola agent" });
const key = {
  connectionId: "conn_demo",
  status: "connected" as const,
  syncedThrough: "2026-10-20T10:00:00Z",
  lastSyncedAt: null,
  syncedCount: 12,
  consentOff: false,
  agentBotId: "bot_granola",
};

const meta = {
  title: "Integrations/GranolaPage",
  component: GranolaPage,
  parameters: { layout: "fullscreen" },
  args: { onOpenAiDataSharing: fn() },
  beforeEach: () => mockRpc({}),
} satisfies Meta<typeof GranolaPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NothingConnected: Story = { args: { data: mockIntegrations() } };
export const SignInOnly: Story = {
  args: { data: mockIntegrations({ servers: [granolaServer], bots: [agent] }) },
};
export const KeyOnly: Story = {
  args: { data: mockIntegrations({ meetings: key, bots: [agent] }) },
};
export const BothRoutes: Story = {
  args: { data: mockIntegrations({ servers: [granolaServer], meetings: key, bots: [agent] }) },
};
