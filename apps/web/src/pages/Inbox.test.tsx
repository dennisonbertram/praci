// @vitest-environment jsdom

import type { InboxListOutput, MailRow } from "@rakazo/contracts";
import type { ComponentProps, ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
const plural = vi.hoisted(
  () => (count: number, forms: { one: string; other: string }) =>
    (count === 1 ? forms.one : forms.other).replace("#", String(count)),
);
vi.mock("@lingui/core/macro", () => ({ t: text, plural }));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: text, i18n: { locale: "en" } }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

const rpcMock = vi.hoisted(() => ({
  list: vi.fn(),
  refresh: vi.fn(),
  feedback: vi.fn(),
  archive: vi.fn(),
  unarchive: vi.fn(),
  archiveMany: vi.fn(),
  unarchiveMany: vi.fn(),
  markRead: vi.fn(),
  askAgent: vi.fn(),
  todos: vi.fn(),
  setDone: vi.fn(),
  connections: vi.fn(),
}));
vi.mock("../lib/rpc", () => ({
  rpc: {
    inbox: {
      list: rpcMock.list,
      refresh: rpcMock.refresh,
      feedback: rpcMock.feedback,
      archive: rpcMock.archive,
      unarchive: rpcMock.unarchive,
      archiveMany: rpcMock.archiveMany,
      unarchiveMany: rpcMock.unarchiveMany,
      markRead: rpcMock.markRead,
      askAgent: rpcMock.askAgent,
      todos: { list: rpcMock.todos, setDone: rpcMock.setDone },
    },
    connections: { list: rpcMock.connections },
  },
}));
vi.mock("../lib/inbox-message-cache", () => ({
  INBOX_CHANGED_EVENT: "rakazo:inbox-changed",
  ROW_MENU_EVENT: "rakazo:inbox-row-menu",
  prefetchInboxMessage: () => {},
  peekInboxMessage: () => undefined,
  loadInboxMessage: () => new Promise(() => {}),
}));
const realDialog = vi.hoisted(() => ({ on: false }));
vi.mock("../components/AiDataSharing", () => ({
  InboxConsentPrompt: ({
    onAllowed,
    onDismiss,
  }: {
    onAllowed: () => void;
    onDismiss?: () => void;
  }) => (
    <div data-consent-prompt>
      <button type="button" onClick={onAllowed}>
        Allow sorting
      </button>
      <button type="button" onClick={onDismiss}>
        Not now
      </button>
    </div>
  ),
}));
vi.mock("../components/ComposeEmail", () => ({
  ComposeEmail: () => <div data-testid="compose" />,
  MAIL_SENT_EVENT: "rakazo:mail-sent",
  NEW_MESSAGE: {},
}));
vi.mock("../components/inbox/InboxMessageDialog", async (importActual) => {
  const actual = await importActual<typeof import("../components/inbox/InboxMessageDialog")>();
  const Fake = ({
    messageId,
    onClose,
    onArchive,
    onMoveToInbox,
    onAskAgentPanel,
    onReplyDone,
    replyDoneText,
    notice,
  }: {
    messageId: string | null;
    onClose: () => void;
    onArchive?: () => void;
    onMoveToInbox?: () => void;
    onAskAgentPanel?: () => Promise<unknown>;
    onReplyDone?: () => void;
    replyDoneText?: string;
    notice?: ReactNode;
  }) =>
    messageId ? (
      <div role="dialog" data-testid="message">
        {messageId}
        <button type="button" onClick={onClose}>
          close
        </button>
        {onArchive ? (
          <button type="button" onClick={onArchive}>
            dialog archive
          </button>
        ) : null}
        {replyDoneText ? <span>done text: {replyDoneText}</span> : null}
        {onReplyDone ? (
          <button type="button" onClick={onReplyDone}>
            dialog reply done
          </button>
        ) : null}
        {onAskAgentPanel ? (
          <button type="button" onClick={() => void onAskAgentPanel()}>
            dialog ask agent
          </button>
        ) : null}
        {onMoveToInbox ? (
          <button type="button" onClick={onMoveToInbox}>
            dialog move
          </button>
        ) : null}
        <div data-testid="notice">{notice}</div>
      </div>
    ) : null;
  return {
    InboxMessageDialog: (props: Parameters<typeof actual.InboxMessageDialog>[0]) =>
      realDialog.on ? actual.InboxMessageDialog(props) : Fake(props),
  };
});
vi.mock("../components/inbox/InboxRow", () => ({
  InboxGroup: ({
    title,
    rows,
    onOpen,
    onMark,
    onArchive,
    onRead,
    selectedId,
    todoDue,
  }: {
    todoDue?: ReadonlyMap<string, string | null>;
    title?: ReactNode;
    rows: MailRow[];
    onOpen: (id: string) => void;
    onMark?: (id: string, mark: "noise" | null) => void;
    onArchive?: (id: string) => void;
    onRead?: (id: string, read: boolean) => void;
    selectedId?: string;
  }) => [
    title && rows.length ? <h2 key="title">{title}</h2> : null,
    ...rows.map((row) => (
      <div key={row.id}>
        <button
          type="button"
          data-row-id={row.id}
          data-selected={selectedId === row.id}
          data-feedback={row.feedback ?? ""}
          data-category={row.category ?? ""}
          data-todo={todoDue?.has(row.id) ? "" : undefined}
          data-due={todoDue?.get(row.id) ?? undefined}
          onClick={() => onOpen(row.id)}
        >
          {row.subject}
        </button>
        {onMark ? (
          <button type="button" onClick={() => onMark(row.id, "noise")}>
            noise {row.id}
          </button>
        ) : null}
        {onArchive ? (
          <button type="button" onClick={() => onArchive(row.id)}>
            archive {row.id}
          </button>
        ) : null}
        <button type="button" data-unread={row.unread} onClick={() => onRead?.(row.id, row.unread)}>
          read {row.id}
        </button>
      </div>
    )),
  ],
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
  inInbox: true,
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
const connectMail = vi.fn();
async function render(
  entries = ["/app/inbox"],
  index?: number,
  props: Partial<ComponentProps<typeof InboxPage>> = {},
) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={entries} initialIndex={index}>
        <Probe />
        <InboxPage onConnectMail={connectMail} onRefreshed={() => {}} paused={false} {...props} />
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
    vi.setSystemTime(Date.now() + 200); // j/k are throttled to one step per 150ms
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  });
// The account choice lives in the Filter menu, as a radio group under "Account".
const pickAccount = async (name: string) => {
  await click(document.querySelector('[data-testid="inbox-filter"]'));
  const item = [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')].find(
    (el) => el.textContent === name,
  );
  await click(item);
};

const click = (el: Element | null | undefined) =>
  act(async () => {
    el?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
const byText = (c: HTMLElement, text: string) =>
  [...c.querySelectorAll("button")].find((b) => b.textContent === text);
const selected = (c: HTMLElement) =>
  c.querySelector<HTMLElement>('[data-selected="true"]')?.dataset.rowId;

let clock = Date.now();
const dwell = (ms = 800) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  clock += 60_000; // each test starts past the j/k throttle the previous one left
  vi.setSystemTime(clock);
  rpcMock.refresh.mockResolvedValue({});
  rpcMock.todos.mockResolvedValue({ todos: [] });
  rpcMock.feedback.mockResolvedValue({});
  rpcMock.archive.mockResolvedValue({ ok: true });
  rpcMock.unarchive.mockResolvedValue({ ok: true });
  rpcMock.archiveMany.mockImplementation(async ({ messageIds }: { messageIds: string[] }) => ({
    done: messageIds,
    failed: [],
  }));
  rpcMock.unarchiveMany.mockImplementation(async ({ messageIds }: { messageIds: string[] }) => ({
    done: messageIds,
    failed: [],
  }));
  rpcMock.markRead.mockResolvedValue({ ok: true });
  rpcMock.list.mockResolvedValue(list([row("a"), row("b"), row("c")]));
  rpcMock.connections.mockResolvedValue([{ provider: "gmail", status: "connected" }]);
});
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  vi.useRealTimers();
  realDialog.on = false;
  vi.clearAllMocks();
});

it("moves the selection with j and k and opens it with Enter", async () => {
  const c = await render();
  await press("j");
  expect(c.querySelectorAll("h1")).toHaveLength(1);
  expect(c.querySelector("h1")?.closest("[data-page-header]")).not.toBeNull();
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
  expect(c.querySelector('[role="status"]')?.textContent).toContain("is now marked as noise");
  resolve({});
});

