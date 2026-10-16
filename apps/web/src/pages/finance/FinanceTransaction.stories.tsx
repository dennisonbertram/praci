import type { FinanceTransactionOutput } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { FinanceReceiptPage, FinanceTransactionPage, ReceiptIcon } from "./FinanceTransaction";

const spend: FinanceTransactionOutput = {
  transaction: {
    id: "txn_demo",
    provider: "mercury",
    externalId: "ext_demo",
    accountExternalId: "acct_ext_demo",
    postedAt: "2026-01-15T12:00:00.000Z",
    purchasedAt: null,
    amountCents: -42_500,
    currency: "USD",
    counterparty: "Acme Cloud",
    vendorKey: "acme-cloud",
    category: "Software",
    status: "posted",
    kind: "card",
    classification: "spend",
    cardLastFour: "4242",
    cardholder: "Sam Sample",
    memo: "Monthly hosting",
    hasReceipt: true,
    dashboardUrl: "https://example.com/transactions/demo",
  },
  vendorName: "Acme Cloud",
  account: {
    id: "acct_demo",
    provider: "mercury",
    externalId: "acct_ext_demo",
    name: "Operating",
    lastFour: "1234",
    kind: "checking",
    balanceCents: 5_000_000,
    currency: "USD",
  },
  vendorIsSubscription: false,
};

const withTxn = (patch: Partial<FinanceTransactionOutput["transaction"]>, rest = {}) => ({
  ...spend,
  ...rest,
  transaction: { ...spend.transaction, ...patch },
});

const receipt = { url: "https://example.com/receipt/demo", mimeType: "text/plain" };
const fail = (message: string) => () => {
  throw new Error(message);
};

const meta = {
  title: "Finance/Transaction",
  parameters: {
    docs: { description: { component: "Also shows: ReceiptThumb, CheckReceipt" } },
  },
} satisfies Meta;
export default meta;
type Story = StoryObj;

export const WithReceipt: Story = {
  beforeEach: () => mockRpc({ "finance.transaction": spend, "finance.receiptUrl": receipt }),
  render: () => <FinanceTransactionPage id="txn_demo" />,
};

export const Subscription: Story = {
  beforeEach: () =>
    mockRpc({
      "finance.transaction": { ...spend, vendorIsSubscription: true },
      "finance.receiptUrl": receipt,
    }),
  render: () => <FinanceTransactionPage id="txn_demo" />,
};

export const Pending: Story = {
  beforeEach: () =>
    mockRpc({
      "finance.transaction": withTxn({ status: "pending", memo: null, cardholder: null }),
    }),
  render: () => <FinanceTransactionPage id="txn_demo" />,
};

/** Mercury does not say whether a receipt exists, so the page offers a check. */
export const CheckForReceipt: Story = {
  beforeEach: () => mockRpc({ "finance.transaction": withTxn({ hasReceipt: false }) }),
  render: () => <FinanceTransactionPage id="txn_demo" />,
};

export const CheckFindsReceipt: Story = {
  beforeEach: () =>
    mockRpc({
      "finance.transaction": withTxn({ hasReceipt: false }),
      "finance.receiptUrl": receipt,
    }),
  render: () => <FinanceTransactionPage id="txn_demo" />,
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByText("Check for receipt"));
    await within(canvasElement).findByLabelText("Open receipt");
  },
};

export const CheckFindsNoReceipt: Story = {
  beforeEach: () =>
    mockRpc({
      "finance.transaction": withTxn({ hasReceipt: false }),
      "finance.receiptUrl": () => {
        throw Object.assign(new Error("none"), { code: "NOT_FOUND" });
      },
    }),
  render: () => <FinanceTransactionPage id="txn_demo" />,
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByText("Check for receipt"));
    await within(canvasElement).findAllByText("No receipt");
  },
};

export const BrexWithoutReceipt: Story = {
  beforeEach: () =>
    mockRpc({
      "finance.transaction": withTxn({ provider: "brex", hasReceipt: false, dashboardUrl: null }),
    }),
  render: () => <FinanceTransactionPage id="txn_demo" />,
};

/** Money in is not spend: no receipt section, and the crumbs go through Accounts. */
export const IncomingTransfer: Story = {
  beforeEach: () =>
    mockRpc({
      "finance.transaction": withTxn({ amountCents: 100_000, classification: "internal_transfer" }),
    }),
  render: () => <FinanceTransactionPage id="txn_demo" />,
};

export const Loading: Story = {
  beforeEach: () => mockRpc({ "finance.transaction": () => new Promise(() => undefined) }),
  render: () => <FinanceTransactionPage id="txn_demo" />,
};

export const LoadFailed: Story = {
  beforeEach: () => mockRpc({ "finance.transaction": fail("Could not load the transaction") }),
  render: () => <FinanceTransactionPage id="txn_demo" />,
};

export const ReceiptIconOnly: Story = { render: () => <ReceiptIcon /> };

export const ReceiptPage: Story = {
  beforeEach: () => mockRpc({ "finance.transaction": spend, "finance.receiptUrl": receipt }),
  render: () => <FinanceReceiptPage id="txn_demo" />,
};

export const ReceiptPageLoading: Story = {
  beforeEach: () => mockRpc({ "finance.transaction": () => new Promise(() => undefined) }),
  render: () => <FinanceReceiptPage id="txn_demo" />,
};

export const ReceiptPageFailed: Story = {
  beforeEach: () =>
    mockRpc({
      "finance.transaction": spend,
      "finance.receiptUrl": fail("Could not load the receipt"),
    }),
  render: () => <FinanceReceiptPage id="txn_demo" />,
};

/** Vendor links that are not https are never shown. */
export const ReceiptPageUnsafeLink: Story = {
  beforeEach: () =>
    mockRpc({
      "finance.transaction": spend,
      "finance.receiptUrl": { url: "http://example.com/receipt", mimeType: null },
    }),
  render: () => <FinanceReceiptPage id="txn_demo" />,
};

export const NotFound: Story = {
  beforeEach: () =>
    mockRpc({
      "finance.transaction": () =>
        Promise.reject(Object.assign(new Error("Not found"), { code: "NOT_FOUND" })),
    }),
  render: () => <FinanceTransactionPage id="missing" />,
};

export const PurchasedBeforePosted: Story = {
  name: "Card charge posted a day after purchase",
  beforeEach: () =>
    mockRpc({
      "finance.transaction": withTxn({
        provider: "brex",
        purchasedAt: "2026-01-14T12:00:00.000Z",
      }),
    }),
  render: () => <FinanceTransactionPage id="txn_demo" />,
};
