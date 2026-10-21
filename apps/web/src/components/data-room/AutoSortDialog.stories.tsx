import type { AutoSortPlan } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { withPageBehind } from "../../stories/decorators";
import { AutoSortDialog } from "./AutoSortDialog";

// Invented data in the shape of a messy room: a duplicate folder with a sub-folder, screenshots
// filed by their camera names, and a loose scan.
const messy: AutoSortPlan = {
  mode: "ai",
  operations: [
    {
      type: "merge_folder",
      key: "merge:f2",
      folderId: "f2",
      intoFolderId: "f1",
      from: "Benefits (2)",
      into: "Benefits",
    },
    {
      type: "move_item",
      key: "move:i1",
      itemId: "i1",
      name: "Scan 0001.pdf",
      fromFolderId: null,
      toPath: ["Legal", "Leases"],
      from: "Unfiled",
      to: "Legal / Leases",
    },
    {
      type: "move_item",
      key: "move:i2",
      itemId: "i2",
      name: "Screenshot 2026-03-14 at 9.10.50 AM.png",
      fromFolderId: "f3",
      toPath: ["Finance", "Cap table"],
      from: "Finance / Cap Table",
      to: "Finance / Cap table",
    },
    {
      type: "rename_item",
      key: "rename:i2",
      itemId: "i2",
      fromName: "Screenshot 2026-03-14 at 9.10.50 AM.png",
      toName: "Cap table - Example Co - 2026-03-14.png",
    },
    {
      type: "rename_item",
      key: "rename:i3",
      itemId: "i3",
      fromName: "Screenshot 2026-03-14 at 9.11.02 AM.png",
      toName: "Cap table - Example Co - 2026-03-14 (2).png",
    },
  ],
};

const meta = {
  title: "DataRoom/AutoSortDialog",
  decorators: [withPageBehind()],
  render: () => <AutoSortDialog onClose={() => undefined} onApplied={() => undefined} />,
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** Every proposed change is ticked; unticking one leaves it out of Apply. */
export const Preview: Story = { beforeEach: () => mockRpc({ "dataRoom.autoSort.plan": messy }) };
/** Waiting for the plan. */
export const Loading: Story = {
  beforeEach: () => mockRpc({ "dataRoom.autoSort.plan": () => new Promise(() => undefined) }),
};
export const AlreadyTidy: Story = {
  beforeEach: () => mockRpc({ "dataRoom.autoSort.plan": { mode: "basic", operations: [] } }),
};
export const Failed: Story = {
  beforeEach: () =>
    mockRpc({
      "dataRoom.autoSort.plan": () => Promise.reject(new Error("Could not plan the sort")),
    }),
};
/** The provider refused the key: the reason, a way to fix it, and no Apply. */
export const KeyRejected: Story = {
  render: () => (
    <AutoSortDialog onClose={() => undefined} onApplied={() => undefined} onOpenModels={fn()} />
  ),
  beforeEach: () =>
    mockRpc({
      "dataRoom.autoSort.plan": { mode: "basic", reason: "ai_rejected", operations: [] },
    }),
};
