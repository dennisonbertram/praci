import type { TaughtSkill } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { TeachCaptureOverlay } from "./TeachCaptureOverlay";

const skill: TaughtSkill = {
  id: "skill_demo",
  botId: "bot_demo",
  name: "Sample skill",
  goal: "Demonstrate a sample task",
  status: "recording",
  playbook: {
    whenToUse: "",
    inputs: [],
    steps: [],
    howToCheck: "",
    whatToReturn: "",
    approvalBoundaries: "",
    failureHandling: "",
  },
  recording: { events: [], snapshots: [] },
  startedAt: "2026-01-01T00:00:00.000Z",
  expiresAt: null,
  stoppedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const meta = {
  title: "Teach/TeachCaptureOverlay",
  component: TeachCaptureOverlay,
  args: { botId: "bot_demo", skill, enabled: true },
  decorators: [
    (Story) => (
      <div className="relative h-48 w-80 rounded-md border border-dashed border-border">
        <span className="p-2 text-xs text-muted-foreground">Computer screen area</span>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof TeachCaptureOverlay>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The overlay is transparent; it only captures input over the screen. */
export const Recording: Story = {};

export const Disabled: Story = { args: { enabled: false } };

export const NotRecording: Story = { args: { skill: { ...skill, status: "draft" } } };

export const NoSkill: Story = { args: { skill: null } };
