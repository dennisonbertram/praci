import type { Meta, StoryObj } from "@storybook/react-vite";
import { withVisibleRoot } from "../../stories/decorators";
import { OwnershipDonut } from "./OwnershipDonut";

const classes = [
  { name: "Common", shares: 5_800_000 },
  { name: "Series Seed Preferred", shares: 1_600_000 },
  { name: "Series A Preferred", shares: 1_400_000 },
  { name: "Warrants", shares: 300_000 },
];

/** Invented holders. Common is held by many, so the tail merges into "Other holders". */
const holdings = [
  { name: "Ada Founder", security: "Common", shares: 2_400_000 },
  { name: "Ben Cofounder", security: "Common", shares: 1_800_000 },
  { name: "Cleo Advisor", security: "Common", shares: 600_000 },
  { name: "Dev Employee", security: "Common", shares: 400_000 },
  { name: "Eli Employee", security: "Common", shares: 300_000 },
  { name: "Fay Employee", security: "Common", shares: 200_000 },
  { name: "Gus Employee", security: "Common", shares: 100_000 },
  { name: "Example Seed Fund", security: "Series Seed Preferred", shares: 1_000_000 },
  { name: "Sample Angels", security: "Series Seed Preferred", shares: 600_000 },
  { name: "Placeholder Ventures", security: "Series A Preferred", shares: 1_400_000 },
  { name: "Hana Engineer", security: "Options", shares: 250_000 },
  { name: "Ivo Designer", security: "Options", shares: 150_000 },
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
  args: { classes, fullyDilutedShares: 10_200_000, holdings, optionPoolAvailable: 700_000 },
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

/** Click a slice or legend row: the donut steps aside, turned toward the holder breakdown. Warrants have no holders, so they stay plain. */
export const BreakdownOpen: Story = {
  play: async ({ canvasElement }) => {
    const row = canvasElement.querySelector<HTMLElement>("button[aria-label^='Show Common']");
    row?.click();
  },
};

export const BreakdownOptionsAndPool: Story = {
  play: async ({ canvasElement }) => {
    canvasElement
      .querySelector<HTMLElement>("button[aria-label^='Show Options and pool']")
      ?.click();
  },
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

export const NarrowBreakdown: Story = {
  ...Narrow,
  play: BreakdownOpen.play,
};

export const ReducedMotion: Story = {
  parameters: { reducedMotion: true },
  decorators: [
    (Story) => {
      window.matchMedia = ((query: string) => ({
        matches: query.includes("reduce"),
        media: query,
        addEventListener() {},
        removeEventListener() {},
      })) as unknown as typeof window.matchMedia;
      return <Story />;
    },
  ],
  play: BreakdownOpen.play,
};
