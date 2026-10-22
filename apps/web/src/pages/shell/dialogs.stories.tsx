import type { Bot } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { mockRpc } from "../../lib/__mocks__/rpc";
import {
  ClearConversationDialog,
  DeleteBotDialog,
  DeleteItemDialog,
  NewBotSectionDialog,
  NewSpaceDialog,
  PickerInfoDialog,
  RenameBotSectionDialog,
  RenameSpaceDialog,
} from "./dialogs";

const meta = {
  title: "Shell/Dialogs",
  decorators: [
    (Story) => (
      <div className="min-h-[420px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;
export default meta;
type Story = StoryObj;

const done = async () => undefined;
const never = () => new Promise<void>(() => undefined);
const reject = async () => {
  throw new Error("The server said no");
};
const noop = () => undefined;
const body = () => within(document.body);

const bot: Bot = {
  id: "bot_demo",
  spaceId: "space_demo",
  name: "Sample Bot",
  title: "Helper",
  description: "",
  instructions: "",
  color: "#7c3aed",
  notifyOnFinish: false,
  pinned: false,
  sectionId: null,
  archivedAt: null,
  unread: false,
  parentBotId: null,
  memoryScope: null,
  threadId: "thread_demo",
  preview: "",
  status: "idle",
  runErrorId: null,
  computerMode: "team",
  updatedAt: "2026-01-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  voiceId: null,
  autoSpeak: false,
  modelProvider: null,
  modelId: null,
  thinkingLevel: null,
  teamChatAmbientEnabled: false,
  teamChatRules: "",
  disabledBuiltinTools: [],
  audience: "internal",
  externalMessageTargets: [],
  externalComputerTools: false,
  webhookConfigured: false,
  spawnKey: null,
  runPhase: null,
};
const longName = "A bot with a very long display name that should wrap instead of overflowing";

/** Types a name (when the dialog has an input) and presses the primary button. */
const submit = (button: string, name?: string) => async () => {
  if (name) await userEvent.type(await body().findByRole("textbox"), name);
  await userEvent.click(await body().findByRole("button", { name: button }));
};

export const NewSpace: Story = {
  render: () => <NewSpaceDialog onCancel={noop} onConfirm={done} />,
};
export const NewSpaceSaving: Story = {
  render: () => <NewSpaceDialog onCancel={noop} onConfirm={never} />,
  play: submit("Create space", "Demo space"),
};
export const NewSpaceError: Story = {
  render: () => <NewSpaceDialog onCancel={noop} onConfirm={reject} />,
  play: submit("Create space", "Demo space"),
};

export const RenameSpace: Story = {
  render: () => (
    <RenameSpaceDialog space={{ name: "Demo space" }} onCancel={noop} onConfirm={done} />
  ),
};
export const RenameSpaceError: Story = {
  render: () => (
    <RenameSpaceDialog space={{ name: "Demo space" }} onCancel={noop} onConfirm={reject} />
  ),
  play: submit("Save", " 2"),
};

export const PickerInfoGroup: Story = {
  render: () => <PickerInfoDialog topic="group" onClose={noop} />,
};
export const PickerInfoSpace: Story = {
  render: () => <PickerInfoDialog topic="space" onClose={noop} />,
};

export const NewBotSection: Story = {
  render: () => (
    <NewBotSectionDialog bot={{ name: "Sample Bot" }} onCancel={noop} onConfirm={done} />
  ),
};
export const NewBotSectionError: Story = {
  render: () => (
    <NewBotSectionDialog bot={{ name: "Sample Bot" }} onCancel={noop} onConfirm={reject} />
  ),
  play: submit("Create", "Demo section"),
};

export const RenameBotSection: Story = {
  render: () => (
    <RenameBotSectionDialog section={{ name: "Demo section" }} onCancel={noop} onConfirm={done} />
  ),
};
export const RenameBotSectionError: Story = {
  render: () => (
    <RenameBotSectionDialog section={{ name: "Demo section" }} onCancel={noop} onConfirm={reject} />
  ),
  play: submit("Save", " 2"),
};

export const ClearConversation: Story = {
  render: () => <ClearConversationDialog bot={bot} onCancel={noop} onConfirm={done} />,
};
export const ClearConversationLongName: Story = {
  render: () => (
    <ClearConversationDialog bot={{ name: longName }} onCancel={noop} onConfirm={done} />
  ),
};
export const ClearConversationError: Story = {
  render: () => <ClearConversationDialog bot={bot} onCancel={noop} onConfirm={reject} />,
  play: submit("Clear"),
};
export const ClearConversationClearing: Story = {
  render: () => <ClearConversationDialog bot={bot} onCancel={noop} onConfirm={never} />,
  play: submit("Clear"),
};

const memories = [{ id: "mem_1", scope: "bot", botId: "bot_demo", path: "notes.md", content: "x" }];
export const DeleteBot: Story = {
  beforeEach: () => mockRpc({ "memory.list": memories }),
  render: () => <DeleteBotDialog bot={bot} onCancel={noop} onConfirm={done} />,
};
/** A bot with no memories skips the memory question. */
export const DeleteBotNoMemories: Story = {
  beforeEach: () => mockRpc({ "memory.list": [] }),
  render: () => <DeleteBotDialog bot={bot} onCancel={noop} onConfirm={done} />,
};
export const DeleteBotLongName: Story = {
  beforeEach: () => mockRpc({ "memory.list": memories }),
  render: () => (
    <DeleteBotDialog bot={{ ...bot, name: longName }} onCancel={noop} onConfirm={done} />
  ),
};
export const DeleteBotError: Story = {
  beforeEach: () => mockRpc({ "memory.list": memories }),
  render: () => <DeleteBotDialog bot={bot} onCancel={noop} onConfirm={reject} />,
  play: async () => {
    await userEvent.click(await body().findByLabelText(/Delete memories too/));
    await userEvent.click(await body().findByRole("button", { name: "Delete" }));
  },
};

export const DeleteGroup: Story = {
  render: () => (
    <DeleteItemDialog item={{ name: "Demo group" }} noun="group" onCancel={noop} onConfirm={done} />
  ),
};
export const DeleteRoutineWithDescription: Story = {
  render: () => (
    <DeleteItemDialog
      item={{ name: "Demo routine" }}
      noun="routine"
      description="Its run history will be deleted too."
      onCancel={noop}
      onConfirm={done}
    />
  ),
};
export const DeleteSpaceError: Story = {
  render: () => (
    <DeleteItemDialog
      item={{ name: "Demo space" }}
      noun="space"
      onCancel={noop}
      onConfirm={reject}
    />
  ),
  play: submit("Delete"),
};
