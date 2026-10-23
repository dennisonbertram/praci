import type { CompanyCalendarItem } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { CompanyCalendar } from "./CompanyCalendar";

const items: CompanyCalendarItem[] = [
  {
    id: "legal:notice",
    title: "Renewal notice",
    date: "2026-10-15",
    stream: "legal",
    status: "open",
    anniversary: false,
    fact: null,
    legalDeadlineId: "notice",
  },
  {
    id: "event:board",
    title: "Board meeting",
    date: "2026-10-21",
    stream: "company",
    status: "suggested",
    anniversary: false,
    fact: { kind: "event", id: "board" },
    legalDeadlineId: null,
  },
  {
    id: "event:funding",
    title: "Funding close",
    date: "2026-10-30",
    stream: "funding",
    status: "confirmed",
    anniversary: false,
    fact: { kind: "event", id: "funding" },
    legalDeadlineId: null,
  },
];
const meta = {
  title: "Company/Calendar",
  component: CompanyCalendar,
  args: { initialMonth: "2026-10", onOpen: () => {} },
  beforeEach: () => mockRpc({ "company.calendar": items }),
} satisfies Meta<typeof CompanyCalendar>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Month: Story = {};
export const Phone: Story = { globals: { viewport: { value: "mobile1" } } };
export const Agenda: Story = { args: { initialView: "agenda" } };
export const Empty: Story = { beforeEach: () => mockRpc({ "company.calendar": [] }) };
export const ErrorState: Story = {
  beforeEach: () => mockRpc({ "company.calendar": () => Promise.reject(new Error("Unavailable")) }),
};
