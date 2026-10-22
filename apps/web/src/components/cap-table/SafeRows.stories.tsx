import type { Safe } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { SafeRows } from "./SafeRows";

const safe = (id: string, investorName: string, extra: Partial<Safe> = {}): Safe => ({
  id,
  source: "native",
  contactId: null,
  roundId: null,
  investorName,
  investorEmail: null,
  amountCents: 5_000_000,
  valuationType: "post_money_cap",
  capCents: 100_000_000,
  discountPercent: null,
  mfn: false,
  proRata: false,
  governingState: null,
  investmentDate: null,
  expiresAt: null,
  canceledAt: null,
  sentAt: "2026-10-01T00:00:00.000Z",
  signedByOwnerAt: null,
  signedByInvestorAt: null,
  paidAt: null,
  documentUrl: null,
  status: "sent",
  createdAt: "2026-10-01T00:00:00.000Z",
  ...extra,
});

const meta = {
  title: "CapTable/SafeRows",
  component: SafeRows,
  decorators: [
    (Story) => (
      <div className="max-w-3xl p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SafeRows>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Amount over cap per row and in total; a Mercury discount SAFE shows a dash and adds nothing. */
export const AtCap: Story = {
  args: {
    safes: [
      safe("s1", "Lakeside Capital"),
      safe("s2", "Harbor Angels", { amountCents: 2_500_000, status: "funded" }),
      safe("s3", "Discount Fund", { source: "mercury", capCents: null, discountPercent: 20 }),
      safe("s4", "Draft Fund", { status: "draft", sentAt: null }),
    ],
  },
};
