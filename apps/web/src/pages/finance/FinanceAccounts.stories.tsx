import type {
  FinanceAccountOutput,
  FinanceAccountsOutput,
  FinanceCryptoOutput,
  FinanceExchange,
  FinanceTransaction,
} from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { FinanceAccountPage, FinanceAccountsPage } from "./FinanceAccounts";

type AccountRow = FinanceAccountsOutput["cash"][number];

const treasury: AccountRow = {
  id: "acct_treasury",
  provider: "mercury",
  externalId: "ext_2",
  name: "Reserve treasury",
  lastFour: null,
  kind: "treasury",
  balanceCents: 12_000_000,
  currency: "USD",
  annualYieldPct: 4.2,
};

const card: AccountRow = {
  id: "acct_card",
  provider: "brex",
  externalId: "ext_3",
  name: "Team card",
  lastFour: "9876",
  kind: "card",
  balanceCents: 320_000,
  currency: "USD",
  annualYieldPct: null,
};

const accounts: FinanceAccountsOutput = {
  totalCashCents: 18_450_000,
  cardOwedCents: 320_000,
  history: [],
  cash: [
    {
      id: "acct_checking",
      provider: "mercury",
      externalId: "ext_1",
      name: "Operating checking",
      lastFour: "4321",
      kind: "checking",
      balanceCents: 6_450_000,
      currency: "USD",
      annualYieldPct: null,
    },
    treasury,
  ],
  cards: [card],
};

const wallet = {
  id: "wallet_1",
  address: "0x1111111111111111111111111111111111111111",
  ensName: null,
  label: "Demo wallet",
  type: "personal" as const,
  safeOwners: null,
  safeThreshold: null,
};

const crypto: FinanceCryptoOutput = {
  connected: true,
  hasApiKey: false,
  summary: {
    totalCents: 250_000,
    byChain: [{ chainId: 1, cents: 250_000 }],
    byWallet: [{ walletId: "wallet_1", cents: 250_000 }],
    lastSyncedAt: "2026-01-01T00:00:00.000Z",
    unpricedTokenCount: 0,
  },
  holdings: [],
  wallets: [wallet, { ...wallet, id: "wallet_2", label: null, type: "safe" as const }],
  lastError: null,
  alchemy: { connected: false, lastError: null },
};

const exchange: FinanceExchange = {
  id: "exch_1",
  provider: "coinbase",
  connected: true,
  lastSyncedAt: "2026-01-01T00:00:00.000Z",
  lastError: null,
  totalCents: 120_000,
  balances: [],
};

const points = Array.from({ length: 12 }, (_, i) => ({
  day: `2026-01-${String(i + 1).padStart(2, "0")}`,
  balanceCents: 15_000_000 + i * 300_000,
}));

const loaded = {
  "finance.accounts": accounts,
  "finance.crypto": crypto,
  "finance.exchanges": [exchange],
  "finance.preferences": { runwayCrypto: "bank" },
  "finance.balanceSeries": { range: "year", points },
};

const meta = {
  title: "Finance/Accounts",
  component: FinanceAccountsPage,
  decorators: [
    (Story) => (
      <div className="@container w-[760px]">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: { description: { component: "Also shows: AccountTable, CryptoGroup" } },
  },
} satisfies Meta<typeof FinanceAccountsPage>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = { beforeEach: () => mockRpc(loaded) };

export const FilteredToOneSource: Story = {
  args: { source: "brex" },
  beforeEach: () => mockRpc(loaded),
};

export const CashOnly: Story = {
  beforeEach: () =>
    mockRpc({
      ...loaded,
      "finance.accounts": { ...accounts, cardOwedCents: null, cards: [] },
      "finance.crypto": {
        ...crypto,
        wallets: [],
        summary: { ...crypto.summary, totalCents: 0, byWallet: [] },
      },
      "finance.exchanges": [],
    }),
};

export const Loading: Story = {
  beforeEach: () => mockRpc({ "finance.accounts": () => new Promise(() => undefined) }),
};

export const LoadFailed: Story = {
  beforeEach: () =>
    mockRpc({
      "finance.accounts": () => {
        throw new Error("Could not load accounts.");
      },
    }),
};

const transaction: FinanceTransaction = {
  id: "txn_1",
  provider: "mercury",
  externalId: "ext_t1",
  accountExternalId: "ext_1",
  postedAt: "2026-01-05T12:00:00.000Z",
  purchasedAt: null,
  amountCents: -4_500,
  currency: "USD",
  counterparty: "Sample Supplies",
  vendorKey: "sample-supplies",
  category: "Office",
  status: "posted",
  kind: "debit",
  classification: "spend",
  cardLastFour: null,
  cardholder: null,
  memo: null,
  hasReceipt: false,
  dashboardUrl: null,
};

const account: FinanceAccountOutput = {
  account: treasury,
  history: [
    { month: "2025-11", balanceCents: 11_000_000 },
    { month: "2025-12", balanceCents: 11_500_000 },
    { month: "2026-01", balanceCents: 12_000_000 },
  ],
  treasuryYield: [
    {
      accountExternalId: "ext_2",
      month: "2026-01",
      dividendsCents: 42_000,
      feeCents: 2_000,
      netCents: 40_000,
    },
    {
      accountExternalId: "ext_2",
      month: "2025-12",
      dividendsCents: 39_000,
      feeCents: 2_000,
      netCents: 37_000,
    },
  ],
  transactions: [
    transaction,
    {
      ...transaction,
      id: "txn_2",
      amountCents: 250_000,
      classification: "revenue",
      counterparty: "Demo Customer",
    },
  ],
};

export const AccountDetail: StoryObj<typeof FinanceAccountPage> = {
  render: () => <FinanceAccountPage id="acct_treasury" />,
  beforeEach: () => mockRpc({ "finance.account": account }),
};

export const CardDetail: StoryObj<typeof FinanceAccountPage> = {
  render: () => <FinanceAccountPage id="acct_card" />,
  beforeEach: () =>
    mockRpc({
      "finance.account": { ...account, account: card, treasuryYield: [], transactions: [] },
    }),
};

/** An account made from an uploaded statement: named from the file, with Rename in the title row. */
export const StatementAccountDetail: StoryObj<typeof FinanceAccountPage> = {
  render: () => <FinanceAccountPage id="acct_statement" />,
  beforeEach: () =>
    mockRpc({
      "finance.account": {
        ...account,
        account: {
          ...treasury,
          id: "acct_statement",
          provider: "statement",
          kind: "checking",
          name: "mock firstbank",
          lastFour: null,
          annualYieldPct: null,
        },
        treasuryYield: [],
      },
    }),
};

export const AccountLoadFailed: StoryObj<typeof FinanceAccountPage> = {
  render: () => <FinanceAccountPage id="acct_missing" />,
  beforeEach: () =>
    mockRpc({
      "finance.account": () => {
        throw new Error("Account not found.");
      },
    }),
};

export const BrexCashWithUnknownCardBalance: Story = {
  name: "Brex filter, card balance not shared",
  args: { source: "brex" },
  beforeEach: () =>
    mockRpc({
      ...loaded,
      "finance.accounts": {
        ...accounts,
        cardOwedCents: null,
        cards: [],
        cash: [
          ...accounts.cash,
          {
            ...accounts.cash[0],
            id: "acct_brex",
            provider: "brex",
            name: "Business account",
            lastFour: null,
            balanceCents: 30_000,
          },
        ],
      },
    }),
};

export const UnknownSourceFilter: Story = {
  args: { unknownSource: "chase" },
  beforeEach: () => mockRpc(loaded),
};
