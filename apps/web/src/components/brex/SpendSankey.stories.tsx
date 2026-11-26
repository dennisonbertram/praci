import type { Meta, StoryObj } from "@storybook/react-vite";
import { emptySankeyFixture, oneCategorySankeyFixture, sankeyFixture } from "./fixtures";
import { SpendSankey } from "./SpendSankey";

const meta = {
  title: "Brex/SpendSankey",
  component: SpendSankey,
  decorators: [
    (Story) => (
      <div className="w-[720px] max-w-full text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SpendSankey>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = { args: { data: sankeyFixture } };
export const OneCategory: Story = { args: { data: oneCategorySankeyFixture } };
export const Empty: Story = { args: { data: emptySankeyFixture } };
