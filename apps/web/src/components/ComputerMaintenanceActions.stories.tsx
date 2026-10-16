import type { ComputerStatus } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { mockRpc } from "../lib/__mocks__/rpc";
import { ComputerMaintenanceActions } from "./ComputerMaintenanceActions";

const computer: ComputerStatus = {
  botId: "bot_ada",
  mode: "dedicated",
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
  canUpdate: true,
  terminalAvailable: true,
};

const meta = {
  title: "Computer/Maintenance actions",
  component: ComputerMaintenanceActions,
  args: { botId: "bot_ada", computer, onChanged: async () => undefined },
  decorators: [
    (Story) => (
      <div className="flex h-72 justify-end p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ComputerMaintenanceActions>;
export default meta;
type Story = StoryObj<typeof meta>;

const openMenu = async ({ canvasElement }: { canvasElement: HTMLElement }) => {
  await userEvent.click(within(canvasElement).getByLabelText("More computer actions"));
  await within(document.body).findByText("Reset computer");
};

export const Closed: Story = {};

export const MenuOpen: Story = { play: openMenu };

export const MenuWithoutUpdate: Story = {
  args: { computer: { ...computer, canUpdate: false } },
  play: openMenu,
};

export const Busy: Story = { args: { computer: { ...computer, busyBotName: "Ben" } } };

export const Booting: Story = { args: { computer: { ...computer, state: "booting" } } };

export const ResetConfirm: Story = {
  play: async (context) => {
    await openMenu(context);
    await userEvent.click(within(document.body).getByLabelText("Reset computer"));
    await expect(await within(document.body).findByText("Reset computer?")).toBeTruthy();
  },
};

export const RecoverConfirm: Story = {
  args: { computer: { ...computer, state: "error" } },
  play: async (context) => {
    await openMenu(context);
    await userEvent.click(within(document.body).getByLabelText("Recover computer"));
    await expect(await within(document.body).findByText("Recover computer?")).toBeTruthy();
  },
};

export const ResetFailed: Story = {
  beforeEach: () =>
    mockRpc({ "computer.reset": () => Promise.reject(new Error("The computer did not respond")) }),
  play: async (context) => {
    await openMenu(context);
    await userEvent.click(within(document.body).getByLabelText("Reset computer"));
    const dialog = await within(document.body).findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Reset" }));
    await expect(await within(dialog).findByText("The computer did not respond")).toBeTruthy();
  },
};

/** With no computer, or no action to offer, the control renders nothing. */
export const Nothing: Story = {
  args: { computer: { ...computer, state: "booting", canUpdate: false } },
  decorators: [
    (Story) => (
      <>
        <p className="text-sm text-muted-foreground">No actions are available while it boots.</p>
        <Story />
      </>
    ),
  ],
};
