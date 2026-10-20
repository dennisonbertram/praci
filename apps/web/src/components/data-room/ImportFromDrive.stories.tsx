import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { DrivePicker } from "./ImportFromDrive";

const meta = {
  title: "Data room/DrivePicker",
  component: DrivePicker,
  args: {
    folderId: null,
    reconnectPath: "/app/integrations?connect=box",
    onClose: () => undefined,
    onDone: () => undefined,
  },
  // The picker is a dialog in a portal, so the story root needs a frame of its own.
  decorators: [
    (Story) => (
      <div className="min-h-8">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DrivePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Invented Drive content: folders first, then files. */
const driveFiles = [
  { id: "1", name: "Planning", mimeType: "application/vnd.google-apps.folder", isFolder: true },
  { id: "2", name: "Budget.xlsx", mimeType: "", isFolder: false, size: 92_000 },
  {
    id: "3",
    name: "Offsite agenda",
    mimeType: "application/vnd.google-apps.document",
    isFolder: false,
  },
];

export const Drive: Story = {
  beforeEach: () => mockRpc({ "dataRoom.driveList": { files: driveFiles } }),
};

/** Invented Box content: folders first, a ticked pick, and a "Load more" page. */
const boxFiles = [
  { id: "1", name: "Board decks", mimeType: "", isFolder: true },
  { id: "2", name: "Contracts", mimeType: "", isFolder: true },
  { id: "3", name: "Meeting notes.docx", mimeType: "", isFolder: false, size: 48_000 },
  { id: "4", name: "Roadmap.pdf", mimeType: "", isFolder: false, size: 1_250_000 },
];

export const Box: Story = {
  args: { box: true },
  beforeEach: () => mockRpc({ "dataRoom.boxList": { files: boxFiles, nextPageToken: "next" } }),
  play: async () => {
    const body = within(document.body);
    await userEvent.click(await body.findByRole("checkbox", { name: /select contracts/i }));
    await userEvent.click(await body.findByRole("checkbox", { name: /select roadmap/i }));
  },
};

/** A lapsed sign-in: muted message with a Reconnect link to the integration page. */
export const BoxReconnect: Story = {
  args: { box: true },
  beforeEach: () =>
    mockRpc({
      "dataRoom.boxList": () => {
        throw new Error("The Box account needs to be reconnected");
      },
    }),
};
