import type { Meta, StoryObj } from "@storybook/react-vite";
import { setHideAmounts } from "../lib/hide-amounts-preference";
import { HideAmountsMenuItem, ShowAmountsButton } from "./HideAmountsToggle";

const meta = {
  title: "Finance/Hide amounts",
  component: HideAmountsMenuItem,
} satisfies Meta<typeof HideAmountsMenuItem>;
export default meta;
type Story = StoryObj<typeof meta>;

export const AccountMenuRow: Story = {
  beforeEach: () => setHideAmounts(false),
  render: () => (
    <div className="w-72">
      <HideAmountsMenuItem />
    </div>
  ),
};

export const AccountMenuRowHidden: Story = {
  beforeEach: () => {
    setHideAmounts(true);
    return () => setHideAmounts(false);
  },
  render: () => (
    <div className="w-72">
      <HideAmountsMenuItem />
    </div>
  ),
};

export const FinanceHeaderShow: Story = {
  beforeEach: () => {
    setHideAmounts(true);
    return () => setHideAmounts(false);
  },
  render: () => <ShowAmountsButton />,
};
