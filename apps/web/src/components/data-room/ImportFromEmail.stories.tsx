import type { Meta, StoryObj } from "@storybook/react-vite";
import { screen, userEvent, waitFor } from "storybook/test";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { ImportSources } from "./ImportFromEmail";

const mail = (id: string, from: string, subject: string, day: string) => ({
  id,
  connectionId: "c1",
  threadId: `t-${id}`,
  from,
  subject,
  snippet: "",
  receivedAt: `${day}T00:00:00.000Z`,
  unread: false,
  inInbox: true,
});
const file = (id: string, filename: string, mimeType: string, size: number) => ({
  id,
  filename,
  mimeType,
  size,
});
// m1: two documents and a signature logo (left out); m2: one already in the Data room and one new;
// m3: only a tiny tracking picture, so the message is not listed.
const ATTACHMENTS: Record<string, ReturnType<typeof file>[]> = {
  m1: [
    file("a1", "invoice-1042.pdf", "application/pdf", 52_000),
    file("a2", "timesheet.xlsx", "application/vnd.ms-excel", 18_400),
    file("a3", "image001.png", "image/png", 4_200),
  ],
  m2: [
    file("b1", "agreement-signed.pdf", "application/pdf", 310_000),
    file("b2", "site-photo.jpg", "image/jpeg", 880_000),
  ],
  m3: [file("c1", "pixel.gif", "image/gif", 43)],
};

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
      "mcp.servers.list": [],
      "connections.catalog": [
        { connectorId: "google", slug: "gmail" },
        { connectorId: "google", slug: "googledrive" },
      ],
      "inbox.list": {
        accounts: [{ id: "c1" }],
        failedAccounts: [],
        reconnectAccounts: [],
        rows: [
          mail("m1", "Example Billing <billing@example.com>", "Invoice 1042", "2026-10-10"),
          mail("m2", "Sample Legal <legal@example.org>", "Signed agreement", "2026-10-08"),
          mail("m3", "Newsletter <news@example.net>", "Weekly digest", "2026-10-07"),
        ],
      },
      "inbox.get": ({ messageId }: { messageId: string }) => ({
        attachments: ATTACHMENTS[messageId] ?? [],
      }),
      "dataRoom.emailImported": { files: [{ messageId: "m2", attachmentId: "b1" }] },
    });
  },
} satisfies Meta<typeof ImportSources>;
export default meta;
type Story = StoryObj<typeof meta>;

const openPicker = async () => {
  await userEvent.click(await screen.findByRole("button", { name: "Import from email" }));
};

export const Connected: Story = {};

export const Picker: Story = {
  play: async () => {
    await openPicker();
    await waitFor(() => screen.getByRole("checkbox", { name: "Select invoice-1042.pdf" }));
  },
};

/** Ticking a message ticks all of its files, and the button counts them. */
export const MessageSelected: Story = {
  play: async (context) => {
    await Picker.play?.(context);
    await userEvent.click(screen.getByRole("checkbox", { name: "Select Invoice 1042" }));
  },
};

export const Empty: Story = {
  beforeEach: () =>
    mockRpc({
      "inbox.list": {
        accounts: [{ id: "c1" }],
        failedAccounts: [],
        reconnectAccounts: [],
        rows: [],
      },
    }),
  play: openPicker,
};

export const LoadError: Story = {
  beforeEach: () =>
    mockRpc({
      "inbox.list": () => {
        throw new Error("Mail is unavailable");
      },
    }),
  play: openPicker,
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
  play: openPicker,
};

export const NotConnected: Story = {
  beforeEach: () => mockRpc({ "connections.list": [] }),
};

/** The server offers neither app: no button leads to a page that says "isn't available". */
export const NotOffered: Story = {
  render: (args) => (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <span>No import buttons:</span>
      <ImportSources {...args} />
    </div>
  ),
  beforeEach: () => mockRpc({ "connections.list": [], "connections.catalog": [] }),
};
