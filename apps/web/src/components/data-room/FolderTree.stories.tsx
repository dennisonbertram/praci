import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { folders } from "../../stories/fixtures/data-room";
import { FolderTree } from "./FolderTree";
import { folderNodes } from "./folders";

const meta = {
  title: "DataRoom/FolderTree",
  render: () => {
    const [selected, setSelected] = useState<string | undefined>("fld_sample");
    return <FolderTree nodes={folderNodes(folders)} selected={selected} onSelect={setSelected} />;
  },
} satisfies Meta;
export default meta;

export const Nested: StoryObj = {};
