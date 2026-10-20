import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { FolderHeader } from "./FolderHeader";

const meta = {
  title: "Shell/Sidebar folders/Folder header",
  component: FolderHeader,
  args: {
    id: "folder_apps",
    name: "Apps",
    count: 4,
    collapsed: false,
    editing: false,
    onToggle: fn(),
    onStartRename: fn(),
    onRename: fn(),
    onCancelRename: fn(),
    onDelete: fn(),
  },
  decorators: [
    (Story) => (
      <div className="w-[316px] bg-sidebar p-2">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FolderHeader>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Expanded: Story = {};

/** Closed, but the most urgent status inside still shows. */
export const CollapsedWithStatus: Story = { args: { collapsed: true, status: "needs_input" } };

export const CollapsedUnread: Story = { args: { collapsed: true, unread: true } };

export const Renaming: Story = { args: { editing: true, name: "Untitled folder" } };

/** A folder of another space opens and closes but has no menu and cannot be dragged. */
export const ReadOnly: Story = { args: { readOnly: true } };

export const LongName: Story = {
  args: { name: "A folder with a very long name that has to be cut off in the row" },
};
