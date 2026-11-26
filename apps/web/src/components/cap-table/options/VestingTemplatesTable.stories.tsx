import type { EquityVestingTemplate } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { VestingTemplatesTable } from "./VestingTemplatesTable";

const template = (
  overrides: Partial<EquityVestingTemplate> & Pick<EquityVestingTemplate, "id" | "name">,
): EquityVestingTemplate => ({
  totalMonths: 48,
  cliffMonths: 12,
  frequencyMonths: 1,
  tranches: null,
  createdAt: "2025-01-06T00:00:00.000Z",
  updatedAt: "2025-01-06T00:00:00.000Z",
  ...overrides,
});

const templates: EquityVestingTemplate[] = [
  template({ id: "vt-1", name: "Standard 4 year" }),
  template({
    id: "vt-2",
    name: "Advisor quarterly",
    totalMonths: 24,
    cliffMonths: 0,
    frequencyMonths: 3,
  }),
  template({
    id: "vt-3",
    name: "Founder custom",
    totalMonths: 36,
    cliffMonths: 0,
    frequencyMonths: 1,
    tranches: [
      { monthOffset: 12, percent: "25" },
      { monthOffset: 24, percent: "25" },
      { monthOffset: 36, percent: "50" },
    ],
  }),
];

const meta = {
  title: "Cap table/Options/VestingTemplatesTable",
  component: VestingTemplatesTable,
  decorators: [
    (Story) => (
      <div className="w-full max-w-4xl text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof VestingTemplatesTable>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Even and custom schedules in one list. */
export const Default: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.vestingTemplates.list": {
        items: templates,
        total: templates.length,
        page: 1,
        pageSize: 100,
      },
    }),
};

/** Nothing saved yet; the empty state offers the add flow. */
export const Empty: Story = {
  beforeEach: () =>
    mockRpc({ "equity.vestingTemplates.list": { items: [], total: 0, page: 1, pageSize: 100 } }),
};

/** The response is still on its way. */
export const Loading: Story = {
  beforeEach: () =>
    mockRpc({ "equity.vestingTemplates.list": () => new Promise<never>(() => undefined) }),
};

/** The server could not answer. */
export const Failed: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.vestingTemplates.list": () => {
        throw new Error("The vesting templates are unavailable.");
      },
    }),
};
