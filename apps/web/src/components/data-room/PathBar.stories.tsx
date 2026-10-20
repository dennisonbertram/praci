import type { DataRoomApiFolder } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { folderNodes } from "./folders";
import { PathBar } from "./PathBar";

const folder = (id: string, name: string, parentId: string | null): DataRoomApiFolder => ({
  id,
  name,
  parentId,
  createdAt: "2026-01-01T00:00:00.000Z",
});
const nodes = folderNodes([
  folder("a", "Sample Corp. _ Data Room", null),
  folder("b", "B__CHARTER DOCUMENTS", "a"),
  folder("c", "1__Formation", "b"),
  folder("d", "2__Amendments and restatements of the certificate of incorporation", "c"),
  folder("e", "Signed copies", "d"),
]);

const meta = {
  title: "DataRoom/PathBar",
  render: (args: { start: string | undefined }) => {
    const [folderId, setFolderId] = useState(args.start);
    return (
      <div className="w-full max-w-3xl">
        <PathBar nodes={nodes} folderId={folderId} onSelect={setFolderId} />
      </div>
    );
  },
} satisfies Meta<{ start: string | undefined }>;
export default meta;

type Story = StoryObj<typeof meta>;

export const InFolder: Story = { args: { start: "b" } };
/** More than four segments: the middle ones sit behind the "…" menu. */
export const LongPath: Story = { args: { start: "e" } };
/** At the top level there is no path bar. */
export const TopLevel: Story = { args: { start: undefined } };
