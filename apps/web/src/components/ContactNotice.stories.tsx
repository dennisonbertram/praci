import type { Meta, StoryObj } from "@storybook/react-vite";
import { ContactNotice } from "./ContactNotice";

const meta = {
  title: "Components/ContactNotice",
  component: ContactNotice,
  args: { onDismiss: () => {} },
} satisfies Meta<typeof ContactNotice>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Saved: Story = { args: { notice: { text: "Saved Ada Example" } } };
export const DeletedWithUndo: Story = {
  args: { notice: { text: "Deleted Ada Example", undo: () => {} } },
};
export const RestoreFailed: Story = {
  args: {
    notice: {
      text: "Could not restore Ada Example: Another contact already has this email. If you dismiss this, Ada Example stays deleted.",
      undo: () => {},
      failed: true,
    },
  },
};
