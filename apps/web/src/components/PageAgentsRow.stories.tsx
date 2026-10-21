import type { Meta, StoryObj } from "@storybook/react-vite";
import { PageAgentsRow } from "./PageAgentsRow";

const meta = {
  title: "Shell/Page agents row",
  component: PageAgentsRow,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="flex w-72 flex-col">
        <Story />
      </div>
    ),
  ],
  args: { open: false, count: 8, needsYou: false, onToggle: () => {} },
} satisfies Meta<typeof PageAgentsRow>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Folded: Story = {};
export const FoldedNeedsYou: Story = { args: { needsYou: true } };
export const Open: Story = { args: { open: true } };
