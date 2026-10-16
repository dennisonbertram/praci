import type { AgentSkill, AgentSkillCatalogEntry, MemoryDocument } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { mockRpc } from "../lib/__mocks__/rpc";
import { KnowledgeSection, SpaceMemorySection } from "./KnowledgeSection";

const docs: MemoryDocument[] = [
  {
    id: "mem_1",
    scope: "bot",
    botId: "bot_demo",
    path: "preferences.md",
    content: "Prefers short answers.\nUses metric units.",
    revision: 3,
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "mem_2",
    scope: "bot",
    botId: "bot_demo",
    path: "a-very-long-document-path/that-keeps-going/and-going/until-it-has-to-truncate.md",
    content: "Notes.",
    revision: 1,
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

const entry = (
  id: string,
  name: string,
  source: AgentSkillCatalogEntry["source"],
): AgentSkillCatalogEntry => ({
  id,
  name,
  description: `What ${name} does and when to use it.`,
  source,
  readOnly: source !== "user",
});

const firstSkill = entry("skill_1", "weekly-summary", "user");
const skills: AgentSkillCatalogEntry[] = [
  firstSkill,
  entry("skill_2", "web-research", "builtin"),
  entry("skill_3", "calendar-helper", "plugin"),
];

const fullSkill = (e: AgentSkillCatalogEntry): AgentSkill => ({
  ...e,
  content: `---\nname: ${e.name}\ndescription: ${e.description}\n---\n\nSteps the agent should follow.\n`,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
});

// Both tabs mount at once, so each story answers both lists.
const none = { "memory.list": [], "agentSkills.list": [] };

const loadedSkills = {
  ...none,
  "agentSkills.list": skills,
  "agentSkills.get": (input: unknown) => {
    const found = skills.find((s) => s.id === (input as { skillId: string }).skillId);
    return fullSkill(found ?? firstSkill);
  },
};

const meta = {
  title: "Shell/Knowledge",
  component: KnowledgeSection,
  args: { botId: "bot_demo", onSkillsChange: () => undefined },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: { component: "Also shows: MemoryDocumentList, SkillSourceBadge, AgentSkills" },
    },
  },
} satisfies Meta<typeof KnowledgeSection>;
export default meta;

type Story = StoryObj<typeof meta>;

const openSkillsTab: Story["play"] = async ({ canvasElement }) => {
  await userEvent.click(await within(canvasElement).findByRole("tab", { name: "Shared skills" }));
};

export const MemoryDocuments: Story = {
  beforeEach: () => mockRpc({ ...none, "memory.list": docs }),
};

export const MemoryEditing: Story = {
  beforeEach: () => mockRpc({ ...none, "memory.list": docs }),
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole("button", { name: /preferences/ }),
    );
  },
};

export const MemoryEmpty: Story = { beforeEach: () => mockRpc(none) };

export const MemoryLoading: Story = {
  beforeEach: () => mockRpc({ ...none, "memory.list": () => new Promise(() => undefined) }),
};

export const MemoryLoadFailed: Story = {
  beforeEach: () =>
    mockRpc({
      ...none,
      "memory.list": () => {
        throw new Error("offline");
      },
    }),
};

export const SkillsWithSourceBadges: Story = {
  beforeEach: () => mockRpc(loadedSkills),
  play: openSkillsTab,
};

export const SkillsEmpty: Story = {
  beforeEach: () => mockRpc(none),
  play: openSkillsTab,
};

export const SkillsLoadFailed: Story = {
  beforeEach: () =>
    mockRpc({
      ...none,
      "agentSkills.list": () => {
        throw new Error("offline");
      },
    }),
  play: openSkillsTab,
};

export const EditingUserSkill: Story = {
  beforeEach: () => mockRpc(loadedSkills),
  play: async (context) => {
    await openSkillsTab(context);
    await userEvent.click(
      await within(context.canvasElement).findByRole("button", { name: /weekly-summary/ }),
    );
  },
};

export const ReadOnlyBuiltinSkill: Story = {
  beforeEach: () => mockRpc(loadedSkills),
  play: async (context) => {
    await openSkillsTab(context);
    await userEvent.click(
      await within(context.canvasElement).findByRole("button", { name: /web-research/ }),
    );
  },
};

export const NewSkillDraft: Story = {
  beforeEach: () => mockRpc(loadedSkills),
  play: async (context) => {
    await openSkillsTab(context);
    await userEvent.click(
      await within(context.canvasElement).findByRole("button", { name: "New skill" }),
    );
  },
};

export const SharedSpaceMemory: StoryObj<typeof SpaceMemorySection> = {
  render: () => (
    <div className="w-96">
      <SpaceMemorySection />
    </div>
  ),
  beforeEach: () =>
    mockRpc({ ...none, "memory.list": docs.map((d) => ({ ...d, scope: "user", botId: null })) }),
};
