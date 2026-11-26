import type { Meta, StoryObj } from "@storybook/react-vite";
import { BrexOverview } from "./BrexOverview";
import { emptySankeyFixture, overviewFixture } from "./fixtures";

const meta = {
  title: "Brex/Overview",
  component: BrexOverview,
  decorators: [
    (Story) => (
      <div className="w-[880px] max-w-full text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BrexOverview>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = { args: { data: overviewFixture } };

export const Partial: Story = {
  args: {
    data: {
      ...overviewFixture,
      partial: true,
      cardSpend: { ...overviewFixture.cardSpend, partial: true },
      nearLimit: { ...overviewFixture.nearLimit, partial: true },
      sankey: { ...overviewFixture.sankey, partial: true },
    },
  },
};

export const Empty: Story = {
  args: {
    data: {
      ...overviewFixture,
      cardSpend: {
        ...overviewFixture.cardSpend,
        monthToDateCents: 0,
        previousMonthToDateCents: 0,
        changePercent: null,
        sparkline: [],
      },
      cards: { active: 0, locked: 0, terminated: 0 },
      nearLimit: { partial: false, count: 0, items: [] },
      sankey: emptySankeyFixture,
      topVendors: [],
    },
  },
};
