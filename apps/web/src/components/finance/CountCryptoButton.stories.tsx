import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { CountCryptoButton } from "./CountCryptoButton";

const meta = {
  title: "Finance/Count crypto button",
  component: CountCryptoButton,
  args: { scope: "bank", onSaved: () => undefined },
  beforeEach: () => mockRpc({ "finance.setPreferences": { ok: true } }),
} satisfies Meta<typeof CountCryptoButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NotCounting: Story = {};
export const CountingAll: Story = { args: { scope: "all" } };
export const CountingStablecoins: Story = { args: { scope: "stablecoins" } };
export const SaveFailed: Story = {
  beforeEach: () =>
    mockRpc({
      "finance.setPreferences": () => {
        throw new Error("Could not save the preference");
      },
    }),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("switch"));
  },
};
