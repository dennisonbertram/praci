import { MEETING_MARK_REASON } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import type { AskBlock } from "./AskCard";
import { AskCard } from "./AskCard";
import { BotToolControlsContext } from "./BotToolControls";

const ask = (overrides: Partial<AskBlock> = {}): AskBlock => ({
  kind: "ask",
  text: "Should I send the weekly summary to the team?",
  ...overrides,
});

const approvalActions = [
  { id: "allow", label: "Allow once" },
  { id: "always", label: "Always allow" },
  { id: "deny", label: "Deny" },
];

const consentAsk = (overrides: Partial<AskBlock> = {}): AskBlock =>
  ask({
    text: "Let Muse Wonder (OpenRouter) see this agent's chats and mail?",
    detail:
      "This agent uses a model you haven't allowed yet. Models you already allowed are unaffected. Messages, chat history, bot instructions, memories, attachments, screenshots and connected-app content are sent to run your bots, including routines. This stays on until you turn it off in Settings under Privacy and approvals.",
    approvalEffectId: "effect_demo",
    consent: { version: "2026-09-14" },
    actions: [
      { id: "allow", label: "Allow" },
      { id: "deny", label: "Not now" },
    ],
    ...overrides,
  });

const shareAsk = (overrides: Partial<AskBlock> = {}): AskBlock =>
  ask({
    text: "Share with Support?",
    detail: "Our lead investor is Halcyon Ventures. You can reach them at priya@halcyon.example.",
    approvalEffectId: "effect_share",
    share: true,
    actions: [
      { id: "allow", label: "Share" },
      { id: "deny", label: "Don't share" },
    ],
    status: "pending",
    ...overrides,
  });

const pageSourceAsk = (overrides: Partial<AskBlock> = {}): AskBlock =>
  ask({
    text: "Read Mercury every hour?",
    detail: 'Request: getAccounts {"limit":5}\nPage: Finance',
    pageSource: { sourceId: "src_demo", callHash: "0".repeat(64) },
    actions: [
      { id: "allow", label: "Allow" },
      { id: "deny", label: "Not now" },
    ],
    status: "pending",
    ...overrides,
  });

const meta = {
  title: "Chat/AskCard",
  component: AskCard,
  args: { block: ask(), canAnswer: true, onAnswer: async () => undefined },
} satisfies Meta<typeof AskCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithDetail: Story = {
  args: {
    block: ask({
      detail: "To: team@example.com\nSubject: Weekly summary\n\nHere is what happened this week.",
    }),
  },
};

export const MoneyApprovalWithFoldedDetails: Story = {
  args: {
    block: ask({
      text: "Send $1,200.00 to Acme Supplies from Operating?",
      detail:
        'tool: mcp__finance-mercury__requestSendMoney\narguments: {\n  "amount": 1200,\n  "recipientId": "rcp-demo",\n  "accountId": "acct-demo"\n}',
      detailFolded: true,
      approvalEffectId: "effect_money",
      // Spending money always needs an explicit, one-time choice. It cannot save an Allow rule.
      actions: [
        { id: "allow", label: "Send $1,200.00" },
        { id: "deny", label: "Deny" },
      ],
    }),
  },
};

export const McpToolApproval: Story = {
  args: {
    block: ask({
      text: "Review before Linear: Create issue → Fix the signup form",
      detail: "tool: mcp__linear__createIssue\ntitle: Fix the signup form",
      approvalEffectId: "effect_mcp",
      actions: approvalActions,
    }),
  },
};

export const ConnectorToolApproval: Story = {
  args: {
    block: ask({
      text: "Review before Slack: Post message → #general",
      detail: "tool: SLACK_POST_MESSAGE\nbody: Weekly summary is ready.",
      approvalEffectId: "effect_connector",
      actions: approvalActions,
    }),
  },
};

/** An agent asks for a capability the owner switched off. The Firewall line is added for a Firewall agent. */
export const RequestAccess: Story = {
  args: {
    block: ask({
      text: "Scout asks to see, add and edit your contacts",
      detail: "Agent's reason: Save the three leads from this thread.",
      approvalEffectId: "effect_access",
      actions: [
        { id: "allow", label: "Allow for this run" },
        { id: "always", label: "Always for this agent" },
        { id: "deny", label: "Deny" },
      ],
    }),
  },
};

export const RequestAccessFirewall: Story = {
  args: {
    block: ask({
      text: "Scout asks to see, add and edit your contacts",
      detail:
        "Agent's reason: Save the three leads from this thread.\nFirewall is on, so each use will still ask you.",
      approvalEffectId: "effect_access",
      actions: [
        { id: "allow", label: "Allow for this run" },
        { id: "always", label: "Always for this agent" },
        { id: "deny", label: "Deny" },
      ],
    }),
  },
};

export const Answered: Story = { args: { block: ask({ status: "answered", answer: "approved" }) } };

export const NoLongerActive: Story = { args: { canAnswer: false } };

