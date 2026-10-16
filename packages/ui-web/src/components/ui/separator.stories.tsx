import type { Meta, StoryObj } from "@storybook/react-vite";
import { Separator } from "./separator";

const meta = { title: "UI/Separator", component: Separator } satisfies Meta<typeof Separator>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  render: (args) => (
    <div className="w-64 text-sm">
      <div>Above</div>
      <Separator {...args} className="my-2" />
      <div>Below</div>
    </div>
  ),
};

export const Vertical: Story = {
  args: { orientation: "vertical" },
  render: (args) => (
    <div className="flex h-6 items-center gap-3 text-sm">
      <span>Left</span>
      <Separator {...args} />
      <span>Right</span>
    </div>
  ),
};
