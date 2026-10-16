import type { FinanceSource } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { FinanceSection, useFinanceStatus } from "./FinanceSection";

function Standalone(props: { sources: FinanceSource[]; onChanged: () => void }) {
  return <FinanceSection {...props} status={useFinanceStatus()} />;
}

const meta = {
  title: "Integrations/FinanceSection",
  component: Standalone,
  parameters: {
    docs: {
      description: {
        component:
          "Also shows: CryptoTile, AlchemyTile, ExchangeTile (rendered after the Mercury and Brex tiles)",
      },
    },
  },
  args: { sources: [], onChanged: () => undefined },
  decorators: [
    (Story) => (
      <div className="w-[860px] max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Standalone>;
export default meta;
type Story = StoryObj<typeof meta>;

const source = (
  provider: FinanceSource["provider"],
  status: FinanceSource["status"],
): FinanceSource => ({
  provider,
  serverId: status === "not_connected" ? null : `srv_${provider}`,
  status,
  lastSyncedAt: null,
});

const crypto = (connected: boolean, lastError: string | null = null) => ({
  connected,
  hasApiKey: connected,
  summary: null,
  holdings: [],
  wallets: [],
  lastError: null,
  alchemy: { connected, lastError },
});

const exchange = (provider: string, connected: boolean) => ({
  id: `ex_${provider}`,
  provider,
  connected,
  lastSyncedAt: null,
  lastError: null,
  totalCents: 0,
  balances: [],
});

export const NothingConnected: Story = {
  beforeEach: () => mockRpc({ "finance.crypto": crypto(false), "finance.exchanges": [] }),
};

export const Loading: Story = {
  beforeEach: () =>
    mockRpc({
      "finance.crypto": () => new Promise(() => undefined),
      "finance.exchanges": () => new Promise(() => undefined),
    }),
};

export const AllConnected: Story = {
  args: { sources: [source("mercury", "ok"), source("brex", "ok")] },
  beforeEach: () =>
    mockRpc({
      "finance.crypto": crypto(true),
      "finance.exchanges": [exchange("coinbase", true), exchange("kraken", true)],
    }),
};

export const NeedsReconnect: Story = {
  args: { sources: [source("mercury", "needs_reconnect"), source("brex", "error")] },
  beforeEach: () => mockRpc({ "finance.crypto": crypto(false), "finance.exchanges": [] }),
};

export const ConnectError: Story = {
  beforeEach: () =>
    mockRpc({
      "finance.crypto": crypto(false),
      "finance.exchanges": [],
      "finance.connect": () => {
        throw new Error("Could not connect");
      },
    }),
  play: async ({ canvasElement }) => {
    canvasElement
      .querySelector<HTMLButtonElement>('[data-testid="finance-tile-mercury"] button')
      ?.click();
    await new Promise((resolve) => setTimeout(resolve, 200));
  },
};

export const AlchemyLastError: Story = {
  beforeEach: () =>
    mockRpc({
      "finance.crypto": crypto(true, "The key was refused"),
      "finance.exchanges": [],
    }),
};
