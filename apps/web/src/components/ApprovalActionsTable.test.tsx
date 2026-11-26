// @vitest-environment jsdom

import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (strings: TemplateStringsArray, ...values: unknown[]) =>
      strings.reduce((text, part, index) => text + String(values[index - 1] ?? "") + part),
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../lib/user-error", () => ({
  errorText: (cause: unknown) => (cause instanceof Error ? cause.message : "Something went wrong"),
}));
const table = vi.hoisted(() => ({ table: vi.fn(), setActionType: vi.fn() }));
vi.mock("../lib/rpc", () => ({ rpc: { approvalRules: table } }));
vi.mock("@rakazo/ui-web", () => ({
  Button: ({ children, ...props }: React.ComponentProps<"button">) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  NativeSelect: ({ children, ...props }: React.ComponentProps<"select">) => (
    <select {...props}>{children}</select>
  ),
  NativeSelectOption: ({ children, ...props }: React.ComponentProps<"option">) => (
    <option {...props}>{children}</option>
  ),
  Skeleton: (props: React.ComponentProps<"div">) => (
    <div data-testid="approvals-skeleton" {...props} />
  ),
  Table: ({ children }: { children: ReactNode }) => <table>{children}</table>,
  TableBody: ({ children }: { children: ReactNode }) => <tbody>{children}</tbody>,
  TableCell: ({ children }: { children: ReactNode }) => <td>{children}</td>,
  TableRow: ({ children }: { children: ReactNode }) => <tr>{children}</tr>,
}));

import { ApprovalActionsTable } from "./ApprovalActionsTable";

i18n.loadAndActivate({ locale: "en", messages: {} });
const render = (props: { botId?: string; refreshKey?: number } = {}) =>
  act(async () =>
    root.render(
      <I18nProvider i18n={i18n}>
        <ApprovalActionsTable {...props} />
      </I18nProvider>,
    ),
  );

const select = (type: string) =>
  container.querySelector<HTMLSelectElement>(`[data-testid=approval-row-${type}]`);