it("offers a way out of an empty search and an empty filter", async () => {
  rpcMock.list.mockResolvedValue(list([]));
  let c = await render(["/app/inbox?q=zebra"]);
  expect(c.textContent).toContain('No results for "zebra"');
  await click(byText(c, "Clear"));
  expect(location.search).toBe("");
  await cleanups.pop()?.();
  c = await render(["/app/inbox?category=billing"]);
  expect(c.textContent).toContain("No mail matches this filter");
  // One Clear control: the X in the search box, which drops the filter too.
  const clears = [...c.querySelectorAll("button")].filter(
    (b) => b.textContent === "Clear" || b.getAttribute("aria-label") === "Clear",
  );
  expect(clears).toHaveLength(1);
  await click(clears[0]);
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

it("focuses the row it returns to without scrolling the list", async () => {
  const focus = vi.spyOn(HTMLElement.prototype, "focus");
  try {
    const c = await render();
    await click(c.querySelector('[data-row-id="a"]'));
    focus.mockClear();
    await click(byText(c, "close"));
    await act(async () => void (await new Promise((r) => requestAnimationFrame(r))));
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(focus).not.toHaveBeenCalledWith();
  } finally {
    focus.mockRestore();
  }
});

it("drops only the undated reply to-do whose mail is listed under Needs reply, marks that row, and keeps the rest", async () => {
  const todo = (id: string, messageId: string, text: string, dueOn: string | null = null) => ({
    id,
    connectionId: "c1",
    messageId,
    text,
    detail: null,
    from: "Dana",
    priority: null,
    dueOn,
    doneAt: null,
  });
  rpcMock.list.mockResolvedValue(
    list([
      row("a", { needsReply: true }),
      row("b", { needsReply: true }),
      row("c", { needsReply: false }),
    ]),
  );
  rpcMock.todos.mockResolvedValue({
    todos: [
      todo("t1", "a", "Reply to Morgan about section 9"),
      todo("t2", "b", "File the trademark form"),
      todo("t3", "a", "Reply to Morgan by Friday", "2099-01-01"),
      todo("t4", "c", "Pay the invoice"),
    ],
  });
  const c = await render();
  // No to-do from a visible Needs reply thread is repeated on the card, dated or not.
  expect(c.textContent).not.toContain("Reply to Morgan about section 9");
  expect(c.textContent).not.toContain("File the trademark form");
  expect(c.textContent).not.toContain("Reply to Morgan by Friday");
  expect(c.textContent).toContain("Pay the invoice");
  // Those rows say "To do" instead.
  const marked = [...c.querySelectorAll("[data-todo]")].map((el) => el.getAttribute("data-row-id"));
  expect(marked).toEqual(["a", "b"]);
  // The dated one keeps its due date on the row.
  expect(c.querySelector('[data-row-id="a"]')?.getAttribute("data-due")).toBe("2099-01-01");
});

it("completes a hidden reply to-do from the open mail", async () => {
  const hidden = {
    id: "t1",
    connectionId: "c1",
    messageId: "a",
    text: "Reply to Morgan about section 9",
    detail: null,
    from: "Dana",
    priority: null,
    dueOn: null,
    doneAt: null,
  };
  rpcMock.list.mockResolvedValue(list([row("a", { needsReply: true })]));
  rpcMock.todos.mockResolvedValue({ todos: [hidden] });
  rpcMock.setDone.mockResolvedValue({ ...hidden, doneAt: new Date().toISOString() });
  const c = await render();
  expect(c.textContent).not.toContain("Reply to Morgan about section 9");
  await click(c.querySelector('[data-row-id="a"]'));
  await click(byText(document.body, "dialog reply done"));
  expect(rpcMock.setDone).toHaveBeenCalledWith({ id: "t1", done: true });
});

it("names the due date on the open mail's completion control", async () => {
  const dated = {
    id: "t1",
    connectionId: "c1",
    messageId: "a",
    text: "Reply to Morgan",
    detail: null,
    from: "Dana",
    priority: null,
    dueOn: "2099-01-01",
    doneAt: null,
  };
  rpcMock.list.mockResolvedValue(list([row("a", { needsReply: true })]));
  rpcMock.todos.mockResolvedValue({ todos: [dated] });
  const c = await render();
  await click(c.querySelector('[data-row-id="a"]'));
  expect(document.body.textContent).toContain("done text: Reply to Morgan · Jan 1");
});

it("does not show sorting when Allow is pressed on an already sorted mailbox", async () => {
  const blocked = {
    enabled: false,
    triageBlocked: { reason: "needs_consent", recipient: { key: "k", name: "Model" } } as never,
  };
  rpcMock.list.mockResolvedValue(list([row("a", { needsReply: true }), row("b")], blocked));
  const c = await render();
  rpcMock.list.mockResolvedValue(list([row("a", { needsReply: true }), row("b")]));
  await click(byText(c, "Allow sorting"));
  expect(c.textContent).not.toContain("Sorting your mail…");
  expect(c.querySelector("[aria-busy=true]")).toBeNull();
});

it("closes the Filter tooltip with its menu", async () => {
  const c = await render();
  const button = c.querySelector<HTMLElement>('[data-testid="inbox-filter"]');
  await act(async () => button?.focus());
  await click(button);
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
  await dwell(600);
  expect(document.querySelector('[role="menu"]')).toBeNull();
  expect(document.querySelector('[data-slot="tooltip-content"]')).toBeNull();
});

it("returns focus to the search field after Clear", async () => {
  const c = await render(["/app/inbox?q=zebra"]);
  const clear = c.querySelector('button[aria-label="Clear"]');
  await click(clear);
  expect(document.activeElement).toBe(c.querySelector("input"));
});

it("refetches the to-dos when triage turns on without a new sync", async () => {
  rpcMock.list.mockResolvedValue(
    list([row("a")], { enabled: false, triageBlocked: { reason: "needs_consent" } as never }),
  );
  await render();
  const before = rpcMock.todos.mock.calls.length;
  // Same syncedAt and no pending triage: only the enabled/blocked state changes.
  rpcMock.list.mockResolvedValue(list([row("a")]));
  await act(async () => window.dispatchEvent(new Event("rakazo:mail-sent")));
  expect(rpcMock.todos.mock.calls.length).toBeGreaterThan(before);
});

it("archives the selected row with e, moves the selection on, and keeps it out of the list", async () => {
  const c = await render();
  await press("j");
  await press("e");
  expect(rpcMock.archive).toHaveBeenCalledWith({ messageId: "a" });
  expect(c.querySelector('[data-row-id="a"]')).toBeNull();
  expect(selected(c)).toBe("b");
});

it("archives from the row without opening it, and brings the row back when it fails", async () => {
  rpcMock.archive.mockRejectedValue(new Error("nope"));
  const c = await render();
  await click(byText(c, "archive b"));
  expect(rpcMock.archive).toHaveBeenCalledWith({ messageId: "b" });
  expect(new URLSearchParams(location.search).get("mail")).toBeNull();
  expect(c.querySelector('[role="alert"]')).not.toBeNull();
  expect(c.querySelector('[data-row-id="b"]')).not.toBeNull();
});

it("marks a row read at once and unread again, saving each", async () => {
  const c = await render();
  const unread = () =>
    c.querySelector("button[data-unread][data-unread]")?.getAttribute("data-unread");
  expect(unread()).toBe("true");
  await click(byText(c, "read a"));
  expect(rpcMock.markRead).toHaveBeenLastCalledWith({ messageId: "a", read: true });
  expect(unread()).toBe("false");
  await click(byText(c, "read a"));
  expect(rpcMock.markRead).toHaveBeenLastCalledWith({ messageId: "a", read: false });
});

it("clears the live region before each announcement so a repeat is spoken again", async () => {
  const c = await render();
  const region = () => c.querySelector('[aria-live="polite"]')?.textContent;
  await click(byText(c, "read a"));
  expect(region()).toBe("");
  await dwell(80);
  expect(region()).toBe("Marked read");
  await click(byText(c, "read a"));
  expect(region()).toBe("");
});

it("announces only the latest read change when two happen within the delay", async () => {
  const c = await render();
  await click(byText(c, "read a"));
  await click(byText(c, "read a"));
  await dwell(80);
  expect(c.querySelector('[aria-live="polite"]')?.textContent).toBe("Marked unread");
});

it("archives under a filter and a search too", async () => {
  const c = await render(["/app/inbox?filter=unread&q=zebra"]);
  await press("j");
  await press("e");
  expect(rpcMock.archive).toHaveBeenCalledWith({ messageId: "a" });
  await click(byText(c, "archive b"));
  expect(rpcMock.archive).toHaveBeenCalledWith({ messageId: "b" });
});

it("keeps an archived search result, which can then be moved back with Undo", async () => {
  const c = await render(["/app/inbox?q=grant&mail=a"]);
  await click(byText(c, "dialog archive"));
  expect(rpcMock.archive).toHaveBeenCalledWith({ messageId: "a" });
  // The search still finds it, so it stays rather than leaving "No results".
  expect(c.querySelector('[data-row-id="a"]')).not.toBeNull();
  await click(c.querySelector('[data-row-id="a"]'));
  await click(byText(c, "dialog move"));
  expect(rpcMock.unarchive).toHaveBeenCalledWith({ messageId: "a" });
  const notice = c.querySelector('[data-testid="notice"]') as HTMLElement;
  expect(notice.textContent).toContain('Moved "Subject a" to Inbox');
  await click(byText(notice, "Undo"));
  expect(rpcMock.archive).toHaveBeenCalledTimes(2);
});

it("shows a slow search even when a reload starts while it is loading", async () => {
  const c = await render();
  let settle: (value: InboxListOutput) => void = () => {};
  rpcMock.list.mockReturnValueOnce(new Promise((r) => (settle = r)));
  rpcMock.list.mockReturnValue(new Promise(() => {}));
  await act(async () => go("/app/inbox?q=invoice"));
  // A sync or triage poll reloads the list before the search answers.
  await act(async () => window.dispatchEvent(new Event("rakazo:mail-sent")));
  await act(async () => settle(list([row("inv", { subject: "Invoice" })])));
  expect(c.textContent).toContain("Invoice");
});

it("offers Undo after an archive, which restores the thread and reloads the list", async () => {
  const c = await render();
  await click(byText(c, "archive b"));
  const toast = c.querySelector('[role="status"]');
  // It names the email, so the person knows which one Undo brings back.
  expect(toast?.textContent).toContain('Archived "Subject b"');
  // The shared toasts rise above it, so a pending approval never hides Undo.
  expect(toast?.querySelector("[data-toast-avoid]")).not.toBeNull();
  const lists = rpcMock.list.mock.calls.length;
  await click(byText(toast as HTMLElement, "Undo"));
  expect(rpcMock.unarchive).toHaveBeenCalledWith({ messageId: "b" });
  expect(rpcMock.list.mock.calls.length).toBeGreaterThan(lists);
  expect(c.querySelector('[role="status"]')?.textContent).toBe("");
});

it("waits for a slow archive to finish before Undo restores the thread", async () => {
  let finish: (value: unknown) => void = () => {};
  rpcMock.archive.mockReturnValue(new Promise((r) => (finish = r)));
  const c = await render();
  await click(byText(c, "archive b"));
  await click(byText(c.querySelector('[role="status"]') as HTMLElement, "Undo"));
  expect(rpcMock.unarchive).not.toHaveBeenCalled();
  await act(async () => finish({ ok: true }));
  expect(rpcMock.unarchive).toHaveBeenCalledWith({ messageId: "b" });
});

it("skips Undo when the archive itself failed", async () => {
  rpcMock.archive.mockRejectedValue(new Error("nope"));
  const c = await render();
  await click(byText(c, "archive b"));
  await click(byText(c.querySelector('[role="status"]') as HTMLElement, "Undo"));
  expect(rpcMock.unarchive).not.toHaveBeenCalled();
});

it("marks an unread row read when it opens, and does not touch a read one", async () => {
  rpcMock.list.mockResolvedValue(list([row("a"), row("b", { unread: false })]));
  const c = await render();
  await click(c.querySelector('[data-row-id="b"]'));
  expect(rpcMock.markRead).not.toHaveBeenCalled();
  await click(byText(c, "close"));
  await click(c.querySelector('[data-row-id="a"]'));
  expect(rpcMock.markRead).not.toHaveBeenCalled();
  await dwell();
  expect(rpcMock.markRead).toHaveBeenCalledTimes(1);
  expect(rpcMock.markRead).toHaveBeenCalledWith({ messageId: "a", read: true });
});

it("does not mark a message read that was open for less than the dwell", async () => {
  const c = await render();
  await click(c.querySelector('[data-row-id="a"]'));
  await dwell(100);
  await act(async () => go("/app/inbox?mail=b"));
  await dwell(700);
  expect(rpcMock.markRead).not.toHaveBeenCalled();
  await dwell(100);
  expect(rpcMock.markRead).toHaveBeenCalledTimes(1);
  expect(rpcMock.markRead).toHaveBeenCalledWith({ messageId: "b", read: true });
});

it("shows one result count with a Clear that drops the search and filter together", async () => {
  const c = await render(["/app/inbox?q=zebra&filter=unread"]);
  expect(c.textContent).toContain("3 results");
  expect(c.textContent).not.toContain("Needs reply");
  // One Clear control: the X in the search box, which drops the filter too.
  const clears = [...c.querySelectorAll("button")].filter(
    (b) => b.textContent === "Clear" || b.getAttribute("aria-label") === "Clear",
  );
  expect(clears).toHaveLength(1);
  await click(clears[0]);
  expect(location.search).toBe("");
});

it("hides the pile tabs and keeps one Clear while showing search results", async () => {
  const c = await render(["/app/inbox?q=zebra"]);
  expect(c.textContent).toContain("3 results");
  expect(c.textContent).not.toContain("Newsletters");
  const clears = [...c.querySelectorAll("button")].filter(
    (b) => b.textContent === "Clear" || b.getAttribute("aria-label") === "Clear",
  );
  expect(clears).toHaveLength(1);
});

it("keeps a Clear when the search text is deleted but the search is still applied", async () => {
  const c = await render(["/app/inbox?q=zebra"]);
  const input = c.querySelector("input") as HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(input, "");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  // One Clear control: the X in the search box, which drops the filter too.
  const clears = [...c.querySelectorAll("button")].filter(
    (b) => b.textContent === "Clear" || b.getAttribute("aria-label") === "Clear",
  );
  expect(clears).toHaveLength(1);
  await click(clears[0]);
  expect(location.search).toBe("");
});

it("names the active filter in the results bar, not on the Filter button", async () => {
  const c = await render(["/app/inbox?filter=unread"]);
  expect(c.textContent).toContain("3 results · Unread");
  expect(c.querySelector('[data-testid="inbox-filter"]')?.textContent).toBe("");
});

it("pages a search with a Loading label and ends with No more results", async () => {
  rpcMock.list.mockResolvedValue(list([row("a")], { nextPageToken: "p2" }));
  let settle: (value: InboxListOutput) => void = () => {};
  const c = await render(["/app/inbox?q=zebra"]);
  expect(c.textContent).toContain("1+ result");
  rpcMock.list.mockReturnValue(new Promise((r) => (settle = r)));
  await click(byText(c, "Load more"));
  expect(byText(c, "Loading…")?.disabled).toBe(true);
  await act(async () => settle(list([row("b")])));
  expect(c.textContent).toContain("No more results");
  expect(c.textContent).toContain("2 results");
});

it("ends the default list with a way to search older mail", async () => {
  const c = await render();
  // Let a focus-restoring frame queued by an earlier test fire first.
  await act(async () => new Promise<void>((r) => requestAnimationFrame(() => r())));
  await click(byText(c, "Search older mail"));
  expect(document.activeElement).toBe(c.querySelector("input"));
});

it("does not archive a selected row that a new filter hid", async () => {
  const c = await render();
  await press("j");
  expect(selected(c)).toBe("a");
  rpcMock.list.mockResolvedValue(list([row("z")]));
  await act(async () => go("/app/inbox?filter=unread"));
  await press("e");
  await press("Enter");
  expect(rpcMock.archive).not.toHaveBeenCalled();
  expect(new URLSearchParams(location.search).get("mail")).toBeNull();
});

it("offers no archive for mail that is not in the inbox", async () => {
  rpcMock.list.mockResolvedValue(list([row("a", { inInbox: false })]));
  const c = await render(["/app/inbox?q=old"]);
  await press("j");
  await press("e");
  expect(rpcMock.archive).not.toHaveBeenCalled();
  await click(c.querySelector('[data-row-id="a"]'));
  expect(byText(c, "dialog archive")).toBeUndefined();
});

it("moving an archived search result to the Inbox confirms it and offers Archive", async () => {
  rpcMock.list.mockResolvedValue(list([row("a", { inInbox: false })]));
  const c = await render(["/app/inbox?q=old&mail=a"]);
  rpcMock.list.mockResolvedValue(list([row("a")]));
  await click(byText(c, "dialog move"));
  expect(rpcMock.unarchive).toHaveBeenCalledWith({ messageId: "a" });
  expect(c.querySelector('[data-testid="notice"]')?.textContent).toContain("to Inbox");
  expect(byText(c, "dialog archive")).toBeDefined();
});

it("does not say No results while loaded pages still have rows", async () => {
  rpcMock.list.mockResolvedValue(list([row("a")], { nextPageToken: "p2" }));
  const c = await render(["/app/inbox?q=zebra"]);
  rpcMock.list.mockResolvedValue(list([row("b")]));
  await click(byText(c, "Load more"));
  await click(byText(c, "archive a"));
  expect(c.textContent).not.toContain("No results");
  expect(c.textContent).toContain("Subject b");
});

it("marks an unread deep-linked message read once, and j and k never mark read", async () => {
  const c = await render(["/app/inbox?mail=a"]);
  expect(rpcMock.markRead).not.toHaveBeenCalled();
  await dwell();
  expect(rpcMock.markRead).toHaveBeenCalledTimes(1);
  expect(rpcMock.markRead).toHaveBeenCalledWith({ messageId: "a", read: true });
  await act(async () => window.dispatchEvent(new Event("rakazo:mail-sent")));
  expect(rpcMock.markRead).toHaveBeenCalledTimes(1);
  await click(byText(c, "close"));
  rpcMock.markRead.mockClear();
  await press("j");
  await press("j");
  await press("k");
  expect(rpcMock.markRead).not.toHaveBeenCalled();
});

it("Ask agent makes the agent for the open message", async () => {
  const bot = { id: "bot-1", name: "Subject a" };
  rpcMock.askAgent.mockResolvedValue(bot);
  const onOpenAgent = vi.fn();
  const c = await render(["/app/inbox?mail=a"], undefined, { onOpenAgent });
  await click(byText(c, "dialog ask agent"));
  expect(rpcMock.askAgent).toHaveBeenCalledWith({ messageId: "a" });
});

it("offers no Ask agent without a shell to open the chat in", async () => {
  const c = await render(["/app/inbox?mail=a"]);
  expect(c.textContent).not.toContain("dialog ask agent");
});

it("archiving the open message closes it and offers Undo on the list", async () => {
  const c = await render(["/app/inbox?mail=a"]);
  await click(byText(c, "dialog archive"));
  // Back to the list, as Archive from the list does, not on to another message.
  expect(c.querySelector('[data-testid="notice"]')).toBeNull();
  const status = c.querySelector('[role="status"]') as HTMLElement;
  expect(status.textContent).toContain("Archived");
  await click(byText(status, "Undo"));
  expect(rpcMock.unarchive).toHaveBeenCalled();
});

it("leaves keys pressed outside the Inbox page, such as by the agent panel, to that panel", async () => {
  const c = await render();
  await press("j");
  expect(selected(c)).toBe("a");
  const panel = document.body.appendChild(document.createElement("fieldset"));
  panel.tabIndex = -1;
  await press("Enter", panel);
  await press("j", panel);
  expect(location.search).toBe("");
  expect(selected(c)).toBe("a");
  panel.remove();
});

it("takes one list step from a burst of j presses and ignores a held key", async () => {
  const c = await render();
  await act(async () => {
    for (let i = 0; i < 20; i++)
      document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "j", bubbles: true }));
  });
  expect(selected(c)).toBe("a");
  vi.setSystemTime(Date.now() + 200);
  await act(async () => {
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", { key: "j", repeat: true, bubbles: true }),
    );
  });
  expect(selected(c)).toBe("a");
});

