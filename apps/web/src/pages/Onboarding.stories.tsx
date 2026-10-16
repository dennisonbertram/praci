import type { IntegrationSetupState } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { mockMe, mockModelCatalog } from "../stories/fixtures";
import { OnboardingPage } from "./Onboarding";

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

const pending = () => new Promise(() => {});

const meta = {
  title: "Pages/Onboarding",
  component: OnboardingPage,
  beforeEach: () => mockRpc({ "models.list": mockModelCatalog, "bots.list": [] }),
} satisfies Meta<typeof OnboardingPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = { beforeEach: () => mockRpc({ me: pending }) };

export const ModelStep: Story = {
  beforeEach: () => mockRpc({ me: { ...mockMe, needsModel: true } }),
};

export const IntegrationsStep: Story = {
  beforeEach: () => mockRpc({ me: mockMe, "integrationSetup.get": setup }),
};

export const OpeningChat: Story = {
  beforeEach: () => mockRpc({ me: mockMe, "bots.create": pending }),
};

export const CreateBotError: Story = {
  beforeEach: () =>
    mockRpc({ me: mockMe, "bots.create": () => Promise.reject(new Error("Server unavailable")) }),
};
