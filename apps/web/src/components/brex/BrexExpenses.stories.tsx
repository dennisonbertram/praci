import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { BrexExpenses } from "./BrexExpenses";
import { emptyExpensesFixture, expensesFixture } from "./fixtures";

const meta = {
  title: "Brex/Expenses",
  component: BrexExpenses,
  parameters: { initialEntries: ["/app/brex/expenses"] },
  decorators: [
    (Story) => (
      <div className="w-[880px] max-w-full text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BrexExpenses>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {
  beforeEach: () => mockRpc({ "brexCards.expenses": expensesFixture }),
};

export const Partial: Story = {
  beforeEach: () => mockRpc({ "brexCards.expenses": { ...expensesFixture, partial: true } }),
};

export const WritesOff: Story = {
  beforeEach: () =>
    mockRpc({
      "brexCards.expenses": { ...expensesFixture, writesEnabled: false, agentBotId: null },
    }),
};

export const Empty: Story = {
  beforeEach: () => mockRpc({ "brexCards.expenses": emptyExpensesFixture }),
};
