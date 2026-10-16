import type { FinanceStatement } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { StatementGroup, type StatementRow } from "./StatementReviewCard";

const base: FinanceStatement = {
  id: "stmt_1",
  accountId: "acct_1",
  fileName: "sample-statement.pdf",
  format: "pdf",
  status: "imported",
  institution: "Sample Bank",
  accountLast4: "1234",
  periodStart: "2026-01-01",
  periodEnd: "2026-01-31",
  openingBalanceCents: 100_000,
  closingBalanceCents: 120_000,
  transactionCount: 14,
  check: { balances: "match", differenceCents: 0 },
  createsAccount: false,
  duplicateCount: 0,
  warnings: [],
  error: null,
  uploadedAt: "2026-02-01T00:00:00.000Z",
};

const row = (key: number, statement: Partial<FinanceStatement>, extra?: Partial<StatementRow>) => ({
  key,
  statement: { ...base, id: `stmt_${key}`, ...statement },
  busy: false,
  ...extra,
});

const meta = {
  title: "Finance/StatementReviewCard",
  component: StatementGroup,
  parameters: {
    docs: { description: { component: "Also shows: CheckLine, Row" } },
  },
  decorators: [
    (Story) => (
      <ul className="w-[480px]">
        <Story />
      </ul>
    ),
  ],
  args: { rows: [row(1, {})], onRemove: () => undefined },
} satisfies Meta<typeof StatementGroup>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NewAccountWithSeveralStatements: Story = {
  args: {
    rows: [
      row(1, { createsAccount: true }),
      row(2, { periodStart: "2026-02-01", periodEnd: "2026-02-28", duplicateCount: 3 }),
    ],
  },
};

export const BalanceMismatch: Story = {
  args: { rows: [row(1, { check: { balances: "mismatch", differenceCents: -2_550 } })] },
};

export const NoBalanceCheck: Story = {
  args: {
    rows: [
      row(1, {
        check: { balances: "unavailable", differenceCents: null },
        openingBalanceCents: null,
        closingBalanceCents: null,
      }),
    ],
  },
};

export const WarningsAndError: Story = {
  args: {
    rows: [
      row(
        1,
        {
          warnings: [
            "Read by an AI model, so check each line against the original.",
            "2 lines could not be read",
          ],
        },
        { error: "Could not remove this statement" },
      ),
    ],
  },
};

export const BusyWithoutPeriod: Story = {
  args: {
    rows: [
      row(
        1,
        { institution: null, accountLast4: null, periodStart: null, periodEnd: null },
        { busy: true },
      ),
    ],
  },
};
