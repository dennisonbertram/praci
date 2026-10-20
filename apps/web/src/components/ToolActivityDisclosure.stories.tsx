import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import {
  StandaloneToolActivity,
  ToolActivityDisclosure,
  ToolOnlyNarration,
  ToolSteps,
} from "./ToolActivityDisclosure";

const steps = [
  { label: "mcp__finance-brex__get_active_integration", count: 1 },
  { label: "mcp__finance-brex__get_banking_transactions", count: 3 },
  { label: "mail_search", count: 1 },
];

const manySteps = Array.from({ length: 10 }, (_, i) => ({
  label: `sample_tool_${i + 1}`,
  count: 1,
}));

const meta = {
  title: "Chat/Tool activity",
  component: ToolActivityDisclosure,
  args: { live: false, stepCount: 5, durationMs: 12_000, children: <ToolSteps steps={steps} /> },
  parameters: {
    docs: {
      description: {
        component: "Also shows: ToolSteps, StandaloneToolActivity, ToolOnlyNarration",
      },
    },
  },
} satisfies Meta<typeof ToolActivityDisclosure>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Done: Story = {};

export const DoneOpen: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByText(/Done/));
    await expect(within(canvasElement).getByText("Write summary.md")).toBeTruthy();
  },
};

export const DoneOneTool: Story = { args: { stepCount: 1, durationMs: undefined } };

export const Live: Story = {
  args: { live: true, stepCount: 3, children: <ToolSteps steps={steps} currentIndex={2} /> },
};

export const DoneWithMailDetails: Story = {
  args: {
    stepCount: 2,
    children: (
      <ToolSteps
        steps={[
          {
            label: "mail_search",
            count: 1,
            summary: "Searched mail · 23 found",
            lines: [
              { text: 'Searching mail: from Kevin · after Oct 1 · "pick a time"' },
              { text: "Found 23 messages" },
            ],
          },
          {
            label: "mail_get",
            count: 1,
            summary: "Read an email",
            lines: [{ text: 'Reading "Re: Justworks setup" from support@example.test' }],
          },
        ]}
      />
    ),
  },
};

export const StepsWithEarlierHidden: Story = {
  args: {
    live: true,
    stepCount: 10,
    children: <ToolSteps steps={manySteps} currentIndex={9} limit={6} />,
  },
};

export const StepWithLongLabel: Story = {
  args: {
    live: true,
    stepCount: 1,
    children: (
      <ToolSteps
        steps={[
          {
            label:
              "mcp__docs__fetch_a_very_long_tool_name_that_keeps_going_and_going_and_going_and_going",
            count: 2,
          },
        ]}
        currentIndex={0}
      />
    ),
  },
};

export const Standalone: StoryObj = {
  render: () => (
    <StandaloneToolActivity live={false} steps={steps} stepCount={5} durationMs={4_000} />
  ),
};

export const StandaloneLive: StoryObj = {
  render: () => <StandaloneToolActivity live steps={manySteps} stepCount={10} />,
};

export const OnlyNarration: StoryObj = {
  render: () => (
    <div className="space-y-2">
      <ToolOnlyNarration blocks={[{ kind: "steps", steps, durationMs: 3_000 }]} live={false} />
      <ToolOnlyNarration blocks={[{ kind: "steps", steps: manySteps }]} live />
    </div>
  ),
};
