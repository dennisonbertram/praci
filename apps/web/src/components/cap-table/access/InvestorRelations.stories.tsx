import type { EquityAccessHolder } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { InvestorRelations } from "./InvestorRelations";

const holder = (
  over: Partial<EquityAccessHolder> & Pick<EquityAccessHolder, "stakeholderId" | "name">,
) =>
  ({
    relationship: "investor",
    group: "investors",
    email: null,
    contactId: null,
    majorInvestor: false,
    ownershipPercent: "0.0000",
    classCodes: [],
    groupLevel: "advanced",
    overrideLevel: null,
    effectiveLevel: "advanced",
    requestedLevel: null,
    requestedAt: null,
    lastSeenAt: null,
    ...over,
  }) as EquityAccessHolder;

const holders: EquityAccessHolder[] = [
  holder({
    stakeholderId: "h1",
    name: "Avery Sample",
    relationship: "founder",
    group: "founders",
    email: "avery@sample.test",
    contactId: "c1",
    ownershipPercent: "42.1250",
    classCodes: ["CS"],
    groupLevel: "full_detail",
    effectiveLevel: "full_detail",
    lastSeenAt: "2026-10-18T14:00:00.000Z",
  }),
  holder({
    stakeholderId: "h2",
    name: "Blue Example Fund",
    email: "ir@blue-example.test",
    contactId: "c2",
    majorInvestor: true,
    ownershipPercent: "18.5000",
    classCodes: ["PA", "PA"],
    requestedLevel: "full_detail",
    requestedAt: "2026-10-20T09:00:00.000Z",
    lastSeenAt: "2026-10-20T08:55:00.000Z",
  }),
  holder({
    stakeholderId: "h3",
    name: "Cedar Growth Partners",
    email: "team@cedar-growth.test",
    contactId: "c3",
    ownershipPercent: "9.7500",
    classCodes: ["PA"],
    overrideLevel: "restricted",
    effectiveLevel: "restricted",
    lastSeenAt: "2026-09-30T10:00:00.000Z",
  }),
  holder({
    stakeholderId: "h4",
    name: "Dana Placeholder",
    relationship: "advisor",
    group: "employees",
    ownershipPercent: "0.2500",
    classCodes: ["OP"],
    groupLevel: "basic",
    effectiveLevel: "basic",
  }),
];

const page = { items: holders, total: holders.length, page: 1, pageSize: 25 };

const meta = {
  title: "Cap table/Investor relations",
  component: InvestorRelations,
  decorators: [
    (Story) => (
      <div className="w-full max-w-5xl text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof InvestorRelations>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Four invented holders: one with an open request, one with an override. */
export const Holders: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.accessHolders.list": page,
      "equity.accessHolders.setLevels": [],
    }),
};

/** No holders yet. */
export const Empty: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.accessHolders.list": { items: [], total: 0, page: 1, pageSize: 25 },
    }),
};

/** The response is still on its way. */
export const Loading: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.accessHolders.list": () => new Promise<never>(() => undefined),
    }),
};
