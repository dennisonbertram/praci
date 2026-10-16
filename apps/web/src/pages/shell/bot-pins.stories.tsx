import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockPins } from "../../stories/fixtures";
import { PinsList, PinsStrip } from "./bot-pins";

const meta = { title: "Shell/Bot pins" } satisfies Meta;
export default meta;

export const Strip: StoryObj = {
  render: () => <PinsStrip pins={mockPins} onPins={() => undefined} />,
};

export const List: StoryObj = {
  render: () => (
    <div className="w-72">
      <PinsList pins={mockPins} onPins={() => undefined} />
    </div>
  ),
};
