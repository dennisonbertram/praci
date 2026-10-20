import type { IntegrationSetupState, ModelCatalogEntry } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
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

const signInCatalog: ModelCatalogEntry[] = [
  {
    provider: "openrouter",
    providerName: "OpenRouter",
    id: "sample/large",
    label: "Sample Large",
    billing: "Billed to your OpenRouter account.",
    auth: "api-key",
    thinkingLevels: ["off", "low", "medium", "high"],
  },
  {
    provider: "openai-codex",
    providerName: "ChatGPT",
    id: "sample-codex",
    label: "Sample Codex",
    billing: "Uses your ChatGPT subscription.",
    auth: "oauth",
    subscription: true,
    signIn: "auth-url",
    oauthLabel: "Sign in with ChatGPT",
  },
];

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

export const SignInOptions: Story = {
  beforeEach: () => mockRpc({ me: { ...mockMe, needsModel: true }, "models.list": signInCatalog }),
};

/** The OpenRouter popup is faked and the callback page's broadcast is sent by the play step. */
export const SignedInWithOpenRouter: Story = {
  beforeEach: () => {
    const realOpen = window.open;
    window.open = () =>
      ({ sessionStorage: { setItem() {} }, location: { href: "" }, close() {} }) as never;
    mockRpc({
      me: { ...mockMe, needsModel: true },
      "models.list": signInCatalog,
      "models.beginOpenRouterOAuth": { authorizationUrl: "https://openrouter.example/auth" },
    });
    return () => {
      window.open = realOpen;
    };
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole("button", { name: "Sign in with OpenRouter" }),
    );
    await new Promise((resolve) => setTimeout(resolve, 100));
    const channel = new BroadcastChannel("rakazo-mcp-oauth");
    channel.postMessage({ type: "mcp-oauth-complete" });
    channel.close();
    await expect(await within(canvasElement).findByText("Signed in with OpenRouter")).toBeVisible();
  },
};

export const SignInFailed: Story = {
  beforeEach: () =>
    mockRpc({
      me: { ...mockMe, needsModel: true },
      "models.list": signInCatalog,
      "models.beginOpenRouterOAuth": () =>
        Promise.reject(new Error("OpenRouter sign-in failed. Try again.")),
    }),
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole("button", { name: "Sign in with OpenRouter" }),
    );
    await expect(await within(canvasElement).findByText(/sign-in failed/i)).toBeVisible();
  },
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
