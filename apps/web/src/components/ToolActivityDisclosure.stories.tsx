import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import {
  StandaloneToolActivity,
  ToolActivityDisclosure,
  ToolOnlyNarration,
  ToolSteps,
} from "./ToolActivityDisclosure";

const steps = [
  { label: "Read sample-notes.md", count: 1 },
  { label: "Search the web for sample pricing", count: 3 },
  { label: "Write summary.md", count: 1 },
];

const manySteps = Array.from({ length: 10 }, (_, i) => ({
  label: `Step ${i + 1}: run a sample tool`,
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
              "Fetch https://docs.example.com/a/very/long/path/that/keeps/going/and/going/and/going",
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
