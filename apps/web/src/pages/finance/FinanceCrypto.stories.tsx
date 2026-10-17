import type { FinanceCryptoOutput, FinanceExchange, FinanceWallet } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { mockRpc, resetRpcMocks } from "../../lib/__mocks__/rpc";
import { FinanceCryptoPage } from "./FinanceCrypto";

const addr = (n: number) => `0x${n.toString(16).padStart(40, "0")}`;

const wallets: FinanceWallet[] = [
  {
    id: "w1",
    address: addr(1),
    ensName: null,
    label: "Operating",
    type: "personal",
    safeOwners: null,
    safeThreshold: null,
  },
  {
    id: "w2",
    address: addr(2),
    ensName: "demo.example",
    label: null,
    type: "safe",
    safeOwners: [addr(3), addr(4), addr(5)],
    safeThreshold: 2,
  },
];

const base: FinanceCryptoOutput = {
  connected: true,
  hasApiKey: true,
  summary: {
    totalCents: 1_250_000,
    stablecoinCents: 1_000_000,
    byChain: [
      { chainId: 1, cents: 900_000 },
      { chainId: 8453, cents: 350_000 },
    ],
    byWallet: [
      { walletId: "w1", cents: 800_000 },
      { walletId: "w2", cents: 450_000 },
    ],
    lastSyncedAt: new Date(Date.now() - 3_600_000).toISOString(),
    unpricedTokenCount: 2,
  },
  holdings: [
    {
      walletId: "w1",
      chainId: 1,
      tokenAddress: null,
      symbol: "ETH",
      name: "Ether",
      decimals: 18,
      rawBalance: "1500000000000000000",
      usdPrice: "2000",
      usdValueCents: 300_000,
      syncedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      walletId: "w1",
      chainId: 8453,
      tokenAddress: addr(9),
      symbol: "USDX",
      name: "Sample Dollar",
      decimals: 6,
      rawBalance: "800000000000",
      usdPrice: "1",
      usdValueCents: 80_000_000,
      syncedAt: "2026-01-01T00:00:00.000Z",
    },
    {
      walletId: "w2",
      chainId: 1,
      tokenAddress: addr(10),
      symbol: "JUNK",
      name: "Unpriced token",
      decimals: 18,
      rawBalance: "5000000000000000000",
      usdPrice: null,
      usdValueCents: null,
      syncedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
  wallets,
  lastError: null,
  alchemy: { connected: false, lastError: null },
};

const history = {
  points: Array.from({ length: 30 }, (_, i) => ({
    day: `2026-01-${String(i + 1).padStart(2, "0")}`,
    stablecoinCents: 800_000 + i * 5_000,
    otherCryptoCents: 200_000 + (i % 7) * 4_000,
  })),
};

const exchange: FinanceExchange = {
  id: "ex1",
  provider: "coinbase",
  connected: true,
  lastSyncedAt: "2026-01-01T00:00:00.000Z",
  lastError: null,
  totalCents: 250_000,
  balances: [{ asset: "BTC", amount: "0.05", usdPrice: "50000", usdValueCents: 250_000 }],
};

const load = (
  crypto: FinanceCryptoOutput | (() => Promise<never>) | null,
  exchanges: FinanceExchange[] = [],
) =>
  mockRpc({
    "finance.crypto": crypto,
    "finance.cryptoHistory": history,
    "finance.exchanges": exchanges,
    "finance.walletRemove": null,
  });

const meta = {
  beforeEach: () => resetRpcMocks(),
  title: "Finance/FinanceCryptoPage",
  parameters: {
    layout: "fullscreen",
    docs: {
      description: { component: "Also shows: WalletRows, RemoveDialog (RemoveWalletConfirm)." },
    },
  },
  render: () => <FinanceCryptoPage />,
} satisfies Meta;
export default meta;
type Story = StoryObj;

export const Default: Story = { beforeEach: () => load(base) };

export const WithExchange: Story = { beforeEach: () => load(base, [exchange]) };

export const NotConnected: Story = {
  beforeEach: () => load({ ...base, connected: false, hasApiKey: false }),
};

/** Balances work without a key; the page offers the optional Blockscout key without claiming it is needed. */
export const NoBlockscoutKey: Story = {
  beforeEach: () => load({ ...base, connected: true, hasApiKey: false }),
};

export const NoWallets: Story = {
  beforeEach: () =>
    load({
      ...base,
      wallets: [],
      holdings: [],
      summary: {
        ...base.summary,
        totalCents: 0,
        byChain: [],
        byWallet: [],
        lastSyncedAt: null,
        unpricedTokenCount: 0,
      },
    }),
};

export const SyncError: Story = {
  beforeEach: () => load({ ...base, lastError: "Could not reach the data provider" }),
};

export const Loading: Story = {
  beforeEach: () => mockRpc({ "finance.crypto": () => new Promise(() => undefined) }),
};

export const LoadFailed: Story = {
  beforeEach: () => mockRpc({ "finance.crypto": () => Promise.reject(new Error("offline")) }),
};

export const RemoveWalletConfirm: Story = {
  beforeEach: () => load(base),
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(await body.findByRole("button", { name: "Actions for Operating" }));
    await userEvent.click(await body.findByRole("menuitem", { name: "Remove" }));
  },
};
