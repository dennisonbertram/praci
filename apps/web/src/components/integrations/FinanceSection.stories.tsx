import type { FinanceSource } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../stories/mock-rpc-5";
import { FinanceSection } from "./FinanceSection";

// Tiles load brand logos from the web; blank them so stories stay offline (AppLogo falls back to a letter).
let logosBlocked = false;
function blockRemoteLogos() {
  if (logosBlocked) return;
  logosBlocked = true;
  const remote = (value: string) => (/^https?:/.test(value) ? "" : value);
  const setAttribute = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (name: string, value: string) {
    return setAttribute.call(
      this,
      name,
      this instanceof HTMLImageElement && name === "src" ? remote(value) : value,
    );
  };
  const src = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
  if (src?.set) {
    const set = src.set;
    Object.defineProperty(HTMLImageElement.prototype, "src", {
      ...src,
      set(value: string) {
        set.call(this, remote(value));
      },
    });
  }
}

const meta = {
  title: "Integrations/FinanceSection",
  component: FinanceSection,
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
    (Story) => {
      blockRemoteLogos();
      return (
        <div className="w-[860px] max-w-full">
          <Story />
        </div>
      );
    },
  ],
} satisfies Meta<typeof FinanceSection>;
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
