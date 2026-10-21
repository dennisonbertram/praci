import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { setHideAmounts } from "../../lib/hide-amounts-preference";
import { manyDocuments, noDocuments } from "../../stories/fixtures/data-room-stats";
import { DataRoomStats } from "./DataRoomStats";

const meta = {
  title: "DataRoom/DataRoomStats",
  component: DataRoomStats,
  parameters: { layout: "fullscreen" },
  args: {
    stats: manyDocuments,
    scope: "All items",
    filtered: false,
    onClearFilters: fn(),
    onPick: fn(),
    onOpenItem: fn(),
  },
  decorators: [
    (Story) => (
      <div className="max-w-5xl bg-background">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DataRoomStats>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A room with more than a thousand documents. */
export const ManyDocuments: Story = { beforeEach: () => setHideAmounts(false) };
/** Money hidden: the amounts show as masked text, with no bars. */
export const AmountsHidden: Story = {
  beforeEach: () => {
    setHideAmounts(true);
    return () => setHideAmounts(false);
  },
};
/** One folder, with a filter set. */
export const FolderFiltered: Story = {
  args: { scope: "Investors / 2026", filtered: true },
  beforeEach: () => setHideAmounts(false),
};
export const Empty: Story = { args: { stats: noDocuments, filtered: true } };
export const Loading: Story = { args: { stats: null } };
export const Failed: Story = {
  args: { stats: null, error: "Could not load stats", onRetry: fn() },
};
/** Two months of documents: the bars stay narrow instead of filling the width. */
export const FewMonths: Story = {
  args: {
    stats: {
      ...manyDocuments,
      dates: {
        unit: "month",
        buckets: [
          { key: "2026-03", count: 1 },
          { key: "2026-04", count: 1 },
        ],
      },
    },
  },
};
