import type { Meta, StoryObj } from "@storybook/react-vite";
import { DriveRow } from "./DriveRow";

const meta = {
  title: "Data room/DriveRow",
  component: DriveRow,
  args: {
    file: {
      id: "f1",
      name: "Q3 report.pdf",
      mimeType: "application/pdf",
      size: 120_000,
      isFolder: false,
    },
    checked: false,
    disabled: false,
    onToggle: () => undefined,
    onOpen: () => undefined,
  },
} satisfies Meta<typeof DriveRow>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NoneSelected: Story = {};
export const FileSelected: Story = { args: { checked: true } };
export const FolderSelected: Story = {
  args: {
    file: {
      id: "d1",
      name: "Contracts",
      mimeType: "application/vnd.google-apps.folder",
      isFolder: true,
    },
    checked: true,
  },
};
export const Folder: Story = { args: { ...FolderSelected.args, checked: false } };
export const CannotImport: Story = { args: { disabled: true } };

/** In the email picker: the checkbox is always shown, and a marker says the file is filed. */
export const AlreadyInDataRoom: Story = {
  args: { checked: true, disabled: true, showCheckbox: true, note: "In Data room" },
};
