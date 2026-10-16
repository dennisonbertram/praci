import type { ComputerUpdate } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { screen, userEvent } from "storybook/test";
import { mockRpc } from "../lib/__mocks__/rpc";
import { withPageBehind } from "../stories/decorators";
import { ComputerUpdateProgress } from "./ComputerUpdateProgress";

const update = (patch: Partial<ComputerUpdate> = {}): ComputerUpdate => ({
  id: "upd_1",
  botId: "bot_ada",
  name: "Ada",
  mode: "dedicated",
  action: "update",
  status: "running",
  stage: "recreating",
  ...patch,
});

/** The pill appears after the first poll; clicking it opens the progress dialog. */
const openDialog = async () => {
  await userEvent.click((await screen.findAllByRole("button"))[0] as HTMLElement);
};

const meta = {
  title: "Computer/Update progress",
  component: ComputerUpdateProgress,
  args: { onCompleted: () => undefined },
  decorators: [withPageBehind("Page behind the update")],
} satisfies Meta<typeof ComputerUpdateProgress>;
export default meta;
type Story = StoryObj<typeof meta>;

export const PillOnly: Story = {
  beforeEach: () => mockRpc({ "computer.updates": [update()] }),
};

export const TeamComputerPill: Story = {
  beforeEach: () => mockRpc({ "computer.updates": [update({ mode: "team", stage: "preparing" })] }),
};

export const Updating: Story = {
  beforeEach: () => mockRpc({ "computer.updates": [update()] }),
  play: openDialog,
};

export const Recovering: Story = {
  beforeEach: () =>
    mockRpc({ "computer.updates": [update({ action: "recover", stage: "restoring" })] }),
  play: openDialog,
};

export const Failed: Story = {
  beforeEach: () => mockRpc({ "computer.updates": [update({ status: "failed" })] }),
  play: openDialog,
};

export const RecoveryFailed: Story = {
  beforeEach: () =>
    mockRpc({ "computer.updates": [update({ action: "recover", status: "failed" })] }),
  play: openDialog,
};

export const Interrupted: Story = {
  beforeEach: () =>
    mockRpc({
      "computer.updates": [update({ status: "interrupted", canReleaseReservation: true })],
    }),
  play: async () => {
    await openDialog();
    await userEvent.click(await screen.findByRole("button", { name: "Release computer" }));
  },
};

export const SeveralUpdates: Story = {
  beforeEach: () =>
    mockRpc({
      "computer.updates": [
        update(),
        update({ id: "upd_2", name: "Ben", mode: "team", stage: "saving" }),
        update({ id: "upd_3", name: "Cy", status: "failed" }),
      ],
    }),
};
