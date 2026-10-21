import type { Meta, StoryObj } from "@storybook/react-vite";
import { OwnershipBar } from "./OwnershipBar";

const meta = {
  title: "Cap table/OwnershipBar",
  component: OwnershipBar,
  decorators: [
    (Story) => (
      <div className="w-full max-w-xl text-foreground">
        <Story />
      </div>
    ),
  ],
  args: {
    classes: [
      { name: "Common", percent: 61 },
      { name: "Seed Preferred", percent: 20 },
      { name: "Option", percent: 11 },
    ],
    pool: 8,
  },
} satisfies Meta<typeof OwnershipBar>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Three classes and the hatched pool, summing to 100.0. */
export const Default: Story = {};

/** More than four classes: the smallest share the last tone as Other. */
export const ManyClasses: Story = {
  args: {
    classes: [
      { name: "Common", percent: 50 },
      { name: "Seed Preferred", percent: 20 },
      { name: "Series A Preferred", percent: 12.5 },
      { name: "Option", percent: 7.5 },
      { name: "Warrants", percent: 5 },
    ],
    pool: 5,
  },
};

export const NoPool: Story = { args: { classes: [{ name: "Common", percent: 100 }], pool: null } };
