import type { Meta, StoryObj } from "@storybook/react-vite";
import { setHideAmounts } from "../lib/hide-amounts-preference";
import { HideAmountsButton, HideAmountsMenuItem } from "./HideAmountsToggle";

const meta = {
  title: "Finance/Hide amounts",
  component: HideAmountsButton,
  parameters: { docs: { description: { component: "Also shows: HideAmountsMenuItem" } } },
} satisfies Meta<typeof HideAmountsButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Shown: Story = {
  beforeEach: () => setHideAmounts(false),
};

export const Hidden: Story = {
  beforeEach: () => {
    setHideAmounts(true);
    return () => setHideAmounts(false);
  },
};

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
