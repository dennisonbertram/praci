import type { Meta, StoryObj } from "@storybook/react-vite";
import { screen, userEvent } from "storybook/test";
import { mockRpc } from "../../stories/rpc-mock-1";
import { AlchemyConnectDialog } from "./AlchemyConnectDialog";

const meta = {
  title: "Integrations/AlchemyConnectDialog",
  component: AlchemyConnectDialog,
  args: { onConnected: () => undefined, onClose: () => undefined },
  // The dialog renders in a portal, so give the story root some content of its own.
  decorators: [
    (Story) => (
      <>
        <div className="h-80" />
        <Story />
      </>
    ),
  ],
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
