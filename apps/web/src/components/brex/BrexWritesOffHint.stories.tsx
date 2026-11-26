import { Button } from "@rakazo/ui-web";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { BrexWritesOffHint } from "./BrexWritesOffHint";

const meta = {
  title: "Brex/WritesOffHint",
  component: BrexWritesOffHint,
  decorators: [
    (Story) => (
      <div className="p-16 text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BrexWritesOffHint>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Hover or Tab to the disabled button to read why. */
export const WritesOff: Story = {
  args: {
    writesOff: true,
    children: (
      <Button size="sm" disabled>
        Edit memo
      </Button>
    ),
  },
};

export const WritesOn: Story = {
  args: { writesOff: false, children: <Button size="sm">Edit memo</Button> },
};
