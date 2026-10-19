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

/** In the icon rail the window controls move to the page header and only a search button remains. */
export const Rail: Story = {
  args: {
    rail: true,
    search: (
      <button type="button" aria-label="Search" className="mx-auto size-9 rounded-xl">
        S
      </button>
    ),
    actions: null,
  },
  decorators: [
    (Story) => (
      <div className="w-14 bg-sidebar">
        <Story />
      </div>
    ),
  ],
};
