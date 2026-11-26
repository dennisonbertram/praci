import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { withPageBehind } from "../../../stories/decorators";
import { DraftSetEditor } from "./DraftSetEditor";

const page = <T,>(items: T[]) => ({ items, total: items.length, page: 1, pageSize: 500 });

const meta = {
  title: "Cap table/Securities/DraftSetEditor",
  component: DraftSetEditor,
  decorators: [withPageBehind()],
  args: { kind: "certificate", set: null, onOpenChange: () => {}, onChanged: () => {} },
  beforeEach: () => {
    let current: Record<string, unknown> | null = null;
    mockRpc({
      "equity.stakeholders.list": page([
        { id: "sh-1", name: "Avery Lindqvist" },
        { id: "sh-2", name: "Juniper Seed Fund" },
      ]),
      "equity.shareClasses.list": page([{ id: "sc-common", name: "Common" }]),
      "equity.draftSets.create": (input: Record<string, unknown>) => {
        current = {
          id: "draft-1",
          name: input.name,
          securityKind: input.securityKind,
          status: "draft",
          revision: 1,
          issuedIds: [],
          items: input.items,
          issuedAt: null,
          createdAt: "2024-05-01T00:00:00.000Z",
          updatedAt: "2024-05-01T00:00:00.000Z",
        };
        return current;
      },
      "equity.draftSets.update": (input: Record<string, unknown>) => {
        const items = Array.isArray(input.items) ? (input.items as Record<string, unknown>[]) : [];
        current = {
          id: input.id,
          name: input.name,
          securityKind:
            current?.securityKind ??
            (items.some((item) => item.kind === "safe" || item.kind === "note")
              ? "convertible"
              : "certificate"),
          status: "draft",
          revision: Number(input.expectedRevision) + 1,
          issuedIds: [],
          items,
          issuedAt: null,
          createdAt: "2024-05-01T00:00:00.000Z",
          updatedAt: "2024-05-01T00:00:00.000Z",
        };
        return current;
      },
      "equity.draftSetActions.review": (input: Record<string, unknown>) => ({
        setId: input.id,
        revision: input.expectedRevision,
        items: (Array.isArray(current?.items) ? current.items : []).map((_, index) => ({
          index,
          problems: [],
        })),
        totalShares: "1000",
        totalPrincipalCents: "1000000",
        ready: true,
      }),
      "equity.draftSetActions.issue": () => ({
        set: { ...current, status: "issued", issuedIds: ["issued-1"] },
        issuedIds: ["issued-1"],
      }),
    });
  },
} satisfies Meta<typeof DraftSetEditor>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NewShares: Story = {};
export const NewSafes: Story = { args: { kind: "convertible" } };
export const ExistingNote: Story = {
  args: {
    kind: "convertible",
    set: {
      id: "draft-note",
      name: "Existing note",
      securityKind: "convertible",
      status: "draft",
      revision: 3,
      issuedIds: [],
      items: [
        {
          stakeholderId: "sh-1",
          blockId: "block-1",
          kind: "note",
          principalCents: "1000000",
          issueDate: "2024-05-01",
          valuationCapCents: "800000000",
          valuationCapType: "pre_money",
          discountPercent: "20",
          interestRate: "7.5",
          interestStartDate: "2024-05-01",
          interestType: "simple",
          mfn: true,
          proRata: true,
        },
      ],
      issuedAt: null,
      createdAt: "2024-05-01T00:00:00.000Z",
      updatedAt: "2024-05-01T00:00:00.000Z",
    },
  },
};
