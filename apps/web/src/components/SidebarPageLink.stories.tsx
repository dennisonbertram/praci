import type { Meta, StoryObj } from "@storybook/react-vite";
import { Mail } from "lucide-react";
import { SidebarPageLink } from "./SidebarPageLink";

const meta = {
  title: "Shell/Sidebar page link",
  component: SidebarPageLink,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="flex w-72 flex-col">
        <Story />
      </div>
    ),
  ],
  args: {
    testId: "sidebar-page",
    current: false,
    icon: <Mail size={15} strokeWidth={1.8} aria-hidden="true" />,
    label: "Inbox",
    onOpen: () => {},
  },
} satisfies Meta<typeof SidebarPageLink>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Current: Story = { args: { current: true } };
