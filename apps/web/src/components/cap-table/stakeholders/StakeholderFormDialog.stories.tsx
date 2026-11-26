import type { Meta, StoryObj } from "@storybook/react-vite";
import { withPageBehind } from "../../../stories/decorators";
import { StakeholderFormDialog } from "./StakeholderFormDialog";
import { fixtureStakeholder } from "./stakeholder-fixtures";

const noop = () => undefined;
const meta = {
  title: "Cap table/Stakeholders/Form dialog",
  component: StakeholderFormDialog,
  decorators: [withPageBehind()],
  args: { open: true, onOpenChange: noop, customProperties: [], onSaved: noop },
} satisfies Meta<typeof StakeholderFormDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Add: Story = {};

export const Edit: Story = { args: { stakeholder: fixtureStakeholder() } };

export const LockedPortfolioEmail: Story = {
  args: { stakeholder: fixtureStakeholder({ portfolioEmailLocked: true }) },
};
