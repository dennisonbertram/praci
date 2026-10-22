import type { CronPreset } from "@rakazo/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { RoutineSchedule } from "./RoutineSchedule";

function Editable({ initial }: { initial: CronPreset }) {
  const [value, setValue] = useState(initial);
  return <RoutineSchedule value={value} onChange={setValue} />;
}

const preset = (patch: Partial<CronPreset>): CronPreset => ({
  freq: "Every day",
  n: 3,
  unit: "minutes",
  time: "9:00 AM",
  cron: "",
  weekday: 1,
  ...patch,
});

const meta = {
  title: "Shell/RoutineSchedule",
  component: RoutineSchedule,
  args: { value: preset({}), onChange: () => undefined },
  render: (args) => <Editable initial={args.value} />,
} satisfies Meta<typeof RoutineSchedule>;
export default meta;
type Story = StoryObj<typeof meta>;

export const EveryDay: Story = {};
export const EveryHour: Story = { args: { value: preset({ freq: "Every hour" }) } };
export const Weekdays: Story = { args: { value: preset({ freq: "Weekdays", time: "7:30 AM" }) } };
export const Interval: Story = {
  args: { value: preset({ freq: "Interval", n: 15, unit: "minutes" }) },
};
export const Advanced: Story = {
  args: { value: preset({ freq: "Advanced", cron: "0 9 * * 1-5" }) },
};
export const EveryWeekFriday: Story = {
  args: { value: preset({ freq: "Every week", weekday: 5 }) },
};
export const EveryMonth: Story = {
  args: { value: preset({ freq: "Every month" }) },
};
