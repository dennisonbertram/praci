import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { userEvent, within } from "storybook/test";
import { folders } from "../../stories/fixtures/data-room";
import { FolderTree } from "./FolderTree";
import { folderNodes } from "./folders";

const meta = {
  title: "DataRoom/FolderTree",
  render: () => {
    const [selected, setSelected] = useState<string | undefined>("fld_sample");
    return (
      <FolderTree
        nodes={folderNodes(folders)}
        selected={selected}
        onSelect={setSelected}
        onAction={() => undefined}
        onNewFolder={() => undefined}
        onAutoSort={() => undefined}
      />
    );
  },
} satisfies Meta;
export default meta;

export const Nested: StoryObj = {};

/** A right-click on a top-level folder opens its Move, Rename and Delete menu. */
export const FolderMenuOpen: StoryObj = {
  play: async ({ canvasElement }) => {
    const contracts = await within(canvasElement).findByRole("treeitem", { name: /Contracts/ });
    await userEvent.pointer({ keys: "[MouseRight]", target: contracts });
  },
};
