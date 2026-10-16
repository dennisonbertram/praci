import type { FinanceExchange } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { ExchangeGroup } from "./ExchangeGroup";

const exchange: FinanceExchange = {
  id: "exch_1",
  provider: "coinbase",
  connected: true,
  lastSyncedAt: "2026-01-01T00:00:00.000Z",
  lastError: null,
  totalCents: 123_450,
  balances: [
    { asset: "AAA", amount: "1.5", usdPrice: "500", usdValueCents: 75_000 },
    { asset: "BBB", amount: "250", usdPrice: "1.9", usdValueCents: 48_450 },
    { asset: "CCC", amount: "12", usdPrice: null, usdValueCents: null },
  ],
};

const meta = {
  title: "Finance/ExchangeGroup",
  component: ExchangeGroup,
  args: { exchange, onChanged: () => undefined },
  decorators: [
    (Story) => (
      <div className="w-[560px] max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ExchangeGroup>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const OtherProvider: Story = { args: { exchange: { ...exchange, provider: "kraken" } } };

export const NoBalances: Story = {
  args: { exchange: { ...exchange, balances: [], totalCents: 0 } },
};

export const SyncError: Story = {
  args: { exchange: { ...exchange, lastError: "The exchange rejected the saved key." } },
};

export const MenuOpen: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByLabelText(/^Actions for/));
    await expect(await within(document.body).findByText("Remove")).toBeTruthy();
  },
};

export const RemoveConfirm: Story = {
  play: async (context) => {
    await MenuOpen.play?.(context as never);
    await userEvent.click(within(document.body).getByText("Remove"));
    await expect(await within(document.body).findByRole("alertdialog")).toBeTruthy();
  },
};

export const RemoveFailed: Story = {
  beforeEach: () =>
    mockRpc({
      "finance.exchangeRemove": () => Promise.reject(new Error("Could not remove the exchange")),
    }),
  play: async (context) => {
    await RemoveConfirm.play?.(context as never);
    const dialog = within(document.body).getByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
    await expect(await within(dialog).findByText("Could not remove the exchange")).toBeTruthy();
  },
};
