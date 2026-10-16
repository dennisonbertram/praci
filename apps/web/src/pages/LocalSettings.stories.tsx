import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../stories/rpc-mock-1";
import { LocalSettingsPage } from "./LocalSettings";

const meta = {
  title: "Pages/LocalSettingsPage",
  component: LocalSettingsPage,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="h-[480px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof LocalSettingsPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = { beforeEach: () => mockRpc({ "integrationSetup.get": {} }) };

/** The first request has not answered, so only the title shows. */
export const Loading: Story = {
  beforeEach: () => mockRpc({ "integrationSetup.get": () => new Promise(() => undefined) }),
};

export const ServerUnavailable: Story = {
  beforeEach: () =>
    mockRpc({
      "integrationSetup.get": () => {
        throw new Error("No local server.");
      },
    }),
};
