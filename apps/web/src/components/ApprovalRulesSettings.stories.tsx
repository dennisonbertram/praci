import type { ActionApprovalRule } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { mockRpc } from "../lib/__mocks__/rpc";
import { ApprovalRulesSettings } from "./ApprovalRulesSettings";

const rules: ActionApprovalRule[] = [
  {
    id: "rule_1",
    effect: "require_approval",
    matchKind: "category",
    matchValue: "email",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "rule_2",
    effect: "always_allow",
    matchKind: "connector",
    matchValue: "Sample connector",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "rule_3",
    effect: "require_approval",
    matchKind: "tool",
    matchValue: "mcp__brex__lock_card",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "rule_4",
    effect: "always_allow",
    matchKind: "category",
    matchValue: "calendar",
    createdAt: "2026-01-01T00:00:00.000Z",
  },
];

const tableRows = [
  "send_email",
  "spend_money",
  "connected_apps_write",
  "calendar_changes",
  "files_and_commands",
  "use_computer",
  "delete_data",
  "message_outside",
  "use_credentials",
].map((actionType, index) => ({
  actionType,
  primary: index < 5,
  effect: actionType === "send_email" || actionType === "spend_money" ? "ask" : "allow",
  spaceEffect: actionType === "send_email" || actionType === "spend_money" ? "ask" : "allow",
  botEffect: null,
}));

const permissions = {
  "permissions.get": { level: "open", effectiveDefault: "open" },
  "permissions.set": (input: unknown) => ({
    level: (input as { level: string | null }).level,
    effectiveDefault: "open",
  }),
};

const meta = {
  title: "Settings/ApprovalRulesSettings",
  component: ApprovalRulesSettings,
  decorators: [
    (Story) => (
      <div className="w-[480px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ApprovalRulesSettings>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithRules: Story = {
  beforeEach: () =>
    mockRpc({
      ...permissions,
      "approvalRules.table": { rows: tableRows },
      "approvalRules.list": rules,
      "approvalRules.set": (input: unknown) => ({
        id: "rule_new",
        createdAt: "2026-01-01T00:00:00.000Z",
        ...(input as object),
      }),
      "approvalRules.remove": {},
    }),
};

/** The permission level stays visible while the action controls are grouped under one disclosure. */
export const CustomizeActionsOpen: Story = {
  beforeEach: () =>
    mockRpc({
      ...permissions,
      "approvalRules.table": { rows: tableRows },
      "approvalRules.list": rules,
    }),
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByText("Customize actions"));
  },
};

/** At Ask for everything the gate asks despite a saved Allow; the disabled Allow remains visible
 * so the owner can replace it with Ask. */
export const AskForEverything: Story = {
  beforeEach: () =>
    mockRpc({
      ...permissions,
      "permissions.get": { level: "ask_everything", effectiveDefault: "open" },
      "approvalRules.table": { rows: tableRows, level: "ask_everything" },
      "approvalRules.list": rules,
      "approvalRules.set": (input: unknown) => ({
        id: "rule_new",
        createdAt: "2026-01-01T00:00:00.000Z",
        ...(input as object),
      }),
      "approvalRules.remove": {},
    }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(await canvas.findByText("Customize actions"));
    const savedAllow = await canvas.findByRole("combobox", { name: "Sample connector" });
    await expect(savedAllow).toHaveValue("allow");
    await expect(savedAllow.querySelector('option[value="allow"]')).toBeDisabled();
    await userEvent.selectOptions(savedAllow, "ask");
  },
};

export const NoRules: Story = {
  beforeEach: () =>
    mockRpc({
      ...permissions,
      "approvalRules.table": { rows: tableRows },
      "approvalRules.list": [],
    }),
};

export const Loading: Story = {
  beforeEach: () =>
    mockRpc({
      ...permissions,
      "approvalRules.list": () => new Promise(() => undefined),
    }),
};

export const LoadError: Story = {
  beforeEach: () =>
    mockRpc({
      ...permissions,
      "approvalRules.list": () => {
        throw new Error("The server did not answer.");
      },
    }),
};

/** An allow for one site, an agent's all-sites allow, and a routine's allow, each removable. */
export const SiteAndAgentRules: Story = {
  beforeEach: () =>
    mockRpc({
      ...permissions,
      "approvalRules.table": { rows: tableRows },
      "approvalRules.list": [
        {
          id: "rule_site",
          effect: "always_allow",
          matchKind: "site",
          matchValue: "example.com",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "rule_bot",
          effect: "always_allow",
          matchKind: "tool",
          matchValue: "web_fetch",
          botId: "bot_1",
          botName: "Researcher",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "rule_routine",
          effect: "always_allow",
          matchKind: "tool",
          matchValue: "mcp__brex__lock_card",
          routineId: "routine_1",
          routineName: "Weekly card check",
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      "approvalRules.remove": {},
    }),
};

export const RemoveFails: Story = {
  beforeEach: () =>
    mockRpc({
      ...permissions,
      "approvalRules.table": { rows: tableRows },
      "approvalRules.list": rules,
      "approvalRules.remove": () => {
        throw new Error("The server did not answer.");
      },
    }),
};
