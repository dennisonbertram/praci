import type { TaughtSkill } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../stories/fixtures-8";
import { TeachRecordingChrome, TeachStopButton } from "./TeachRecordingChrome";

const recording: TaughtSkill = {
  id: "skill_demo",
  botId: "bot_demo",
  name: "Export the weekly report",
  goal: "Export the weekly report from the demo dashboard",
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
  expiresAt: new Date(Date.now() + 7 * 60_000).toISOString(),
  stoppedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const meta = {
  title: "Chat/TeachRecordingChrome",
  component: TeachRecordingChrome,
  args: { recording, botId: "bot_demo", onStop: () => undefined },
  beforeEach: () => mockRpc({ "computer.input": {} }),
  parameters: { docs: { description: { component: "Also shows: ProtectedTeachInput" } } },
} satisfies Meta<typeof TeachRecordingChrome>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Panel: Story = {};
export const PanelBusy: Story = { args: { busy: true } };
export const PanelNoExpiry: Story = { args: { recording: { ...recording, expiresAt: null } } };
export const Overlay: Story = {
  args: { variant: "overlay" },
  render: (args) => (
    <div className="flex w-96 items-center">
      <TeachRecordingChrome {...args} />
      <TeachStopButton onStop={() => undefined} />
    </div>
  ),
};
export const StopButtonBusy: Story = {
  render: () => <TeachStopButton busy onStop={() => undefined} />,
};
