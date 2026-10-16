import type { Meta, StoryObj } from "@storybook/react-vite";
import { folders, readyItem } from "../../stories/fixtures/data-room";
import { folderNodes } from "./folders";
import { ItemDialog } from "./ItemDialogs";
import type { ItemAction } from "./ItemMenu";

const meta = {
  title: "DataRoom/ItemDialog",
  render: (args: { action: ItemAction }) => (
    <>
      <p className="p-4 text-sm">{readyItem.name}</p>
      <ItemDialog
        action={args.action}
        item={readyItem}
        folders={folderNodes(folders)}
        onClose={() => undefined}
        onDone={() => undefined}
      />
    </>
  ),
} satisfies Meta<{ action: ItemAction }>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Rename: Story = { args: { action: "rename" } };
export const Move: Story = { args: { action: "move" } };
export const Delete: Story = { args: { action: "delete" } };
