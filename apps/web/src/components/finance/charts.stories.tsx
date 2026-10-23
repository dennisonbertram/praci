import type { CashPoint } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { BurnLines, Chart, LineChart, MonthBars } from "./charts";

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

/** A balance that never changes sits mid-chart instead of on the x axis. */
export const LineFlat: Story = {
  render: () => (
    <LineChart
      height={200}
      label="Cash balance"
      values={[115_000_000, 115_000_000, 115_000_000, 115_000_000, 115_000_000, 115_000_000]}
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

/** A raise two days before the right edge: its label hugs the edge instead of running past it. */
export const BurnFinancingNearEdge: Story = {
  render: () => (
    <BurnLines
      granularity="day"
      label="Cash out by day"
      onOpen={() => undefined}
      series={dayCents.map((outCents, i) => ({
        start: `2026-10-${String(i + 1).padStart(2, "0")}`,
        end: `2026-10-${String(i + 1).padStart(2, "0")}`,
        outCents,
        revenueCents: 0,
        financingCents: i === dayCents.length - 3 ? 25_000_000 : 0,
        partial: false,
      }))}
    />
  ),
};

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
/** Invented buckets: `count` of `months` months (0 for weeks) ending with the one holding 2026-10-14. */
const buckets = (count: number, months: number) =>
  Array.from({ length: count }, (_, i) => {
    const back = count - 1 - i;
    const start =
      months === 0
        ? Date.UTC(2026, 9, 12) - back * 7 * 86_400_000
        : Date.UTC(2026, 9 - months * back, 1);
    const end =
      months === 0
        ? start + 6 * 86_400_000
        : Date.UTC(new Date(start).getUTCFullYear(), new Date(start).getUTCMonth() + months, 0);
    return {
      start: iso(start),
      end: iso(end),
      outCents: 90_000 * Math.max(months, 1) + ((i * 53_000) % 70_000),
      revenueCents: i % 3 === 0 ? 60_000 : 0,
      financingCents: 0,
      partial: i === count - 1,
    };
  });

export const BurnWeeks: Story = {
  render: () => (
    <BurnLines
      granularity="week"
      label="Cash out by week"
      onOpen={() => undefined}
      series={buckets(12, 0)}
    />
  ),
};

export const BurnMonths: Story = {
  render: () => (
    <BurnLines
      granularity="month"
      label="Cash out by month"
      onOpen={() => undefined}
      series={buckets(12, 1)}
    />
  ),
};

export const BurnQuarters: Story = {
  render: () => (
    <BurnLines
      granularity="quarter"
      label="Cash out by quarter"
      onOpen={() => undefined}
      series={buckets(8, 3)}
    />
  ),
};

/** A raise inside the scale is named beside its ring, as in the month view. */
export const BurnQuartersFinancing: Story = {
  render: () => (
    <BurnLines
      granularity="quarter"
      label="Cash out by quarter"
      onOpen={() => undefined}
      series={buckets(4, 3).map((p, i) => ({ ...p, financingCents: i === 2 ? 150_000 : 0 }))}
    />
  ),
};

export const BurnYears: Story = {
  render: () => (
    <BurnLines
      granularity="year"
      label="Cash out by year"
      onOpen={() => undefined}
      series={buckets(2, 12)}
    />
  ),
};

/** One year of data: a single bar (hollow while the year runs), not two stray dots. */
export const BurnYearOne: Story = {
  render: () => (
    <BurnLines
      granularity="year"
      label="Cash out by year"
      onOpen={() => undefined}
      series={[
        {
          start: "2026-01-01",
          end: "2026-12-31",
          outCents: 9_000_000,
          revenueCents: 2_000_000,
          financingCents: 0,
          partial: true,
        },
      ]}
    />
  ),
};

/** A new account: three weeks of history stay at the left edge instead of spreading across the chart. */
export const BurnFewPoints: Story = {
  render: () => (
    <BurnLines
      granularity="week"
      label="Cash out by week"
      onOpen={() => undefined}
      series={buckets(3, 0)}
    />
  ),
};

export const BurnSinglePoint: Story = {
  render: () => (
    <BurnLines
      granularity="week"
      label="Cash out by week"
      onOpen={() => undefined}
      series={buckets(1, 0)}
    />
  ),
};

export const Months: Story = {
  render: () => (
    <MonthBars
      label="Spend by month"
      items={months.map((m, i) => ({
        label: m.slice(5),
        cents: 120_000 + i * 45_000,
        partial: i === months.length - 1,
      }))}
    />
  ),
};
