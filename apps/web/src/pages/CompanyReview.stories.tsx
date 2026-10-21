import type { CompanyReviewItem } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { CompanyReview } from "./CompanyReview";
import { companyFixture } from "./company-fixtures";

const candidate: CompanyReviewItem = {
  kind: "candidate",
  id: "candidate:alex",
  candidate: {
    id: "alex",
    version: "v1",
    reason: "name_only_person_candidate",
    title: "Alex Reed",
    quote: "Alex joined the robotics team.",
    sourceKind: "gmail",
    details: [],
    choices: [{ id: "person", title: "Alex Reed · alex@northwind.example" }],
    allowSeparate: true,
    editableTitle: true,
    subjects: [],
    subjectChoices: [],
  },
};
const meta = {
  title: "Company/Review",
  component: CompanyReview,
  args: { items: [candidate], onOpen: () => {}, onChanged: () => {} },
  beforeEach: () =>
    mockRpc({
      "company.resolveCandidate": { ok: true },
      "company.confirm": { ok: true },
      "company.reject": { ok: true },
    }),
} satisfies Meta<typeof CompanyReview>;
export default meta;
type Story = StoryObj<typeof meta>;
export const SamePerson: Story = {};
export const Contradiction: Story = {
  args: {
    items: [
      {
        kind: "fact",
        id: "entity:company",
        reason: "contradiction",
        fact: {
          kind: "entity",
          record: {
            ...companyFixture.entities[0]!,
            evidence: companyFixture.entities[0]!.evidence.map((row) => ({
              ...row,
              stance: "contradicts",
            })),
          },
        },
      },
    ],
  },
};
export const RejectedName: Story = {
  args: {
    items: [
      {
        ...candidate,
        candidate: { ...candidate.candidate, reason: "rejected_name_only_claim", choices: [] },
      },
    ],
  },
};
export const AmbiguousEvent: Story = {
  args: {
    items: [
      {
        ...candidate,
        candidate: {
          ...candidate.candidate,
          reason: "ambiguous_event_subjects",
          title: "Board meeting",
          allowSeparate: false,
          editableTitle: false,
          choices: [{ id: "event", title: "Board meeting · 2026-10-21" }],
        },
      },
    ],
  },
};
export const UnresolvedSubjects: Story = {
  args: {
    items: [
      {
        ...candidate,
        candidate: {
          ...candidate.candidate,
          reason: "unresolved_import_subjects",
          title: "Employment",
          allowSeparate: false,
          editableTitle: false,
          choices: [],
          subjects: [
            { ref: "person", title: "Alex Reed", entityId: null },
            { ref: "company", title: "Northwind Robotics", entityId: "company" },
          ],
          subjectChoices: [
            { id: "person", title: "Alex Reed" },
            { id: "company", title: "Northwind Robotics" },
          ],
        },
      },
    ],
  },
};
export const Empty: Story = { args: { items: [] } };
export const ActionError: Story = {
  beforeEach: () =>
    mockRpc({ "company.resolveCandidate": () => Promise.reject(new Error("Unavailable")) }),
};
