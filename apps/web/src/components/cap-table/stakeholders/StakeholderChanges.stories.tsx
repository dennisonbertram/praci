import type { EquityStakeholderChange } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { StakeholderChanges } from "./StakeholderChanges";
import { fixturePage, fixtureStakeholder } from "./stakeholder-fixtures";

const change = (overrides: Partial<EquityStakeholderChange>): EquityStakeholderChange => ({
  id: "ch-1",
  kind: "profile",
  source: "file",
  stakeholderId: "sh-1",
  stakeholderName: "Maya Fenwick",
  employeeId: "E-101",
  externalName: "Maya Fenwick",
  externalEmail: "maya@example.test",
  proposed: { jobTitle: "Senior Engineer", contactEmail: "maya.f@example.test" },
  terminationDate: null,
  status: "pending",
  acceptedFields: [],
  resolvedAt: null,
  createdAt: "2026-11-01T09:00:00.000Z",
  ...overrides,
});

const page = (items: EquityStakeholderChange[]) => ({
  items,
  total: items.length,
  page: 1,
  pageSize: 500,
});

const meta = {
  title: "Cap table/Stakeholders/Changes",
  component: StakeholderChanges,
  args: { onBack: () => undefined },
  beforeEach: () =>
    mockRpc({
      "equity.stakeholderChanges.counts": {
        match: 1,
        termination: 1,
        profile: 2,
        lastProposedAt: null,
      },
      "equity.stakeholderChanges.list": (input: unknown) => {
        const kind = (input as { kind: string }).kind;
        if (kind === "match")
          return page([
            change({
              id: "ch-3",
              kind: "match",
              stakeholderId: null,
              stakeholderName: null,
              externalName: "Jo Newhire",
              externalEmail: "jo@example.test",
              employeeId: "E-205",
            }),
          ]);
        if (kind === "termination")
          return page([
            change({
              id: "ch-4",
              kind: "termination",
              proposed: {},
              terminationDate: "2026-10-31",
            }),
          ]);
        return page([
          change({}),
          change({
            id: "ch-2",
            stakeholderId: "sh-7",
            stakeholderName: "Sam Whitlock",
            proposed: { department: "Operations" },
          }),
        ]);
      },
      "equity.optionActions.previewTermination": {
        stakeholderId: "sh-1",
        terminatedOn: "2026-10-31",
        grants: [],
      },
      "equity.stakeholders.get": fixtureStakeholder(),
      "equity.stakeholders.list": fixturePage(),
    }),
} satisfies Meta<typeof StakeholderChanges>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ProfileChanges: Story = {};

export const Empty: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.stakeholderChanges.counts": {
        match: 0,
        termination: 0,
        profile: 0,
        lastProposedAt: null,
      },
      "equity.stakeholderChanges.list": page([]),
    }),
};
