import type { Meta, StoryObj } from "@storybook/react-vite";
import { Toggle } from "./toggle";

const meta = {
  title: "UI/Toggle",
  component: Toggle,
  args: { children: "Bold", "aria-label": "Bold" },
} satisfies Meta<typeof Toggle>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Pressed: Story = { args: { defaultPressed: true } };

export const Outline: Story = { args: { variant: "outline" } };

export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-center gap-2">
      {(["sm", "default", "lg"] as const).map((s) => (
        <Toggle key={s} {...args} size={s}>
          {s}
        </Toggle>
      ))}
    </div>
  ),
};

export const Disabled: Story = { args: { disabled: true } };
