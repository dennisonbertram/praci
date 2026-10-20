import type { MemoryDocument } from "@rakazo/contracts";
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

const none = { "memory.list": [] };

const meta = {
  title: "Shell/Knowledge",
  component: KnowledgeSection,
  args: { botId: "bot_demo" },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: { component: "Also shows: MemoryDocumentList" },
    },
  },
} satisfies Meta<typeof KnowledgeSection>;
export default meta;

type Story = StoryObj<typeof meta>;

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

export const SharedSpaceMemory: StoryObj<typeof SpaceMemorySection> = {
  render: () => (
    <div className="w-96">
      <SpaceMemorySection />
    </div>
  ),
  beforeEach: () =>
    mockRpc({
      ...none,
      "memory.list": [
        { ...docs[0], id: "mem_s", scope: "user", botId: null, path: "MEMORY.md" },
        { ...docs[0], id: "mem_c", botId: "bot_chief", path: "MEMORY.md" },
        { ...docs[1], id: "mem_r", botId: "bot_retired" },
      ],
      "bots.list": [{ id: "bot_chief", name: "Chief" }],
      "bots.listArchived": [{ id: "bot_retired", name: "Retired" }],
    }),
};
