import type { ComputerStatus } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { mockRpc } from "../../stories/fixtures-9";
import { ComputerWorkspace } from "./ComputerWorkspace";

const computer: ComputerStatus = {
  botId: "bot_demo",
  mode: "dedicated",
  kind: "docker",
  state: "running",
  controlHolder: "user",
  controlBotId: null,
  takeoverRequested: false,
  screenAvailable: true,
  screenWidth: 1280,
  screenHeight: 800,
  homeRevision: null,
  busyBotName: null,
  canUpdate: false,
  terminalAvailable: false,
};

const files = [
  { path: "notes", kind: "dir", size: 0 },
  { path: "report.txt", kind: "file", size: 2048 },
  { path: "sample.png", kind: "file", size: 51200 },
];

const meta = {
  title: "Computer/ComputerWorkspace",
  component: ComputerWorkspace,
  parameters: {
    layout: "fullscreen",
    docs: { description: { component: "Also shows: WorkspaceWindow" } },
  },
  args: {
    botId: "bot_demo",
    computer,
    hasControl: true,
    dock: true,
    children: (
      <div className="grid h-full place-items-center bg-muted text-sm text-muted-foreground">
        Sample screen
      </div>
    ),
  },
  decorators: [
    (Story) => (
      <div className="h-[640px]">
        <Story />
      </div>
    ),
  ],
  beforeEach: () => mockRpc({ "computer.files": files, "computer.commands": [] }),
} satisfies Meta<typeof ComputerWorkspace>;
export default meta;

type Story = StoryObj<typeof meta>;

export const DockOnly: Story = {};

export const WithFilesWindow: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Files" }));
  },
};

export const WithTerminalWindow: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Terminal" }));
  },
};

export const BothWindows: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Files" }));
    await userEvent.click(canvas.getByRole("button", { name: "Terminal" }));
  },
};

export const FilesListFails: Story = {
  beforeEach: () =>
    mockRpc({
      "computer.files": () => {
        throw new Error("Computer is not reachable");
      },
    }),
  play: WithFilesWindow.play,
};

export const DesktopWithoutScreen: Story = {
  args: { computer: { ...computer, kind: "desktop" } },
};

export const NoDock: Story = { args: { dock: false } };
