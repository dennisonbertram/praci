import type {
  ExternalConversation,
  MessagingAgentConnection,
  MessagingChannelMembership,
  MessagingStatus,
} from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { mockRpc, resetRpcMocks } from "../lib/__mocks__/rpc";
import { withPageBehind } from "../stories/decorators";
import { mockBot as bot } from "../stories/fixtures";
import { MessagingSettingsOverlay } from "./MessagingSettingsOverlay";

const linked: MessagingStatus = {
  enabled: true,
  providers: ["sendblue", "slack"],
  openSignup: false,
  identities: [
    {
      id: "ident_1",
      provider: "sendblue",
      address: "+15550100",
      botId: "bot_demo",
      botName: "Demo bot",
    },
  ],
};

const channels: MessagingChannelMembership[] = [
  {
    id: "m1",
    channelId: "c1",
    identityId: "ident_1",
    provider: "slack",
    name: "Demo group",
    status: "invited",
    memberCount: 4,
  },
  {
    id: "m2",
    channelId: "c2",
    identityId: "ident_1",
    provider: "slack",
    name: null,
    status: "approved",
    memberCount: 2,
  },
];

const connections: MessagingAgentConnection[] = [
  {
    id: "conn1",
    peerBotName: "Sample bot",
    peerOwnerLabel: "Pat",
    status: "pending",
    incoming: true,
  },
  {
    id: "conn2",
    peerBotName: "Other bot",
    peerOwnerLabel: "Lee",
    status: "approved",
    incoming: false,
  },
];

const conversation: ExternalConversation = {
  id: "ext_1",
  spaceId: "space_demo",
  botId: "bot_demo",
  provider: "slack",
  displayName: "Demo team channel",
  participantNames: ["Pat", "Lee"],
  teamChatAmbientEnabled: null,
  teamChatRules: null,
  automatedSenderPolicies: {},
  automatedSenders: [],
  threadId: "thread_ext",
  preview: "",
  unread: false,
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const spaces = (externalConversations: ExternalConversation[]) => ({
  current: { externalConversations },
});

const meta = {
  beforeEach: () => resetRpcMocks(),
  decorators: [withPageBehind()],
  title: "Settings/MessagingSettingsOverlay",
  component: MessagingSettingsOverlay,
  args: { onClose: () => undefined },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof MessagingSettingsOverlay>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  beforeEach: () =>
    mockRpc({
      "messaging.status": { ...linked, identities: [] },
      "messaging.channels.list": [],
      "messaging.connections.list": [],
      "bots.list": [bot],
      "spaces.list": spaces([]),
    }),
};

export const Populated: Story = {
  beforeEach: () =>
    mockRpc({
      "messaging.status": linked,
      "messaging.channels.list": channels,
      "messaging.connections.list": connections,
      "bots.list": [bot],
      "spaces.list": spaces([conversation]),
    }),
};

export const LinkCodeIssued: Story = {
  beforeEach: () =>
    mockRpc({
      "messaging.status": { ...linked, identities: [] },
      "messaging.channels.list": [],
      "messaging.connections.list": [],
      "bots.list": [bot],
      "spaces.list": spaces([]),
      "messaging.link.start": { code: "DEMO-1234" },
    }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await canvas.findByRole("option", { name: "Demo bot" });
    await userEvent.selectOptions(await canvas.findByLabelText("Bot to link"), "bot_demo");
    await userEvent.click(await canvas.findByRole("button", { name: "Link a chat app" }));
  },
};

export const LoadFailed: Story = {
  beforeEach: () => mockRpc({ "messaging.status": () => Promise.reject(new Error("offline")) }),
};

export const ConversationSettingsOpen: Story = {
  ...Populated,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body);
    await userEvent.click(await canvas.findByRole("button", { name: "Settings" }));
  },
};
