import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { mockRpc } from "../lib/__mocks__/rpc";
import { folders, items } from "../stories/fixtures/data-room";
import { DataRoomPage } from "./DataRoom";

const load = (list: typeof items) =>
  mockRpc({
    "dataRoom.folders": folders,
    "dataRoom.imports": [],
    "dataRoom.items.list": { items: list, nextCursor: null },
    "dataRoom.item": (input: unknown) =>
      items.find((item) => item.id === (input as { id: string }).id) ?? items[0],
  });

const meta = {
  title: "DataRoom/DataRoomPage",
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div className="flex h-[640px]">
        <Story />
      </div>
    ),
  ],
  render: () => <DataRoomPage />,
} satisfies Meta;
export default meta;
type Story = StoryObj;

export const WithItems: Story = { beforeEach: () => load(items) };
/** An import is running: one row at the top of the list shows its progress. */
export const Importing: Story = {
  beforeEach: () => {
    load(items);
    mockRpc({
      "dataRoom.imports": [
        {
          id: "imp_1",
          source: "drive",
          total: 5,
          done: 3,
          failed: 0,
          inProgress: 2,
          finished: false,
          latest: [],
        },
      ],
    });
  },
};
/** An import and file processing at once share one status line. */
export const ImportingAndProcessing: Story = {
  beforeEach: () => {
    load(items);
    mockRpc({
      "dataRoom.imports": [
        {
          id: "imp_1",
          source: "drive",
          total: 1104,
          done: 399,
          failed: 0,
          inProgress: 20,
          finished: false,
          latest: [],
        },
      ],
      "dataRoom.processing": {
        reading: 400,
        indexing: 300,
        tagging: 77,
        failed: 0,
        current: "Sample agreement.pdf",
      },
    });
  },
};
/** The Ask button opens the Data room agent's panel. */
export const WithAskAgent: Story = {
  beforeEach: () => load(items),
  render: () => <DataRoomPage onAskAgent={fn()} />,
};
export const Empty: Story = { beforeEach: () => load([]) };
