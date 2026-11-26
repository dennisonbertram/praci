import type { Meta, StoryObj } from "@storybook/react-vite";
import { screen, userEvent } from "storybook/test";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { withPageBehind } from "../../stories/decorators";
import { BrexCardsConnectDialog } from "./BrexCardsConnectDialog";

const meta = {
  title: "Integrations/BrexCardsConnectDialog",
  component: BrexCardsConnectDialog,
  args: { onClose: () => undefined },
  decorators: [withPageBehind()],
} satisfies Meta<typeof BrexCardsConnectDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** The permissions the token needs, opened. */
export const PermissionsExpanded: Story = {
  play: async () => {
    await userEvent.click(await screen.findByText("Permissions for the token"));
  },
};

/** The owner swaps the token of an existing connection. */
export const Replace: Story = { args: { mode: "replace" } };

/** Brex accepts the token but it lacks a permission; the dialog keeps the message inline. */
export const MissingPermission: Story = {
  beforeEach: () =>
    mockRpc({
      "brexCards.connect": () => {
        throw new Error("Brex refused this token. It may be missing a permission or have expired.");
      },
    }),
  play: async () => {
    await userEvent.type(await screen.findByLabelText("API token"), "tok_demo");
    await userEvent.click(screen.getByRole("button", { name: "Connect" }));
  },
};

/** Brex refuses the token; the dialog keeps the message inline and nothing changes. */
export const TokenRefused: Story = {
  beforeEach: () =>
    mockRpc({
      "brexCards.connect": () => {
        throw new Error("Brex rejected this token");
      },
    }),
  play: async () => {
    await userEvent.type(await screen.findByLabelText("API token"), "tok_demo");
    await userEvent.click(screen.getByRole("button", { name: "Connect" }));
  },
};
