import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { CompanyPage } from "./Company";
import { companyFixture } from "./company-fixtures";

const meta = { title: "Company/Page", component: CompanyPage } satisfies Meta<typeof CompanyPage>;
export default meta;
type Story = StoryObj<typeof meta>;
const responses = {
  "finance.overview": null,
  "carta.capTable": { snapshot: null, syncing: false },
};
export const Full: Story = {
  beforeEach: () => mockRpc({ ...responses, "company.page": companyFixture }),
};
export const Empty: Story = {
  beforeEach: () =>
    mockRpc({
      ...responses,
      "company.page": { entities: [], edges: [], events: [], latestRun: null },
    }),
};
export const Running: Story = {
  beforeEach: () =>
    mockRpc({
      ...responses,
      "company.page": { ...companyFixture, latestRun: { id: "run", status: "running" } },
    }),
};
export const EventsOnly: Story = {
  beforeEach: () =>
    mockRpc({
      ...responses,
      "company.page": {
        entities: [],
        edges: [],
        latestRun: null,
        events: companyFixture.events.map((event) => ({ ...event, entityIds: [] })),
      },
    }),
};
export const Partial: Story = {
  beforeEach: () =>
    mockRpc({
      ...responses,
      "company.page": {
        ...companyFixture,
        latestRun: { id: "run", status: "completed_with_failures" },
      },
    }),
};
export const Loading: Story = {
  beforeEach: () => mockRpc({ ...responses, "company.page": () => new Promise(() => {}) }),
};
export const ErrorState: Story = {
  beforeEach: () =>
    mockRpc({
      ...responses,
      "company.page": () => Promise.reject(new globalThis.Error("Unavailable")),
    }),
};
