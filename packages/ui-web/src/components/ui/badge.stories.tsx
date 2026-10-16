import type { Meta, StoryObj } from "@storybook/react-vite";
import { Badge } from "./badge";

const meta = { title: "UI/Badge", component: Badge, args: { children: "Badge" } } satisfies Meta<
  typeof Badge
>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Variants: Story = {
  render: (args) => (
    <div className="flex flex-wrap gap-2">
      {(["default", "secondary", "destructive", "outline", "ghost", "link"] as const).map((v) => (
        <Badge key={v} {...args} variant={v}>
          {v}
        </Badge>
      ))}
    </div>
  ),
};

export const LongContent: Story = {
  args: { children: "A badge with a much longer label than usual" },
  decorators: [
    (Story) => (
      <div className="w-40">
        <Story />
      </div>
    ),
  ],
};
