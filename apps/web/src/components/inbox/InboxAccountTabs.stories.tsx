import type { Meta, StoryObj } from "@storybook/react-vite";
import { InboxAccountTabs } from "./InboxAccountTabs";

const meta = {
  title: "Inbox/InboxAccountTabs",
  component: InboxAccountTabs,
  args: {
    accounts: [
      { connectionId: "c1", label: "Work", address: "ada@example.com" },
      { connectionId: "c2", label: "Studio", address: "ada@studio.example.com" },
    ],
    value: undefined,
    onChange: () => undefined,
  },
} satisfies Meta<typeof InboxAccountTabs>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const SecondAccount: Story = { args: { value: "c2" } };

/** Two accounts both named Gmail show their addresses instead. */
export const SameLabel: Story = {
  args: {
    accounts: [
      { connectionId: "c1", label: "Gmail", address: "ada@example.com" },
      {
        connectionId: "c2",
        label: "Gmail",
        address: "ada.lovelace.long.address@studio.example.com",
      },
    ],
  },
};
