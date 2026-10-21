import type { Meta, StoryObj } from "@storybook/react-vite";
import { CompanyFactDetail } from "./CompanyFactDetail";
import { companyFixture } from "./company-fixtures";

const meta = {
  title: "Company/Fact detail",
  component: CompanyFactDetail,
  render: (args) => (
    <div>
      <CompanyFactDetail {...args} />
    </div>
  ),
  args: {
    fact: { kind: "entity", record: companyFixture.entities[0]! },
    onClose: () => {},
    onChanged: () => {},
  },
} satisfies Meta<typeof CompanyFactDetail>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Suggested: Story = {};
export const Confirmed: Story = {
  args: {
    fact: {
      kind: "entity",
      record: { ...companyFixture.entities[0]!, status: "confirmed", lockedFields: ["status"] },
    },
  },
};
export const Conflict: Story = {
  args: {
    fact: {
      kind: "entity",
      record: {
        ...companyFixture.entities[0]!,
        evidence: companyFixture.entities[0]!.evidence.map((e) => ({
          ...e,
          stance: "contradicts",
        })),
      },
    },
  },
};
export const Employment: Story = {
  args: { fact: { kind: "edge", record: companyFixture.edges[0]! } },
};
export const Event: Story = {
  args: { fact: { kind: "event", record: companyFixture.events[0]! } },
};
export const Roleless: Story = {
  args: { fact: { kind: "edge", record: { ...companyFixture.edges[0]!, role: null } } },
};
export const Shared: Story = {
  args: {
    fact: {
      kind: "entity",
      record: {
        ...companyFixture.entities[0]!,
        status: "confirmed",
        visibility: "team",
        readOnly: true,
        evidence: [],
        identities: [],
      },
    },
  },
};
export const Promoted: Story = {
  args: {
    fact: {
      kind: "entity",
      record: { ...companyFixture.entities[0]!, status: "confirmed", visibility: "team" },
    },
  },
};
export const PersonPrivacy: Story = {
  args: {
    fact: { kind: "entity", record: { ...companyFixture.entities[1]!, status: "confirmed" } },
  },
};
