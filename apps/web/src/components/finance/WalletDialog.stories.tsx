import type { FinanceWallet } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { WalletDialog } from "./WalletDialog";

const wallet: FinanceWallet = {
  id: "wallet_1",
  address: "0x1111111111111111111111111111111111111111",
  ensName: null,
  label: "Demo wallet",
  type: "personal",
  safeOwners: null,
  safeThreshold: null,
};

const meta = {
  title: "Finance/WalletDialog",
  component: WalletDialog,
  // The dialog renders in a portal, so give the story root something to show.
  decorators: [
    (Story) => (
      <>
        <p className="text-sm text-muted-foreground">Page behind the dialog</p>
        <Story />
      </>
    ),
  ],
  args: { open: true, onClose: () => undefined, onSaved: () => undefined },
} satisfies Meta<typeof WalletDialog>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Add: Story = {};

export const Edit: Story = { args: { wallet } };

export const ServerError: Story = {
  beforeEach: () =>
    mockRpc({
      "finance.walletAdd": () => {
        throw new Error("That wallet is already added.");
      },
    }),
  play: async () => {
    const screen = within(document.body);
    await userEvent.type(await screen.findByLabelText("Address or ENS"), "demo.eth");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));
  },
};
