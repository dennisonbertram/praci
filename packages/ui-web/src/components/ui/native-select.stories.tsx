import type { Meta, StoryObj } from "@storybook/react-vite";
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "./native-select";

const meta = {
  title: "UI/NativeSelect",
  component: NativeSelect,
  args: { "aria-label": "Region", defaultValue: "north" },
  render: (args) => (
    <NativeSelect {...args}>
      <NativeSelectOption value="north">North</NativeSelectOption>
      <NativeSelectOption value="south">South</NativeSelectOption>
      <NativeSelectOption value="east">East</NativeSelectOption>
    </NativeSelect>
  ),
  parameters: {
    docs: {
      description: { component: "Also shows: NativeSelectOption, NativeSelectOptGroup" },
    },
  },
} satisfies Meta<typeof NativeSelect>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Small: Story = { args: { size: "sm" } };
export const Disabled: Story = { args: { disabled: true } };
export const Invalid: Story = { args: { "aria-invalid": true } };

export const Grouped: Story = {
  render: (args) => (
    <NativeSelect {...args} defaultValue="oak">
      <NativeSelectOptGroup label="Trees">
        <NativeSelectOption value="oak">Oak</NativeSelectOption>
        <NativeSelectOption value="pine">Pine</NativeSelectOption>
      </NativeSelectOptGroup>
      <NativeSelectOptGroup label="Shrubs">
        <NativeSelectOption value="holly">Holly</NativeSelectOption>
      </NativeSelectOptGroup>
    </NativeSelect>
  ),
};
