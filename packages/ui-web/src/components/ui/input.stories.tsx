import type { Meta, StoryObj } from "@storybook/react-vite";
import { Input } from "./input";

const meta: Meta<typeof Input> = {
  title: "UI/Input",
  component: Input,
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { placeholder: "Type here", "aria-label": "Example" } };
export const WithValue: Story = { args: { defaultValue: "Sample value", "aria-label": "Example" } };
export const Disabled: Story = {
  args: { disabled: true, defaultValue: "Disabled", "aria-label": "Example" },
};
export const Invalid: Story = {
  args: { "aria-invalid": true, defaultValue: "Bad value", "aria-label": "Example" },
};
export const LongContent: Story = {
  args: {
    defaultValue:
      "A very long value that is wider than the input and has to scroll horizontally inside it",
    "aria-label": "Example",
  },
};
export const File: Story = { args: { type: "file", "aria-label": "Example file" } };
