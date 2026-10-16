import type { ComputerStatus } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, waitFor, within } from "storybook/test";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { TeachComputerOverlayControl } from "./TeachComputerOverlay";

const computer: ComputerStatus = {
  botId: "bot_demo",
  mode: "team",
  kind: "docker",
  state: "running",
  controlHolder: "none",
  controlBotId: null,
  takeoverRequested: false,
  screenAvailable: true,
  screenWidth: 1280,
  screenHeight: 800,
  homeRevision: null,
  busyBotName: null,
  canUpdate: false,
  terminalAvailable: true,
};

/** Start is disabled while the mount check runs, so wait for it. */
const openGoal = async (canvasElement: HTMLElement) => {
  const button = await within(canvasElement).findByTestId("teach-start-button");
  await waitFor(() => {
    if ((button as HTMLButtonElement).disabled) throw new Error("still checking");
  });
  await userEvent.click(button);
};

const meta = {
  title: "Teach/Computer overlay control",
  component: TeachComputerOverlayControl,
  args: { botId: "bot_demo", computer, onRefresh: async () => undefined },
  decorators: [
    (Story) => (
      <div className="flex min-h-[320px] justify-end p-4">
        <Story />
      </div>
    ),
  ],
  beforeEach: () =>
    mockRpc({ "skills.list": [], "computer.boot": { ok: true }, "skills.start": {} }),
} satisfies Meta<typeof TeachComputerOverlayControl>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {};

/** No computer status yet: the control still shows so teaching can boot one. */
export const NoComputerYet: Story = { args: { computer: null } };

export const Busy: Story = { args: { busy: true } };

export const GoalOpen: Story = {
  play: async ({ canvasElement }) => {
    await openGoal(canvasElement);
  },
};

export const StartFailed: Story = {
  beforeEach: () =>
    mockRpc({
      "skills.list": [],
      "computer.boot": () => {
        throw new Error("Could not start teaching");
      },
    }),
  play: async ({ canvasElement }) => {
    await openGoal(canvasElement);
    await userEvent.type(await within(document.body).findByTestId("teach-goal-input"), "Demo goal");
    await userEvent.click(
      await within(document.body).findByRole("button", { name: "Start recording" }),
    );
  },
};

/** A recording is already active on the server, so recovery shows instead of Start. */
export const RecordingAlreadyActive: Story = {
  beforeEach: () => mockRpc({ "skills.list": [{ id: "skill_demo", status: "recording" }] }),
};

/** The status check failed, so Start stays locked rather than risk a second recording. */
export const StatusCheckFailed: Story = {
  beforeEach: () =>
    mockRpc({
      "skills.list": () => {
        throw new Error("offline");
      },
    }),
};

/** Desktop-host bots do not get the control. */
export const DesktopHost: Story = { args: { computer: { ...computer, kind: "desktop" } } };
