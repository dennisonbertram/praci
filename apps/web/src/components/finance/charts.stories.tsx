import type { CashPoint } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { BurnLines, Chart, LineChart, MonthBars, StackBar } from "./charts";

const meta = {
  title: "Finance/Charts",
  parameters: {
    docs: {
      description: {
        component: "Also shows: Grid (axis lines inside LineChart, BurnLines, MonthBars)",
      },
    },
  },
  decorators: [
    (Story) => (
      <div className="w-[560px] max-w-full text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const months = ["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"];
const burn: CashPoint[] = months.map((m, i) => ({
  start: `${m}-01`,
  end: `${m}-28`,
  outCents: 400_000 + i * 60_000,
  revenueCents: i % 2 ? 250_000 : 0,
  financingCents: i === 2 ? 500_000 : 0,
  partial: i === months.length - 1,
}));

export const ChartFrame: Story = {
  render: () => (
    <Chart height={80} label="Frame">
      {(width) => <rect x={0} y={0} width={width} height={80} className="fill-muted" />}
    </Chart>
  ),
};

export const Line: Story = {
  render: () => (
    <LineChart
      height={200}
      label="Cash balance"
      values={[900_000, 820_000, 760_000, 640_000, 590_000, 480_000]}
      labels={["Jan", "Feb", "Mar", "Apr", "May", "Jun"]}
    />
  ),
};

export const LineProjectionToZero: Story = {
  render: () => (
    <LineChart
      height={200}
      label="Runway"
      values={[900_000, 700_000, 500_000, 300_000, 100_000, 0]}
      labels={["Jan", "Feb", "Mar", "Apr", "May", "Jun"]}
      solidUntil={2}
      endMarker
    />
  ),
};

export const LineBare: Story = {
  render: () => (
    <LineChart height={60} label="Trend" axes={false} values={[3, 5, 4, 8, 6]} labels={[]} />
  ),
};

export const LineEmpty: Story = {
  render: () => <LineChart height={120} label="Empty" values={[]} labels={[]} />,
};

export const Burn: Story = {
  render: () => <BurnLines series={burn} label="Cash out by month" onOpen={() => undefined} />,
};

export const BurnEmpty: Story = {
  render: () => <BurnLines series={[]} label="Cash out by month" onOpen={() => undefined} />,
};

const dayCents = [
  12_000, 8_500, 0, 21_000, 6_000, 14_500, 9_000, 18_000, 7_500, 700_000, 11_000, 5_000, 16_500,
  9_500, 0, 13_000, 8_000, 22_000, 6_500,
];

export const BurnDays: Story = {
  render: () => (
    <BurnLines
      granularity="day"
      label="Cash out by day"
      onOpen={() => undefined}
      series={dayCents.map((outCents, i) => ({
        start: `2026-10-${String(i + 1).padStart(2, "0")}`,
        end: `2026-10-${String(i + 1).padStart(2, "0")}`,
        outCents,
        revenueCents: i === 4 || i === 12 ? 40_000 : 0,
        financingCents: i === 6 ? 300_000 : 0,
        partial: i === dayCents.length - 1,
      }))}
    />
  ),
};

export const BurnWeeks: Story = {
  render: () => (
    <BurnLines
      granularity="week"
      label="Cash out by week"
      onOpen={() => undefined}
      series={Array.from({ length: 8 }, (_, i) => ({
        start: `2026-05-${String(4 + i * 7).padStart(2, "0")}`,
        end: `2026-05-${String(10 + i * 7).padStart(2, "0")}`,
        outCents: 90_000 + i * 20_000,
        revenueCents: i % 3 === 0 ? 60_000 : 0,
        financingCents: 0,
        partial: false,
      }))}
    />
  ),
};

export const Months: Story = {
  render: () => (
    <MonthBars
      label="Spend by month"
      items={months.map((m, i) => ({ label: m.slice(5), cents: 120_000 + i * 45_000 }))}
    />
  ),
};

export const Stack: Story = {
  render: () => (
    <StackBar
      label="Spend by category"
      onOpen={() => undefined}
      segments={[
        { key: "a", label: "Software", cents: 500_000 },
        { key: "b", label: "Travel", cents: 300_000 },
        { key: "c", label: "Meals", cents: 150_000 },
        { key: "d", label: "Other", cents: 50_000 },
      ]}
    />
  ),
};

export const StackEmpty: Story = {
  render: () => <StackBar label="Spend by category" onOpen={() => undefined} segments={[]} />,
};