it("a burst of 140 j presses in the open message moves one row and marks only it read", async () => {
  realDialog.on = true;
  const c = await render();
  await click(c.querySelector('[data-row-id="a"]'));
  await act(async () => {
    for (let i = 0; i < 140; i++)
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "j", bubbles: true }));
  });
  await dwell(1000);
  expect(location.search).toBe("?mail=b");
  expect(rpcMock.markRead).toHaveBeenCalledTimes(1);
  expect(rpcMock.markRead).toHaveBeenCalledWith({ messageId: "b", read: true });
});

it("keeps a mark's Undo on screen long enough to reach it", async () => {
  const c = await render();
  await click(byText(c, "noise b"));
  const toast = () => c.textContent?.includes("Mail from Dana is now marked as noise");
  await dwell(8_000);
  expect(toast()).toBe(true);
  await dwell(3_000);
  expect(toast()).toBe(false);
});

it("stops spinning when sorting stalls and offers to try again", async () => {
  // Each poll returns a fresh answer, as the server does.
  rpcMock.list.mockImplementation(async () => list([row("a"), row("b")], { triagePending: true }));
  const c = await render();
  // The first stall starts the sort over once by itself; the notice comes after the second.
  for (let i = 0; i < 7; i++) await dwell(5_000);
  expect(c.textContent).not.toContain("taking longer than usual");
  expect(rpcMock.refresh.mock.calls.length).toBeGreaterThan(1);
  for (let i = 0; i < 7; i++) await dwell(5_000);
  expect(c.textContent).not.toContain("Sorting your mail…");
  expect(c.textContent).toContain("Sorting is taking longer than usual.");
  const refreshes = rpcMock.refresh.mock.calls.length;
  await click(byText(c, "Try sorting again"));
  expect(rpcMock.refresh.mock.calls.length).toBe(refreshes + 1);
  expect(c.textContent).toContain("Sorting your mail…");
});

