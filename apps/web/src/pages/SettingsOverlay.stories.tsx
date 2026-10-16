import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { withPageBehind } from "../stories/decorators";
import { mockMe, mockModelCatalog, mockModelCredentials } from "../stories/fixtures";
import { SettingsOverlay } from "./SettingsOverlay";

const meta = {
  title: "Settings/Settings overlay",
  component: SettingsOverlay,
  parameters: { layout: "fullscreen" },
  args: {
    email: "demo@example.test",
    name: "Demo User",
    usage: { runs: 42, inputTokens: 120000, outputTokens: 34000, totalTokens: 154000 },
    onUsageOpen: () => undefined,
    avatarStyle: "robot",
    onAvatarStyleChange: async () => undefined,
    memoryConfig: null,
    onMemoryConfigChange: () => undefined,
    onClose: () => undefined,
  },
  decorators: [withPageBehind("Page behind the settings")],
  beforeEach: () => {
    mockRpc({
      "aiConsent.status": { recipients: [] },
      "approvalRules.list": [],
      "autoReview.get": { enabled: false, checkerAvailable: true },
      "memory.list": [],
      "bots.list": [],
      "bots.listArchived": [],
      "agentSkills.list": [],
      "models.list": mockModelCatalog,
      "models.credentials": mockModelCredentials,
      me: mockMe,
      "models.backups": [],
      "voice.catalog": [],
      "voice.credentials": [],
      "voice.status": {
        configured: false,
        ready: false,
        transcribe: false,
        provider: null,
        voiceId: "",
      },
      "billing.status": {
        access: true,
        canManage: true,
        trialAvailable: false,
        trialDays: 0,
        state: "active",
        price: { amount: 2000, currency: "usd", interval: "month", intervalCount: 1 },
        seats: 3,
        trialEndsAt: null,
        currentPeriodEndsAt: "2026-06-01T00:00:00.000Z",
        cancelAtPeriodEnd: false,
        hasCustomer: true,
      },
    });
    // The General section reads the sign-in options with fetch.
    const original = window.fetch;
    window.fetch = async (input, init) =>
      String(input).includes("/api/auth/account-security")
        ? new Response(
            JSON.stringify({
              hasPassword: true,
              passwordChangeEnabled: true,
              freshOidcAuth: false,
              ssoLinked: false,
              emailDeletion: false,
              sso: null,
            }),
          )
        : original(input, init);
    return () => {
      window.fetch = original;
    };
  },
} satisfies Meta<typeof SettingsOverlay>;
export default meta;
type Story = StoryObj<typeof meta>;

export const General: Story = {};
export const GeneralAsOwner: Story = {
  args: { isDeploymentOwner: true, messagingEnabled: true, onOpenMessaging: () => undefined },
};
export const Models: Story = { args: { initialSection: "models" } };
export const Memory: Story = {
  args: {
    initialSection: "memory",
    memoryConfig: {
      provider: "builtin",
      settings: {},
      defaultMemoryScope: "isolated",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  },
};
export const Voice: Story = { args: { initialSection: "voice" } };
export const Usage: Story = { args: { initialSection: "usage" } };
export const UsageEmpty: Story = { args: { initialSection: "usage", usage: null } };
export const Billing: Story = { args: { initialSection: "billing", billingEnabled: true } };
export const ComputerUnavailable: Story = {
  name: "Computer (sandbox not configured)",
  args: { initialSection: "computer", isDeploymentOwner: true, sandboxProvider: "none" },
};
export const Updates: Story = { args: { initialSection: "updates", isDeploymentOwner: true } };
