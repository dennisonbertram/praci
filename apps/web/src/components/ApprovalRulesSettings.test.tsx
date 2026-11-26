// @vitest-environment jsdom

import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const t = (strings: TemplateStringsArray, ...values: unknown[]) =>
  strings.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), "");
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("../lib/user-error", () => ({ errorText: () => "Something went wrong" }));
const api = vi.hoisted(() => ({
  list: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
  table: vi.fn(),
  setActionType: vi.fn(),
}));
const bots = vi.hoisted(() => ({ list: vi.fn() }));
const permissions = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn() }));
vi.mock("../lib/rpc", () => ({ rpc: { approvalRules: api, bots, permissions } }));

import { ApprovalActionsTable } from "./ApprovalActionsTable";
import { ApprovalRulesSettings } from "./ApprovalRulesSettings";

i18n.loadAndActivate({ locale: "en", messages: {} });

const TYPES = [
  ["send_email", true],
  ["spend_money", true],
  ["connected_apps_write", true],
  ["calendar_changes", true],
  ["files_and_commands", true],
  ["use_computer", false],
  ["delete_data", false],
  ["message_outside", false],
  ["use_credentials", false],
] as const;
const rows = (botEffects: Record<string, string> = {}) =>
  TYPES.map(([actionType, primary]) => ({
    actionType,
    primary,
    effect: botEffects[actionType] ?? "ask",
    spaceEffect: "ask",
    botEffect: botEffects[actionType] ?? null,
  }));

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const select = (type: string) =>
  container.querySelector<HTMLSelectElement>(`[data-testid=approval-row-${type}]`);

