import type { EquityTransaction } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { ActivityLog } from "./ActivityLog";

const tx = (over: Partial<EquityTransaction> & Pick<EquityTransaction, "id" | "kind">) =>
  ({
    effectiveDate: "2026-03-01",
    reason: null,
    certificateId: null,
    convertibleId: null,
    optionGrantId: null,
    planId: null,
    securityLabel: null,
    quantity: null,
    valueCents: null,
    before: null,
    after: null,
    resulting: [],
    note: null,
    actorName: "Sam Example",
    createdAt: "2026-03-01T15:30:00.000Z",
    ...over,
  }) satisfies EquityTransaction;

const rows: EquityTransaction[] = [
  tx({
    id: "t4",
    kind: "stock_split",
    effectiveDate: "2026-06-01",
    createdAt: "2026-06-01T09:00:00.000Z",
    note: "2-for-1 split",
    before: { ratio: "1" },
    after: { ratio: "2" },
  }),
  tx({
    id: "t3",
    kind: "cancel",
    securityLabel: "CS-3",
    quantity: "5000",
    reason: "write_off_cancel",
    createdAt: "2026-05-02T12:00:00.000Z",
    before: { status: "outstanding" },
    after: { status: "canceled" },
  }),
  tx({
    id: "t2",
    kind: "transfer",
    securityLabel: "CS-2",
    quantity: "20000",
    valueCents: "2000000",
    createdAt: "2026-04-10T10:00:00.000Z",
    before: { holder: "Avery Sample" },
    after: { holder: "Blue Example Fund" },
  }),
  tx({
    id: "t1",
    kind: "issue",
    securityLabel: "PA-1",
    quantity: "1500000",
    valueCents: "150000000",
    after: { quantity: "1500000", shareClass: "Series A Preferred" },
  }),
];

const meta = {
  title: "Cap table/Activity log",
  component: ActivityLog,
  decorators: [
    (Story) => (
      <div className="w-full max-w-5xl text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ActivityLog>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Issues, a transfer, a cancellation and a split. */
export const WithActivity: Story = {
  beforeEach: () =>
    mockRpc({ "equity.transactions.list": { items: rows, total: 4, page: 1, pageSize: 25 } }),
};

/** An expanded certificate legend with a long, unbroken token. */
export const LongCertificateLegend: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.transactions.list": {
        items: [
          tx({
            id: "long-certificate-legend",
            kind: "issue",
            certificateId: "certificate-1",
            securityLabel: "CS-2",
            before: { certificateLegend: "Original certificate" },
            after: { certificateLegend: `CERTIFICATE-${"A".repeat(180)}` },
          }),
        ],
        total: 1,
        page: 1,
        pageSize: 25,
      },
    }),
};

/** A ledger with no changes yet. */
export const Empty: Story = {
  beforeEach: () =>
    mockRpc({ "equity.transactions.list": { items: [], total: 0, page: 1, pageSize: 25 } }),
};

/** The response is still on its way. */
export const Loading: Story = {
  beforeEach: () =>
    mockRpc({ "equity.transactions.list": () => new Promise<never>(() => undefined) }),
};

/** The server could not answer. */
export const Failed: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.transactions.list": () => {
        throw new Error("The activity log is unavailable.");
      },
    }),
};
