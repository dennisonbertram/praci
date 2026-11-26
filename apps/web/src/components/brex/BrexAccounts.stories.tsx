import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { BrexAccounts } from "./BrexAccounts";
import { accountsFixture, emptyAccountsFixture } from "./fixtures";

const meta = {
  title: "Brex/Accounts",
  component: BrexAccounts,
  parameters: { initialEntries: ["/app/brex/accounts"] },
  decorators: [
    (Story) => (
      <div className="w-[880px] max-w-full text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BrexAccounts>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Normal: Story = {
  beforeEach: () => mockRpc({ "brexCards.accounts": accountsFixture }),
};

export const Empty: Story = {
  beforeEach: () => mockRpc({ "brexCards.accounts": emptyAccountsFixture }),
};
