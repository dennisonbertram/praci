import type { Meta, StoryObj } from "@storybook/react-vite";
import { DriveImportButton } from "./ImportFromDrive";

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
