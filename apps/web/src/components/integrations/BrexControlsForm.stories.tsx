import type { BrexCardsControls } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { screen, userEvent } from "storybook/test";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { BrexControlsForm } from "./BrexControlsForm";

const controls: BrexCardsControls = {
  maxNewCardLimitCents: 100_000,
  maxCardLimitCents: 500_000,
  maxSpendLimitBaseCents: 1_000_000,
  maxCardsPerDay: 5,
  allowedDurations: ["MONTHLY", "ONE_TIME"],
  oneTimeMaxDays: 90,
};

const meta = {
  title: "Integrations/BrexControlsForm",
  component: BrexControlsForm,
  beforeEach: () =>
    mockRpc({
      "brexCards.getControls": controls,
      "brexCards.setControls": (input: unknown) => input,
    }),
} satisfies Meta<typeof BrexControlsForm>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Loading: Story = {
  beforeEach: () => mockRpc({ "brexCards.getControls": () => new Promise(() => undefined) }),
};

export const LoadError: Story = {
  beforeEach: () =>
    mockRpc({
      "brexCards.getControls": () => {
        throw new Error("Could not reach Brex");
      },
    }),
};

/** A cap that is not a positive dollar amount is not saved; the field is marked. */
export const InvalidValue: Story = {
  play: async () => {
    const field = await screen.findByLabelText("Max limit for a new card");
    await userEvent.clear(field);
    await userEvent.type(field, "abc");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
  },
};

export const Saved: Story = {
  play: async () => {
    await userEvent.click(await screen.findByRole("button", { name: "Save" }));
  },
};
