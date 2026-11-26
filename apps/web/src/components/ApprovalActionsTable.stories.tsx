import type { ApprovalTableRow } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { mockRpc } from "../lib/__mocks__/rpc";
import { ApprovalActionsTable } from "./ApprovalActionsTable";

const defaults: Array<[ApprovalTableRow["actionType"], ApprovalTableRow["effect"], boolean]> = [
  ["send_email", "ask", true],
  ["spend_money", "ask", true],
  ["connected_apps_write", "allow", true],
  ["calendar_changes", "allow", true],
  ["files_and_commands", "allow", true],
  ["use_computer", "allow", false],
  ["delete_data", "allow", false],
  ["message_outside", "allow", false],
  ["use_credentials", "allow", false],
];
const rows = (
  override: Partial<Record<ApprovalTableRow["actionType"], "allow" | "ask" | "block">> = {},
) =>
  defaults.map(([actionType, spaceEffect, primary]) => ({
    actionType,
    primary,
    spaceEffect,
    botEffect: override[actionType] ?? null,
    effect: override[actionType] ?? spaceEffect,
  }));

/** The rows as the gate decides at a stricter level: Ask, except a saved Block (or, at Ask for changes, a saved Allow). */
const stricter = (
  saved: Partial<Record<ApprovalTableRow["actionType"], "allow" | "ask" | "block">>,
  everything = false,
) =>
  defaults.map(([actionType, , primary]) => {
    const effect = saved[actionType] ?? "ask";
    const shown = everything && effect === "allow" ? "ask" : effect;
    return { actionType, primary, spaceEffect: shown, botEffect: null, effect: shown };
  });

const meta = {
  title: "Settings/ApprovalActionsTable",
  component: ApprovalActionsTable,
  decorators: [
    (Story) => (
      <div className="w-[480px] max-w-full px-5 sm:px-0">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ApprovalActionsTable>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Defaults: Story = {
  beforeEach: () => mockRpc({ "approvalRules.table": { rows: rows(), level: "open" } }),
};

/** Spend money offers only Ask and Block; delete data and send email carry a hard-line note. */
export const MoreActionsOpen: Story = {
  beforeEach: () =>
    mockRpc({ "approvalRules.table": { rows: rows({ send_email: "block" }), level: "open" } }),
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByText("More actions"));
  },
};

/** An always-ask row can be Ask or Block; a bot with an override can still return to all bots. */
export const BotWithOverride: Story = {
  args: { botId: "bot_1" },
  beforeEach: () =>
    mockRpc({
      "approvalRules.table": {
        rows: rows({ send_email: "block", spend_money: "block" }),
        level: "open",
      },
    }),
};

/** A payment Block inherited from the space stays editable as Same as all bots. */
export const BotInheritsPaymentBlock: Story = {
  args: { botId: "bot_1" },
  beforeEach: () =>
    mockRpc({
      "approvalRules.table": {
        level: "open",
        rows: defaults.map(([actionType, spaceEffect, primary]) => ({
          actionType,
          primary,
          spaceEffect: actionType === "spend_money" ? "block" : spaceEffect,
          botEffect: null,
          effect: actionType === "spend_money" ? "block" : spaceEffect,
        })),
      },
    }),
};

/** At Ask for changes a row with no saved rule asks, as the gate does. */
export const AskForChanges: Story = {
  beforeEach: () =>
    mockRpc({
      "approvalRules.table": {
        rows: stricter({ calendar_changes: "allow" }),
        level: "ask_changes",
      },
    }),
};

/** At Ask for everything nothing can be Allow: the Allow option is disabled; Block still works. */
export const AskForEverything: Story = {
  beforeEach: () =>
    mockRpc({
      "approvalRules.table": {
        rows: stricter({ send_email: "block" }, true),
        level: "ask_everything",
      },
    }),
};

export const Saving: Story = {
  beforeEach: () =>
    mockRpc({
      "approvalRules.table": { rows: rows(), level: "open" },
      "approvalRules.setActionType": () => new Promise(() => undefined),
    }),
  play: async ({ canvasElement }) => {
    const select = await within(canvasElement).findByLabelText("Send email");
    await userEvent.selectOptions(select, "block");
  },
};

export const Loading: Story = {
  beforeEach: () => mockRpc({ "approvalRules.table": () => new Promise(() => undefined) }),
};

export const SaveError: Story = {
  beforeEach: () =>
    mockRpc({
      "approvalRules.table": { rows: rows(), level: "open" },
      "approvalRules.setActionType": () => {
        throw new Error("The server did not answer.");
      },
    }),
  play: async ({ canvasElement }) => {
    const select = await within(canvasElement).findByLabelText("Send email");
    await userEvent.selectOptions(select, "allow");
  },
};
