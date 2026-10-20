// @vitest-environment jsdom

import type { InboxListOutput, MailRow } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
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
  archive: vi.fn(),
  archiveMany: vi.fn(),
  unarchiveMany: vi.fn(),
  prefetch: vi.fn(),
}));
vi.mock("../lib/rpc", () => ({
  rpc: {
    inbox: {
      list: rpcMock.list,
      refresh: async () => ({}),
      feedback: vi.fn(),
      archive: rpcMock.archive,
      unarchive: vi.fn(),
      archiveMany: rpcMock.archiveMany,
      unarchiveMany: rpcMock.unarchiveMany,
      markRead: async () => ({ ok: true }),
      todos: { list: async () => ({ todos: [] }), setDone: vi.fn() },
    },
  },
}));
vi.mock("../lib/inbox-message-cache", () => ({
  INBOX_CHANGED_EVENT: "rakazo:inbox-changed",
  prefetchInboxMessage: rpcMock.prefetch,
  peekInboxMessage: () => undefined,
  loadInboxMessage: () => new Promise(() => {}),
}));
vi.mock("../components/AiDataSharing", () => ({ InboxConsentPrompt: () => null }));
vi.mock("../components/ComposeEmail", () => ({
  ComposeEmail: () => null,
  MAIL_SENT_EVENT: "rakazo:mail-sent",
  NEW_MESSAGE: {},
}));
vi.mock("../components/inbox/InboxMessageDialog", () => ({
  InboxMessageDialog: ({ messageId }: { messageId: string | null }) =>
    messageId ? (
      <div role="dialog" data-testid="message">
        {messageId}
      </div>
    ) : null,
}));

import { InboxPage } from "./Inbox";

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const row = (id: string, extra: Partial<MailRow> = {}): MailRow => ({
  id,
  connectionId: "c1",
  threadId: `t-${id}`,
  from: "Acme Billing",
  fromAddress: "billing@acme.example",
  subject: `Subject ${id}`,
  snippet: `Snippet ${id}`,
  receivedAt: new Date(Date.now() - 60_000).toISOString(),
  unread: false,
  inInbox: true,
  needsReply: null,
  priority: null,
  reason: null,
  category: null,
  feedback: null,
  pile: "updates",
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

// Acme sends three messages, Shop one, so Updates shows a group and a plain row.
const updates = [
  row("a1", { reason: "October invoice, due Nov 30", unread: true, receivedAt: minutesAgo(1) }),
  row("a2", { receivedAt: minutesAgo(2) }),
  row("a3", { receivedAt: minutesAgo(3) }),
  row("s1", {
    from: "Shop",
    fromAddress: "orders@shop.example",
    subject: "Your order shipped",
    receivedAt: minutesAgo(4),
  }),
];

const cleanups: Array<() => Promise<void>> = [];
async function render(entry: string) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[entry]}>
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

let clock = Date.now();
const press = (key: string, extra: KeyboardEventInit = {}) =>
  act(async () => {
    vi.setSystemTime(Date.now() + 200);
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...extra }),
    );
  });
const click = (el: Element | null | undefined, init: MouseEventInit = {}) =>
  act(async () => {
    el?.dispatchEvent(new MouseEvent("click", { bubbles: true, ...init }));
  });
const byText = (c: HTMLElement, label: string) =>
  [...c.querySelectorAll("button")].find((b) => b.textContent === label);
const rowIds = (c: HTMLElement) =>
  [...c.querySelectorAll<HTMLElement>("[data-row-id]")].map((el) => el.dataset.rowId);
