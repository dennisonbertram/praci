import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockSections } from "../stories/fixtures-6";
import { BotContextMenu } from "./BotContextMenu";

const noop = () => {};

const meta = {
  title: "Shell/Bot context menu",
  component: BotContextMenu,
  parameters: { layout: "fullscreen" },
  args: {
    bot: { name: "Ada", pinned: false, sectionId: null, unread: false },
    position: { x: 40, y: 40 },
    sections: mockSections,
    onClose: noop,
    onTogglePinned: noop,
    onMoveToSection: noop,
    onCreateSection: noop,
    onRenameSection: noop,
    onToggleUnread: noop,
    onEdit: noop,
    onDuplicate: noop,
    onClear: noop,
    onArchive: noop,
    onDelete: noop,
  },
  decorators: [
    (Story) => (
      <div className="h-[460px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BotContextMenu>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const PinnedAndUnread: Story = {
  args: { bot: { name: "Ada", pinned: true, sectionId: "sec_one", unread: true } },
};

export const NoSections: Story = { args: { sections: [] } };
