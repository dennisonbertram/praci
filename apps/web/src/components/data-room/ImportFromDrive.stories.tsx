import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { BoxImportButton, DriveImportButton } from "./ImportFromDrive";

const meta = {
  title: "Data room/DriveImportButton",
  component: DriveImportButton,
  args: { connected: true, compact: false, folderId: null, onDone: () => undefined },
} satisfies Meta<typeof DriveImportButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Connected: Story = {};
export const NotConnected: Story = { args: { connected: false } };
export const Compact: Story = { args: { compact: true } };

/** Invented Box content: folders first, a ticked pick, and a "Load more" page. */
const boxFiles = [
  { id: "1", name: "Board decks", mimeType: "", isFolder: true },
  { id: "2", name: "Contracts", mimeType: "", isFolder: true },
  { id: "3", name: "Meeting notes.docx", mimeType: "", isFolder: false, size: 48_000 },
  { id: "4", name: "Roadmap.pdf", mimeType: "", isFolder: false, size: 1_250_000 },
];

export const BoxButton: StoryObj<typeof BoxImportButton> = {
  render: (args) => <BoxImportButton {...args} />,
  args: { compact: false, folderId: null, onDone: () => undefined },
};

export const BoxPicker: StoryObj<typeof BoxImportButton> = {
  ...BoxButton,
  beforeEach: () => mockRpc({ "dataRoom.boxList": { files: boxFiles, nextPageToken: "next" } }),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: /import from box/i }));
    const body = within(document.body);
    await userEvent.click(await body.findByRole("checkbox", { name: /select contracts/i }));
    await userEvent.click(await body.findByRole("checkbox", { name: /select roadmap/i }));
  },
};

export const BoxReconnect: StoryObj<typeof BoxImportButton> = {
  ...BoxPicker,
  beforeEach: () =>
    mockRpc({
      "dataRoom.boxList": () => {
        throw new Error("The Box account needs to be reconnected");
      },
    }),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: /import from box/i }));
  },
};