it("shows grey bars at first, then the unsorted rows dimmed after about 15 s of the first sort", async () => {
  rpcMock.list.mockImplementation(async () => list([row("a"), row("b")], { triagePending: true }));
  const c = await render();
  await dwell(10_000);
  expect(c.querySelector("[aria-busy=true]")).not.toBeNull();
  expect(c.textContent).not.toContain("noise a");
  await dwell(6_000);
  expect(c.querySelector("[aria-busy=true]")).toBeNull();
  expect(c.textContent).toContain("noise a");
  expect(c.textContent).toContain("Sorting your mail…");
  expect(c.querySelector(".opacity-60")?.textContent).toContain("noise a");
});

it("says sorting at once after Allow and keeps the rows back until the sort lands", async () => {
  const blocked = {
    enabled: false,
    triageBlocked: { reason: "needs_consent", recipient: { key: "k", name: "Model" } } as never,
  };
  rpcMock.list.mockResolvedValue(list([row("a"), row("b")], blocked));
  const c = await render();
  expect(c.querySelector("[data-consent-prompt]")).not.toBeNull();
  // The first sync after Allow has not queued triage yet; the to-dos are still loading.
  rpcMock.list.mockResolvedValue(list([row("a"), row("b")]));
  rpcMock.todos.mockReturnValue(new Promise(() => {}));
  await click(byText(c, "Allow sorting"));
  expect(c.textContent).toContain("Sorting your mail…");
  expect(c.querySelector("[aria-busy=true]")).not.toBeNull();
  expect(c.textContent).not.toContain("noise a");
  await dwell(16_000);
  expect(c.textContent).toContain("noise a");
  expect(c.textContent).toContain("Sorting your mail…");
});

it("remembers Not now on the sorting prompt in this browser", async () => {
  const blocked = {
    enabled: false,
    triageBlocked: { reason: "needs_consent", recipient: { key: "k", name: "Model" } } as never,
  };
  rpcMock.list.mockResolvedValue(list([row("a")], blocked));
  const first = await render();
  await click(byText(first, "Not now"));
  expect(first.querySelector("[data-consent-prompt]")).toBeNull();
  const again = await render();
  expect(again.querySelector("[data-consent-prompt]")).toBeNull();
  localStorage.removeItem("rakazo.inboxConsentDismissed");
});

it("keeps rows still while a row menu is open and the first sort finishes", async () => {
  const blocked = {
    enabled: false,
    triageBlocked: { reason: "needs_consent", recipient: { key: "k", name: "Model" } } as never,
  };
  rpcMock.list.mockResolvedValue(list([row("a"), row("b")], blocked));
  const c = await render();
  rpcMock.list.mockResolvedValue(list([row("a"), row("b")]));
  await click(byText(c, "Allow sorting"));
  await dwell(16_000);
  expect(c.textContent).toContain("Sorting your mail…");
  await act(async () => {
    window.dispatchEvent(new CustomEvent("rakazo:inbox-row-menu", { detail: true }));
  });
  // Triage lands while the menu is open; the sort ends, and the rows must stay where they are.
  rpcMock.list.mockResolvedValue(list([row("a", { needsReply: true }), row("b")]));
  await act(async () => window.dispatchEvent(new Event("rakazo:mail-sent")));
  await dwell(61_000);
  expect(c.textContent).not.toContain("Sorting your mail…");
  const headings = () => [...c.querySelectorAll("h2")].map((h) => h.textContent);
  expect(headings()).not.toContain("Needs reply");
  await act(async () => {
    window.dispatchEvent(new CustomEvent("rakazo:inbox-row-menu", { detail: false }));
  });
  await dwell(100);
  expect(headings()).toContain("Needs reply");
});

it("does not say First sync once a refresh reports an earlier sync", async () => {
  vi.useFakeTimers();
  try {
    rpcMock.list.mockReturnValue(new Promise(() => {}));
    rpcMock.refresh.mockImplementation(async () => ({
      syncing: true,
      syncedAt: "2026-01-01T00:00:00Z",
    }));
    const c = await render();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6_000);
    });
    expect(c.textContent).not.toContain("First sync can take a minute");
    expect(c.textContent).toContain("Reading your mail…");
  } finally {
    vi.useRealTimers();
  }
});

it("keeps the sorting stall notice through the minute sync", async () => {
  vi.useFakeTimers();
  try {
    rpcMock.list.mockImplementation(async () => list([row("a")], { triagePending: true }));
    const c = await render();
    for (let i = 0; i < 14; i++)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000);
      });
    expect(c.textContent).toContain("Sorting is taking longer than usual.");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(61_000);
    });
    expect(c.textContent).toContain("Sorting is taking longer than usual.");
  } finally {
    vi.useRealTimers();
  }
});

it("says it is reading the mail during the first sync and asks the server a few times only", async () => {
  vi.useFakeTimers();
  try {
    rpcMock.list.mockResolvedValue(list([]));
    rpcMock.refresh.mockImplementation(async () => ({ syncing: true }));
    const c = await render();
    expect(c.textContent).toContain("Reading your mail…");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(25_000);
    });
    expect(rpcMock.refresh.mock.calls.length).toBeLessThanOrEqual(6);
  } finally {
    vi.useRealTimers();
  }
});

