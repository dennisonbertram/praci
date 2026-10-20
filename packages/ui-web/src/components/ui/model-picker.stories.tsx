import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { ModelPicker } from "./model-picker";

const options = Array.from({ length: 387 }, (_, index) => ({
  value: `sample-${index % 3}:model-${index}`,
  id: `model-${index}`,
  label: `Sample model ${index}`,
  provider: `sample-${index % 3}`,
  providerName: `Sample provider ${(index % 3) + 1}`,
}));

const meta = {
  title: "UI/Model picker",
  component: ModelPicker,
  args: {
    options,
    value: options[200]!.value,
    onChange: () => undefined,
    label: "Model",
    searchLabel: "Search models",
    emptyLabel: "No matching models",
    loadingLabel: "Loading models…",
  },
  render: (args) => {
    const [value, setValue] = useState(args.value);
    return (
      <div className="w-full max-w-sm">
        <ModelPicker {...args} value={value} onChange={setValue} />
      </div>
    );
  },
} satisfies Meta<typeof ModelPicker>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Catalog: Story = {};
export const Loading: Story = { args: { loading: true, options: [], value: "" } };
export const Empty: Story = { args: { options: [], value: "" } };
export const UnlistedCurrentModel: Story = { args: { value: "saved-provider:custom-model" } };
export const CustomEmbeddingModel: Story = {
  args: {
    options: [{ value: "", label: "Default" }],
    value: "sample-embedding",
    allowCustom: true,
  },
};
