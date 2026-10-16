import type { IntegrationSetupState } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { makeBot } from "../stories/fixtures";
import { IntegrationSetupPage } from "./IntegrationSetup";

const setup: IntegrationSetupState = {
  canConfigure: true,
  needsSetup: true,
  webUrl: "https://rakazo.example.com",
  providers: [
    { id: "composio", configured: false },
    { id: "pipedream", configured: false },
    { id: "google", configured: false },
  ],
};

const one = [makeBot({ id: "bot_a", name: "Scout" })];
const two = [...one, makeBot({ id: "bot_b", name: "Ledger" })];

const meta = {
  title: "Pages/IntegrationSetup",
  component: IntegrationSetupPage,
} satisfies Meta<typeof IntegrationSetupPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  beforeEach: () => mockRpc({ "bots.list": () => new Promise(() => {}) }),
};

export const LoadError: Story = {
  beforeEach: () => mockRpc({ "bots.list": () => Promise.reject(new Error("offline")) }),
};

export const Server: Story = {
  beforeEach: () => mockRpc({ "bots.list": one, "integrationSetup.get": setup }),
};

export const ServerWithBotPicker: Story = {
  beforeEach: () => mockRpc({ "bots.list": two, "integrationSetup.get": setup }),
};

export const McpMode: Story = {
  parameters: { initialEntries: ["/?mode=mcp"] },
  beforeEach: () => mockRpc({ "bots.list": two }),
};
