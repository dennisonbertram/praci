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
  markRead: vi.fn(),
  todos: vi.fn(),
}));
vi.mock("../lib/rpc", () => ({
  rpc: {
    inbox: {
      list: rpcMock.list,
      refresh: rpcMock.refresh,
      feedback: rpcMock.feedback,
      archive: rpcMock.archive,
      unarchive: rpcMock.unarchive,
      markRead: rpcMock.markRead,
      todos: { list: rpcMock.todos, setDone: vi.fn() },
    },
  },
}));
vi.mock("../lib/inbox-message-cache", () => ({
  INBOX_CHANGED_EVENT: "rakazo:inbox-changed",
  prefetchInboxMessage: () => {},
  peekInboxMessage: () => undefined,
  loadInboxMessage: () => new Promise(() => {}),
}));
const realDialog = vi.hoisted(() => ({ on: false }));
vi.mock("../components/AiDataSharing", () => ({ InboxConsentPrompt: () => null }));
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
    notice,
  }: {
    messageId: string | null;
    onClose: () => void;
    onArchive?: () => void;
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
  }: {
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
async function render(entries = ["/app/inbox"], index?: number) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={entries} initialIndex={index}>
        <Probe />
        <InboxPage onConnectMail={connectMail} onRefreshed={() => {}} paused={false} />
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
  rpcMock.markRead.mockResolvedValue({ ok: true });
  rpcMock.list.mockResolvedValue(list([row("a"), row("b"), row("c")]));
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
  c = await render(["/app/inbox?view=important"]);
  expect(c.textContent).toContain("No mail matches this filter");
  await click(byText(c, "Clear"));
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

it("offers Undo after an archive, which restores the thread and reloads the list", async () => {
  const c = await render();
  await click(byText(c, "archive b"));
  const toast = c.querySelector('[role="status"]');
  // It names the email, so the person knows which one Undo brings back.
  expect(toast?.textContent).toContain('Archived "Subject b"');
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
  await click(byText(c, "Clear"));
  expect(location.search).toBe("");
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
  for (let i = 0; i < 13; i++) await dwell(5_000);
  expect(c.textContent).not.toContain("Sorting your mail…");
  expect(c.textContent).toContain("Sorting is taking longer than usual.");
  const refreshes = rpcMock.refresh.mock.calls.length;
  await click(byText(c, "Try sorting again"));
  expect(rpcMock.refresh.mock.calls.length).toBe(refreshes + 1);
  expect(c.textContent).toContain("Sorting your mail…");
});

it("shows nothing from the first sort until it and its to-dos have landed, then changes once", async () => {
  rpcMock.list.mockResolvedValue(list([row("a"), row("b")], { triagePending: true }));
  const c = await render();
  const sorting = () => c.textContent?.includes("Sorting your mail…");
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
  expect(category("b")).toBe("");
  // Sorting finished, and its to-dos are still loading: the page waits for them.
  let todosLoaded: (value: unknown) => void = () => {};
  rpcMock.todos.mockReturnValue(new Promise((resolve) => (todosLoaded = resolve)));
  rpcMock.list.mockResolvedValue(
    list([row("a", { needsReply: true }), row("b", { needsReply: false, category: "newsletter" })]),
  );
  await act(async () => window.dispatchEvent(new Event("rakazo:mail-sent")));
  expect(sorting()).toBe(true);
  expect(category("b")).toBe("");
  const todo = {
    id: "t1",
    connectionId: "c1",
    messageId: "a",
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

it("turns off search and Filter until mail is connected", async () => {
  rpcMock.list.mockResolvedValue(list([], { accounts: [] }));
  const c = await render();
  expect(c.textContent).toContain("No mail connected");
  expect(c.querySelector<HTMLInputElement>('input[aria-label="Search mail"]')?.disabled).toBe(true);
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
  const sales = [...c.querySelectorAll<HTMLElement>('[role="tab"]')].find(
    (el) => el.textContent === "Sales",
  );
  await click(sales ?? null);
  expect(rpcMock.list).toHaveBeenLastCalledWith(expect.objectContaining({ connectionId: "c2" }));
  for (const cleanup of cleanups.splice(0)) await cleanup();
  rpcMock.list.mockClear();
  await render();
  expect(rpcMock.list).toHaveBeenCalledWith(expect.objectContaining({ connectionId: "c2" }));
  // Back to All for the tests that follow.
  const again = [...document.querySelectorAll<HTMLElement>('[role="tab"]')].find(
    (el) => el.textContent === "All",
  );
  await click(again ?? null);
});
