import { Button } from "@rakazo/ui-web";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { CapTableEmptyState } from "./CapTableEmptyState";

const meta = {
  title: "Cap table/Shell/EmptyState",
  component: CapTableEmptyState,
  decorators: [
    (Story) => (
      <div className="w-full max-w-xl">
        <Story />
      </div>
    ),
  ],
  args: { message: "No stakeholders yet" },
} satisfies Meta<typeof CapTableEmptyState>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A tab with nothing in it, and no action: there is nothing to do from here yet. */
export const Default: Story = {};

/** The one action that fills the tab. */
export const WithAction: Story = {
  args: {
    message: "No cap table yet",
    action: <Button size="sm">Copy from current cap table</Button>,
  },
};
