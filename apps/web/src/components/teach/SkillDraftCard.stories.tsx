import type { SkillPlaybook, TaughtSkill } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { mockRpc } from "../../lib/__mocks__/rpc";
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

const live = (patch: Partial<TaughtSkill>): TaughtSkill => ({
  id: "skill_demo",
  botId: "bot_demo",
  name: "File sample invoices",
  goal: "Check each new invoice and file it.",
  status: "draft",
  playbook,
  recording: { events: [], snapshots: [] },
  startedAt: null,
  expiresAt: null,
  stoppedAt: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...patch,
});

const loginPlaybook: SkillPlaybook = {
  ...playbook,
  steps: ["Open the demo sign-in page", "Type the username", "Ask the user to sign in"],
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

/** The details move under "More" so Name, Steps and Save fit without scrolling. */
export const MoreOpen: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByText("More"));
  },
};

const withLogin = {
  args: { block: { ...meta.args.block, playbook: loginPlaybook } },
  beforeEach: () =>
    mockRpc({
      "skills.get": live({
        playbook: loginPlaybook,
        loginPrompts: [{ stepIndex: 2, field: "Password", username: "demo-user" }],
      }),
    }),
} satisfies Story;

/** A password was typed while teaching; the step waits for Save as login or Skip. */
export const LoginPrompt: Story = withLogin;

export const LoginPromptForm: Story = {
  ...withLogin,
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByText("Save as login"));
    await userEvent.type(
      await within(canvasElement).findByLabelText("Site"),
      "https://login.example.test",
    );
    // The typed username is offered, not assumed.
    await expect(
      ((await within(canvasElement).findByLabelText("Username")) as HTMLInputElement).value,
    ).toBe("demo-user");
  },
};

/** The name field shows its rule instead of a generic validation error. */
export const LoginPromptInvalidName: Story = {
  ...withLogin,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText("Save as login"));
    await userEvent.type(await canvas.findByLabelText("Name"), "CRM Login");
    await expect(await canvas.findByText("Lowercase letters, numbers, - and _.")).toBeTruthy();
  },
};

export const LoginPromptError: Story = {
  ...withLogin,
  beforeEach: () => {
    withLogin.beforeEach();
    mockRpc({
      "taughtSkills.saveLogin": () => {
        throw new Error("Could not save the login");
      },
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText("Save as login"));
    await userEvent.type(await canvas.findByLabelText("Site"), "https://login.example.test");
    await userEvent.click(await canvas.findByRole("button", { name: "Save login" }));
    await expect(await canvas.findByRole("alert")).toBeTruthy();
  },
};

/** A draft that was never saved is expired or discarded: the card says so. */
export const Discarded: Story = {
  beforeEach: () => mockRpc({ "taughtSkills.cancel": () => ({ ok: true }) }),
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("button", { name: "Discard" }));
    await expect(await within(canvasElement).findByText("Discarded")).toBeTruthy();
  },
};

export const TestWorked: Story = {
  args: { block: { ...meta.args.block, status: "saved" } },
  beforeEach: () => mockRpc({ "skills.get": live({ status: "saved", lastTestOutcome: "worked" }) }),
};

export const TestStopped: Story = {
  args: { block: { ...meta.args.block, status: "saved" } },
  beforeEach: () =>
    mockRpc({
      "skills.get": live({
        status: "saved",
        lastTestOutcome: "stopped",
        lastTestNote: "the Export button was not on the screen",
      }),
    }),
};

/** Test pressed and the outcome has not settled yet. */
export const TestRunning: Story = {
  beforeEach: () => mockRpc({ "skills.get": live({ lastTestOutcome: null }) }),
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("button", { name: "Test" }));
  },
};
