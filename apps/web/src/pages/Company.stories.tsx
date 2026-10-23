import type { CompanyReviewItem } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { CompanyPage } from "./Company";
import { companyFixture } from "./company-fixtures";

const meta = { title: "Company/Page", component: CompanyPage } satisfies Meta<typeof CompanyPage>;
export default meta;
type Story = StoryObj<typeof meta>;
const responses = {
  "company.review": { items: [] },
  "finance.overview": null,
  "carta.capTable": { snapshot: null, syncing: false },
};
export const Full: Story = {
  args: { onAskAgent: () => {} },
  beforeEach: () => mockRpc({ ...responses, "company.page": companyFixture }),
};
export const Review: Story = {
  parameters: { initialEntries: ["/app/company?view=review"] },
  beforeEach: () => {
    let items: CompanyReviewItem[] = [
      {
        kind: "fact",
        id: "entity:company",
        reason: "contradiction",
        fact: { kind: "entity", record: companyFixture.entities[0]! },
      },
      {
        kind: "candidate",
        id: "candidate:alex",
        candidate: {
          id: "alex",
          version: "v1",
          reason: "name_only_person_candidate",
          title: "Alex Reed",
          quote: "Alex joined the robotics team.",
          sourceKind: "gmail",
          details: [{ label: "Role", value: "Engineer" }],
          choices: [{ id: "person", title: "Alex Reed · alex@northwind.example" }],
          allowSeparate: true,
          editableTitle: true,
          subjects: [],
          subjectChoices: [],
        },
      },
    ];
    mockRpc({
      ...responses,
      "company.page": companyFixture,
      "company.review": () => ({ items }),
      "company.confirm": () => {
        items = items.filter((item) => item.kind !== "fact");
        return { ok: true };
      },
      "company.resolveCandidate": () => {
        items = items.filter((item) => item.kind !== "candidate");
        return { ok: true };
      },
      "companyImport.refreshStatus": [
        {
          id: "gmail",
          sourceKind: "gmail",
          capability: "supported",
          status: "ready",
          reason: null,
          lastSuccessAt: "2026-10-21T03:00:00Z",
          nextRunAt: "2026-10-22T03:00:00Z",
          runId: null,
        },
        {
          id: "notion",
          sourceKind: "notion",
          capability: "manual_only",
          status: "unavailable",
          reason:
            "notion_search_non_exhaustive_and_not_immediately_indexed_no_reliable_nested_change_feed",
          lastSuccessAt: null,
          nextRunAt: null,
          runId: null,
        },
      ],
    });
  },
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
