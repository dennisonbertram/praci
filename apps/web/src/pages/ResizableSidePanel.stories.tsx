import type { Meta, StoryObj } from "@storybook/react-vite";
import { ResizableSidePanel } from "./ResizableSidePanel";

const meta = {
  title: "Shell/Resizable side panel",
  component: ResizableSidePanel,
  parameters: { layout: "fullscreen" },
  args: { open: true, panel: "page", botsSidebarCollapsed: true },
  decorators: [
    (Story) => (
      <div className="relative flex h-[420px] w-full overflow-hidden">
        <div className="flex-1 p-4 text-sm text-muted-foreground">Main content</div>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ResizableSidePanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Open: Story = {
  args: {
    children: <div className="p-4 text-sm">Panel content. Drag the left edge to resize.</div>,
  },
};

export const Closed: Story = {
  args: { open: false, children: <div className="p-4 text-sm">Hidden content</div> },
};

export const WithBotsSidebar: Story = {
  args: {
    botsSidebarCollapsed: false,
    children: <div className="p-4 text-sm">Leaves room for the bots sidebar.</div>,
  },
};
