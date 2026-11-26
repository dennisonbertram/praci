import { DropdownMenuCheckboxItem, DropdownMenuItem } from "@rakazo/ui-web";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { PageAgentsRow } from "./PageAgentsRow";

const meta = {
  title: "Shell/Page agents row",
  component: PageAgentsRow,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="flex w-72 flex-col">
        <Story />
      </div>
    ),
  ],
  args: { open: false, count: 8, needsYou: false, onToggle: () => {} },
} satisfies Meta<typeof PageAgentsRow>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Folded: Story = {};
export const FoldedNeedsYou: Story = { args: { needsYou: true } };
export const Open: Story = { args: { open: true } };
export const EmailChats: Story = { args: { label: "Email chats", count: 5 } };

/** Hover the row or focus the "…" button to open the menu. */
export const WithMenu: Story = {
  args: {
    actions: (
      <>
        <DropdownMenuItem>New page</DropdownMenuItem>
        <DropdownMenuCheckboxItem checked>Show unused page agents</DropdownMenuCheckboxItem>
        <DropdownMenuItem disabled>Mark all read</DropdownMenuItem>
      </>
    ),
  },
};
export const EmailChatsWithMenu: Story = {
  args: {
    label: "Email chats",
    count: 5,
    actions: (
      <>
        <DropdownMenuItem>Mark all read</DropdownMenuItem>
        <DropdownMenuItem>Archive all email chats</DropdownMenuItem>
      </>
    ),
  },
};
