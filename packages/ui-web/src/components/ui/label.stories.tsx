import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "./input";
import { Label } from "./label";

const meta = {
  title: "UI/Label",
  component: Label,
  parameters: { layout: "padded" },
} satisfies Meta<typeof Label>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { children: "Display name" } };

export const WithInput: Story = {
  render: () => (
    <div className="flex w-64 flex-col gap-2">
      <Label htmlFor="label-demo">Email</Label>
      <Input id="label-demo" placeholder="name@example.com" />
    </div>
  ),
};

export const DisabledPeer: Story = {
  render: () => (
    <div className="flex w-64 flex-col gap-2">
      <Input id="label-disabled" disabled className="peer order-2" />
      <Label htmlFor="label-disabled" className="order-1">
        Disabled field
      </Label>
    </div>
  ),
};
