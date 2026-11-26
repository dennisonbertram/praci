import type { EquityVestingTemplate } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { withPageBehind } from "../../../stories/decorators";
import { VestingTemplateForm } from "./VestingTemplateForm";

const template: EquityVestingTemplate = {
  id: "vt-1",
  name: "Standard 4 year",
  totalMonths: 48,
  cliffMonths: 12,
  frequencyMonths: 1,
  tranches: null,
  createdAt: "2025-01-06T00:00:00.000Z",
  updatedAt: "2025-01-06T00:00:00.000Z",
};

const meta = {
  title: "Cap table/Options/VestingTemplateForm",
  component: VestingTemplateForm,
  decorators: [withPageBehind()],
  args: { template: null, onClose: () => {}, onSaved: () => {} },
  beforeEach: () =>
    mockRpc({
      "equity.vestingTemplates.create": template,
      "equity.vestingTemplates.update": template,
    }),
} satisfies Meta<typeof VestingTemplateForm>;
export default meta;
type Story = StoryObj<typeof meta>;

/** A new template starts on the standard monthly schedule with a one-year cliff. */
export const New: Story = {};

/** Editing an even schedule. */
export const EditEven: Story = { args: { template } };

/** Editing a custom schedule: tranches by month and percent. */
export const EditCustom: Story = {
  args: {
    template: {
      ...template,
      id: "vt-2",
      name: "Founder custom",
      totalMonths: 36,
      cliffMonths: 0,
      tranches: [
        { monthOffset: 12, percent: "25" },
        { monthOffset: 24, percent: "25" },
        { monthOffset: 36, percent: "50" },
      ],
    },
  },
};
