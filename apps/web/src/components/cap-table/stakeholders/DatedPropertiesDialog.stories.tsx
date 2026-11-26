import type { Meta, StoryObj } from "@storybook/react-vite";
import { withPageBehind } from "../../../stories/decorators";
import { DatedPropertiesDialog } from "./DatedPropertiesDialog";
import { fixtureStakeholder } from "./stakeholder-fixtures";

const noop = () => undefined;
const meta = {
  title: "Cap table/Stakeholders/Dated properties dialog",
  component: DatedPropertiesDialog,
  decorators: [withPageBehind()],
  args: { open: true, onOpenChange: noop, onSaved: noop },
} satisfies Meta<typeof DatedPropertiesDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const EmployeeWithHistory: Story = {
  args: {
    stakeholder: fixtureStakeholder({
      properties: [
        { id: "p-4", kind: "relationship", effectiveDate: "2025-01-01", value: "employee" },
        { id: "p-3", kind: "relationship", effectiveDate: "2024-03-01", value: "consultant" },
        { id: "p-2", kind: "job_title", effectiveDate: "2025-01-01", value: "Senior Engineer" },
        { id: "p-1", kind: "job_title", effectiveDate: "2024-03-01", value: "Engineer" },
        { id: "p-5", kind: "cost_center", effectiveDate: "2025-01-01", value: "R&D" },
      ],
    }),
  },
};

export const NoProperties: Story = {
  args: {
    stakeholder: fixtureStakeholder({
      relationship: null,
      jobTitle: null,
      costCenter: null,
      department: null,
      properties: [],
    }),
  },
};