async function change(el: HTMLSelectElement | null, value: string) {
  await act(async () => {
    if (!el) throw new Error("select missing");
    el.value = value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.resetAllMocks();
  api.list.mockResolvedValue([]);
  bots.list.mockResolvedValue([]);
  permissions.get.mockResolvedValue({ level: "ask_changes", effectiveDefault: "open" });
  api.setActionType.mockResolvedValue({ ok: true });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it("keeps the permission level visible and groups action controls under one customization disclosure", async () => {
  api.table.mockResolvedValue({ rows: rows() });
  api.list.mockResolvedValue([toolRule, botRule]);
  await act(async () =>
    root.render(
      <I18nProvider i18n={i18n}>
        <ApprovalRulesSettings />
      </I18nProvider>,
    ),
  );
  await act(async () => {});
  const disclosure = container.querySelector("details");
  expect(disclosure?.querySelector("summary")?.textContent).toBe("Customize actions");
  expect(levelSelect()?.closest("details")).toBeNull();
  expect(disclosure?.contains(select("send_email"))).toBe(true);
  expect(disclosure?.contains(select("use_computer"))).toBe(true);
  expect(disclosure?.querySelectorAll("details")).toHaveLength(0);
  expect(disclosure?.textContent).toContain("Lock card");
  expect(disclosure?.textContent).not.toContain("mcp__brex__lock_card");
  expect(disclosure?.textContent).toContain("Researcher");
  expect(api.table).toHaveBeenCalledWith({ botId: undefined });
});

it("reloads the table when the level changes, and disables Allow at Ask for everything", async () => {
  api.table.mockResolvedValueOnce({ rows: rows({}), level: "ask_changes" });
  await act(async () =>
    root.render(
      <I18nProvider i18n={i18n}>
        <ApprovalRulesSettings />
      </I18nProvider>,
    ),
  );
  await act(async () => {});
  expect(api.table).toHaveBeenCalledTimes(1);
  expect(select("calendar_changes")?.value).toBe("ask");
  api.table.mockResolvedValue({ rows: rows({}), level: "ask_everything" });
  permissions.set.mockResolvedValue({ level: "ask_everything", effectiveDefault: "open" });
  await change(
    container.querySelector<HTMLSelectElement>(
      `#${CSS.escape(container.querySelector("label")?.getAttribute("for") ?? "")}`,
    ),
    "ask_everything",
  );
  await act(async () => {});
  expect(api.table).toHaveBeenCalledTimes(2);
  const allow = select("calendar_changes")?.querySelector<HTMLOptionElement>("option[value=allow]");
  expect(allow?.disabled).toBe(true);
  expect(
    select("calendar_changes")?.querySelector<HTMLOptionElement>("option[value=block]")?.disabled,
  ).toBe(false);
  expect(container.textContent).not.toContain("Background runs ask");
});

it("saves a changed space row and reloads the table", async () => {
  api.table.mockResolvedValue({ rows: rows() });
  await act(async () =>
    root.render(
      <I18nProvider i18n={i18n}>
        <ApprovalActionsTable />
      </I18nProvider>,
    ),
  );
  await act(async () => {});
  await change(select("send_email"), "block");
  expect(api.setActionType).toHaveBeenCalledWith({
    actionType: "send_email",
    botId: undefined,
    effect: "block",
  });
  expect(api.table).toHaveBeenCalledTimes(2);
});

it("for a bot, shows the override and sends null for Same as all bots", async () => {
  api.table.mockResolvedValue({ rows: rows({ send_email: "block" }) });
  await act(async () =>
    root.render(
      <I18nProvider i18n={i18n}>
        <ApprovalActionsTable botId="bot-1" />
      </I18nProvider>,
    ),
  );
  await act(async () => {});
  expect(select("send_email")?.value).toBe("block");
  // Payment actions inherit the space setting unless this agent has an explicit override.
  expect(select("calendar_changes")?.value).toBe("same");
  expect(select("spend_money")?.value).toBe("same");
  expect(select("spend_money")?.disabled).toBe(false);
  await change(select("send_email"), "same");
  expect(api.setActionType).toHaveBeenCalledWith({
    actionType: "send_email",
    botId: "bot-1",
    effect: null,
  });
});

it("shows an error when saving fails", async () => {
  api.table.mockResolvedValue({ rows: rows() });
  api.setActionType.mockRejectedValue(new Error("x"));
  await act(async () =>
    root.render(
      <I18nProvider i18n={i18n}>
        <ApprovalActionsTable />
      </I18nProvider>,
    ),
  );
  await act(async () => {});
  await change(select("send_email"), "allow");
  expect(container.textContent).toContain("Something went wrong");
});

it("disables Allow for a tool rule that always needs approval", async () => {
  api.table.mockResolvedValue({ rows: rows() });
  api.list.mockResolvedValue([
    {
      id: "r1",
      effect: "require_approval",
      matchKind: "tool",
      matchValue: "create_space",
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  ]);
  await act(async () =>
    root.render(
      <I18nProvider i18n={i18n}>
        <ApprovalRulesSettings />
      </I18nProvider>,
    ),
  );
  await act(async () => {});
  const ruleSelect = container.querySelector<HTMLSelectElement>("li select");
  expect(ruleSelect?.value).toBe("ask");
  expect(ruleSelect?.querySelector<HTMLOptionElement>("option[value=allow]")?.disabled).toBe(true);
  expect(ruleSelect?.querySelector<HTMLOptionElement>("option[value=block]")?.disabled).toBe(false);
});

const allowToolRule = {
  id: "r3",
  effect: "always_allow",
  matchKind: "tool",
  matchValue: "mcp__brex__lock_card",
  createdAt: "2026-01-01T00:00:00.000Z",
};
const allowConnectorRule = {
  id: "r4",
  effect: "always_allow",
  matchKind: "connector",
  matchValue: "brex",
  createdAt: "2026-01-01T00:00:00.000Z",
};
const blockToolRule = {
  id: "r6",
  effect: "block",
  matchKind: "tool",
  matchValue: "mcp__brex__freeze_card",
  createdAt: "2026-01-01T00:00:00.000Z",
};
const levelSelect = () =>
  container.querySelector<HTMLSelectElement>("[data-testid=permission-level] select");

it("at Ask for everything shows saved Allows so they can still be edited", async () => {
  permissions.get.mockResolvedValue({ level: "ask_everything", effectiveDefault: "open" });
  api.table.mockResolvedValue({ rows: rows(), level: "ask_everything" });
  api.list.mockResolvedValue([allowToolRule, allowConnectorRule, blockToolRule]);
  await act(async () =>
    root.render(
      <I18nProvider i18n={i18n}>
        <ApprovalRulesSettings />
      </I18nProvider>,
    ),
  );
  await act(async () => {});
  // Nine table rows, the permission level, then one select per listed rule.
  expect(container.querySelectorAll("select")).toHaveLength(13);
  const ruleSelects = container.querySelectorAll<HTMLSelectElement>("li select");
  expect(ruleSelects).toHaveLength(3);
  // The gate asks while the saved rule remains Allow; the disabled option keeps that intent clear.
  expect(ruleSelects[0]?.value).toBe("allow");
  expect(ruleSelects[0]?.querySelector<HTMLOptionElement>("option[value=allow]")?.disabled).toBe(
    true,
  );
  expect(ruleSelects[0]?.querySelector<HTMLOptionElement>("option[value=block]")?.disabled).toBe(
    false,
  );
  expect(ruleSelects[1]?.value).toBe("allow");
  expect(ruleSelects[1]?.querySelector<HTMLOptionElement>("option[value=allow]")?.disabled).toBe(
    true,
  );
  // Block still outranks the level.
  expect(ruleSelects[2]?.value).toBe("block");
  expect(api.set).not.toHaveBeenCalled();
  expect(api.list).toHaveBeenCalledTimes(1);
});

it("keeps a saved Allow visible when the level rises and restores it without rewriting it", async () => {
  permissions.get.mockResolvedValue({ level: "open", effectiveDefault: "open" });
  api.table.mockResolvedValue({ rows: rows(), level: "open" });
  api.list.mockResolvedValue([allowToolRule]);
  await act(async () =>
    root.render(
      <I18nProvider i18n={i18n}>
        <ApprovalRulesSettings />
      </I18nProvider>,
    ),
  );
  await act(async () => {});
  expect(container.querySelector<HTMLSelectElement>("li select")?.value).toBe("allow");
  api.table.mockResolvedValue({ rows: rows(), level: "ask_everything" });
  permissions.set.mockResolvedValue({ level: "ask_everything", effectiveDefault: "open" });
  await change(levelSelect(), "ask_everything");
  await act(async () => {});
  const ruleSelect = container.querySelector<HTMLSelectElement>("li select");
  expect(ruleSelect?.value).toBe("allow");
  expect(ruleSelect?.querySelector<HTMLOptionElement>("option[value=allow]")?.disabled).toBe(true);
  // Display only: the saved rule is not rewritten and the list is not refetched.
  expect(api.set).not.toHaveBeenCalled();
  expect(api.list).toHaveBeenCalledTimes(1);
  // Restoring the level restores the saved intent.
  api.table.mockResolvedValue({ rows: rows(), level: "open" });
  permissions.set.mockResolvedValue({ level: "open", effectiveDefault: "open" });
  await change(levelSelect(), "open");
  await act(async () => {});
  expect(container.querySelector<HTMLSelectElement>("li select")?.value).toBe("allow");
});

it("lets the owner replace a saved Allow with Ask at Ask for everything", async () => {
  permissions.get.mockResolvedValue({ level: "ask_everything", effectiveDefault: "open" });
  api.table.mockResolvedValue({ rows: rows(), level: "ask_everything" });
  api.list.mockResolvedValue([allowToolRule]);
  api.set.mockResolvedValue({ ...allowToolRule, effect: "require_approval" });
  await act(async () =>
    root.render(
      <I18nProvider i18n={i18n}>
        <ApprovalRulesSettings />
      </I18nProvider>,
    ),
  );
  await act(async () => {});

  const ruleSelect = container.querySelector<HTMLSelectElement>("li select");
  expect(ruleSelect?.value).toBe("allow");
  await change(ruleSelect ?? null, "ask");

  expect(api.set).toHaveBeenCalledWith({
    effect: "require_approval",
    matchKind: "tool",
    matchValue: "mcp__brex__lock_card",
  });
  expect(container.querySelector<HTMLSelectElement>("li select")?.value).toBe("ask");
});

const toolRule = {
  id: "r2",
  effect: "require_approval",
  matchKind: "tool",
  matchValue: "mcp__brex__lock_card",
  createdAt: "2026-01-01T00:00:00.000Z",
};

it("names a tool rule readably and keeps the raw id in the title", async () => {
  api.table.mockResolvedValue({ rows: rows() });
  api.list.mockResolvedValue([toolRule]);
  await act(async () =>
    root.render(
      <I18nProvider i18n={i18n}>
        <ApprovalRulesSettings />
      </I18nProvider>,
    ),
  );
  await act(async () => {});
  const item = container.querySelector("li");
  const name = item?.querySelector<HTMLElement>("[title]");
  expect(name?.getAttribute("title")).toBe("mcp__brex__lock_card");
  expect(name?.textContent).not.toContain("mcp__");
  expect(item?.querySelector("select")?.getAttribute("aria-label")).not.toContain("mcp__");
});

it("disables the row's select while its save is pending", async () => {
  api.table.mockResolvedValue({ rows: rows() });
  api.list.mockResolvedValue([toolRule]);
  api.set.mockReturnValue(new Promise(() => {}));
  await act(async () =>
    root.render(
      <I18nProvider i18n={i18n}>
        <ApprovalRulesSettings />
      </I18nProvider>,
    ),
  );
  await act(async () => {});
  await change(container.querySelector<HTMLSelectElement>("li select"), "block");
  expect(api.set).toHaveBeenCalledTimes(1);
  expect(container.querySelector<HTMLSelectElement>("li select")?.disabled).toBe(true);
});

const botRule = {
  id: "r5",
  effect: "always_allow",
  matchKind: "tool",
  matchValue: "web_fetch",
  botId: "bot-1",
  botName: "Researcher",
  createdAt: "2026-01-01T00:00:00.000Z",
};

it("names an agent's all-sites rule from the list response", async () => {
  api.table.mockResolvedValue({ rows: rows() });
  api.list.mockResolvedValue([botRule]);
  await act(async () =>
    root.render(
      <I18nProvider i18n={i18n}>
        <ApprovalRulesSettings />
      </I18nProvider>,
    ),
  );
  await act(async () => {});
  expect(container.querySelector("li")?.textContent).toContain("Researcher");
  expect(bots.list).not.toHaveBeenCalled();
});

const clickButton = (label: string) =>
  [...container.querySelectorAll("button")].find((button) => button.textContent === label);

it("removing a rule offers Undo that saves it again", async () => {
  api.table.mockResolvedValue({ rows: rows() });
  api.list.mockResolvedValue([botRule]);
  api.remove.mockResolvedValue({ ok: true });
  // set returns the rule without the joined agent name, as the server does.
  api.set.mockResolvedValue({ ...botRule, botName: undefined });
  await act(async () =>
    root.render(
      <I18nProvider i18n={i18n}>
        <ApprovalRulesSettings />
      </I18nProvider>,
    ),
  );
  await act(async () => {});
  await act(async () => clickButton("Remove")?.click());
  expect(api.remove).toHaveBeenCalledWith({ id: "r5" });
  expect(container.querySelector("li")).toBeNull();
  // Settings is a dialog, where toasts are hidden, so Undo sits in the section itself.
  expect(container.textContent).toContain("Removed Researcher");
  await act(async () => clickButton("Undo")?.click());
  expect(api.set).toHaveBeenCalledWith({
    effect: "always_allow",
    matchKind: "tool",
    matchValue: "web_fetch",
    botId: "bot-1",
  });
  expect(container.querySelector("li")?.textContent).toContain("Researcher");
  expect(container.textContent).not.toContain("Removed Researcher");
});

it("restores a rule once however fast Undo is pressed", async () => {
  api.table.mockResolvedValue({ rows: rows() });
  api.list.mockResolvedValue([botRule]);
  api.remove.mockResolvedValue({ ok: true });
  api.set.mockResolvedValue(botRule);
  await act(async () =>
    root.render(
      <I18nProvider i18n={i18n}>
        <ApprovalRulesSettings />
      </I18nProvider>,
    ),
  );
  await act(async () => {});
  await act(async () => clickButton("Remove")?.click());
  const undo = clickButton("Undo");
  await act(async () => {
    undo?.click();
    undo?.click();
  });
  expect(api.set).toHaveBeenCalledTimes(1);
  expect(container.querySelectorAll("li")).toHaveLength(1);
});
