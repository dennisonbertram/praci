import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import type { AskBlock } from "./AskCard";
import { AskCard } from "./AskCard";

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
    text: "Allow your mail to be sent to OpenRouter (example/model-1, forwarded to its provider)?",
    detail:
      "Messages, chat history, bot instructions, memories, attachments, screenshots and connected-app content are sent to run your bots, including routines. This stays on until you turn it off in Account settings.",
    approvalEffectId: "effect_demo",
    consent: { version: "2026-09-14" },
    actions: [
      { id: "allow", label: "Allow" },
      { id: "deny", label: "Not now" },
    ],
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
      text: "Review before Mercury: Request send money → $1,200.00",
      detail:
        'tool: mcp__finance-mercury__requestSendMoney\narguments: {\n  "amount": 1200,\n  "accountId": "acct-demo"\n}',
      detailFolded: true,
      approvalEffectId: "effect_money",
      actions: approvalActions,
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
      text: "Paste the API key for the sample service.",
      input: "secret",
      purpose: "api_key",
      credential: {
        name: "SAMPLE_KEY",
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
