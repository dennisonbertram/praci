import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { RecipientField } from "./RecipientField";

const meta = {
  title: "Inbox/RecipientField",
  component: RecipientField,
  args: { label: "To", entries: [], onChange: () => undefined },
  render: (args) => {
    const [entries, setEntries] = useState(args.entries);
    return (
      <div className="w-96 rounded-md border border-border p-2">
        <RecipientField {...args} entries={entries} onChange={setEntries} />
      </div>
    );
  },
} satisfies Meta<typeof RecipientField>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const WithRecipients: Story = {
  args: { entries: ["Sam Example <sam@example.com>", "robin@example.com"] },
};

export const WithInvalidAddress: Story = {
  args: { entries: ["sam@example.com", "not-an-address"] },
};

export const ManyRecipients: Story = {
  args: {
    entries: Array.from({ length: 12 }, (_, i) => `person${i + 1}@example.com`),
  },
};

export const WithTrailing: Story = {
  args: {
    entries: ["sam@example.com"],
    trailing: <button type="button">Cc</button>,
  },
};

export const Disabled: Story = {
  args: { entries: ["sam@example.com"], disabled: true },
};
