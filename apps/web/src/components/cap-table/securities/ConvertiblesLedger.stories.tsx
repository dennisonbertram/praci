import type { EquityConvertible } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { ConvertiblesLedger } from "./ConvertiblesLedger";

const HOLDERS = ["Juniper Seed Fund", "Rowan Angels LLC", "Mara Quint", "Oak Lane Capital"];

function convertible(index: number): EquityConvertible {
  const note = index % 4 === 3;
  const status = index === 5 ? "converted" : index === 7 ? "canceled" : "outstanding";
  return {
    id: `cv-${index}`,
    label: note ? `NOTE-${index}` : `SAFE-${index}`,
    stakeholderId: `sh-${index % 4}`,
    stakeholderName: HOLDERS[index % 4]!,
    blockId: note ? "block-notes" : "block-seed",
    blockName: note ? "Bridge notes" : "Seed SAFEs",
    kind: note ? "note" : "safe",
    status,
    closedOn: status === "outstanding" ? null : index === 7 ? "2024-08-11" : "2024-07-01",
    principalCents: String(25_000_000 * ((index % 3) + 1)),
    issueDate: `2024-0${(index % 8) + 1}-10`,
    interestRate: note ? "6.0000000000" : null,
    interestAccruedCents: note ? "1875000" : "0",
    totalCents: String(25_000_000 * ((index % 3) + 1) + (note ? 1_875_000 : 0)),
    valuationCapCents: index % 2 ? "800000000" : "1200000000",
    valuationCapType: "post_money",
    discountPercent: index % 3 === 0 ? "20.0000000000" : null,
    convertedToLabel: index === 5 ? "PA-14" : null,
  } as EquityConvertible;
}

const rows = Array.from({ length: 10 }, (_, index) => convertible(index + 1));

const meta = {
  title: "Cap table/Securities/ConvertiblesLedger",
  component: ConvertiblesLedger,
  args: { onOpen: () => {}, onAction: () => {} },
} satisfies Meta<typeof ConvertiblesLedger>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.convertibles.list": { items: rows, total: rows.length, page: 1, pageSize: 25 },
      "equity.convertibleTotals": { count: rows.length, principalCents: "550000000" },
    }),
};
export const ClosedInterestUnavailable: Story = {
  beforeEach: () => {
    const row = {
      ...convertible(11),
      kind: "note",
      status: "repaid",
      closedOn: null,
      interestAccruedCents: null,
      totalCents: null,
    } as EquityConvertible;
    return mockRpc({
      "equity.convertibles.list": { items: [row], total: 1, page: 1, pageSize: 25 },
      "equity.convertibleTotals": { count: 1, principalCents: row.principalCents },
    });
  },
};
export const Empty: Story = {
  beforeEach: () =>
    mockRpc({ "equity.convertibles.list": { items: [], total: 0, page: 1, pageSize: 25 } }),
};
export const Loading: Story = {
  beforeEach: () => mockRpc({ "equity.convertibles.list": () => new Promise(() => {}) }),
};
