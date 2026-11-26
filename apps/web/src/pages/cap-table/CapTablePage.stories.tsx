import type { EquityOverview } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fixturePage } from "../../components/cap-table/stakeholders/stakeholder-fixtures";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { CapTablePage } from "./CapTablePage";

const overview: EquityOverview = {
  hasLedger: false,
  canImport: true,
  importedAt: null,
  asOf: "2026-10-15",
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

const meta = {
  title: "Pages/Cap table",
  component: CapTablePage,
  parameters: { initialEntries: ["/app/cap-table/overview"] },
  decorators: [
    (Story) => (
      <div className="w-full max-w-5xl text-foreground">
        <Story />
      </div>
    ),
  ],
  beforeEach: () => mockRpc({ "equity.overview": overview }),
} satisfies Meta<typeof CapTablePage>;
export default meta;
type Story = StoryObj<typeof meta>;

/** The tabs, on the Overview tab with nothing imported yet. */
export const Overview: Story = {};

/** The stakeholders directory. */
export const Stakeholders: Story = {
  parameters: { initialEntries: ["/app/cap-table/stakeholders"] },
  beforeEach: () =>
    mockRpc({
      "equity.overview": overview,
      "equity.stakeholders.list": fixturePage(),
      "equity.customProperties.list": [],
      "equity.savedViews.list": { items: [], total: 0, page: 1, pageSize: 500 },
      "equity.stakeholderChanges.counts": {
        match: 0,
        termination: 0,
        profile: 0,
        lastProposedAt: null,
      },
    }),
};

/** Share classes, the widest tab label. */
export const ShareClasses: Story = {
  parameters: { initialEntries: ["/app/cap-table/share-classes"] },
};
