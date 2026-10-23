import type { Meta, StoryObj } from "@storybook/react-vite";
import { CompanyHistory } from "./CompanyHistory";
import { companyFixture } from "./company-fixtures";

const meta = {
  title: "Company/History",
  component: CompanyHistory,
  args: { data: companyFixture, today: "2026-10-01", onOpen: () => {} },
} satisfies Meta<typeof CompanyHistory>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Year: Story = { args: { initialZoom: "year" } };
export const Quarter: Story = { args: { initialZoom: "quarter" } };
export const Month: Story = { args: { initialZoom: "month" } };
export const YearOnly: Story = {
  args: {
    data: {
      ...companyFixture,
      events: [
        { ...companyFixture.events[0]!, occursOn: { date: "2025-01-01", precision: "year" } },
      ],
    },
  },
};
export const Empty: Story = {
  args: { data: { entities: [], edges: [], events: [], latestRun: null } },
};
export const ReturningPerson: Story = {
  args: {
    data: {
      ...companyFixture,
      edges: [
        {
          ...companyFixture.edges[0]!,
          startsOn: { date: "2022-03-01", precision: "day" },
          endsOn: { date: "2023-06-30", precision: "day" },
        },
        {
          ...companyFixture.edges[0]!,
          id: "returned",
          role: "Lead engineer",
          startsOn: { date: "2024-02-01", precision: "day" },
        },
      ],
    },
  },
};
