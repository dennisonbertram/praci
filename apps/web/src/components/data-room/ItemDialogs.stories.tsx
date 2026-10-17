import type { Meta, StoryObj } from "@storybook/react-vite";
import { folders, readyItem } from "../../stories/fixtures/data-room";

const contracts = folders[0]!;
const reports = folders.find((folder) => folder.name === "Reports")!;

import { folderNodes } from "./folders";
import { ItemDialog, NewFolderDialog } from "./ItemDialogs";
import type { ItemAction } from "./ItemMenu";

const meta = {
  title: "DataRoom/ItemDialog",
  render: (args: { action: ItemAction; folder?: boolean; emptyFolder?: boolean }) => (
    <>
      <p className="p-4 text-sm">{readyItem.name}</p>
      <ItemDialog
        action={args.action}
        item={args.emptyFolder ? reports : args.folder ? contracts : readyItem}
        folders={folderNodes(folders)}
        onClose={() => undefined}
        onDone={() => undefined}
      />
    </>
  ),
} satisfies Meta<{ action: ItemAction; folder?: boolean; emptyFolder?: boolean }>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Rename: Story = { args: { action: "rename" } };
export const Move: Story = { args: { action: "move" } };
export const Delete: Story = { args: { action: "delete" } };
/** "New folder…" chosen: a name field appears and Save creates the folder, then moves the item. */
export const MoveToNewFolder: Story = {
  args: { action: "move" },
  play: async () => {
    const select = document.querySelector<HTMLSelectElement>('select[name="folder"]');
    if (!select) return;
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(
      select,
      "__new__",
    );
    select.dispatchEvent(new Event("change", { bubbles: true }));
  },
};
/** A folder: it cannot move into itself or its sub-folders, so those are not offered. */
export const MoveFolder: Story = { args: { action: "move", folder: true } };
export const RenameFolder: Story = { args: { action: "rename", folder: true } };
/** A folder with something in it: the dialog says what it holds and offers no Delete. */
export const DeleteFolder: Story = { args: { action: "delete", folder: true } };
/** An empty folder is deleted after a confirmation. */
export const DeleteEmptyFolder: Story = { args: { action: "delete", emptyFolder: true } };
/** New folder from the tree: a name, and where it goes ("Inside", starting at the open folder). */
export const NewFolder: Story = {
  args: { action: "rename" },
  render: () => (
    <NewFolderDialog
      folders={folderNodes(folders)}
      parentId="fld_contracts"
      onClose={() => undefined}
      onDone={() => undefined}
    />
  ),
};
