import type { Meta, StoryObj } from "@storybook/react-vite";
import { screen, userEvent, waitFor } from "storybook/test";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { ImportSources } from "./ImportFromEmail";

const meta = {
  title: "Data room/Import sources",
  component: ImportSources,
  parameters: { docs: { description: { component: "Also shows: EmailPicker, MessageRow" } } },
  args: { folderId: null, onDone: () => undefined },
  beforeEach: () => {
    mockRpc({
      "connections.list": [
        {
          id: "c1",
          connectorId: "google",
          provider: "gmail",
          displayName: "Example mail",
          status: "connected",
        },
      ],
      "inbox.list": {
        accounts: [{ id: "c1" }],
        failedAccounts: [],
        reconnectAccounts: [],
        rows: [
          {
            id: "m1",
            connectionId: "c1",
            threadId: "t1",
            from: "Example Billing <billing@example.com>",
            subject: "Invoice 1042",
            snippet: "",
            receivedAt: "2026-10-10T00:00:00.000Z",
            unread: false,
            inInbox: true,
          },
        ],
      },
      "inbox.get": {
        attachments: [
          { id: "a1", filename: "invoice-1042.pdf", mimeType: "application/pdf", size: 52000 },
        ],
      },
    });
  },
} satisfies Meta<typeof ImportSources>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Connected: Story = {};

export const Picker: Story = {
  play: async () => {
    await userEvent.click(await screen.findByRole("button", { name: "Import from email" }));
    await userEvent.click(await screen.findByRole("button", { name: /Invoice 1042/ }));
    await waitFor(() => screen.getByRole("checkbox", { name: "invoice-1042.pdf" }));
  },
};

export const NeedsReconnect: Story = {
  beforeEach: () =>
    mockRpc({
      "inbox.list": {
        accounts: [{ id: "c1" }],
        failedAccounts: ["c1"],
        reconnectAccounts: ["c1"],
        rows: [],
      },
    }),
  play: Picker.play,
};

export const NotConnected: Story = {
  beforeEach: () => mockRpc({ "connections.list": [] }),
};