export const WithChoices: Story = {
  args: {
    block: ask({
      actions: [
        { id: "daily", label: "Every day" },
        { id: "weekly", label: "Every week" },
      ],
    }),
  },
};

export const AnsweredChoice: Story = {
  args: {
    block: ask({
      status: "answered",
      answer: "weekly",
      actions: [
        { id: "daily", label: "Every day" },
        { id: "weekly", label: "Every week" },
      ],
    }),
  },
};

export const Approval: Story = {
  args: {
    block: ask({
      text: "Allow the bot to run the calendar tool?",
      approvalEffectId: "effect_demo",
      actions: approvalActions,
    }),
  },
};

export const DesktopAppApproval: Story = {
  args: {
    block: ask({
      text: "Use Music on this Mac",
      approvalEffectId: "effect_desktop_app",
      actions: [
        { id: "allow", label: "Allow for this run" },
        { id: "deny", label: "Deny" },
      ],
    }),
  },
};

export const ApprovalWithReason: Story = {
  args: {
    block: ask({
      text: "Allow the bot to send this email?",
      approvalEffectId: "effect_demo",
      approvalReason: "Asked because this ran in the background",
      actions: [
        { id: "allow", label: "Allow once" },
        { id: "deny", label: "Deny" },
      ],
    }),
  },
};

export const ApprovalMeetingMark: Story = {
  args: {
    block: ask({
      text: "Allow the bot to send this email?",
      approvalEffectId: "effect_demo",
      approvalReason: MEETING_MARK_REASON,
      actions: [
        { id: "allow", label: "Allow once" },
        { id: "deny", label: "Deny" },
      ],
    }),
  },
  decorators: [
    (Story) => (
      <BotToolControlsContext.Provider
        value={{
          editableBotName: () => undefined,
          disableTool: async () => undefined,
          canSend: () => false,
          sendDraft: async () => undefined,
          openComposer: () => undefined,
          clearConversation: () => undefined,
        }}
      >
        <Story />
      </BotToolControlsContext.Provider>
    ),
  ],
};

/** A connected-app tool: friendly title, with the exact tool id behind the chevron. */
export const ApprovalWithToolId: Story = {
  args: {
    block: ask({
      text: "Review before Carta: Discover",
      approvalEffectId: "effect_demo",
      toolId: "mcp__integration-5f783c95__discover",
      actions: [
        { id: "allow", label: "Allow once" },
        { id: "always", label: "Always allow this tool" },
        { id: "deny", label: "Deny" },
      ],
    }),
  },
};

/** A fetch to a site the run was not given: allow once, this site, or every site for this agent. */
export const NewSiteWithAllSites: Story = {
  args: {
    block: ask({
      text: "Review before Web fetch",
      approvalEffectId: "effect_demo",
      site: "npmjs.com",
      actions: [
        { id: "allow", label: "Allow once" },
        { id: "always", label: "Always allow npmjs.com" },
        {
          id: "always_bot_sites",
          label:
            "Allow all sites for this agent (it can read Drive, calendar, Data room, contacts and records)",
        },
        { id: "deny", label: "Deny" },
      ],
    }),
  },
};

/** A background routine card: allow once, or always for this routine only. */
export const RoutineCardWithAlways: Story = {
  args: {
    block: ask({
      text: "Review before Write file",
      approvalEffectId: "effect_demo",
      approvalReason: "Asked because this ran in the background.",
      actions: [
        { id: "allow", label: "Allow once" },
        { id: "always_routine", label: "Always for this routine" },
        { id: "deny", label: "Deny" },
      ],
    }),
  },
};

export const ApprovalAlwaysAllowed: Story = {
  args: {
    block: ask({
      text: "Review before Carta: Discover",
      approvalEffectId: "effect_demo",
      toolId: "mcp__integration-5f783c95__discover",
      actions: approvalActions,
      status: "answered",
      answer: "always",
    }),
  },
  decorators: [
    (Story) => (
      <BotToolControlsContext.Provider
        value={{
          editableBotName: () => undefined,
          disableTool: async () => undefined,
          canSend: () => false,
          sendDraft: async () => undefined,
          openComposer: () => undefined,
          openApprovalSettings: () => undefined,
        }}
      >
        <Story />
      </BotToolControlsContext.Provider>
    ),
  ],
};

export const ApprovalAllowed: Story = {
  args: {
    block: ask({
      approvalEffectId: "effect_demo",
      actions: approvalActions,
      status: "answered",
      answer: "allow",
    }),
  },
};

/** A payment allowed here that its bank must still approve, with the time it was requested. */
export const PaymentWaitingForProvider: Story = {
  args: {
    block: ask({
      text: "Send $1,250.00 to Acme Supplies from Operating?",
      approvalEffectId: "effect_money",
      actions: [
        { id: "allow", label: "Send $1,250.00" },
        { id: "deny", label: "Deny" },
      ],
      waitsFor: "Mercury",
      status: "answered",
      answer: "allow",
    }),
    canAnswer: false,
    requestedAt: "2030-01-01T09:44:00.000Z",
  },
};

