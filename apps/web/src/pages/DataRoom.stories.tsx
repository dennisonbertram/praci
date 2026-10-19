import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { mockRpc } from "../lib/__mocks__/rpc";
import { folders, items } from "../stories/fixtures/data-room";
import { DataRoomPage } from "./DataRoom";

const load = (list: typeof items) =>
  mockRpc({
    "dataRoom.folders": folders,
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
/** The Ask button opens the Data room agent's panel. */
export const WithAskAgent: Story = {
  beforeEach: () => load(items),
  render: () => <DataRoomPage onAskAgent={fn()} />,
};
export const Empty: Story = { beforeEach: () => load([]) };
