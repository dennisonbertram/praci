import { vestingEvents, vestingRuleOf } from "@rakazo/core/equity";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { VestingChart } from "./VestingChart";

const FOUR_YEARS = 48_000n;

/** A 4 year monthly grant with a 1 year cliff. */
const monthlyWithCliff = () =>
  vestingEvents(
    vestingRuleOf({
      startDate: "2022-03-01",
      totalMonths: 48,
      cliffMonths: 12,
      frequencyMonths: 1,
    }),
    FOUR_YEARS,
  );

/** Custom tranches: nothing before the 1 year mark, then uneven chunks. */
const tranches = () =>
  vestingEvents(
    vestingRuleOf({
      startDate: "2023-06-15",
      totalMonths: 48,
      cliffMonths: 0,
      frequencyMonths: 0,
      tranches: [
        { monthOffset: 12, percent: "25" },
        { monthOffset: 24, percent: "25" },
        { monthOffset: 36, percent: "25" },
        { monthOffset: 48, percent: "25" },
      ],
    }),
    FOUR_YEARS,
  );

/** A grant whose vesting was stopped part way, so the schedule ends early. */
const stoppedEarly = () =>
  vestingEvents(
    vestingRuleOf({
      startDate: "2023-01-01",
      totalMonths: 48,
      cliffMonths: 0,
      frequencyMonths: 1,
      stoppedOn: "2024-07-31",
    }),
    FOUR_YEARS,
  );

const meta = {
  title: "Cap table/Options/VestingChart",
  component: VestingChart,
  args: { events: monthlyWithCliff(), total: FOUR_YEARS, asOf: "2024-01-15" },
} satisfies Meta<typeof VestingChart>;
export default meta;
type Story = StoryObj<typeof meta>;

export const OneYearCliffMonthly: Story = {};

export const CustomTranches: Story = {
  args: { events: tranches(), asOf: "2025-06-30" },
};

export const StoppedEarly: Story = {
  args: { events: stoppedEarly(), asOf: "2024-03-01" },
};

export const BeforeFirstVesting: Story = {
  args: { events: monthlyWithCliff(), asOf: "2022-06-01" },
};
