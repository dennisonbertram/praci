import type { ScratchpadItem } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { mockRpc } from "../stories/fixtures-9";
import { ScratchpadSection } from "./ScratchpadSection";

function item(id: string, title: string, status: ScratchpadItem["status"], notes = "") {
  return {
    id,
    botId: "bot_demo",
    title,
    status,
    notes,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  } satisfies ScratchpadItem;
}

const items = [
  item("s1", "Draft the sample report", "open", "Waiting on the demo figures."),
  item("s2", "Check the invented budget", "parked"),
  item("s3", "Send the sample summary", "done"),
];

const meta = {
  title: "Shell/Scratchpad section",
  component: ScratchpadSection,
  args: { botId: "bot_demo" },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ScratchpadSection>;
export default meta;

type Story = StoryObj<typeof meta>;

export const WithItems: Story = {
  beforeEach: () => mockRpc({ "scratchpad.list": items }),
};

export const Empty: Story = {
  beforeEach: () => mockRpc({ "scratchpad.list": [] }),
};

export const AddFails: Story = {
  beforeEach: () =>
    mockRpc({
      "scratchpad.list": items,
      "scratchpad.create": () => {
        throw new Error("failed");
      },
    }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(await canvas.findByLabelText("New open-work item"), "New sample item");
    await userEvent.click(canvas.getByRole("button", { name: "Add" }));
  },
};
