import type { Meta, StoryObj } from "@storybook/react-vite";
import { ContactNotice } from "./ContactNotice";

const meta = { title: "Components/ContactNotice", component: ContactNotice } satisfies Meta<
  typeof ContactNotice
>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Saved: Story = {
  args: { notice: { text: "Saved Ada Lovelace" }, onDismiss: () => {} },
};
export const DeletedWithUndo: Story = {
  args: { notice: { text: "Deleted Ada Lovelace", undo: () => {} }, onDismiss: () => {} },
};
export const RestoreFailed: Story = {
  args: {
    notice: { text: "Could not restore Ada Lovelace: offline.", undo: () => {}, failed: true },
    onDismiss: () => {},
  },
};
