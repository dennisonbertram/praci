import type { DataRoomConsentStatus } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { DataRoomConsentPrompt } from "./ConsentPrompt";

const meta = {
  title: "DataRoom/ConsentPrompt",
  render: () => (
    <div className="w-[560px]">
      <DataRoomConsentPrompt onAllowed={() => undefined} />
    </div>
  ),
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const status = (over: Partial<DataRoomConsentStatus> = {}): DataRoomConsentStatus => ({
  key: "data-room:demo",
  version: "2026-01-01",
  allowed: false,
  disclosure: "",
  recipients: [{ name: "Demo Model A", detail: "demo/model-a" }],
  ...over,
});

export const AskToRead: Story = {
  beforeEach: () =>
    mockRpc({ "dataRoom.consent": status(), "dataRoom.consentGrant": status({ allowed: true }) }),
};

export const AllowFailed: Story = {
  beforeEach: () =>
    mockRpc({
      "dataRoom.consent": status(),
      "dataRoom.consentGrant": () => {
        throw new Error("AI data sharing changed. Review it again.");
      },
    }),
  play: async ({ canvasElement }) => {
    canvasElement.querySelector("button")?.click();
    await new Promise((resolve) => setTimeout(resolve, 100));
  },
};

export const NoModel: Story = {
  beforeEach: () => mockRpc({ "dataRoom.consent": status({ recipients: [] }) }),
};
