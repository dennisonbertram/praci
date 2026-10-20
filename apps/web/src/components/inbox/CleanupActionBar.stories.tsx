import type { Meta, StoryObj } from "@storybook/react-vite";
import { CleanupActionBar } from "./CleanupActionBar";

const meta = {
  title: "Inbox/CleanupActionBar",
  component: CleanupActionBar,
  args: {
    counts: { archive: 31, unsubscribe: 26, skip_inbox: 31, spam: 31 },
    onApply: () => undefined,
  },
} satisfies Meta<typeof CleanupActionBar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A choice that touches nothing is disabled, such as Unsubscribe when no ticked sender has a link. */
export const SomeEmpty: Story = {
  args: { counts: { archive: 12, unsubscribe: 0, skip_inbox: 12, spam: 12 } },
};

/** Nothing ticked. */
export const NothingTicked: Story = {
  args: { counts: { archive: 0, unsubscribe: 0, skip_inbox: 0, spam: 0 } },
};

/** An action is running. */
export const Busy: Story = { args: { busy: true } };
