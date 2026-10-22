import type { Meta, StoryObj } from "@storybook/react-vite";
import { InboxPileTabs } from "./InboxPileTabs";

const counts = { important: 6, updates: 14, newsletters: 31, spam: 0 };

const meta = {
  title: "Inbox/InboxPileTabs",
  component: InboxPileTabs,
  args: { value: "important", counts, onChange: () => undefined },
} satisfies Meta<typeof InboxPileTabs>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Spam shows its count only when there is spam. */
export const WithSpamCount: Story = { args: { counts: { ...counts, spam: 12 } } };

/** The open Spam pile keeps its tab after the last spam is cleared. */
export const SpamActive: Story = {
  args: { value: "spam", counts: { ...counts, spam: 0 } },
};

/** A Gmail filter, search or category is open, so no pile is selected. */
export const NoPileSelected: Story = { args: { value: undefined } };
