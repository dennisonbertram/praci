import type { ScratchpadItem } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { mockRpc } from "../lib/__mocks__/rpc";
import { ScratchpadSection } from "./ScratchpadSection";

function item(
  id: string,
  title: string,
  status: ScratchpadItem["status"],
  notes = "",
  extra: Partial<ScratchpadItem> = {},
) {
  return {
    id,
    botId: "bot_demo",
    title,
    status,
    notes,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...extra,
  } satisfies ScratchpadItem;
}

const items = [
  item("s1", "Draft the sample report", "open", "Waiting on the demo figures."),
  item("s2", "Check the invented budget", "parked"),
  item("s3", "Send the sample summary", "done", "", {
    resolvedReason: "Sent the sample summary to the invented list.",
  }),
];

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

const itemsWithDates = [
  item("s4", "Get the sample contract signed", "open", "", {
    waitingOn: "Acme legal",
    dueAt: inDays(3),
  }),
  item("s5", "Confirm the invented venue", "open", "", { waitingOn: "Venue manager" }),
  item("s6", "Send the sample invoice", "open", "", { dueAt: inDays(-2) }),
  item("s7", "Collect the demo figures", "open", "", {
    waitingOn: "Finance",
    dueAt: inDays(-1),
  }),
  items[1],
  items[2],
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

export const LoadFails: Story = {
  beforeEach: () =>
    mockRpc({
      "scratchpad.list": () => {
        throw new Error("offline");
      },
    }),
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

/** Waiting on and due lines; a past-due date shows in the destructive colour. */
export const WaitingAndDue: Story = {
  beforeEach: () => mockRpc({ "scratchpad.list": itemsWithDates }),
};

/** Completing an item shows an Undo toast; the Done list keeps it with its reason and Reopen. */
export const DoneOpened: Story = {
  beforeEach: () => mockRpc({ "scratchpad.list": itemsWithDates }),
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByText(/^Done \(/));
  },
};

/** Removing a row hides it at once and holds the delete for the Undo window. */
export const RemovedPendingUndo: Story = {
  beforeEach: () => mockRpc({ "scratchpad.list": items, "scratchpad.remove": { ok: true } }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const [removeFirst] = await canvas.findAllByRole("button", { name: "Remove" });
    await userEvent.click(removeFirst as HTMLElement);
  },
};
