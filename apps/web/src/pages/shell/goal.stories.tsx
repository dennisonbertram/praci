import type { ThreadGoal } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { GoalBlockView, GoalLine, GoalNotice } from "./goal";

const goal: ThreadGoal = {
  id: "goal-1",
  text: "Find three suppliers for ceramic mugs and list their prices in the work list",
  status: "active",
  stopReason: null,
  lastReason: null,
  continuations: 1,
  startedAt: "2026-01-01T00:00:00.000Z",
};

const meta = {
  title: "Shell/Goal",
  component: GoalLine,
  args: { goal, waiting: false, onClear: fn() },
  decorators: [
    (Story) => (
      <div className="max-w-xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof GoalLine>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Working: Story = {};
export const Paused: Story = { args: { goal: { ...goal, status: "paused" } } };
export const WaitingOnYou: Story = { args: { waiting: true } };
export const LongText: Story = {
  args: { goal: { ...goal, text: `${goal.text}. ${goal.text}. ${goal.text}.` } },
  play: async ({ canvasElement }) => {
    const toggle = within(canvasElement).getByRole("button", { expanded: false });
    await userEvent.click(toggle);
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  },
};
export const Clear: Story = {
  play: async ({ canvasElement, args }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Clear goal" }));
    await expect(args.onClear).toHaveBeenCalled();
  },
};

export const BlockMet: Story = {
  render: () => (
    <GoalBlockView
      block={{ kind: "goal", outcome: "met", reason: "Three suppliers found.", text: "Goal met." }}
    />
  ),
};
export const BlockMetWithEvidence: Story = {
  render: () => (
    <GoalBlockView
      block={{
        kind: "goal",
        outcome: "met",
        reason: "Three suppliers found and listed.",
        text: "Goal met. Three suppliers found and listed.",
        evidence: [
          { id: "r1.t1", text: 'web_search: {"title":"Northwind Ceramics","price":"$4.20"}' },
          { id: "r2.t1", text: "mail_search: 3 threads mention mug pricing" },
          { id: "r3.t1", text: "scratchpad_write: 3 rows added" },
        ],
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    const disclosure = within(canvasElement).getByText("Evidence · 3");
    await userEvent.click(disclosure);
    await expect(canvasElement.querySelector("details")).toHaveAttribute("open");
  },
};

export const BlockBlocked: Story = {
  render: () => (
    <GoalBlockView
      block={{
        kind: "goal",
        outcome: "blocked",
        reason: "Sign in to the supplier portal, then send a message.",
        text: "Goal blocked.",
      }}
    />
  ),
};
export const BlockStopped: Story = {
  render: () => (
    <GoalBlockView
      block={{ kind: "goal", outcome: "stopped", reason: "After 25 runs.", text: "Goal stopped." }}
    />
  ),
};

export const Notice: Story = {
  render: () => <GoalNotice message="No goal set." onDismiss={fn()} />,
};
