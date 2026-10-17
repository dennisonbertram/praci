import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { withPageBehind } from "../../stories/decorators";
import { RenameAccountDialog } from "./RenameAccountDialog";

const meta = {
  title: "Finance/RenameAccountDialog",
  component: RenameAccountDialog,
  // The dialog renders in a portal, so give the story root something to show.
  decorators: [withPageBehind()],
  args: {
    // MOCK DEMO DATA: an account named from its statement's file name.
    account: { id: "acct_1", name: "mock firstbank" },
    onClose: () => undefined,
    onSaved: () => undefined,
  },
} satisfies Meta<typeof RenameAccountDialog>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ServerError: Story = {
  beforeEach: () =>
    mockRpc({
      "finance.statementAccountRename": () => {
        throw new Error("Could not rename the account");
      },
    }),
  play: async () => {
    const screen = within(document.body);
    await userEvent.click(await screen.findByRole("button", { name: "Save" }));
  },
};