const headerKey = "group:billing@acme.example";
const header = (c: HTMLElement) => c.querySelector<HTMLElement>(`[data-row-id="${headerKey}"]`);
const boxes = (c: HTMLElement) => [...c.querySelectorAll<HTMLElement>('[role="checkbox"]')];

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
  clock += 60_000;
  vi.setSystemTime(clock);
  rpcMock.list.mockImplementation(async (input: { pile?: string }) =>
    list(input.pile === "updates" || input.pile === "newsletters" ? updates : [], {
      pileCounts: { important: 0, updates: 2, newsletters: 0, spam: 0 },
    }),
  );
  rpcMock.archive.mockResolvedValue({ ok: true });
  rpcMock.archiveMany.mockImplementation(async ({ messageIds }: { messageIds: string[] }) => ({
    done: messageIds,
    failed: [],
  }));
  rpcMock.unarchiveMany.mockImplementation(async ({ messageIds }: { messageIds: string[] }) => ({
    done: messageIds,
    failed: [],
  }));
});
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("Updates and Newsletters pile", () => {
  it("shows one row per sender with the count and the newest summary, and a single message as a row", async () => {
    const c = await render("/app/inbox?pile=updates");
    expect(rowIds(c)).toEqual([headerKey, "s1"]);
    const text = header(c)?.textContent ?? "";
    expect(text).toContain("Acme Billing");
    expect(text).toContain("3");
    expect(text).toContain("Subject a1 — October invoice, due Nov 30");
    expect(header(c)?.getAttribute("aria-expanded")).toBe("false");
  });

  it("asks for the pile only, with no view or triage-only input", async () => {
    await render("/app/inbox?pile=newsletters");
    expect(rpcMock.list).toHaveBeenCalledWith({ pile: "newsletters" });
  });

  it("works without triage, since piles come from free rules", async () => {
    rpcMock.list.mockResolvedValue(
      list(updates, { enabled: false, triageBlocked: { reason: "no_model" } }),
    );
    const c = await render("/app/inbox?pile=newsletters");
    expect(rowIds(c)).toEqual([headerKey, "s1"]);
  });

  it("expands a group on click and lists its messages", async () => {
    const c = await render("/app/inbox?pile=updates");
    await click(header(c));
    expect(rowIds(c)).toEqual([headerKey, "a1", "a2", "a3", "s1"]);
    await click(header(c));
    expect(rowIds(c)).toEqual([headerKey, "s1"]);
  });

  it("moves through headers and open messages with j and opens or closes a group with Enter", async () => {
    const c = await render("/app/inbox?pile=updates");
    await press("j");
    expect(header(c)?.className).toContain("border-primary");
    await press("Enter");
    expect(rowIds(c)).toEqual([headerKey, "a1", "a2", "a3", "s1"]);
    await press("j");
    expect(c.querySelector('[data-row-id="a1"]')?.className).toContain("border-primary");
    // Enter on a message opens it; a group id never reaches the message dialog.
    await press("Enter");
    expect(c.querySelector('[data-testid="message"]')?.textContent).toBe("a1");
  });

  it("never prefetches a group header as if it were a message", async () => {
    const c = await render("/app/inbox?pile=updates");
    await press("j");
    await act(async () => void (await vi.advanceTimersByTimeAsync(300)));
    const asked = rpcMock.prefetch.mock.calls.map(([id]) => id);
    expect(asked).toEqual(["s1"]);
    expect(c).toBeTruthy();
  });

  it("the group checkbox checks all of the group's messages, even while it is closed", async () => {
    const c = await render("/app/inbox?pile=updates");
    await click(boxes(c)[0]);
    expect(c.textContent).toContain("3 selected");
    expect(boxes(c)[0]?.getAttribute("aria-checked")).toBe("true");
    await click(boxes(c)[0]);
    expect(c.textContent).not.toContain("selected");
  });

  it("archives a whole checked group in one call, with one Undo for all of it", async () => {
    const c = await render("/app/inbox?pile=updates");
    await click(boxes(c)[0]);
    await click(byText(c, "Archive"));
    expect(rpcMock.archiveMany).toHaveBeenCalledTimes(1);
    expect(rpcMock.archiveMany).toHaveBeenCalledWith({ messageIds: ["a1", "a2", "a3"] });
    expect(rowIds(c)).toEqual(["s1"]);
    const toast = c.querySelector('[role="status"]') as HTMLElement;
    expect(toast.textContent).toContain("Archived 3");
    await click(byText(toast, "Undo"));
    expect(rpcMock.unarchiveMany).toHaveBeenCalledWith({ messageIds: ["a1", "a2", "a3"] });
  });

  it("archives a group from its own Archive button", async () => {
    const c = await render("/app/inbox?pile=updates");
    await click(header(c)?.parentElement?.querySelector('button[aria-label="Archive"]'));
    expect(rpcMock.archiveMany).toHaveBeenCalledWith({ messageIds: ["a1", "a2", "a3"] });
  });

  it("e on a focused group header archives the group, and x checks it", async () => {
    const c = await render("/app/inbox?pile=updates");
    await press("j");
    await press("x");
    expect(c.textContent).toContain("3 selected");
    await press("x");
    expect(c.textContent).not.toContain("selected");
    await press("e");
    expect(rpcMock.archiveMany).toHaveBeenCalledWith({ messageIds: ["a1", "a2", "a3"] });
    expect(rpcMock.archive).not.toHaveBeenCalled();
    // The focus moves on to the sender that stays.
    expect(c.querySelector('[data-row-id="s1"]')?.className).toContain("border-primary");
  });

  it("shift-click checks the rows in between", async () => {
    const c = await render("/app/inbox?pile=updates");
    await click(header(c));
    // boxes: group, a1, a2, a3, s1
    await click(boxes(c)[1]);
    await click(boxes(c)[4], { shiftKey: true });
    expect(c.textContent).toContain("4 selected");
    await click(byText(c, "Archive"));
    expect(rpcMock.archiveMany).toHaveBeenCalledWith({ messageIds: ["a1", "a2", "a3", "s1"] });
  });

  it("archives one message of an open group with the single call", async () => {
    const c = await render("/app/inbox?pile=updates");
    await click(header(c));
    await click(
      c
        .querySelector('[data-row-id="a2"]')
        ?.parentElement?.querySelector('button[aria-label="Archive"]'),
    );
    expect(rpcMock.archive).toHaveBeenCalledWith({ messageId: "a2" });
    expect(rpcMock.archiveMany).not.toHaveBeenCalled();
  });

  it("closes the groups and the checks when the pile changes", async () => {
    const c = await render("/app/inbox?pile=updates");
    await click(header(c));
    await click(boxes(c)[1]);
    const tab = [...c.querySelectorAll<HTMLElement>('[role="tab"]')].find(
      (el) => el.textContent === "Newsletters",
    );
    await click(tab);
    expect(c.textContent).not.toContain("selected");
    expect(header(c)?.getAttribute("aria-expanded")).toBe("false");
  });

  it("hides the Newsletter label inside the Newsletters pile", async () => {
    rpcMock.list.mockResolvedValue(
      list([row("n1", { category: "newsletter", pile: "newsletters" })]),
    );
    const c = await render("/app/inbox?pile=newsletters");
    expect(c.querySelector("[data-label-dot]")).toBeNull();
  });
});

describe("Spam pile", () => {
  const spam = [
    row("g1", { pile: "spam", inInbox: false, from: "Gmail spam", fromAddress: "x@spam.example" }),
    row("g2", { pile: "spam", from: "Rule spam", fromAddress: "y@spam.example" }),
  ];
  beforeEach(() => {
    rpcMock.list.mockResolvedValue(
      list(spam, { pileCounts: { important: 0, updates: 0, newsletters: 0, spam: 2 } }),
    );
  });

  it("lists spam flat, without an Archived badge on mail that is not in the inbox", async () => {
    const c = await render("/app/inbox?pile=spam");
    expect(rowIds(c)).toEqual(["g1", "g2"]);
    expect(c.querySelector('[data-slot="badge"]')?.textContent ?? "").not.toContain("Archived");
  });

  it("archives the selected spam that is in the inbox, with allowSpam", async () => {
    const c = await render("/app/inbox?pile=spam");
    await click(boxes(c)[0]);
    await click(boxes(c)[1]);
    await click(byText(c, "Archive"));
    expect(rpcMock.archiveMany).toHaveBeenCalledWith({ messageIds: ["g2"], allowSpam: true });
  });
});
