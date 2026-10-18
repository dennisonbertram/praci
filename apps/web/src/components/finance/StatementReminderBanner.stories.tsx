import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatementReminderBanner } from "./StatementReminderBanner";

const meta = {
  title: "Finance/StatementReminderBanner",
  component: StatementReminderBanner,
  parameters: { layout: "padded" },
  args: { onUpload: () => {} },
} satisfies Meta<typeof StatementReminderBanner>;
export default meta;
type Story = StoryObj<typeof meta>;

const one = {
  accountId: "acct_1",
  accountName: "Sample checking",
  coveredThrough: "2026-08-31",
  dueFor: "2026-09-30",
};

export const Single: Story = { args: { reminders: [one] } };

export const Several: Story = {
  args: {
    reminders: [
      one,
      { ...one, accountId: "acct_2", accountName: "Sample savings" },
      { ...one, accountId: "acct_3", accountName: "Sample card" },
    ],
  },
};

/** A cycle that ends mid-month names its end day, not the month that is not over yet. */
export const MidMonthCycle: Story = {
  args: { reminders: [{ ...one, coveredThrough: "2026-09-07", dueFor: "2026-10-07" }] },
};

export const LongName: Story = {
  args: {
    reminders: [
      { ...one, accountName: "Sample business checking account with a very long display name" },
    ],
  },
};
