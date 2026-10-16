import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { withPageBehind } from "../../stories/decorators";
import { ExchangeConnectDialog } from "./ExchangeConnectDialog";

const meta = {
  title: "Integrations/ExchangeConnectDialog",
  component: ExchangeConnectDialog,
  args: { provider: "coinbase", onConnected: () => undefined, onClose: () => undefined },
  // The dialog renders in a portal, so give the story root something to show.
  decorators: [withPageBehind()],
} satisfies Meta<typeof ExchangeConnectDialog>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Coinbase: Story = {};

export const Kraken: Story = { args: { provider: "kraken" } };

export const ServerError: Story = {
  beforeEach: () => {
    mockRpc({
      "finance.exchangeConnect": () => {
        throw new Error("The key could not read balances.");
      },
    });
  },
  play: async () => {
    const screen = within(document.body);
    await userEvent.type(await screen.findByLabelText("API key name"), "demo-key");
    await userEvent.type(screen.getByLabelText("Private key"), "demo-secret");
    await userEvent.click(screen.getByRole("button", { name: "Connect" }));
  },
};
