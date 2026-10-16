import type { ComputerCommand } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { screen, userEvent } from "storybook/test";
import { mockRpc } from "../../stories/rpc-mock-1";
import TerminalApp from "./TerminalApp";

const commands: ComputerCommand[] = [
  {
    executionId: "exec_1",
    kind: "shell",
    command: "ls demo-project",
    cwd: "/workspace",
    status: "done",
    exitCode: 0,
    output: "README.md\nsrc\npackage.json\n",
  },
  {
    executionId: "exec_2",
    kind: "write_file",
    command: "demo-project/notes.txt",
    cwd: "/workspace",
    status: "done",
    exitCode: null,
    output: "",
    bytes: 128,
  },
  {
    executionId: "exec_3",
    kind: "shell",
    command: "npm test",
    cwd: "/workspace/demo-project",
    status: "done",
    exitCode: 1,
    output: "FAIL sample.test.js\n  expected 1 but received 2\n",
  },
  {
    executionId: "exec_4",
    kind: "launch_app",
    command: "Sample Editor",
    cwd: "/workspace",
    status: "done",
    exitCode: null,
    output: "",
  },
  {
    executionId: "exec_5",
    kind: "shell",
    command: "sleep 30",
    cwd: "/workspace",
    status: "running",
    exitCode: null,
    output: "",
  },
];

const meta = {
  title: "Computer/TerminalApp",
  component: TerminalApp,
  args: { botId: "bot_demo", canUseShell: false },
  decorators: [
    (Story) => (
      <div className="h-96 w-[640px] border border-border">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: { component: "Also shows: ActivityTerminal, ShellTerminal, TerminalPane." },
    },
  },
} satisfies Meta<typeof TerminalApp>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Activity: Story = {
  beforeEach: () => mockRpc({ "computer.commands": commands }),
};

export const ActivityEmpty: Story = {
  beforeEach: () => mockRpc({ "computer.commands": [] }),
};

export const ActivityError: Story = {
  beforeEach: () =>
    mockRpc({
      "computer.commands": () => {
        throw new Error("The computer is not reachable.");
      },
    }),
};

/** Without control the shell is offered as a button. */
export const OpenShellButton: Story = {
  args: { onTakeControl: async () => false },
  beforeEach: () => mockRpc({ "computer.commands": commands }),
};

export const ShellTab: Story = {
  args: { canUseShell: true },
  beforeEach: () =>
    mockRpc({ "computer.commands": commands, "computer.terminalUrl": { url: null } }),
  play: async () => {
    await userEvent.click(await screen.findByRole("tab", { name: "Shell" }));
  },
};

export const ShellError: Story = {
  args: { canUseShell: true },
  beforeEach: () =>
    mockRpc({
      "computer.commands": commands,
      "computer.terminalUrl": () => {
        throw new Error("You do not have control of this computer.");
      },
    }),
  play: async () => {
    await userEvent.click(await screen.findByRole("tab", { name: "Shell" }));
  },
};