async function change(el: HTMLSelectElement | null, value: string) {
  await act(async () => {
    if (!el) throw new Error("select missing");
    el.value = value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function deferred() {
  let resolve!: (value: unknown) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<unknown>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const botRow = (botEffect: string | null) => ({
  actionType: "send_email",
  primary: true,
  spaceEffect: "ask",
  botEffect,
  effect: botEffect ?? "ask",
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.resetAllMocks();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it("retries a failed approvals load and clears the error after it succeeds", async () => {
  table.table.mockRejectedValueOnce(new Error("Could not load approvals"));
  await render();
  expect(container.textContent).toContain("Could not load approvals");
  const retry = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Retry",
  );
  expect(retry).not.toBeUndefined();

  table.table.mockResolvedValueOnce({ rows: [] });
  await act(async () => retry?.click());
  expect(container.querySelector("[data-testid=approval-actions-table]")).not.toBeNull();
  expect(container.textContent).not.toContain("Could not load approvals");
});

it("shows spend and credentials as always asking, and notes the partly hard-lined rows", async () => {
  const row = (actionType: string, spaceEffect: string) => ({
    actionType,
    primary: true,
    spaceEffect,
    botEffect: null,
    effect: spaceEffect,
  });
  table.table.mockResolvedValue({
    rows: [
      row("spend_money", "allow"),
      row("use_credentials", "allow"),
      row("delete_data", "allow"),
      row("send_email", "allow"),
      row("calendar_changes", "allow"),
    ],
  });
  await render();
  const select = (type: string) =>
    container.querySelector<HTMLSelectElement>(`[data-testid=approval-row-${type}]`);
  const note = (type: string) =>
    container.querySelector(`[data-testid=approval-note-${type}]`)?.textContent;
  // Payments always ask: a stored Allow still asks, and Allow is not an option the gate honors.
  expect(select("spend_money")?.disabled).toBe(false);
  expect(select("spend_money")?.value).toBe("ask");
  expect(select("spend_money")?.querySelector("option[value=allow]")).toBeNull();
  expect(note("spend_money")).toBe("Always asks");
  // A credentialed read follows the setting; only writes and grants are hard lines.
  expect(select("use_credentials")?.disabled).toBe(false);
  expect(select("use_credentials")?.value).toBe("allow");
  expect(note("use_credentials")).toBe("Writes always ask");
  expect(note("delete_data")).toBe("Permanent deletes always ask");
  expect(note("send_email")).toBe("New recipients always ask");
  expect(select("delete_data")?.disabled).toBe(false);
  expect(select("send_email")?.disabled).toBe(false);
  expect(select("send_email")?.value).toBe("allow");
  expect(note("calendar_changes")).toBeUndefined();
});

it("shows a saved Block on an always-ask row, and asks again when it is lowered to Ask", async () => {
  const row = (effect: string) => ({
    actionType: "spend_money",
    primary: true,
    spaceEffect: effect,
    botEffect: null,
    effect,
  });
  table.table
    .mockResolvedValueOnce({ rows: [row("block")], level: "open" })
    .mockResolvedValueOnce({ rows: [row("ask")], level: "open" });
  await render();
  expect(select("spend_money")?.disabled).toBe(false);
  expect(select("spend_money")?.value).toBe("block");
  expect(container.querySelector("[data-testid=approval-note-spend_money]")?.textContent).toBe(
    "Blocked",
  );

  await change(select("spend_money"), "ask");
  expect(table.setActionType).toHaveBeenCalledWith({ actionType: "spend_money", effect: "ask" });
  expect(select("spend_money")?.value).toBe("ask");
});

it("keeps Same as all bots available for an inherited payment Block", async () => {
  const row = (spaceEffect: string, botEffect: string | null) => ({
    actionType: "spend_money",
    primary: true,
    spaceEffect,
    botEffect,
    effect: botEffect ?? spaceEffect,
  });
  table.table
    .mockResolvedValueOnce({ rows: [row("block", null)], level: "open" })
    .mockResolvedValueOnce({ rows: [row("block", "ask")], level: "open" });
  await render({ botId: "bot-1" });
  // The effective state is Block, but the bot has no override and can inherit future space changes.
  expect(select("spend_money")?.value).toBe("same");
  expect(select("spend_money")?.querySelector("option[value=same]")?.textContent).toBe(
    "Same as all bots",
  );

  await change(select("spend_money"), "ask");
  expect(table.setActionType).toHaveBeenCalledWith({
    actionType: "spend_money",
    botId: "bot-1",
    effect: "ask",
  });
  expect(select("spend_money")?.value).toBe("ask");
});

it("clears a payment override to inherit the space setting", async () => {
  const row = (botEffect: string | null) => ({
    actionType: "spend_money",
    primary: true,
    spaceEffect: "block",
    botEffect,
    effect: botEffect ?? "block",
  });
  table.table
    .mockResolvedValueOnce({ rows: [row("ask")], level: "open" })
    .mockResolvedValueOnce({ rows: [row(null)], level: "open" });
  await render({ botId: "bot-1" });
  expect(select("spend_money")?.value).toBe("ask");

  await change(select("spend_money"), "same");

  expect(table.setActionType).toHaveBeenCalledWith({
    actionType: "spend_money",
    botId: "bot-1",
    effect: null,
  });
  expect(select("spend_money")?.value).toBe("same");
});

it("ignores a stale load that resolves after the agent changed", async () => {
  const stale = deferred();
  table.table.mockReturnValueOnce(stale.promise);
  table.table.mockResolvedValue({ rows: [botRow("allow")], level: "open" });
  await render({ botId: "bot-1" });
  await render({ botId: "bot-2" });
  expect(select("send_email")?.value).toBe("allow");

  await act(async () => {
    stale.resolve({ rows: [botRow("block")], level: "ask_everything" });
  });
  expect(select("send_email")?.value).toBe("allow");
  // bot-1's level must not disable Allow on bot-2's rows.
  expect(
    select("send_email")?.querySelector<HTMLOptionElement>("option[value=allow]")?.disabled,
  ).toBe(false);
});

it("keeps the newest response when two reloads of one agent overlap", async () => {
  const first = deferred();
  const second = deferred();
  table.table
    .mockResolvedValueOnce({ rows: [botRow("ask")], level: "open" })
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  await render({ botId: "bot-1" });
  await render({ botId: "bot-1", refreshKey: 1 });
  await render({ botId: "bot-1", refreshKey: 2 });
  await act(async () => {
    second.resolve({ rows: [botRow("allow")], level: "open" });
  });
  expect(select("send_email")?.value).toBe("allow");

  await act(async () => {
    first.resolve({ rows: [botRow("block")], level: "open" });
  });
  expect(select("send_email")?.value).toBe("allow");
});

it("clears the rows when a refresh fails, so stale settings cannot be edited", async () => {
  table.table.mockResolvedValueOnce({ rows: [botRow("allow")], level: "open" });
  await render({ botId: "bot-1" });
  expect(select("send_email")?.value).toBe("allow");

  table.table.mockRejectedValueOnce(new Error("Could not load approvals"));
  await render({ botId: "bot-1", refreshKey: 1 });
  expect(container.textContent).toContain("Could not load approvals");
  expect(select("send_email")).toBeNull();
});

it("refetches when a refresh supersedes a same-agent save mid-write", async () => {
  const write = deferred();
  const earlyRead = deferred();
  table.table.mockResolvedValueOnce({ rows: [botRow("ask")], level: "open" });
  table.setActionType.mockReturnValueOnce(write.promise);
  await render({ botId: "bot-1" });
  await change(select("send_email"), "block");

  // A refresh during the write reads the rules before the write lands.
  table.table.mockReturnValueOnce(earlyRead.promise);
  await render({ botId: "bot-1", refreshKey: 1 });
  await act(async () => {
    earlyRead.resolve({ rows: [botRow("ask")], level: "open" });
  });
  expect(select("send_email")?.value).toBe("ask");

  table.table.mockResolvedValueOnce({ rows: [botRow("block")], level: "open" });
  await act(async () => {
    write.resolve({ ok: true });
  });
  // The completed write must fetch the newest rules itself; the early read's stale rows cannot
  // stay on screen.
  expect(select("send_email")?.value).toBe("block");
  expect(table.table).toHaveBeenCalledTimes(3);
});

it("ignores a save that finishes after the agent changed", async () => {
  const saving = deferred();
  table.setActionType.mockReturnValueOnce(saving.promise);
  table.table.mockImplementation(({ botId }: { botId?: string }) =>
    Promise.resolve({ rows: [botRow(botId === "bot-1" ? "block" : "allow")], level: "open" }),
  );
  await render({ botId: "bot-1" });
  await change(select("send_email"), "block");

  await render({ botId: "bot-2" });
  expect(select("send_email")?.value).toBe("allow");

  await act(async () => {
    saving.resolve({ ok: true });
  });
  // The late save must not refetch or show bot-1's rows on bot-2's table.
  expect(select("send_email")?.value).toBe("allow");
  expect(table.table).toHaveBeenCalledTimes(2);
});
