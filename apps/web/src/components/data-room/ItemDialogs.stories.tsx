import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../lib/__mocks__/rpc";
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
        onOpenFolder={() => undefined}
      />
    </>
  ),
} satisfies Meta<{ action: ItemAction; folder?: boolean; emptyFolder?: boolean }>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Rename: Story = { args: { action: "rename" } };
export const Move: Story = { args: { action: "move" } };
export const Delete: Story = {
  args: { action: "delete" },
  beforeEach: () => mockRpc({ "legal.itemLinks": { contractTitle: null, deadlines: 0 } }),
};
/** A file Legal has read: the dialog says its contract and deadlines go with it. */
export const DeleteWithLegalContract: Story = {
  args: { action: "delete" },
  beforeEach: () => mockRpc({ "legal.itemLinks": { contractTitle: "Office lease", deadlines: 2 } }),
};
const investorContact = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  name,
  email: `${name.toLowerCase().replace(" ", ".")}@example.test`,
  organization: null,
  kind: "investor",
  notes: null,
  addedBy: null,
  createdAt: "2026-10-15T00:00:00.000Z",
  updatedAt: "2026-10-15T00:00:00.000Z",
  ...extra,
});
/** Share with investors: Ada already has the file (Unshare), Bo and Cy do not; "Email them a link" starts unticked. */
export const Share: Story = {
  args: { action: "share" },
  beforeEach: () =>
    mockRpc({
      "contacts.list": [
        investorContact("c1", "Ada Example"),
        investorContact("c2", "Bo Sample"),
        investorContact("c3", "Cy Placeholder"),
      ],
      "investors.shares": ["c1"],
    }),
};
export const ShareNoInvestors: Story = {
  args: { action: "share" },
  beforeEach: () => mockRpc({ "contacts.list": [], "investors.shares": [] }),
};

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
/** A folder with something in it: the dialog says what it holds and offers to open it, not Delete. */
export const DeleteFolder: Story = { args: { action: "delete", folder: true } };
/** An empty folder is deleted after a confirmation. */
export const DeleteEmptyFolder: Story = { args: { action: "delete", emptyFolder: true } };
/** New folder from the tree: a name, and where it goes ("Inside", starting at the open folder). */
export const NewFolder: Story = {
  args: { action: "rename" },
  // The dialog renders in a portal, so the page behind it is what the smoke check finds in the root.
  render: () => (
    <>
      <p className="p-4 text-sm">{contracts.name}</p>
      <NewFolderDialog
        folders={folderNodes(folders)}
        parentId="fld_contracts"
        onClose={() => undefined}
        onDone={() => undefined}
      />
    </>
  ),
};
