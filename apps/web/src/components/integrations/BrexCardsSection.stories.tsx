import type { BrexCardsList } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { screen, userEvent } from "storybook/test";
import { BrexCardsSection } from "./BrexCardsSection";

const cards: BrexCardsList = {
  serverId: "srv_brex",
  agentBotId: "bot_brex",
  writesEnabled: true,
  cards: [
    {
      cardId: "card_demo_1",
      name: "Design tools",
      lastFour: "4242",
      ownerUserId: "user_demo_1",
      status: "ACTIVE",
      limitCents: 20_000,
      currency: "USD",
      duration: "MONTHLY",
    },
    {
      // Same last four as the card above: the buttons act on the row's own card id.
      cardId: "card_demo_2",
      name: "Conference travel",
      lastFour: "4242",
      ownerUserId: "user_demo_2",
      status: "LOCKED",
      limitCents: 150_000,
      currency: "USD",
      duration: "ONE_TIME",
    },
    {
      // Brex has terminated this card: no action applies.
      cardId: "card_demo_3",
      name: "Old trial",
      lastFour: "1881",
      ownerUserId: "user_demo_1",
      status: "TERMINATED",
      limitCents: 1_000,
      currency: "USD",
      duration: "ONE_TIME",
    },
  ],
};

const meta = {
  title: "Integrations/BrexCardsSection",
  component: BrexCardsSection,
  args: { cards, error: null, onRetry: () => undefined },
} satisfies Meta<typeof BrexCardsSection>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Changes are off in the Agent section, so the row buttons wait. */
export const ChangesOff: Story = { args: { cards: { ...cards, writesEnabled: false } } };

export const NoAgent: Story = { args: { cards: { ...cards, agentBotId: null } } };

export const Loading: Story = { args: { cards: null } };

export const Empty: Story = { args: { cards: { ...cards, cards: [] } } };

export const LoadError: Story = { args: { cards: null, error: "Could not reach Brex" } };

export const EditLimit: Story = {
  play: async () => {
    const [first] = await screen.findAllByRole("button", { name: "Edit limit" });
    if (first) await userEvent.click(first);
  },
};

export const CancelCard: Story = {
  play: async () => {
    const [first] = await screen.findAllByRole("button", { name: "Cancel" });
    if (first) await userEvent.click(first);
  },
};
