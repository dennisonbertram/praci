import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { BrexCards } from "./BrexCards";
import { brexCardsControlsFixture, cardsViewFixture } from "./fixtures";

const meta = {
  title: "Brex/Cards",
  component: BrexCards,
  decorators: [
    (Story) => (
      <div className="w-[880px] max-w-full text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BrexCards>;
export default meta;
type Story = StoryObj<typeof meta>;

const load =
  (data: unknown = cardsViewFixture) =>
  () =>
    mockRpc({
      "brexCards.cardsView": data,
      "brexCards.getControls": brexCardsControlsFixture,
      "threads.send": { ok: true },
    });

export const Tiles: Story = { beforeEach: load() };

export const List: Story = {
  beforeEach: load(),
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("button", { name: "List" }));
  },
};

export const Detail: Story = {
  beforeEach: load(),
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("button", { name: "Figma" }));
  },
};

export const NewCard: Story = {
  beforeEach: load(),
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("button", { name: "New card" }));
  },
};

export const AllowChangesOff: Story = {
  beforeEach: load({ ...cardsViewFixture, writesEnabled: false }),
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("button", { name: "Figma" }));
  },
};

export const ShowTerminated: Story = {
  beforeEach: load(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Status" }));
    await userEvent.click(
      await within(document.body).findByRole("menuitemcheckbox", { name: "Terminated" }),
    );
  },
};

export const NoMatches: Story = {
  beforeEach: load(),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      await canvas.findByPlaceholderText("Search name, vendor or last four"),
      "nothing here",
    );
  },
};

export const Partial: Story = {
  beforeEach: load({ ...cardsViewFixture, partial: true }),
};

export const Empty: Story = {
  beforeEach: load({ ...cardsViewFixture, cards: [] }),
};

export const Loading: Story = {};

export const Failed: Story = {
  beforeEach: () =>
    mockRpc({
      "brexCards.cardsView": () => Promise.reject(new Error("Could not load cards")),
      "brexCards.getControls": brexCardsControlsFixture,
    }),
};
