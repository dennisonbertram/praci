import type { LegalNode } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { graph, id } from "../../pages/legal/fixtures";
import { LegalGraphView } from "./LegalGraph";

const meta = {
  title: "Legal/Graph",
  component: LegalGraphView,
  args: { graph },
} satisfies Meta<typeof LegalGraphView>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = { args: { graph: { nodes: [], edges: [] } } };

const many: LegalNode[] = Array.from({ length: 300 }, (_, n) => ({
  id: id(1000 + n),
  kind: (["company", "person", "contract", "obligation", "right"] as const)[n % 5] ?? "other",
  label: `Item ${n + 1}`,
  attrs: null,
  contractId: null,
}));

export const TooManyNodes: Story = {
  args: {
    graph: {
      nodes: many,
      edges: many.slice(1).map((node, n) => ({
        id: id(5000 + n),
        fromId: many[n]?.id ?? node.id,
        toId: node.id,
        relation: "relates to",
        dataRoomItemId: null,
        sourceQuote: null,
      })),
    },
  },
};

/** Narrower than the drawing: it scrolls sideways and says so. */
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="w-[358px]">
        <Story />
      </div>
    ),
  ],
};