/** A routine's whole prompt reads in full: no nested scroll box, so nothing is cut off on a phone. */
export const LongInstruction: Story = {
  args: {
    block: ask({
      text: "Review before creating the repeating schedule",
      detail: Array.from(
        { length: 8 },
        (_, i) =>
          `Step ${i + 1}: read the open investor follow-ups from the Investors page and post a concise list here.`,
      ).join("\n"),
      approvalEffectId: "effect_routine",
      actions: approvalActions,
    }),
  },
};

export const ApprovalDenied: Story = {
  args: {
    block: ask({
      approvalEffectId: "effect_demo",
      actions: approvalActions,
      status: "answered",
      answer: "deny",
    }),
  },
};

/** A newer request replaced this one; the server closed it, so it has no buttons. */
export const ApprovalSuperseded: Story = {
  args: {
    block: ask({
      approvalEffectId: "effect_demo",
      actions: approvalActions,
      status: "answered",
      answer: "superseded",
    }),
  },
};

/** The run failed before the card was answered; nothing was sent. */
export const ApprovalExpired: Story = {
  args: {
    block: ask({
      approvalEffectId: "effect_demo",
      actions: approvalActions,
      status: "answered",
      answer: "expired",
    }),
  },
};

export const ApprovalAnsweredConfirm: Story = {
  args: {
    block: ask({
      text: "Send this payment request?",
      approvalEffectId: "effect_demo",
      actions: [{ id: "confirm-payment", label: "Confirm payment request" }],
      status: "answered",
      answer: "confirm-payment",
    }),
  },
};

export const CreateSpaceApproval: Story = {
  args: {
    block: ask({
      text: "Create a space named Demo?",
      approvalEffectId: "effect_demo",
      actions: [
        { id: "create", label: "Create", outcome: "created" },
        { id: "cancel", label: "Cancel", outcome: "cancelled" },
      ],
    }),
  },
};

export const CreatedSpace: Story = {
  args: {
    block: ask({
      approvalEffectId: "effect_demo",
      actions: [
        { id: "create", label: "Create", outcome: "created" },
        { id: "cancel", label: "Cancel", outcome: "cancelled" },
      ],
      status: "answered",
      answer: "create",
    }),
  },
};

export const SecretApiKey: Story = {
  args: {
    block: ask({
      text: "Example access for the weekly report. Waiting for the key.",
      input: "secret",
      purpose: "api_key",
      credential: {
        name: "EXAMPLE_API_KEY",
        origin: "https://api.example.com",
        auth: { type: "bearer" },
      },
    }),
  },
};

export const SecretLogin: Story = {
  args: {
    block: ask({
      text: "Sign in to the sample site.",
      input: "secret",
      purpose: "password",
      credential: {
        name: "SAMPLE_LOGIN",
        origin: "https://app.example.com",
        auth: { type: "login" },
      },
    }),
  },
};

export const SecretCommandVariable: Story = {
  args: {
    block: ask({
      text: "Provide a value for the build command.",
      input: "secret",
      purpose: "api_key",
      credential: { name: "SAMPLE_TOKEN", origin: "", auth: { type: "command" } },
    }),
  },
};

export const SecretSaved: Story = {
  args: {
    block: ask({ input: "secret", purpose: "api_key", status: "answered", answer: "x" }),
  },
};

export const SubmitFails: Story = {
  args: {
    onAnswer: async () => {
      throw new Error("The network went away");
    },
  },
};

export const EditingAnswer: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: /edit first/i }));
  },
};

export const ConsentRequest: Story = { args: { block: consentAsk() } };

export const ConsentAllowed: Story = {
  args: { block: consentAsk({ status: "answered", answer: "allow" }) },
};

export const ConsentDeclined: Story = {
  args: { block: consentAsk({ status: "answered", answer: "deny" }) },
};

/** A message from one bot to an external bot, held for the owner: the exact text, Share once or Don't share. */
export const HeldShare: Story = { args: { block: shareAsk() } };

export const HeldShareShared: Story = {
  args: { block: shareAsk({ status: "answered", answer: "allow" }) },
};

export const HeldShareDeclined: Story = {
  args: { block: shareAsk({ status: "answered", answer: "deny" }) },
};

/** The owner's approval of a page's data source: answered without a waiting run. */
export const PageSourcePending: Story = { args: { block: pageSourceAsk() } };

/** An API source: the exact GET, the key's name only, and the page. */
export const PageSourceHttpPending: Story = {
  args: {
    block: pageSourceAsk({
      text: "Read api.example.com every hour?",
      detail:
        "Request: GET https://api.example.com/v1/revenue?period=week\nKey: billing\nPage: Revenue",
    }),
  },
};

export const PageSourceAllowed: Story = {
  args: { block: pageSourceAsk({ status: "answered", answer: "allow" }) },
};

export const PageSourceDenied: Story = {
  args: { block: pageSourceAsk({ status: "answered", answer: "deny" }) },
};
