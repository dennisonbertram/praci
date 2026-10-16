import type { Meta, StoryObj } from "@storybook/react-vite";
import { screen, userEvent } from "storybook/test";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { withPageBehind } from "../../stories/decorators";
import { AlchemyConnectDialog } from "./AlchemyConnectDialog";

const meta = {
  title: "Integrations/AlchemyConnectDialog",
  component: AlchemyConnectDialog,
  args: { onConnected: () => undefined, onClose: () => undefined },
  decorators: [withPageBehind()],
} satisfies Meta<typeof AlchemyConnectDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The server rejects the key and the dialog shows its message inline. */
export const KeyRejected: Story = {
  beforeEach: () =>
    mockRpc({
      "finance.cryptoProviderConnect": () => {
        throw new Error("That API key was not accepted.");
      },
    }),
  play: async () => {
    await userEvent.type(await screen.findByLabelText("API key"), "demo-key");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
  },
};
