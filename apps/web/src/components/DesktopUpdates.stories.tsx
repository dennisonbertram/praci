import type { DesktopUpdateState, RakazoDesktop } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { DesktopUpdateSection, DesktopUpdatesProvider } from "./DesktopUpdates";

const idle: DesktopUpdateState = {
  phase: "idle",
  currentVersion: "1.2.3",
  availableVersion: null,
  percent: null,
  message: null,
  checkedAt: "2026-01-01T00:00:00.000Z",
};

/** Installs a fake desktop bridge that always reports `state`, and removes it afterwards. */
function withBridge(state: DesktopUpdateState) {
  return () => {
    const reply = async () => state;
    const bridge = { update: { state: reply, check: reply, download: reply, install: reply } };
    window.rakazoDesktop = bridge as unknown as RakazoDesktop;
    return () => {
      window.rakazoDesktop = undefined;
    };
  };
}

const meta = {
  title: "Shell/Desktop updates",
  component: DesktopUpdatesProvider,
  render: () => (
    <DesktopUpdatesProvider>
      <div className="w-96">
        <DesktopUpdateSection />
      </div>
    </DesktopUpdatesProvider>
  ),
  args: { children: null },
} satisfies Meta<typeof DesktopUpdatesProvider>;
export default meta;

type Story = StoryObj<typeof meta>;

export const UpToDate: Story = { beforeEach: withBridge(idle) };

export const Checking: Story = { beforeEach: withBridge({ ...idle, phase: "checking" }) };

export const Downloading: Story = {
  beforeEach: withBridge({
    ...idle,
    phase: "downloading",
    availableVersion: "1.3.0",
    percent: 42,
  }),
};

export const ReadyToRestart: Story = {
  beforeEach: withBridge({ ...idle, phase: "ready", availableVersion: "1.3.0" }),
};

export const WithMessage: Story = {
  beforeEach: withBridge({
    ...idle,
    phase: "error",
    message: "Could not reach the update server.",
  }),
};
