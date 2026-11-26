import type { Meta, StoryObj } from "@storybook/react-vite";
import { setHideAmounts } from "../../lib/hide-amounts-preference";
import { ConcealedAmountInput } from "./ConcealedAmountInput";

const meta = {
  title: "Cap table/Concealed amount input",
  component: ConcealedAmountInput,
  args: {
    scopeKey: "saved-price",
    stored: true,
    fieldLabel: "Price per share",
    value: "125.50",
    onChange: () => {},
    "aria-label": "Price per share",
    inputMode: "decimal",
  },
} satisfies Meta<typeof ConcealedAmountInput>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SavedAmountHidden: Story = {
  beforeEach: () => {
    setHideAmounts(true);
    return () => setHideAmounts(false);
  },
};
