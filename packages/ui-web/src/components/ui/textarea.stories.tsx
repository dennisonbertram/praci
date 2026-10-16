import type { Meta, StoryObj } from "@storybook/react-vite";
import { Textarea } from "./textarea";

const meta = {
  title: "UI/Textarea",
  component: Textarea,
  args: { placeholder: "Write a note", className: "w-80" },
} satisfies Meta<typeof Textarea>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithValue: Story = { args: { defaultValue: "Review the sample budget on Friday." } };

export const LongContent: Story = {
  args: {
    defaultValue: Array.from(
      { length: 8 },
      (_, i) => `Line ${i + 1}: a longer sample sentence that wraps inside the field.`,
    ).join("\n"),
  },
};

export const Disabled: Story = { args: { disabled: true, defaultValue: "Not editable" } };

export const Invalid: Story = { args: { "aria-invalid": true, defaultValue: "Needs a fix" } };
