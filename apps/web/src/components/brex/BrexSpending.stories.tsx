import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { BrexSpending } from "./BrexSpending";
import { emptySpendingFixture, spendingFixture } from "./fixtures";

const meta = {
  title: "Brex/Spending",
  component: BrexSpending,
  parameters: { initialEntries: ["/app/brex/spending"] },
} satisfies Meta<typeof BrexSpending>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  beforeEach: () => mockRpc({ "brexCards.spending": spendingFixture }),
};

export const Empty: Story = {
  beforeEach: () => mockRpc({ "brexCards.spending": emptySpendingFixture }),
};

export const Partial: Story = {
  beforeEach: () => mockRpc({ "brexCards.spending": { ...spendingFixture, partial: true } }),
};
