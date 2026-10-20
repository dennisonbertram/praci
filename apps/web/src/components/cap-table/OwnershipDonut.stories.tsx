import type { Meta, StoryObj } from "@storybook/react-vite";
import { withVisibleRoot } from "../../stories/decorators";
import { OwnershipDonut } from "./OwnershipDonut";

const classes = [
  { name: "Common", shares: 5_800_000 },
  { name: "Series Seed Preferred", shares: 1_600_000 },
  { name: "Series A Preferred", shares: 1_400_000 },
  { name: "Warrants", shares: 300_000 },
];

const meta = {
  title: "Cap table/OwnershipDonut",
  component: OwnershipDonut,
  decorators: [
    (Story) => (
      <div className="@container w-full text-foreground">
        <Story />
      </div>
    ),
  ],
  args: { classes, fullyDilutedShares: 11_200_000 },
} satisfies Meta<typeof OwnershipDonut>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Five classes and the shares no class holds, so the legend adds up to the centre. */
export const Default: Story = {};

/** A tiny class stays visible without changing its numbers. */
export const TinyClass: Story = {
  args: {
    classes: [
      { name: "Common", shares: 9_934_000 },
      { name: "Series Seed Preferred", shares: 66_000 },
    ],
    fullyDilutedShares: 10_000_000,
  },
};

export const SingleClass: Story = {
  args: { classes: [{ name: "Common", shares: 8_000_000 }], fullyDilutedShares: 8_000_000 },
};

/** Nothing renders until Carta has reported a class. */
export const Empty: Story = {
  args: { classes: [], fullyDilutedShares: null },
  decorators: [withVisibleRoot("No ownership card")],
};

/** Classes past the sixth are merged into Other. */
export const ManyClasses: Story = {
  args: {
    classes: [
      ...classes,
      { name: "Series B Preferred", shares: 700_000 },
      { name: "Notes", shares: 200_000 },
      { name: "SAFE", shares: 100_000 },
    ],
    fullyDilutedShares: 12_000_000,
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
