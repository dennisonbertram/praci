import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";

const meta = { title: "UI/Button", component: Button, args: { children: "Button" } } satisfies Meta<
  typeof Button
>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Variants: Story = {
  render: (args) => (
    <div className="flex flex-wrap gap-2">
      {(["default", "outline", "secondary", "ghost", "destructive", "link"] as const).map((v) => (
        <Button key={v} {...args} variant={v}>
          {v}
        </Button>
      ))}
    </div>
  ),
};

export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-2">
      {(["xs", "sm", "default", "lg"] as const).map((s) => (
        <Button key={s} {...args} size={s}>
          {s}
        </Button>
      ))}
    </div>
  ),
};
