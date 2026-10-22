import type { AgentSkill, BotAgentSkill } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { BotSkillsSection } from "./BotSkillsSection";

const entry = (
  id: string,
  name: string,
  source: BotAgentSkill["source"],
  enabled = true,
): BotAgentSkill => ({
  id,
  name,
  description: `What ${name} does and when to use it.`,
  source,
  origin: "user",
  readOnly: source !== "user",
  enabled,
});

const skills: BotAgentSkill[] = [
  entry("builtin:web-research", "web-research", "builtin"),
  entry("skill_1", "weekly-summary", "user"),
  entry("skill_2", "expense-report", "user", false),
  entry("plugin:calendar", "calendar-helper", "plugin"),
  { ...entry("skill_3", "meeting-notes", "user"), origin: "agent" },
];

const fullSkill = (e: BotAgentSkill): AgentSkill => ({
  id: e.id,
  name: e.name,
  description: e.description,
  source: e.source,
  origin: e.origin,
  readOnly: e.readOnly,
  content: `---\nname: ${e.name}\ndescription: ${e.description}\n---\n\nSteps the agent should follow.\n`,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

const loaded = {
  "agentSkills.forBot": skills,
  "agentSkills.drafts": [],
  "agentSkills.setEnabled": { ok: true },
  "agentSkills.get": (input: unknown) => {
    const found = skills.find((s) => s.id === (input as { skillId: string }).skillId);
    return fullSkill(found ?? (skills[1] as BotAgentSkill));
  },
};

const meta = {
  title: "Shell/BotSkillsSection",
  component: BotSkillsSection,
  args: { botId: "bot_demo", onSkillsChange: () => undefined },
  decorators: [
    (Story) => (
      <div className="w-full max-w-96 px-4">
        <Story />
      </div>
    ),
  ],
  beforeEach: () => mockRpc(loaded),
  parameters: {
    docs: { description: { component: "Also shows: SkillSourceBadge" } },
  },
} satisfies Meta<typeof BotSkillsSection>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const AgentDrafts: Story = {
  beforeEach: () =>
    mockRpc({
      ...loaded,
      "agentSkills.drafts": [
        {
          id: "draft_1",
          name: "invoice-follow-up",
          description: "Chase unpaid invoices politely.",
          content:
            "---\nname: invoice-follow-up\ndescription: Chase unpaid invoices politely.\n---\n\nCheck the invoice status, then draft a reminder.\n",
          revision: false,
        },
        {
          id: "skill_1",
          name: "weekly-summary",
          description: "What weekly-summary does and when to use it.",
          content:
            "---\nname: weekly-summary\ndescription: What weekly-summary does and when to use it.\n---\n\nSteps, now with a closing question.\n",
          revision: true,
        },
      ],
    }),
};

export const AddSkill: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("button", { name: "Add skill" }));
  },
};

export const FromUrl: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Add skill" }));
    await userEvent.click(await canvas.findByRole("button", { name: "From URL" }));
    await userEvent.type(
      await canvas.findByRole("textbox", { name: "From URL" }),
      "https://github.com/acme/skills/blob/main/SKILL.md",
    );
  },
};

export const NewSkillDraft: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("button", { name: "Add skill" }));
  },
};

export const EditingUserSkill: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole("button", { name: /weekly-summary/ }),
    );
  },
};

export const ReadOnlyBuiltinSkill: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole("button", { name: /web-research/ }),
    );
  },
};

export const Loading: Story = {
  beforeEach: () => mockRpc({ "agentSkills.forBot": () => new Promise(() => undefined) }),
};

export const LoadFailed: Story = {
  beforeEach: () =>
    mockRpc({
      "agentSkills.forBot": () => {
        throw new Error("offline");
      },
    }),
};

export const NewSkillSaveFailed: Story = {
  beforeEach: () =>
    mockRpc({
      ...loaded,
      "agentSkills.create": () => {
        throw new Error("Skill front matter needs a description.");
      },
    }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByRole("button", { name: "Add skill" }));
    await userEvent.click(await canvas.findByRole("textbox", { name: "SKILL.md" }));
    await userEvent.paste("---\nname: demo\ndescription: Demo skill.\n---\n\nSteps.\n");
    await userEvent.click(await canvas.findByRole("button", { name: "Save" }));
  },
};
