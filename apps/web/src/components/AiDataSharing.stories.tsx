import type { AiConsentStatus } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { AiDataSharingSection, InboxConsentPrompt } from "./AiDataSharing";

const meta = { title: "Settings/AI data sharing" } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const status = (allowed: boolean): AiConsentStatus => ({
  scope: "space_demo",
  version: "2026-01-01",
  recipients: [
    { key: "model_a", name: "Demo Provider", use: "model", detail: "demo/model-a, forwarded to its provider", allowed },
    { key: "model_b", name: "Demo Provider", use: "model", detail: "demo/model-b, forwarded to its provider", allowed: true },
    { key: "voice_a", name: "Demo Voice", use: "voice", detail: "Speech", allowed: false },
  ],
});

export const Prompt: Story = {
  render: () => (
    <div className="w-[480px]">
      <InboxConsentPrompt
        recipient={{ key: "model_a", name: "Demo Model A" }}
        onAllowed={() => undefined}
        onDismiss={() => undefined}
      />
    </div>
  ),
  beforeEach: () => mockRpc({ "aiConsent.status": status(false), "aiConsent.allow": status(true) }),
};

export const PromptError: Story = {
  ...Prompt,
  beforeEach: () =>
    mockRpc({
      "aiConsent.status": status(false),
      "aiConsent.allow": () => {
        throw new Error("Could not save your choice");
      },
    }),
  play: async ({ canvasElement }) => {
    canvasElement.querySelector("button")?.click();
    await new Promise((resolve) => setTimeout(resolve, 100));
  },
};

export const Section: Story = {
  render: () => (
    <div className="w-[480px]">
      <AiDataSharingSection />
    </div>
  ),
  beforeEach: () => mockRpc({ "aiConsent.status": status(false) }),
};

export const SectionHiddenWhenEmpty: Story = {
  render: () => (
    <div className="w-[480px] text-sm text-muted-foreground">
      Nothing renders below this line.
      <AiDataSharingSection />
    </div>
  ),
  beforeEach: () => mockRpc({ "aiConsent.status": { ...status(false), recipients: [] } }),
};