it("shows the consent prompt without loading text while the first sync runs", async () => {
  vi.useFakeTimers();
  try {
    rpcMock.list.mockResolvedValue(
      list([], {
        enabled: false,
        syncedAt: null,
        triageBlocked: {
          reason: "needs_consent",
          recipient: { key: "k", name: "Model" },
        } as never,
      }),
    );
    rpcMock.refresh.mockImplementation(async () => ({ syncing: true }));
    const c = await render();
    // The choice is the one thing to read before consent: no sync status beside it.
    expect(c.textContent).not.toContain("Reading your mail");
    expect(c.querySelector("[data-consent-prompt]")).not.toBeNull();
    // Blank bars beside the card look stalled: any skeleton left is hidden.
    for (const bar of c.querySelectorAll('[data-slot="skeleton"]'))
      expect(bar.closest("[hidden]")).not.toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    expect(c.textContent).not.toContain("First sync can take a minute");
  } finally {
    vi.useRealTimers();
  }
});

it("shows nothing from the first sort until it and its to-dos have landed, then changes once", async () => {
  rpcMock.list.mockResolvedValue(list([row("a"), row("b")], { triagePending: true }));
  const c = await render();
  const sorting = () => c.textContent?.includes("Sorting your mail…");
  // No row shows before the sort has landed, so none can move afterwards.
  expect(c.querySelector("[data-row-id]")).toBeNull();
  const category = (id: string) =>
    c.querySelector<HTMLElement>(`[data-row-id="${id}"]`)?.dataset.category;
  // Part of the mail is sorted while sorting goes on: the rows show none of it yet.
  rpcMock.list.mockResolvedValue(
    list([row("a"), row("b", { needsReply: false, category: "newsletter" })], {
      triagePending: true,
    }),
  );
  await act(async () => window.dispatchEvent(new Event("rakazo:mail-sent")));
  expect(sorting()).toBe(true);
  expect(c.querySelector("[data-row-id]")).toBeNull();
  // Sorting finished, and its to-dos are still loading: the page waits for them.
  let todosLoaded: (value: unknown) => void = () => {};
  rpcMock.todos.mockReturnValue(new Promise((resolve) => (todosLoaded = resolve)));
  rpcMock.list.mockResolvedValue(
    list([row("a", { needsReply: true }), row("b", { needsReply: false, category: "newsletter" })]),
  );
  await act(async () => window.dispatchEvent(new Event("rakazo:mail-sent")));
  expect(sorting()).toBe(true);
  expect(c.querySelector("[data-row-id]")).toBeNull();
  const todo = {
    id: "t1",
    connectionId: "c1",
    messageId: "elsewhere",
    text: "Send the deck",
    detail: null,
    from: "Dana",
    priority: null,
    dueOn: null,
    doneAt: null,
  };
  await act(async () => todosLoaded({ todos: [todo] }));
  expect(sorting()).toBe(false);
  expect(category("b")).toBe("newsletter");
  expect(c.textContent).toContain("Send the deck");
});

it("says it is sorting while the first triage runs, and names the sender a mark covers", async () => {
  rpcMock.list.mockResolvedValue(list([row("a"), row("b")], { triagePending: true }));
  const c = await render();
  const sorting = () =>
    [...c.querySelectorAll('[role="status"]')].some((el) =>
      el.textContent?.includes("Sorting your mail…"),
    );
  expect(sorting()).toBe(true);
  // Triage finished: one update regroups the list and the status goes.
  rpcMock.list.mockResolvedValue(list([row("a", { needsReply: true }), row("b")]));
  await act(async () => window.dispatchEvent(new Event("rakazo:mail-sent")));
  expect(sorting()).toBe(false);
  await click(byText(c, "noise b"));
  expect(c.querySelector('[role="status"]')?.textContent).toContain(
    "Mail from Dana is now marked as noise",
  );
});

it("calls today's group 'Other mail today' when Needs reply is above it", async () => {
  rpcMock.list.mockResolvedValue(list([row("a", { needsReply: true }), row("b")]));
  const c = await render();
  const headings = [...c.querySelectorAll("h2")].map((h) => h.textContent);
  expect(headings).toEqual(["Needs reply", "Other mail today"]);
  rpcMock.list.mockResolvedValue(list([row("b")]));
  const plain = await render();
  expect([...plain.querySelectorAll("h2")].map((h) => h.textContent)).toContain("Today");
});

it("shows five Needs reply rows and the rest behind 'Show n more'", async () => {
  const ids = ["r1", "r2", "r3", "r4", "r5", "r6", "r7"];
  rpcMock.list.mockResolvedValue(list(ids.map((id) => row(id, { needsReply: true }))));
  const c = await render();
  expect(c.querySelectorAll("button[data-row-id]").length).toBe(5);
  await click(byText(c, "Show 2 more"));
  expect(c.querySelectorAll("button[data-row-id]").length).toBe(7);
  expect(byText(c, "Show 2 more")).toBeUndefined();
});

it("keeps the To do card the same when 'Show n more' lists more Needs reply rows", async () => {
  const ids = ["r1", "r2", "r3", "r4", "r5", "r6", "r7"];
  rpcMock.list.mockResolvedValue(list(ids.map((id) => row(id, { needsReply: true }))));
  const todo = (id: string, messageId: string, text: string) => ({
    id,
    connectionId: "c1",
    messageId,
    text,
    detail: null,
    from: "Dana",
    priority: null,
    dueOn: null,
    doneAt: null,
  });
  rpcMock.todos.mockResolvedValue({
    todos: [todo("t1", "r1", "Reply about one"), todo("t7", "r7", "Reply about seven")],
  });
  const c = await render();
  expect(c.textContent).not.toContain("Reply about one");
  expect(c.textContent).toContain("Reply about seven");
  await click(byText(c, "Show 2 more"));
  expect(c.textContent).not.toContain("Reply about one");
  expect(c.textContent).toContain("Reply about seven");
});

