// @vitest-environment jsdom

import type { InboxListOutput, MailRow } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: text, i18n: { locale: "en" } }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

const rpcMock = vi.hoisted(() => ({
  list: vi.fn(),
  refresh: vi.fn(),
  feedback: vi.fn(),
  todos: vi.fn(),
}));
vi.mock("../lib/rpc", () => ({
  rpc: {
    inbox: {
      list: rpcMock.list,
      refresh: rpcMock.refresh,
      feedback: rpcMock.feedback,
      todos: { list: rpcMock.todos, setDone: vi.fn() },
    },
  },
}));
vi.mock("../lib/inbox-message-cache", () => ({ prefetchInboxMessage: () => {} }));
vi.mock("../components/AiDataSharing", () => ({ InboxConsentPrompt: () => null }));
vi.mock("../components/ComposeEmail", () => ({
  ComposeEmail: () => <div data-testid="compose" />,
  MAIL_SENT_EVENT: "rakazo:mail-sent",
  NEW_MESSAGE: {},
}));
vi.mock("../components/inbox/InboxMessageDialog", () => ({
  InboxMessageDialog: ({
    messageId,
    onClose,
  }: {
    messageId: string | null;
    onClose: () => void;
  }) =>
    messageId ? (
      <div role="dialog" data-testid="message">
        {messageId}
        <button type="button" onClick={onClose}>
          close
        </button>
      </div>
    ) : null,
}));
vi.mock("../components/inbox/InboxRow", () => ({
  InboxGroup: ({
    rows,
    onOpen,
    onMark,
    selectedId,
  }: {
    rows: MailRow[];
    onOpen: (id: string) => void;
    onMark?: (id: string, mark: "noise" | null) => void;
    selectedId?: string;
  }) =>
    rows.map((row) => (
      <div key={row.id}>
        <button
          type="button"
          data-row-id={row.id}
          data-selected={selectedId === row.id}
          data-feedback={row.feedback ?? ""}
          onClick={() => onOpen(row.id)}
        >
          {row.subject}
        </button>
        {onMark ? (
          <button type="button" onClick={() => onMark(row.id, "noise")}>
            noise {row.id}
          </button>
        ) : null}
      </div>
    )),
}));

import { InboxPage } from "./Inbox";

const row = (id: string, extra: Partial<MailRow> = {}): MailRow => ({
  id,
  connectionId: "c1",
  threadId: `t-${id}`,
  from: "Dana",
  subject: `Subject ${id}`,
  snippet: "",
  receivedAt: new Date().toISOString(),
  unread: true,
  needsReply: null,
  priority: null,
  reason: null,
  category: null,
  feedback: null,
  ...extra,
});

const list = (rows: MailRow[], extra: Partial<InboxListOutput> = {}): InboxListOutput => ({
  accounts: [{ connectionId: "c1", label: "Me" }] as InboxListOutput["accounts"],
  agent: null,
  rows,
  syncedAt: "2026-10-12T00:00:00.000Z",
  failedAccounts: [],
  reconnectAccounts: [],
  enabled: true,
  triageBlocked: null,
  triagePending: false,
  ...extra,
});

let location: ReturnType<typeof useLocation>;
let go: (to: string) => void;
const Probe = () => {
  location = useLocation();
  go = useNavigate();
  return null;
};

const cleanups: Array<() => Promise<void>> = [];
async function render(entries = ["/app/inbox"], index?: number) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={entries} initialIndex={index}>
        <Probe />
        <InboxPage onConnectMail={() => {}} onRefreshed={() => {}} paused={false} />
      </MemoryRouter>,
    ),
  );
  cleanups.push(async () => {
    await act(async () => root.unmount());
    container.remove();
  });
  return container;
}

