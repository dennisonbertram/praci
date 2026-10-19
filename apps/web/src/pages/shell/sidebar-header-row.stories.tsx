import type { Meta, StoryObj } from "@storybook/react-vite";
import { SidebarHeaderRow } from "./sidebar-header-row";

const meta = {
  title: "Shell/Sidebar header row",
  component: SidebarHeaderRow,
  args: {
    search: (
      <input
        aria-label="Search"
        placeholder="Search"
        className="app-no-drag min-w-0 flex-1 rounded-xl border border-border bg-card px-3 py-1.5"
      />
    ),
    actions: <button type="button">+</button>,
  },
  decorators: [
    (Story) => (
      <div className="w-[316px] bg-sidebar">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SidebarHeaderRow>;
export default meta;

type Story = StoryObj<typeof meta>;

/** In a browser there are no window controls: Search and the buttons share the row. */
export const Web: Story = {};
