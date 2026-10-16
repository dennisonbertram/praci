import type { Meta, StoryObj } from "@storybook/react-vite";
import { screen, userEvent, waitFor } from "storybook/test";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { withPageBehind } from "../../stories/decorators";
import { AddAccountDialog } from "./AddAccountDialog";

const meta = {
  title: "Finance/Add account dialog",
  component: AddAccountDialog,
  parameters: { docs: { description: { component: "Also shows: Option, iconTile" } } },
  args: { onPickCrypto: () => undefined, onImported: () => undefined, onClose: () => undefined },
  decorators: [withPageBehind()],
  beforeEach: () => {
    mockRpc({ "finance.overview": { sources: [] }, "finance.exchanges": [] });
  },
} satisfies Meta<typeof AddAccountDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithConnectedBadge: Story = {
  name: "With connected badge (Option)",
  beforeEach: () =>
    mockRpc({
      "finance.overview": {
        sources: [{ provider: "mercury", serverId: "srv_1", status: "ok", lastSyncedAt: null }],
      },
      "finance.exchanges": [
        {
          id: "ex_1",
          provider: "coinbase",
          connected: true,
          lastSyncedAt: null,
          lastError: null,
          totalCents: 0,
          balances: [],
        },
      ],
    }),
};

export const BankOnly: Story = { args: { onPickCrypto: undefined } };

export const UploadStatements: Story = { args: { initialStep: "bank" } };

export const UploadStep: Story = {
  name: "Upload statements (opened from the list, with Back)",
  play: async () => {
    await userEvent.click(await screen.findByRole("button", { name: /Upload statements/ }));
    await screen.findByRole("button", { name: "Back" });
  },
};

export const SignInCancelled: Story = {
  beforeEach: () =>
    mockRpc({
      "finance.overview": { sources: [] },
      "finance.exchanges": [],
      "finance.connect": { status: "cancelled" },
    }),
  play: async () => {
    await userEvent.click(await screen.findByRole("button", { name: /Mercury/ }));
    await waitFor(() => screen.getByRole("alert"));
  },
};
