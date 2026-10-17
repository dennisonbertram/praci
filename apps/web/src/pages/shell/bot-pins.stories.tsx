import type { BotPins } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { spyOn, userEvent, waitFor, within } from "storybook/test";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { setHideAmounts } from "../../lib/hide-amounts-preference";
import { mockPins } from "../../stories/fixtures";
import { PinsList, PinsStrip } from "./bot-pins";

const meta = {
  title: "Shell/Bot pins",
  parameters: { docs: { description: { component: "Also shows: ItemRow" } } },
} satisfies Meta;
export default meta;

const none = () => undefined;
const withList = (items: { id: string; text: string; done: boolean }[]): BotPins => ({
  ...mockPins,
  list: { title: "This week", items },
});
const list = (pins: BotPins) => (
  <div className="w-72">
    <PinsList pins={pins} onPins={none} />
  </div>
);

export const Strip: StoryObj = {
  render: () => <PinsStrip pins={mockPins} onPins={none} />,
};

/** While amounts are hidden, every figure is masked and its unit kept. */
export const StripAmountsHidden: StoryObj = {
  beforeEach: () => {
    setHideAmounts(true);
    return () => setHideAmounts(false);
  },
  render: () => <PinsStrip pins={mockPins} onPins={none} />,
};

export const StripWithStatError: StoryObj = {
  render: () => (
    <PinsStrip
      pins={{
        ...mockPins,
        stats: [
          ...mockPins.stats,
          { id: "bad", label: "Balance", value: "-", error: "The source did not respond" },
        ],
      }}
      onPins={none}
    />
  ),
};

export const StripRefreshing: StoryObj = {
  beforeEach: () => mockRpc({ "pins.refresh": () => new Promise(() => undefined) }),
  render: () => <PinsStrip pins={mockPins} onPins={none} />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByLabelText("Refresh"));
  },
};

export const List: StoryObj = { render: () => list(mockPins) };

export const ListEmpty: StoryObj = { render: () => list(withList([])) };

export const ListLongItem: StoryObj = {
  render: () =>
    list(
      withList([
        {
          id: "a",
          text: "Review the sample budget with the finance team and send the notes to everyone who attended the meeting",
          done: false,
        },
        { id: "b", text: "Done item with long text that wraps onto a second line", done: true },
      ]),
    ),
};

export const EditingItem: StoryObj = {
  render: () => list(mockPins),
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByText("Send the demo invoice"));
  },
};

/** The save is retried once; a second failure shows the alert. */
export const ListSaveFailed: StoryObj = {
  beforeEach: () => {
    // The component logs each failed save; that is expected here.
    const log = spyOn(console, "error").mockImplementation(() => undefined);
    mockRpc({
      "pins.save": () => {
        throw new Error("offline");
      },
    });
    return () => log.mockRestore();
  },
  render: () => list(mockPins),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByLabelText("Send the demo invoice"));
    await waitFor(() => canvas.getByRole("alert"), { timeout: 5000 });
  },
};

/** The bot changed the list first, so the edit was not saved. */
export const ListConflict: StoryObj = {
  beforeEach: () =>
    mockRpc({ "pins.save": { ok: false, reason: "conflict", pins: { ...mockPins, revision: 2 } } }),
  render: () => list(mockPins),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByLabelText("Send the demo invoice"));
    await waitFor(() => canvas.getByRole("status"));
  },
};
