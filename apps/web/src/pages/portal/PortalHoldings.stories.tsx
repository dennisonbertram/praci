import type { EquityAccessView } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { PortalHoldings } from "./PortalHoldings";

const personal = {
  stakeholderId: "s1",
  name: "Avery Sample",
  holdings: [
    {
      kind: "certificate" as const,
      label: "CS-4",
      shareClassName: "Common",
      quantity: "120000",
      principalCents: null,
      issueDate: "2022-03-01",
    },
    {
      kind: "option" as const,
      label: "ES-9",
      shareClassName: "Common",
      quantity: "40000",
      principalCents: null,
      issueDate: "2023-01-15",
    },
  ],
};

const restricted: EquityAccessView = { level: "restricted", personal, fairMarketValue: null };
const basic: EquityAccessView = {
  ...restricted,
  level: "basic",
  shareClasses: [
    {
      name: "Series A Preferred",
      prefix: "PA",
      classType: "preferred",
      originalIssuePrice: "1.25",
      conversionRatio: "1",
      liquidationMultiple: "1",
      participating: false,
      seniority: 2,
    },
    {
      name: "Common",
      prefix: "CS",
      classType: "common",
      originalIssuePrice: null,
      conversionRatio: "1",
      liquidationMultiple: "1",
      participating: false,
      seniority: 1,
    },
  ],
  summary: {
    outstandingShares: "9000000",
    fullyDilutedShares: "10000000",
    classes: [
      {
        name: "Series A Preferred",
        outstandingShares: "2000000",
        fullyDilutedShares: "2000000",
        fullyDilutedPercent: "20.0000",
      },
      {
        name: "Common",
        outstandingShares: "7000000",
        fullyDilutedShares: "8000000",
        fullyDilutedPercent: "80.0000",
      },
    ],
  },
  fundraising: [
    {
      name: "Series A",
      closingDate: "2024-05-01",
      originalIssuePrice: "1.25",
      preMoneyValuationCents: "1000000000",
    },
  ],
};

const meta = {
  title: "Portal/Holdings",
  component: PortalHoldings,
  decorators: [
    (Story) => (
      <div className="mx-auto flex max-w-2xl flex-col gap-8 text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PortalHoldings>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Only the holder's own securities. */
export const Restricted: Story = { args: { view: restricted } };

/** Adds class terms, the summary cap table and fundraising. */
export const Basic: Story = { args: { view: basic } };

/** Detailed holdings of other holders too. */
export const FullDetail: Story = {
  args: {
    view: {
      ...basic,
      level: "full_detail",
      holders: [{ ...personal, stakeholderId: "s2", name: "Blue Example Fund" }],
    },
  },
};
