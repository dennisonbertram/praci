import type { AccountSecurity, ServerUpdateStatus } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import {
  ComputerSettingsPanel,
  GeneralSettingsPanels,
  UpdatesSettingsPanel,
  UsageSettingsPanel,
} from "./AccountSettingsOverlay";

const security: AccountSecurity = {
  hasPassword: true,
  passwordChangeEnabled: true,
  freshOidcAuth: false,
  ssoLinked: false,
  emailDeletion: false,
  sso: null,
};

/** The account section reads sign-in options with fetch, outside rpc, so answer that one URL. */
const accountSecurity = (value: AccountSecurity) => () => {
  mockRpc({
    "aiConsent.status": { recipients: [] },
    "approvalRules.list": [],
    "autoReview.get": { enabled: false, checkerAvailable: true },
  });
  const original = window.fetch;
  window.fetch = async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("/api/auth/account-security")) {
      return new Response(JSON.stringify(value), {
        headers: { "Content-Type": "application/json" },
      });
    }
    return original(input, init);
  };
  return () => {
    window.fetch = original;
  };
};

const updateStatus: ServerUpdateStatus = {
  supported: true,
  unsupportedReason: null,
  installKind: "sidecar",
  manualCommands: [],
  mode: "sidecar",
  strategy: "pull",
  strategyNote: null,
  version: "1.0.0",
  revision: null,
  commit: null,
  branch: null,
  remoteUrl: null,
  dirty: false,
  dirtyPaths: [],
  image: "registry.example.com/rakazo",
  imageTag: "1.0.0",
  previousImageTag: null,
  canRollback: false,
  source: { repoUrl: "https://github.com/example/rakazo", branch: "main", official: true },
  officialRepoUrl: "https://github.com/example/rakazo",
  restartSupervisor: "none",
  restartAdvice: "",
  running: false,
  lastRun: null,
};

const meta = {
  title: "Shell/AccountSettings",
  component: GeneralSettingsPanels,
  args: {
    name: "Sam Example",
    email: "sam@example.com",
    avatarStyle: "organic",
    onAvatarStyleChange: async () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="w-[560px]">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component:
          "Also shows: ChangePasswordSection, SettingsPasswordInput, AppearancePicker, UiLocalePicker",
      },
    },
  },
} satisfies Meta<typeof GeneralSettingsPanels>;
export default meta;
type Story = StoryObj<typeof meta>;

export const GeneralWithPassword: Story = { beforeEach: accountSecurity(security) };

export const GeneralSsoOnly: Story = {
  beforeEach: accountSecurity({
    ...security,
    hasPassword: false,
    ssoLinked: true,
    sso: { name: "Example SSO" },
  }),
};

export const GeneralPasswordChangeDisabled: Story = {
  beforeEach: accountSecurity({ ...security, passwordChangeEnabled: false }),
};

export const GeneralWithMessaging: Story = {
  args: { messagingEnabled: true, onOpenMessaging: () => undefined, isDeploymentOwner: true },
  beforeEach: accountSecurity(security),
};

export const GeneralWithTimeZone: Story = {
  args: { timezone: "America/New_York", onTimezoneChange: async () => undefined },
  beforeEach: accountSecurity(security),
};

export const GeneralWithoutEmail: Story = {
  args: { email: null },
  beforeEach: accountSecurity(security),
};

export const Usage: StoryObj = {
  render: () => (
    <div className="w-[560px]">
      <UsageSettingsPanel
        usage={{ runs: 42, inputTokens: 120000, outputTokens: 30000, totalTokens: 150000 }}
      />
    </div>
  ),
};

export const UsageEmpty: StoryObj = {
  render: () => (
    <div className="w-[560px]">
      <UsageSettingsPanel usage={null} />
    </div>
  ),
};

export const ComputerAvailable: StoryObj = {
  render: () => (
    <div className="w-[560px]">
      <ComputerSettingsPanel sandboxProvider="docker" />
    </div>
  ),
};

export const ComputerUnavailable: StoryObj = {
  render: () => (
    <div className="w-[560px]">
      <ComputerSettingsPanel sandboxProvider="none" />
    </div>
  ),
};

export const UpdatesOwner: StoryObj = {
  render: () => (
    <div className="w-[560px]">
      <UpdatesSettingsPanel isDeploymentOwner />
    </div>
  ),
  beforeEach: () => mockRpc({ "updater.status": updateStatus }),
};

export const UpdatesMember: StoryObj = {
  render: () => (
    <div className="w-[560px]">
      <UpdatesSettingsPanel />
    </div>
  ),
};
