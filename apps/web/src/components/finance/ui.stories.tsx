import type { BreakdownRow, FinanceTransaction } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import {
  AskAgentButton,
  BreakdownRows,
  BurnLegend,
  Chevron,
  Chip,
  DetailHead,
  DetailPage,
  ErrorNotice,
  FinanceChromeProvider,
  Kpi,
  Kv,
  KvRow,
  NotFoundNotice,
  PeriodTabs,
  Section,
  Th,
  TransactionTable,
  ValueLink,
} from "./ui";

const meta = {
  title: "Finance/Shared UI",
  decorators: [
    (Story) => (
      <div className="@container w-[44rem] max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const crumbs = [
  { label: "Finance", to: "/finance" },
  { label: "Vendors", to: "/finance/vendors" },
  { label: "Sample Cloud Co" },
];

const rows: BreakdownRow[] = [
  { key: "software", label: "Software", cents: 420000 },
  { key: "travel", label: "Travel", cents: 260000 },
  {
    key: "a-very-long-category-name-that-must-truncate",
    label: "A very long category name that must truncate",
    cents: 90000,
  },
  { key: "meals", label: "Meals", cents: 12000 },
];

const base: FinanceTransaction = {
  id: "txn_1",
  provider: "mercury",
  externalId: "ext_1",
  accountExternalId: "acct_1",
  postedAt: "2026-03-04T12:00:00.000Z",
  purchasedAt: null,
  amountCents: -12900,
  currency: "USD",
  counterparty: "Sample Cloud Co",
  vendorKey: "sample-cloud-co",
  category: "Software",
  status: "posted",
  kind: "card",
  classification: "spend",
  cardLastFour: "4242",
  cardholder: null,
  memo: "Monthly hosting",
  hasReceipt: false,
  dashboardUrl: null,
};
const transactions: FinanceTransaction[] = [
  base,
  {
    ...base,
    id: "txn_2",
    counterparty: "Demo Airline",
    category: null,
    status: "pending",
    memo: null,
    amountCents: -48050,
  },
  {
    ...base,
    id: "txn_3",
    counterparty: "Example Customer Inc",
    category: "Revenue",
    amountCents: 250000,
    status: "other",
    memo: "Invoice 1001, a long memo line that should clamp to a single line in the table row",
  },
];

const withAgent = (Story: () => React.ReactElement) => (
  <FinanceChromeProvider value={{ onAskAgent: () => undefined }}>
    <Story />
  </FinanceChromeProvider>
);

export const AskAgent: Story = {
  decorators: [(Story) => withAgent(Story)],
  render: () => <AskAgentButton />,
};

export const AskAgentHidden: Story = {
  name: "Ask agent hidden (panel open)",
  render: () => (
    <div>
      <AskAgentButton />
      <span className="text-xs text-muted-foreground">Nothing renders above.</span>
    </div>
  ),
};

export const DetailHeadWithAgent: Story = {
  decorators: [(Story) => withAgent(Story)],
  render: () => <DetailHead crumbs={crumbs} />,
};

export const DetailHeadSingleCrumb: Story = {
  render: () => <DetailHead crumbs={[{ label: "Finance" }]} />,
};

export const ErrorNoticeDefault: Story = {
  name: "Error notice",
  render: () => <ErrorNotice message="Could not load vendors." onRetry={() => undefined} />,
};

export const DetailPageLoaded: Story = {
  decorators: [(Story) => withAgent(Story)],
  render: () => (
    <DetailPage
      crumbs={crumbs}
      title="Sample Cloud Co"
      subtitle="3 transactions since January"
      action={<Chip to="/finance">Software</Chip>}
      loading={false}
      error=""
      onRetry={() => undefined}
    >
      <Section title="Summary">Body content</Section>
    </DetailPage>
  ),
};

export const DetailPageLoading: Story = {
  render: () => <DetailPage crumbs={crumbs} loading error="" onRetry={() => undefined} />,
};

export const DetailPageError: Story = {
  render: () => (
    <DetailPage crumbs={crumbs} loading={false} error="Request failed." onRetry={() => undefined} />
  ),
};

export const SectionWithTitleAndAction: Story = {
  render: () => (
    <Section title="Top vendors" action={<Chip to="/finance/vendors">View all</Chip>}>
      <p>Section body.</p>
    </Section>
  ),
};

export const SectionPlain: Story = {
  render: () => <Section>Section with no heading.</Section>,
};

export const Kpis: Story = {
  name: "Kpi",
  render: () => (
    <div className="grid grid-cols-2 gap-3">
      <Kpi title="Cash" value="$128,400" sub="across 3 accounts" />
      <Kpi title="Burn" value="$21,300" sub="per month" to="/finance/burn" />
      <Kpi
        title="Runway"
        value="14 months"
        to="/finance/runway"
        hover={<span>Sample hover detail</span>}
      />
      <Kpi title="Open invoices" value="3" />
    </div>
  ),
};

export const Breakdown: Story = {
  name: "Breakdown rows",
  render: () => (
    <Section title="By category">
      <BreakdownRows rows={rows} to={(row) => `/finance/category/${row.key}`} swatches />
    </Section>
  ),
};

export const BreakdownNoSwatches: Story = {
  render: () => <BreakdownRows rows={rows} to={(row) => `/finance/category/${row.key}`} />,
};

export const BreakdownEmpty: Story = {
  render: () => <BreakdownRows rows={[]} to={() => "/"} />,
};

export const Transactions: Story = {
  name: "Transaction table",
  render: () => <TransactionTable rows={transactions} />,
};

export const TransactionsEmpty: Story = {
  render: () => <TransactionTable rows={[]} />,
};

export const TableParts: Story = {
  name: "Th and Chevron",
  render: () => (
    <table className="w-full">
      <thead>
        <tr>
          <Th>Name</Th>
          <Th right>Amount</Th>
          <Th />
        </tr>
      </thead>
      <tbody>
        <tr className="group/row">
          <td>Row</td>
          <td className="text-end">$1.00</td>
          <Chevron />
        </tr>
      </tbody>
    </table>
  ),
};

export const Chips: Story = {
  name: "Chip",
  render: () => (
    <div className="flex gap-2">
      <Chip to="/a" on>
        Active
      </Chip>
      <Chip to="/b">Inactive</Chip>
    </div>
  ),
};

export const Periods: Story = {
  name: "Period tabs",
  render: () => {
    const [value, setValue] = useState<"week" | "month" | "quarter" | "year">("month");
    return <PeriodTabs value={value} onChange={setValue} />;
  },
};

export const KeyValues: Story = {
  name: "Kv, KvRow and ValueLink",
  render: () => (
    <Kv>
      <KvRow label="Counterparty">
        <ValueLink to="/finance/vendors/sample">Sample Cloud Co</ValueLink>
      </KvRow>
      <KvRow label="Memo">
        A long memo that wraps across more than one line to show how the value column behaves when
        the text is much longer than the available width of the container.
      </KvRow>
    </Kv>
  ),
};

export const NotFound: Story = {
  name: "Not found notice",
  render: () => <NotFoundNotice />,
};

export const DetailPageNotFound: Story = {
  render: () => (
    <DetailPage
      crumbs={crumbs}
      loading={false}
      error="Not found"
      notFound
      onRetry={() => undefined}
    />
  ),
};

export const BurnChartLegend: Story = {
  render: () => <BurnLegend />,
};

export const PeriodsNoneSelected: Story = {
  name: "Periods with none selected (a custom range is shown)",
  render: () => <PeriodTabs value={null} onChange={() => undefined} />,
};
