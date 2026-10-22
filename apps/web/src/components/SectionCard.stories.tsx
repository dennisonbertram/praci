import { Button } from "@rakazo/ui-web";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { SectionCard } from "./SectionCard";

const meta = {
  title: "Layout/SectionCard",
  component: SectionCard,
  decorators: [
    (Story) => (
      <div className="w-full max-w-3xl">
        <Story />
      </div>
    ),
  ],
  args: { title: "Updates", children: <p className="text-sm">Section content.</p> },
} satisfies Meta<typeof SectionCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithActions: Story = {
  args: {
    actions: (
      <Button variant="outline" size="sm">
        New update
      </Button>
    ),
  },
};

/** Outlined in ink: what needs the founder. */
export const Attention: Story = { args: { title: "Action items", attention: true } };
