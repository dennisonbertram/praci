import type { EquityOverview } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { byStakeholderFixture } from "../views/fixtures";
import { CapTableOverview } from "./CapTableOverview";
import { demoOverview } from "./demo-overview";

const overview: EquityOverview = {
  hasLedger: true,
  canImport: false,
  importedAt: "2026-10-01",
  asOf: "2026-10-15",
  totals: {
    outstandingShares: "10100000",
    fullyDilutedShares: "12000000",
    commonShares: "7000000",
    preferredShares: "4100000",
    availablePlanShares: "900000",
    amountRaisedCents: "500000000",
  },
  classes: [
    {
      shareClassId: "sc-common",
      name: "Common",
      classType: "common",
      authorizedShares: "10000000",
      outstandingShares: "7000000",
      outstandingPercent: "69.3069",
      fullyDilutedShares: "7000000",
      fullyDilutedPercent: "58.3333",
      amountRaisedCents: "0",
    },
    {
      shareClassId: "sc-seed",
      name: "Seed Preferred",
      classType: "preferred",
      authorizedShares: "4100000",
      outstandingShares: "4100000",
      outstandingPercent: "40.5941",
      fullyDilutedShares: "4100000",
      fullyDilutedPercent: "34.1667",
      amountRaisedCents: "500000000",
    },
  ],
  plans: [
    {
      planId: "plan-1",
      name: "2026 Stock Plan",
      outstandingShares: "300000",
      availableShares: "900000",
      fullyDilutedPercent: "10.0000",
    },
  ],
  convertibles: [
    {
      blockId: "block-1",
      name: "Sample Capital SAFE",
      principalCents: "25000000",
      interestCents: "1500000",
      outstandingDebtCents: "26500000",
      amountRaisedCents: "25000000",
    },
  ],
  counts: {
    stakeholders: 4,
    shareClasses: 2,
    plans: 1,
    certificates: 3,
    convertibles: 1,
    optionGrants: 4,
    fundingRounds: 1,
  },
};

const EMPTY: EquityOverview = {
  ...overview,
  hasLedger: false,
  importedAt: null,
  totals: {
    outstandingShares: "0",
    fullyDilutedShares: "0",
    commonShares: "0",
    preferredShares: "0",
    availablePlanShares: "0",
    amountRaisedCents: "0",
  },
  classes: [],
  plans: [],
  convertibles: [],
  counts: {
    stakeholders: 0,
    shareClasses: 0,
    plans: 0,
    certificates: 0,
    convertibles: 0,
    optionGrants: 0,
    fundingRounds: 0,
  },
};

const noViews = { items: [], total: 0, page: 1, pageSize: 500 };

const meta = {
  title: "Cap table/Overview",
  component: CapTableOverview,
  decorators: [
    (Story) => (
      <div className="w-full max-w-4xl text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CapTableOverview>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A ledger with common, preferred, a plan and a convertible. */
export const WithData: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.overview": overview,
      "equity.views.capTableByStakeholder": byStakeholderFixture,
      "equity.savedViews.list": noViews,
    }),
};

/** The invented demo ledger the demo stack seeds (Northwind Robotics). */
export const DemoLedger: Story = {
  beforeEach: () =>
    mockRpc({ "equity.overview": demoOverview(), "equity.savedViews.list": noViews }),
};

/** Nothing imported yet, and a snapshot to copy in. */
export const EmptyWithImport: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.overview": { ...EMPTY, canImport: true },
      "equity.savedViews.list": noViews,
    }),
};

/** Nothing imported, and no snapshot to copy. */
export const EmptyWithoutImport: Story = {
  beforeEach: () => mockRpc({ "equity.overview": EMPTY, "equity.savedViews.list": noViews }),
};

/** The response is still on its way. */
export const Loading: Story = {
  beforeEach: () => mockRpc({ "equity.overview": () => new Promise<never>(() => undefined) }),
};

/** The server could not answer. */
export const Failed: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.overview": () => {
        throw new Error("The cap table is unavailable.");
      },
    }),
};