const press = (key: string, target: Element | Document = document.body) =>
  act(async () => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
const click = (el: Element | null | undefined) =>
  act(async () => {
    el?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
const byText = (c: HTMLElement, text: string) =>
  [...c.querySelectorAll("button")].find((b) => b.textContent === text);
const selected = (c: HTMLElement) =>
  c.querySelector<HTMLElement>('[data-selected="true"]')?.dataset.rowId;

beforeEach(() => {
  rpcMock.refresh.mockResolvedValue({});
  rpcMock.todos.mockResolvedValue({ todos: [] });
  rpcMock.feedback.mockResolvedValue({});
  rpcMock.list.mockResolvedValue(list([row("a"), row("b"), row("c")]));
});
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  vi.clearAllMocks();
});

it("moves the selection with j and k and opens it with Enter", async () => {
  const c = await render();
  await press("j");
  expect(selected(c)).toBe("a");
  await press("j");
  await press("ArrowDown");
  expect(selected(c)).toBe("c");
  await press("k");
  expect(selected(c)).toBe("b");
  expect(document.activeElement).toBe(c.querySelector('[data-row-id="b"]'));
  await press("Enter");
  expect(new URLSearchParams(location.search).get("mail")).toBe("b");
});

it("ignores keys typed in the search field", async () => {
  const c = await render();
  const input = c.querySelector("input") as HTMLInputElement;
  await press("j", input);
  expect(selected(c)).toBeUndefined();
  await press("/");
  expect(document.activeElement).toBe(input);
});

it("shows a cached list at once while its key is refetched", async () => {
  const c = await render();
  expect(c.textContent).toContain("Subject a");
  // A key with nothing cached shows the skeleton, not the other key's rows.
  let settle: (value: InboxListOutput) => void = () => {};
  rpcMock.list.mockReturnValue(new Promise((r) => (settle = r)));
  await act(async () => go("/app/inbox?filter=unread"));
  expect(c.querySelector('[aria-busy="true"]')).not.toBeNull();
  expect(c.textContent).not.toContain("Subject a");
  await act(async () => settle(list([row("z")])));
  expect(c.textContent).toContain("Subject z");
  // Going back shows the cached rows while the refetch is still pending.
  rpcMock.list.mockReturnValue(new Promise(() => {}));
  await act(async () => go("/app/inbox"));
  expect(c.querySelector('[aria-busy="true"]')).toBeNull();
  expect(c.textContent).toContain("Subject a");
});

it("reverts an optimistic mark when saving fails", async () => {
  rpcMock.feedback.mockRejectedValue(new Error("nope"));
  const c = await render();
  await click(byText(c, "noise a"));
  expect(c.querySelector('[data-row-id="a"]')?.getAttribute("data-feedback")).toBe("");
  expect(c.querySelector('[role="alert"]')).not.toBeNull();
});

it("marks the row at once and offers Undo", async () => {
  let resolve: (v: unknown) => void = () => {};
  rpcMock.feedback.mockReturnValue(new Promise((r) => (resolve = r)));
  const c = await render();
  await click(byText(c, "noise a"));
  expect(c.querySelector('[data-row-id="a"]')?.getAttribute("data-feedback")).toBe("noise");
  expect(c.querySelector('[role="status"]')?.textContent).toContain("Marked noise");
  resolve({});
});

it("offers a way out of an empty search and an empty filter", async () => {
  rpcMock.list.mockResolvedValue(list([]));
  let c = await render(["/app/inbox?q=zebra"]);
  expect(c.textContent).toContain('No results for "zebra"');
  await click(byText(c, "Clear search"));
  expect(location.search).toBe("");
  await cleanups.pop()?.();
  c = await render(["/app/inbox?view=important"]);
  expect(c.textContent).toContain("No mail matches this filter");
  await click(byText(c, "Clear filter"));
  expect(location.search).toBe("");
});

it("closing a list-opened message goes Back, a deep link replaces", async () => {
  const c = await render();
  await click(c.querySelector('[data-row-id="a"]'));
  expect(location.search).toBe("?mail=a");
  await click(byText(c, "close"));
  expect(location.search).toBe("");
  expect(location.state).toBeNull();
  await cleanups.pop()?.();
  const d = await render(["/app/inbox", "/app/inbox?mail=a"], 1);
  await click(byText(d, "close"));
  expect(location.search).toBe("");
});

it("Escape in the search field clears the text and the applied search", async () => {
  const c = await render(["/app/inbox?q=zebra"]);
  const input = c.querySelector("input") as HTMLInputElement;
  expect(input.value).toBe("zebra");
  await press("Escape", input);
  expect(input.value).toBe("");
  expect(location.search).toBe("");
});

it("Escape with no applied search only clears the typed text", async () => {
  const c = await render();
  const input = c.querySelector("input") as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(input, "draft");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  expect(input.value).toBe("draft");
  await press("Escape", input);
  expect(input.value).toBe("");
  expect(location.search).toBe("");
});

it("returns focus to the search field after Clear", async () => {
  const c = await render(["/app/inbox?q=zebra"]);
  const clear = c.querySelector('button[aria-label="Clear"]');
  await click(clear);
  expect(document.activeElement).toBe(c.querySelector("input"));
});