it("holds rows in their groups while triage is still running", async () => {
  // Each answer is pending; the poll after the first load classifies row b as well.
  let calls = 0;
  rpcMock.list.mockImplementation(async () => {
    calls += 1;
    const b = calls > 2 ? row("b", { needsReply: true }) : row("b");
    return list([row("a", { needsReply: true }), b], { triagePending: true });
  });
  const c = await render();
  await dwell(5_000);
  expect(calls).toBeGreaterThan(2);
  // Row b sits after the "Other mail today" heading until triage ends.
  const other = [...c.querySelectorAll("h2")].find((h) => h.textContent === "Other mail today");
  const b = c.querySelector('button[data-row-id="b"]');
  expect(
    other && b && other.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();
});

it("keeps rows in their groups while a row menu is open", async () => {
  let classified = false;
  rpcMock.list.mockImplementation(async () =>
    list([row("a", { needsReply: true }), classified ? row("b", { needsReply: true }) : row("b")]),
  );
  const c = await render();
  const menu = (open: boolean) =>
    act(async () => {
      window.dispatchEvent(new CustomEvent("rakazo:inbox-row-menu", { detail: open }));
    });
  const afterOther = () => {
    const other = [...c.querySelectorAll("h2")].find((h) => h.textContent === "Other mail today");
    const b = c.querySelector('button[data-row-id="b"]');
    return Boolean(
      other && b && other.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING,
    );
  };
  await menu(true);
  classified = true;
  await act(async () => {
    window.dispatchEvent(new Event("rakazo:inbox-changed"));
  });
  await dwell(1_000);
  expect(afterOther()).toBe(true);
  await menu(false);
  await dwell(100);
  expect(afterOther()).toBe(false);
});

it("does not hold a mark back while triage is running", async () => {
  let marked = false;
  rpcMock.feedback.mockImplementation(async () => {
    marked = true;
    return {};
  });
  rpcMock.list.mockImplementation(async () =>
    list(
      [
        row("a", { needsReply: true }),
        marked ? row("b", { needsReply: true, feedback: "noise" }) : row("b"),
      ],
      { triagePending: true },
    ),
  );
  const c = await render();
  await click(byText(c, "noise b"));
  await dwell(1_000);
  const other = [...c.querySelectorAll("h2")].find((h) => h.textContent === "Other mail today");
  const b = c.querySelector('button[data-row-id="b"]');
  // The marked row takes the server's new classification at once, so it is above the Other heading.
  expect(
    !other || (b && other.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_PRECEDING),
  ).toBeTruthy();
});

it("keeps one held snapshot per list", async () => {
  const accounts = [
    { connectionId: "c1", label: "Me" },
    { connectionId: "c2", label: "Sales" },
  ] as InboxListOutput["accounts"];
  rpcMock.list.mockImplementation(async (input: { connectionId?: string }) =>
    input.connectionId === "c2"
      ? list([row("s1", { needsReply: true }), row("s2", { needsReply: true })], {
          accounts,
          triagePending: true,
        })
      : list([row("a", { needsReply: true }), row("b")], { accounts, triagePending: true }),
  );
  const c = await render();
  // Both lists are cached after one visit, so the next switch shows rows at once, still pending.
  await pickAccount("Sales");
  await pickAccount("All");
  // The Sales rows were never in the first list's snapshot; they still show under Needs reply.
  await pickAccount("Sales");
  await dwell(1_000);
  expect([...c.querySelectorAll("h2")].map((h) => h.textContent)).toEqual(["Needs reply"]);
});

it("looks for new mail once a minute while it is open", async () => {
  vi.useFakeTimers();
  try {
    await render();
    const syncs = rpcMock.refresh.mock.calls.length;
    const lists = rpcMock.list.mock.calls.length;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(rpcMock.refresh.mock.calls.length).toBe(syncs + 1);
    expect(rpcMock.list.mock.calls.length).toBe(lists + 1);
  } finally {
    vi.useRealTimers();
  }
});

it("keeps Load more results when the minute refresh reloads the list", async () => {
  vi.useFakeTimers();
  try {
    rpcMock.list.mockResolvedValue(list([row("a")], { nextPageToken: "p2" }));
    const c = await render(["/app/inbox?q=zebra"]);
    rpcMock.list.mockResolvedValue(list([row("b")]));
    await click(byText(c, "Load more"));
    expect(c.textContent).toContain("Subject b");
    rpcMock.list.mockResolvedValue(list([row("a")], { nextPageToken: "p2" }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });
    expect(c.textContent).toContain("Subject a");
    expect(c.textContent).toContain("Subject b");
  } finally {
    vi.useRealTimers();
  }
});

it("Undo after Move to Inbox waits for the move before archiving again", async () => {
  rpcMock.list.mockResolvedValue(list([row("a", { inInbox: false })]));
  const c = await render(["/app/inbox?q=old&mail=a"]);
  let finishMove: (value: unknown) => void = () => {};
  rpcMock.unarchive.mockReturnValue(new Promise((r) => (finishMove = r)));
  rpcMock.list.mockResolvedValue(list([row("a")]));
  await click(byText(c, "dialog move"));
  await click(byText(c, "Undo"));
  expect(rpcMock.archive).not.toHaveBeenCalled();
  await act(async () => finishMove({ ok: true }));
  expect(rpcMock.archive).toHaveBeenCalledWith({ messageId: "a" });
});

it("offers Reconnect Gmail, not Try again, when an account's sign-in lapsed", async () => {
  rpcMock.list.mockResolvedValue(
    list([row("a")], { failedAccounts: ["Me"], reconnectAccounts: ["Me"] }),
  );
  const c = await render();
  expect(c.querySelector('[role="alert"]')?.textContent).toContain(
    "Gmail needs to be reconnected.",
  );
  await click(byText(c, "Reconnect Gmail"));
  expect(connectMail).toHaveBeenCalledTimes(1);
  expect(c.textContent).not.toContain("Try again");
});

it("explains a rate-limited Inbox with no mail, and shows Try again working", async () => {
  rpcMock.list.mockResolvedValue(
    list([], { failedAccounts: ["Me"], reconnectAccounts: [], rateLimitedAccounts: ["Me"] }),
  );
  const c = await render();
  expect(c.querySelector("h2")?.textContent).toBe("Your mail didn't load");
  expect(c.querySelector('[role="alert"]')?.textContent).toContain("Gmail is limiting requests");
  let finish: (value: unknown) => void = () => {};
  rpcMock.refresh.mockReturnValue(new Promise((r) => (finish = r)));
  byText(c, "Try again")?.focus();
  await click(byText(c, "Try again"));
  expect(byText(c, "Try again")?.getAttribute("aria-disabled")).toBe("true");
  expect(document.activeElement).toBe(byText(c, "Try again"));
  expect(c.querySelector('[data-slot="spinner"]')).not.toBeNull();
  // The label stays in the accessibility tree (not display/visibility hidden) and the spinner
  // is decorative, so the busy button is still announced as "Try again".
  const retryButton = byText(c, "Try again");
  expect(retryButton?.getAttribute("aria-busy")).toBe("true");
  expect(retryButton?.querySelector('[data-slot="spinner"]')?.getAttribute("aria-hidden")).toBe(
    "true",
  );
  expect(retryButton?.querySelector("span")?.className).not.toContain("invisible");
  // Activating the busy button again, by click or keyboard, must not start another refresh.
  const calls = rpcMock.refresh.mock.calls.length;
  await click(retryButton);
  await act(async () => {
    for (const key of ["Enter", " "]) {
      retryButton?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
      retryButton?.dispatchEvent(new KeyboardEvent("keyup", { key, bubbles: true }));
    }
  });
  expect(rpcMock.refresh).toHaveBeenCalledTimes(calls);
  await act(async () => finish({}));
  expect(byText(c, "Try again")?.getAttribute("aria-disabled")).not.toBe("true");
  expect(document.activeElement).toBe(byText(c, "Try again"));
  expect(c.textContent).not.toContain("few seconds");
  expect(c.querySelector('[role="alert"]')?.textContent).toBe("Gmail is still limiting requests.");
  expect(c.querySelector('[role="alert"]')?.className).toContain("text-warning");
});

describe("Try again notice", () => {
  const limitedList = () =>
    list([], { failedAccounts: ["Me"], reconnectAccounts: [], rateLimitedAccounts: ["Me"] });
  const retryWith = async (after: () => Promise<unknown> | unknown) => {
    rpcMock.list.mockResolvedValue(limitedList());
    const c = await render();
    rpcMock.refresh.mockResolvedValue({});
    let finishList: (value: unknown) => void = () => {};
    rpcMock.list.mockImplementation(() => new Promise((r) => (finishList = r)));
    await click(byText(c, "Try again"));
    // The refresh settled; the list reload after it is still pending.
    expect(c.querySelector('[role="alert"]')?.textContent ?? "").not.toContain("still limiting");
    await act(async () => finishList(await after()));
    return c;
  };

  it("shows no still-limited text while the reload after the sync is pending, then none when clear", async () => {
    const c = await retryWith(() => list([row("a")]));
    expect(c.querySelector('[role="alert"]')).toBeNull();
  });

  it("says Gmail is still limiting requests when the reload after the sync is limited", async () => {
    const c = await retryWith(() => limitedList());
    expect(c.querySelector('[role="alert"]')?.textContent).toContain("still limiting");
  });
});

it("shows the rate-limit notice in the warning colour above cached mail", async () => {
  rpcMock.list.mockResolvedValue(
    list([row("a")], {
      failedAccounts: ["Me"],
      reconnectAccounts: [],
      rateLimitedAccounts: ["Me"],
    }),
  );
  const c = await render();
  const alert = c.querySelector('[role="alert"]');
  expect(alert?.textContent).toContain("Gmail is limiting requests right now.");
  expect(alert?.className).toContain("text-warning");
  expect(alert?.className).not.toContain("text-destructive");
});

it("shows Connect mail without waiting for the slow list when no Gmail is connected", async () => {
  rpcMock.connections.mockResolvedValue([]);
  rpcMock.list.mockReturnValue(new Promise(() => {}));
  const c = await render();
  expect(c.textContent).toContain("No mail connected");
  expect(c.textContent).not.toContain("First sync can take a minute");
  expect(c.textContent).not.toContain("Reading your mail");
});

it("keeps the skeleton while a connected account's list is slow", async () => {
  rpcMock.list.mockReturnValue(new Promise(() => {}));
  const c = await render();
  expect(c.querySelector("[aria-busy='true']")).not.toBeNull();
  expect(c.textContent).not.toContain("No mail connected");
});

it("turns off search and Filter until mail is connected", async () => {
  rpcMock.list.mockResolvedValue(list([], { accounts: [] }));
  const c = await render();
  expect(c.textContent).toContain("No mail connected");
  const search = c.querySelector<HTMLInputElement>('input[aria-label="Search mail"]');
  expect(search === null || search.disabled).toBe(true);
});

const meetingTodo = (id: string, text: string, extra: Record<string, unknown> = {}) => ({
  id,
  connectionId: null,
  meetingId: `m-${id}`,
  messageId: null,
  text,
  detail: "Planning, Oct 19",
  from: null,
  priority: null,
  dueOn: null,
  doneAt: null,
  ...extra,
});
const sourceOn = { source: true, syncing: false, ready: true };

it("shows a meeting-only user's follow-ups above Connect mail, with no mail page and no consent prompt", async () => {
  rpcMock.list.mockResolvedValue(
    list([], {
      accounts: [],
      enabled: false,
      triageBlocked: { reason: "needs_consent" } as never,
    }),
  );
  rpcMock.todos.mockResolvedValue({
    enabled: true,
    todos: [meetingTodo("t1", "Send the notes")],
    meetings: sourceOn,
  });
  const c = await render();
  expect(c.textContent).toContain("To do");
  expect(c.textContent).toContain("Send the notes");
  expect(c.textContent).toContain("Planning, Oct 19");
  expect(c.textContent).not.toContain("No mail connected");
  expect(c.querySelector("[data-consent-prompt]")).toBeNull();
  const order = [...c.querySelectorAll("h2, button")].map((el) => el.textContent);
  expect(order.indexOf("To do")).toBeLessThan(order.indexOf("Connect mail"));
  await click(byText(c, "Connect mail"));
  expect(connectMail).toHaveBeenCalled();
});

it("shows the card with a connected source and no to-dos yet: Syncing, then the empty line", async () => {
  rpcMock.list.mockResolvedValue(list([], { accounts: [] }));
  rpcMock.todos.mockResolvedValue({
    enabled: true,
    todos: [],
    meetings: { source: true, syncing: true, ready: true },
  });
  const c = await render();
  expect(c.textContent).toContain("To do");
  expect(c.textContent).toContain("Syncing");
  expect(c.textContent).not.toContain("No follow-ups from meetings yet");
  expect(c.textContent).not.toContain("No mail connected");

  // The first sync finishes; the card looks again on its own.
  rpcMock.todos.mockResolvedValue({ enabled: true, todos: [], meetings: sourceOn });
  await dwell(5_100);
  expect(c.textContent).toContain("No follow-ups from meetings yet");
  expect(c.textContent).not.toContain("Syncing");
});

it("keeps the heading and the empty line after the last meeting to-do is completed", async () => {
  rpcMock.list.mockResolvedValue(list([], { accounts: [] }));
  const todo = meetingTodo("t1", "Send the notes");
  rpcMock.todos.mockResolvedValue({ enabled: true, todos: [todo], meetings: sourceOn });
  rpcMock.setDone.mockResolvedValue({ ...todo, doneAt: new Date().toISOString() });
  const c = await render();
  expect(c.textContent).not.toContain("No follow-ups from meetings yet");
  await click(c.querySelector('[role="checkbox"]'));
  expect(c.textContent).toContain("To do");
  expect(c.textContent).toContain("No follow-ups from meetings yet");
});

it("shows nothing for a user with no mail, no to-dos and no source", async () => {
  rpcMock.list.mockResolvedValue(list([], { accounts: [] }));
  rpcMock.todos.mockResolvedValue({
    enabled: false,
    todos: [],
    meetings: { source: false, syncing: false, ready: false },
  });
  const c = await render();
  expect(c.textContent).toContain("No mail connected");
  expect(c.textContent).not.toContain("To do");
});

it("shows meeting follow-ups on every account tab", async () => {
  const accounts = [
    { connectionId: "c1", label: "Me" },
    { connectionId: "c2", label: "Sales" },
  ] as InboxListOutput["accounts"];
  rpcMock.list.mockResolvedValue(list([row("a")], { accounts }));
  const forTab = ({ connectionId }: { connectionId?: string }) => ({
    enabled: true,
    todos: [
      meetingTodo("t1", "From a meeting"),
      ...(connectionId === "c2"
        ? [meetingTodo("t2", "Mail on Sales", { connectionId: "c2" })]
        : []),
    ],
    meetings: sourceOn,
  });
  rpcMock.todos.mockImplementation(async (input: { connectionId?: string }) => forTab(input));
  const c = await render();
  expect(c.textContent).toContain("From a meeting");
  await pickAccount("Sales");
  expect(c.textContent).toContain("From a meeting");
  expect(c.textContent).toContain("Mail on Sales");
  await pickAccount("All");
});

it("shows meeting follow-ups even when the mail list is empty, on All and on an account tab", async () => {
  const accounts = [
    { connectionId: "c1", label: "Me" },
    { connectionId: "c2", label: "Sales" },
  ] as InboxListOutput["accounts"];
  rpcMock.list.mockResolvedValue(list([], { accounts, syncedAt: "2026-10-12T00:00:00.000Z" }));
  rpcMock.todos.mockResolvedValue({
    enabled: true,
    todos: [meetingTodo("t1", "From a meeting")],
    meetings: sourceOn,
  });
  const c = await render();
  expect(c.textContent).toContain("No mail");
  expect(c.textContent).toContain("From a meeting");
  await pickAccount("Sales");
  expect(c.textContent).toContain("From a meeting");
  await pickAccount("All");
});

it("opens the shortcut list with ? while a message is open", async () => {
  await render(["/app/inbox?mail=b"]);
  await press("?");
  expect(document.body.textContent).toContain("Keyboard shortcuts");
});

it("keeps the chosen account tab after leaving the Inbox and coming back", async () => {
  const accounts = [
    { connectionId: "c1", label: "Me" },
    { connectionId: "c2", label: "Sales" },
  ] as InboxListOutput["accounts"];
  rpcMock.list.mockResolvedValue(list([row("a")], { accounts }));
  const c = await render();
  expect(c.querySelectorAll('[role="tab"]')).toHaveLength(3);
  await pickAccount("Sales");
  expect(rpcMock.list).toHaveBeenLastCalledWith(expect.objectContaining({ connectionId: "c2" }));
  for (const cleanup of cleanups.splice(0)) await cleanup();
  rpcMock.list.mockClear();
  await render();
  expect(rpcMock.list).toHaveBeenCalledWith(expect.objectContaining({ connectionId: "c2" }));
  // Back to All for the tests that follow.
  await pickAccount("All");
});

it("polls refresh while it reports syncing and reloads the list once when it stops", async () => {
  rpcMock.refresh
    .mockResolvedValueOnce({ ok: true, syncing: true })
    .mockResolvedValueOnce({ ok: true, syncing: true })
    .mockResolvedValue({ ok: true, syncing: false });
  await render();
  expect(rpcMock.refresh).toHaveBeenCalledTimes(1);
  const lists = rpcMock.list.mock.calls.length;
  await dwell(2_000);
  expect(rpcMock.refresh).toHaveBeenCalledTimes(2);
  expect(rpcMock.list.mock.calls.length).toBe(lists);
  // Each wait doubles, so a long first sync is not asked about every two seconds.
  await dwell(4_000);
  expect(rpcMock.refresh).toHaveBeenCalledTimes(3);
  expect(rpcMock.list.mock.calls.length).toBe(lists + 1);
  await dwell(10_000);
  expect(rpcMock.refresh).toHaveBeenCalledTimes(3);
});

describe("piles", () => {
  const counts = { important: 3, updates: 2, newsletters: 1, spam: 0 };
  const tab = (c: HTMLElement, name: string) =>
    [...c.querySelectorAll<HTMLElement>('[role="tab"]')].find((el) =>
      el.textContent?.startsWith(name),
    );

  it("opens the Important pile and asks for it", async () => {
    const c = await render();
    expect(rpcMock.list).toHaveBeenCalledWith({ pile: "important" });
    expect(tab(c, "Important")?.getAttribute("aria-selected")).toBe("true");
    expect(c.textContent).toContain("Search older mail");
  });

  it("switches pile from the tabs, keeps the account tab, and returns to Important", async () => {
    const c = await render();
    await click(tab(c, "Updates"));
    expect(location.search).toBe("?pile=updates");
    expect(rpcMock.list).toHaveBeenLastCalledWith({ pile: "updates" });
    expect(c.textContent).not.toContain("Search older mail");
    await click(tab(c, "Important"));
    expect(location.search).toBe("");
  });

  it("shows no pile tab as selected while a filter is open, and a pile click leaves the filter", async () => {
    const c = await render(["/app/inbox?filter=unread"]);
    expect(tab(c, "Important")?.getAttribute("aria-selected")).toBe("false");
    expect(rpcMock.list).toHaveBeenCalledWith({ filter: "unread" });
    await click(tab(c, "Newsletters"));
    expect(location.search).toBe("?pile=newsletters");
  });

  it("shows a Spam tab with its count only when there is spam, and keeps it after a filtered list", async () => {
    rpcMock.list.mockResolvedValue(list([row("a")], { pileCounts: counts }));
    const c = await render();
    expect(tab(c, "Spam")).toBeUndefined();
    rpcMock.list.mockResolvedValue(list([row("a")], { pileCounts: { ...counts, spam: 4 } }));
    await act(async () => window.dispatchEvent(new Event("rakazo:mail-sent")));
    expect(tab(c, "Spam")?.textContent).toBe("Spam4");
    // A filtered list carries no counts; the tab stays.
    rpcMock.list.mockResolvedValue(list([row("a")]));
    await act(async () => go("/app/inbox?filter=unread"));
    expect(tab(c, "Spam")?.textContent).toBe("Spam4");
    await click(tab(c, "Spam"));
    expect(rpcMock.list).toHaveBeenLastCalledWith({ pile: "spam" });
  });

  it("says No mail for an empty pile", async () => {
    rpcMock.list.mockResolvedValue(list([]));
    const c = await render(["/app/inbox?pile=updates"]);
    expect(c.textContent).toContain("No mail");
    expect(c.textContent).not.toContain("matches this filter");
    // No mail in any pile, so there is nothing to search.
    expect(c.querySelector('input[aria-label="Search mail"]')).toBeNull();
  });

  it("leaves the old view parameter alone and opens Important", async () => {
    await render(["/app/inbox?view=important"]);
    expect(rpcMock.list).toHaveBeenCalledWith({ pile: "important" });
  });
});

describe("selecting rows", () => {
  const pickTwo = async (c: HTMLElement) => {
    await press("j");
    await press("x");
    await press("j");
    await press("x");
    return c;
  };
  const toast = (c: HTMLElement) => c.querySelector('[role="status"]') as HTMLElement;

  it("x checks the focused row, shows the count, and Escape clears the selection", async () => {
    const c = await render();
    await press("j");
    await press("x");
    expect(c.textContent).toContain("1 selected");
    await press("x");
    expect(c.textContent).not.toContain("selected");
    await press("x");
    await press("Escape");
    expect(c.textContent).not.toContain("selected");
  });

  it("e archives all checked rows in one call, shows Archived 2, and keeps the others", async () => {
    const c = await pickTwo(await render());
    expect(c.textContent).toContain("2 selected");
    await press("e");
    expect(rpcMock.archiveMany).toHaveBeenCalledTimes(1);
    expect(rpcMock.archiveMany).toHaveBeenCalledWith({ messageIds: ["a", "b"] });
    expect(rpcMock.archive).not.toHaveBeenCalled();
    expect(c.querySelector('[data-row-id="a"]')).toBeNull();
    expect(c.querySelector('[data-row-id="b"]')).toBeNull();
    expect(c.querySelector('[data-row-id="c"]')).not.toBeNull();
    expect(toast(c).textContent).toContain("Archived 2");
    expect(c.textContent).not.toContain("selected");
  });

  it("the selection bar archives the checked rows", async () => {
    const c = await pickTwo(await render());
    await click(byText(c, "Archive"));
    expect(rpcMock.archiveMany).toHaveBeenCalledWith({ messageIds: ["a", "b"] });
  });

  it("the selection bar clears the checks without archiving", async () => {
    const c = await pickTwo(await render());
    await click(byText(c, "Clear"));
    expect(c.textContent).not.toContain("selected");
    expect(rpcMock.archiveMany).not.toHaveBeenCalled();
  });

  it("one Undo puts the whole selection back, after the archive has finished", async () => {
    let finish: (value: unknown) => void = () => {};
    rpcMock.archiveMany.mockReturnValue(new Promise((r) => (finish = r)));
    const c = await pickTwo(await render());
    await press("e");
    await click(byText(toast(c), "Undo"));
    expect(rpcMock.unarchiveMany).not.toHaveBeenCalled();
    await act(async () => finish({ done: ["a", "b"], failed: [] }));
    expect(rpcMock.unarchiveMany).toHaveBeenCalledTimes(1);
    expect(rpcMock.unarchiveMany).toHaveBeenCalledWith({ messageIds: ["a", "b"] });
  });

  it("undoes only the threads that were archived, and reloads the list for a partial failure", async () => {
    rpcMock.archiveMany.mockResolvedValue({
      done: ["a"],
      failed: [{ messageId: "b", reason: "unavailable" }],
    });
    const c = await pickTwo(await render());
    const lists = rpcMock.list.mock.calls.length;
    await press("e");
    expect(c.querySelector('[role="alert"]')?.textContent).toContain("Couldn't archive 1");
    expect(rpcMock.list.mock.calls.length).toBeGreaterThan(lists);
    await click(byText(toast(c), "Undo"));
    expect(rpcMock.unarchiveMany).toHaveBeenCalledWith({ messageIds: ["a"] });
  });

  it("skips Undo when the whole archive failed, and shows the error", async () => {
    rpcMock.archiveMany.mockRejectedValue(new Error("nope"));
    const c = await pickTwo(await render());
    await press("e");
    expect(c.querySelector('[role="alert"]')).not.toBeNull();
    await click(byText(toast(c), "Undo"));
    expect(rpcMock.unarchiveMany).not.toHaveBeenCalled();
  });

  it("clears the selection when the pile changes", async () => {
    const c = await pickTwo(await render());
    expect(c.textContent).toContain("2 selected");
    await act(async () => go("/app/inbox?filter=unread"));
    expect(c.textContent).not.toContain("selected");
  });

  it("e still archives the focused row when nothing is checked", async () => {
    await render();
    await press("j");
    await press("e");
    expect(rpcMock.archive).toHaveBeenCalledWith({ messageId: "a" });
    expect(rpcMock.archiveMany).not.toHaveBeenCalled();
  });

  it("archives from the Spam pile with allowSpam, and never sends spam-pile mail from other piles", async () => {
    rpcMock.list.mockResolvedValue(
      list([row("s1", { pile: "spam" }), row("s2", { pile: "spam", inInbox: false }), row("n")], {
        pileCounts: { important: 0, updates: 0, newsletters: 0, spam: 3 },
      }),
    );
    const c = await render(["/app/inbox?pile=spam"]);
    await pickTwo(c);
    await press("j");
    await press("x");
    await press("e");
    // The archived Gmail-spam row (not in the inbox) is left out.
    expect(rpcMock.archiveMany).toHaveBeenCalledWith({
      messageIds: ["s1", "n"],
      allowSpam: true,
    });
    await cleanups.pop()?.();
    rpcMock.archiveMany.mockClear();
    const d = await render(["/app/inbox?pile=updates"]);
    await pickTwo(d);
    await press("e");
    expect(rpcMock.archiveMany).toHaveBeenCalledWith({ messageIds: ["n"] });
  });
});

describe("a list that holds still", () => {
  it("keeps the pile tabs before sorting is allowed, so locally sorted mail stays reachable", async () => {
    rpcMock.list.mockResolvedValue(
      list([row("a")], {
        enabled: false,
        triageBlocked: { reason: "needs_consent", recipient: { key: "k", name: "Model" } } as never,
      }),
    );
    const c = await render();
    expect(c.textContent).toContain("Subject a");
    expect(c.textContent).toContain("Updates");
    expect(c.textContent).toContain("Newsletters");
  });

  it("keeps a to-do that arrives after the rows show out of the list until the list changes", async () => {
    rpcMock.list.mockResolvedValue(list([row("a", { needsReply: true })]));
    const c = await render();
    expect(c.textContent).not.toContain("Send the deck");
    const todo = {
      id: "t1",
      connectionId: "c1",
      messageId: "elsewhere",
      text: "Send the deck",
      detail: null,
      from: "Dana",
      priority: null,
      dueOn: null,
      doneAt: null,
    };
    rpcMock.todos.mockResolvedValue({ todos: [todo] });
    // A later sync lands with a new to-do: the rows under the pointer stay where they are.
    rpcMock.list.mockResolvedValue(
      list([row("a", { needsReply: true })], { syncedAt: "2026-10-12T00:05:00.000Z" }),
    );
    await act(async () => window.dispatchEvent(new Event("rakazo:mail-sent")));
    expect(c.textContent).not.toContain("Send the deck");
    await act(async () => go("/app/inbox?filter=unread"));
    await act(async () => go("/app/inbox"));
    expect(c.textContent).toContain("Send the deck");
  });

  it("keeps a completed to-do completed when a held answer is applied later", async () => {
    rpcMock.list.mockResolvedValue(list([row("a", { needsReply: true })]));
    const make = (id: string) => ({
      id,
      connectionId: "c1",
      messageId: "elsewhere",
      text: `Task ${id}`,
      detail: null,
      from: "Dana",
      priority: null,
      dueOn: null,
      doneAt: null,
    });
    rpcMock.todos.mockResolvedValue({ todos: [make("A")] });
    const c = await render();
    expect(c.textContent).toContain("Task A");
    rpcMock.todos.mockResolvedValue({ todos: [make("A"), make("B")] });
    rpcMock.list.mockResolvedValue(
      list([row("a", { needsReply: true })], { syncedAt: "2026-10-12T00:05:00.000Z" }),
    );
    await act(async () => window.dispatchEvent(new Event("rakazo:mail-sent")));
    expect(c.textContent).not.toContain("Task B");
    rpcMock.setDone.mockResolvedValue({ ...make("A"), doneAt: new Date().toISOString() });
    await click(c.querySelector('[role="checkbox"][aria-label="Task A"]'));
    await act(async () => go("/app/inbox?filter=unread"));
    await act(async () => go("/app/inbox"));
    expect(c.textContent).toContain("Task B");
    expect(
      c.querySelector('[role="checkbox"][aria-label="Task A"]')?.getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("names each filter once and keeps the filter menu short", async () => {
    const c = await render();
    await click(c.querySelector('[data-testid="inbox-filter"]'));
    const items = [...document.querySelectorAll('[role^="menuitem"]')].map((el) => el.textContent);
    expect(items.length).toBeLessThan(10);
    expect(new Set(items).size).toBe(items.length);
    // Those two names belong to the pile tabs.
    expect(items).not.toContain("Updates");
    expect(items).not.toContain("Newsletters");
  });

  it("gives Compose the same box as the other toolbar buttons", async () => {
    const c = await render();
    const box = (label: string) => c.querySelector(`button[aria-label="${label}"]`)?.className;
    expect(box("Compose")).toBeTruthy();
    expect(box("Compose")).toBe(box("Cleanup"));
  });
});

it("shows no rows in the first seconds of a slow first sort, and the stall notice later", async () => {
  vi.useFakeTimers();
  try {
    rpcMock.list.mockImplementation(async () => list([row("a")], { triagePending: true }));
    const c = await render();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(c.querySelector("[aria-busy=true]")).not.toBeNull();
    expect(c.textContent).not.toContain("noise a");
    for (let i = 0; i < 14; i++)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000);
      });
    expect(c.textContent).toContain("Sorting is taking longer than usual.");
    expect(c.textContent).toContain("noise a");
  } finally {
    vi.useRealTimers();
  }
});
