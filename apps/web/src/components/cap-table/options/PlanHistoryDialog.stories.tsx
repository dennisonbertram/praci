import type { Meta, StoryObj } from "@storybook/react-vite";
import { withPageBehind } from "../../../stories/decorators";
import { PlanHistoryDialog } from "./PlanHistoryDialog";
import { demoPlanPool } from "./plan-pool-fixture";

const pool = demoPlanPool({
  increases: [
    { date: "2024-03-04", shares: "600000", note: "Initial reserve" },
    { date: "2025-06-18", shares: "250000", note: "Board approved top-up" },
    { date: "2026-01-09", shares: "150000", note: null },
  ],
});

const meta = {
  title: "Cap table/Options/PlanHistoryDialog",
  component: PlanHistoryDialog,
  decorators: [withPageBehind()],
  args: { pool, onClose: () => {} },
} satisfies Meta<typeof PlanHistoryDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithIncreases: Story = {};

export const NoIncreases: Story = { args: { pool: demoPlanPool({ increases: [] }) } };
