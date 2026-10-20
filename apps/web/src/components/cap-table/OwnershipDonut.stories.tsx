import type { Meta, StoryObj } from "@storybook/react-vite";
import { OwnershipDonut } from "./OwnershipDonut";

const classes = [
  { name: "Common", shares: 5_800_000 },
  { name: "Series Seed Preferred", shares: 1_600_000 },
  { name: "Series A Preferred", shares: 1_400_000 },
  { name: "Options", shares: 900_000 },
  { name: "SAFE", shares: 300_000 },
];

const meta = {
  title: "Cap table/OwnershipDonut",
  component: OwnershipDonut,
  decorators: [
    (Story) => (
      <div className="@container w-[720px] max-w-full text-foreground">
        <Story />
      </div>
    ),
  ],
  args: { classes, fullyDilutedShares: 10_000_000 },
} satisfies Meta<typeof OwnershipDonut>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Classes past the sixth are merged into Other. */
export const ManyClasses: Story = {
  args: {
    classes: [
      ...classes,
      { name: "Series B Preferred", shares: 700_000 },
      { name: "Warrants", shares: 200_000 },
      { name: "Notes", shares: 100_000 },
    ],
  },
};

export const Selectable: Story = {
  args: { selectable: ["Common", "Series A Preferred"], onSelect: () => {} },
};

export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="@container w-[343px] text-foreground">
        <Story />
      </div>
    ),
  ],
};
