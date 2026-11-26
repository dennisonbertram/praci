import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { BrexPage } from "./BrexPage";
import {
  accountsFixture,
  activityFixture,
  expensesFixture,
  limitsFixture,
  overviewFixture,
  tripsFixture,
} from "./fixtures";

const meta = {
  title: "Brex/Page",
  component: BrexPage,
  parameters: { initialEntries: ["/app/brex"] },
} satisfies Meta<typeof BrexPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Connected: Story = {
  beforeEach: () => mockRpc({ "brexCards.overview": overviewFixture }),
};

export const SectionPlaceholder: Story = {
  parameters: { initialEntries: ["/app/brex/spending"] },
  beforeEach: () => mockRpc({ "brexCards.overview": overviewFixture }),
};

export const Expenses: Story = {
  parameters: { initialEntries: ["/app/brex/expenses"] },
  beforeEach: () =>
    mockRpc({ "brexCards.overview": overviewFixture, "brexCards.expenses": expensesFixture }),
};

export const Accounts: Story = {
  parameters: { initialEntries: ["/app/brex/accounts"] },
  beforeEach: () =>
    mockRpc({ "brexCards.overview": overviewFixture, "brexCards.accounts": accountsFixture }),
};

export const Travel: Story = {
  parameters: { initialEntries: ["/app/brex/travel"] },
  beforeEach: () =>
    mockRpc({ "brexCards.overview": overviewFixture, "brexCards.trips": tripsFixture }),
};

export const Activity: Story = {
  parameters: { initialEntries: ["/app/brex/activity"] },
  beforeEach: () =>
    mockRpc({ "brexCards.overview": overviewFixture, "brexCards.activity": activityFixture }),
};

export const NotConnected: Story = {
  beforeEach: () =>
    mockRpc({
      "brexCards.overview": () =>
        Promise.reject(
          Object.assign(new Error("Brex cards are not connected"), { code: "NOT_FOUND" }),
        ),
    }),
};

export const OverviewFailed: Story = {
  parameters: { initialEntries: ["/app/brex/limits"] },
  beforeEach: () =>
    mockRpc({
      "brexCards.overview": () => Promise.reject(new Error("Brex could not be reached")),
      "brexCards.limits": limitsFixture,
    }),
};
