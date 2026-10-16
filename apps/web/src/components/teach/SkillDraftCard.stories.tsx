import type { SkillPlaybook } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../stories/rpc-mock-1";
import { SkillDraftCard } from "./SkillDraftCard";

const playbook: SkillPlaybook = {
  whenToUse: "When a new sample invoice arrives in the shared inbox.",
  inputs: ["Invoice PDF", "Vendor name"],
  steps: ["Open the invoice", "Check the total against the order", "File it in the demo folder"],
  howToCheck: "The total matches the order.",
  whatToReturn: "A one-line summary with the total.",
  approvalBoundaries: "Never pay an invoice without approval.",
  failureHandling: "Ask the owner when the total does not match.",
};

const meta = {
  title: "Teach/SkillDraftCard",
  component: SkillDraftCard,
  args: {
    block: {
      kind: "skill_draft",
      skillId: "skill_demo",
      name: "File sample invoices",
      goal: "Check each new invoice and file it.",
      playbook,
      status: "draft",
    },
    onRefresh: async () => undefined,
    onAddRoutine: () => undefined,
  },
  beforeEach: () => mockRpc({ "skills.updateDraft": {}, "skills.save": {}, "skills.testRun": {} }),
} satisfies Meta<typeof SkillDraftCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Draft: Story = {};

export const Saved: Story = {
  args: { block: { ...meta.args.block, status: "saved" } },
};

export const EmptyPlaybook: Story = {
  args: {
    block: {
      ...meta.args.block,
      name: "",
      playbook: {
        whenToUse: "",
        inputs: [],
        steps: [],
        howToCheck: "",
        whatToReturn: "",
        approvalBoundaries: "",
        failureHandling: "",
      },
    },
  },
};

export const LongContent: Story = {
  args: {
    block: {
      ...meta.args.block,
      goal: "Check each new invoice, compare it to the order, and file it in the right folder. ".repeat(
        4,
      ),
      playbook: {
        ...playbook,
        steps: Array.from({ length: 12 }, (_, i) => `Step ${i + 1}: do a sample task`),
      },
    },
  },
};
