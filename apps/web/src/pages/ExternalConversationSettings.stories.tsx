import type { ExternalConversation } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { scoutBot } from "../stories/fixtures";
import { ExternalConversationSettings } from "./ExternalConversationSettings";

const conversation: ExternalConversation = {
  id: "ext_1",
  spaceId: "space_demo",
  botId: "bot_demo",
  provider: "slack",
  displayName: "Demo project room",
  participantNames: ["Alex Example", "Sam Sample"],
  teamChatAmbientEnabled: null,
  teamChatRules: null,
  automatedSenderPolicies: {},
  automatedSenders: [
    { id: "ci", name: "Build notifier" },
    { id: "deploy", name: "Deploy bot" },
  ],
  threadId: "thread_ext",
  preview: "",
  unread: false,
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const meta = {
  title: "Shell/External conversation settings",
  component: ExternalConversationSettings,
  args: { conversation, bot: scoutBot, onSave: async (): Promise<void> => undefined },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ExternalConversationSettings>;
export default meta;

type Story = StoryObj<typeof meta>;

const clickSave: Story["play"] = async ({ canvasElement }) => {
  await userEvent.click(await within(canvasElement).findByRole("button", { name: /Save/ }));
};

export const Default: Story = {};

export const OverridesAndRollup: Story = {
  args: {
    conversation: {
      ...conversation,
      teamChatAmbientEnabled: false,
      teamChatRules: "Only reply when someone asks Scout by name.",
      automatedSenderPolicies: {
        ci: { name: "Build notifier", mode: "rollup", rollupHours: 12 },
        deploy: { name: "Deploy bot", mode: "action" },
      },
    },
  },
};

export const MentionsOnlyBotDefault: Story = {
  args: { bot: { ...scoutBot, teamChatAmbientEnabled: false } },
};

export const NoAutomatedSenders: Story = {
  args: {
    conversation: { ...conversation, automatedSenders: [], displayName: null },
  },
};

export const Saved: Story = { play: clickSave };

export const Saving: Story = {
  args: { onSave: () => new Promise(() => undefined) },
  play: clickSave,
};

export const SaveFailed: Story = {
  args: {
    onSave: async () => {
      throw new Error("The server is unavailable.");
    },
  },
  play: clickSave,
};
