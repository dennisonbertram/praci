import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect } from "react";
import { DataRoomDropZone } from "./DropZone";
import { showDeletedToast } from "./upload-toasts";

const meta = {
  title: "DataRoom/DropZone",
  render: () => (
    <div className="p-4 text-sm">
      Drag a file over this page.
      <DataRoomDropZone userId="usr_sample" />
    </div>
  ),
} satisfies Meta;
export default meta;

export const Idle: StoryObj = {};

function DeletedToast() {
  // After the drop zone has set its scope, which clears earlier toasts.
  useEffect(() => showDeletedToast("Sample lease.pdf"), []);
  return null;
}
/** The confirmation after an item is deleted. */
export const Deleted: StoryObj = {
  render: () => (
    <div className="p-4 text-sm">
      <DataRoomDropZone userId="usr_sample" />
      <DeletedToast />
    </div>
  ),
};
