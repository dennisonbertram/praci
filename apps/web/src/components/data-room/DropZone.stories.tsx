import type { Meta, StoryObj } from "@storybook/react-vite";
import { DataRoomDropZone } from "./DropZone";

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
