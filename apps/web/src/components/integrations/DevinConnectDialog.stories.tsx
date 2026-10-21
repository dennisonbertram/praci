import type { Meta, StoryObj } from "@storybook/react-vite";
import { screen, userEvent } from "storybook/test";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { withPageBehind } from "../../stories/decorators";
import { DevinConnectDialog } from "./DevinConnectDialog";

const meta = {
  title: "Integrations/DevinConnectDialog",
  component: DevinConnectDialog,
  args: { onClose: () => undefined },
  decorators: [withPageBehind()],
} satisfies Meta<typeof DevinConnectDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A rejected connection: the same dialog swaps the key. */
export const Replace: Story = { args: { mode: "replace" } };

/** The server refuses the key and the dialog keeps its message inline. */
export const KeyRefused: Story = {
  beforeEach: () =>
    mockRpc({
      "devin.connect": () => {
        throw new Error("The key was refused.");
      },
    }),
  play: async () => {
    await userEvent.type(await screen.findByLabelText("Organization service-user key"), "demo-key");
    await userEvent.click(screen.getByRole("button", { name: "Connect" }));
  },
};
