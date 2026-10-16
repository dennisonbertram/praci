import type { FinanceStatement } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent } from "storybook/test";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { StatementImport } from "./StatementImport";

const meta = {
  title: "Finance/StatementImport",
  component: StatementImport,
  args: { onImported: () => undefined },
  decorators: [
    (Story) => (
      <div className="w-[520px] max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StatementImport>;
export default meta;
type Story = StoryObj<typeof meta>;

const statement = (over: Partial<FinanceStatement> = {}): FinanceStatement => ({
  id: "stmt_1",
  accountId: null,
  fileName: "demo.csv",
  format: "csv",
  status: "review",
  institution: "Demo Bank",
  accountLast4: "0000",
  periodStart: "2026-01-01",
  periodEnd: "2026-01-31",
  openingBalanceCents: 100_000,
  closingBalanceCents: 90_000,
  transactionCount: 12,
  check: { balances: "match", differenceCents: 0 },
  createsAccount: true,
  duplicateCount: 0,
  warnings: [],
  error: null,
  uploadedAt: "2026-02-01T00:00:00.000Z",
  ...over,
});

const upload =
  (name: string) =>
  async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    const input = canvasElement.querySelector<HTMLInputElement>('input[type="file"]');
    if (input)
      await userEvent.upload(input, new File(["a,b"], name, { type: "text/csv" }), {
        applyAccept: false,
      });
    await new Promise((resolve) => setTimeout(resolve, 300));
  };

export const Empty: Story = {};

export const Imported: Story = {
  beforeEach: () =>
    mockRpc({ "finance.statementUpload": statement(), "finance.statementConfirm": null }),
  play: upload("demo.csv"),
};

export const Reading: Story = {
  beforeEach: () => mockRpc({ "finance.statementUpload": () => new Promise(() => undefined) }),
  play: upload("demo.csv"),
};

export const UnsupportedFile: Story = { play: upload("notes.txt") };

export const UnreadableFile: Story = {
  beforeEach: () =>
    mockRpc({
      "finance.statementUpload": statement({ status: "failed", error: "Could not read this file" }),
      "finance.statementDiscard": null,
    }),
  play: upload("demo.csv"),
};
