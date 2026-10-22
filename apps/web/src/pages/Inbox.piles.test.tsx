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
  moveMany: vi.fn(),
  undo: vi.fn(),
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
      moveMany: rpcMock.moveMany,
      actions: { undo: rpcMock.undo },
      markRead: async () => ({ ok: true }),
      todos: { list: async () => ({ todos: [] }), setDone: vi.fn() },
    },
    connections: { list: async () => [{ provider: "gmail", status: "connected" }] },
  },
}));
vi.mock("../lib/inbox-message-cache", () => ({
  INBOX_CHANGED_EVENT: "rakazo:inbox-changed",
  prefetchInboxMessage: rpcMock.prefetch,
  peekInboxMessage: () => undefined,
  loadInboxMessage: () => new Promise(() => {}),
}));
vi.mock("../components/inbox/InboxCleanup", () => ({
  InboxCleanup: ({ connectionId, onBack }: { connectionId?: string; onBack: () => void }) => (
    <div data-testid="cleanup-screen" data-connection={connectionId ?? ""}>
      <button type="button" onClick={onBack}>
        leave
      </button>
    </div>
  ),
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
  rpcMock.moveMany.mockImplementation(async ({ messageIds }: { messageIds: string[] }) => ({
    done: messageIds,
    failed: [],
    batchId: "batch-1",
  }));
  rpcMock.undo.mockResolvedValue({ restored: 3, failed: 0 });
});
afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) await cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("Newsletters digest", () => {
  const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
  const issues = [
    row("old", { receivedAt: daysAgo(10), pile: "newsletters" }),
    row("d2", {
      from: "Beta Weekly",
      fromAddress: "hi@beta.example",
      receivedAt: daysAgo(2),
      pile: "newsletters",
      reason: "Second issue",
    }),
    row("d1", { receivedAt: daysAgo(1), pile: "newsletters", unread: true }),
    row("d3", {
      from: "Beta Weekly",
      fromAddress: "hi@beta.example",
      receivedAt: daysAgo(5),
      pile: "newsletters",
    }),
  ];
  const toggle = (c: HTMLElement) =>
    [...c.querySelectorAll<HTMLElement>("button[aria-pressed]")].find(
      (b) => b.textContent === "Digest",
    ) ?? null;
  beforeEach(() => {
    rpcMock.list.mockImplementation(async (input: { pile?: string }) =>
      list(input.pile === "newsletters" ? issues : updates, {
        pileCounts: { important: 0, updates: 2, newsletters: 4, spam: 0 },
      }),
    );
  });

  it("offers the Digest toggle on the Newsletters pile only", async () => {
    const newsletters = await render("/app/inbox?pile=newsletters");
    expect(toggle(newsletters)).not.toBeNull();
    const other = await render("/app/inbox?pile=updates");
    expect(toggle(other)).toBeNull();
  });

  it("shows one card per sender from the last 7 days with a message count, in place of the sender groups", async () => {
    const c = await render("/app/inbox?pile=newsletters");
    await click(toggle(c));
    expect(rowIds(c)).toEqual(["d1", "d2"]);
    expect(c.querySelector('[data-row-id="d2"]')?.textContent).toContain("2 messages");
    expect(c.querySelector('[data-row-id="d1"]')?.textContent).not.toContain("messages");
    expect(c.textContent).toContain("Second issue");
    await click(toggle(c));
    expect(rowIds(c)).toContain(headerKey);
  });

  it("reads the digest from ?digest=1, so a link or Back returns to it", async () => {
    const c = await render("/app/inbox?pile=newsletters&digest=1");
    expect(toggle(c)?.getAttribute("aria-pressed")).toBe("true");
    expect(rowIds(c)).toEqual(["d1", "d2"]);
  });

  it("opens an issue in the message viewer", async () => {
    const c = await render("/app/inbox?pile=newsletters");
    await click(toggle(c));
    await click(c.querySelector('[data-row-id="d2"] button'));
    expect(c.querySelector('[data-testid="message"]')?.textContent).toBe("d2");
  });

  it("moves through the cards with j", async () => {
    const c = await render("/app/inbox?pile=newsletters");
    await click(toggle(c));
    await press("j");
    await press("j");
    expect(c.querySelector('[data-row-id="d2"]')?.getAttribute("aria-current")).toBe("true");
  });

  it("archives only the issues shown with Archive all, and Undo restores them", async () => {
    const c = await render("/app/inbox?pile=newsletters");
    await click(toggle(c));
    await click(byText(c, "Archive all 3 messages from 2 senders"));
    expect(rpcMock.archiveMany).toHaveBeenCalledWith({ messageIds: ["d1", "d2", "d3"] });
    const toast = c.querySelector('[role="status"]') as HTMLElement;
    expect(toast.textContent).toContain("Archived 3");
    await click(byText(toast, "Undo"));
    expect(rpcMock.unarchiveMany).toHaveBeenCalledWith({ messageIds: ["d1", "d2", "d3"] });
  });

  it("leaves the digest when another pile opens", async () => {
    const c = await render("/app/inbox?pile=newsletters");
    await click(toggle(c));
    expect(toggle(c)?.getAttribute("aria-pressed")).toBe("true");
    await click(byText(c, "Updates"));
    await click(byText(c, "Newsletters"));
    expect(toggle(c)?.getAttribute("aria-pressed")).toBe("false");
  });
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
    // The cache dedupes repeated prefetches of one id; what matters is that no header id is asked.
    const asked = [...new Set(rpcMock.prefetch.mock.calls.map(([id]) => id))];
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

  it("archives a group of 120 messages in calls of at most 50, and Undo restores them the same way", async () => {
    const many = Array.from({ length: 120 }, (_, i) =>
      row(`n${i}`, { receivedAt: minutesAgo(i + 1) }),
    );
    rpcMock.list.mockResolvedValue(list(many));
    const c = await render("/app/inbox?pile=updates");
    await click(header(c)?.parentElement?.querySelector('button[aria-label="Archive"]'));
    expect(rpcMock.archiveMany.mock.calls.map(([input]) => input.messageIds.length)).toEqual([
      50, 50, 20,
    ]);
    const toast = c.querySelector('[role="status"]') as HTMLElement;
    await click(byText(toast, "Undo"));
    expect(rpcMock.unarchiveMany.mock.calls.map(([input]) => input.messageIds.length)).toEqual([
      50, 50, 20,
    ]);
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

describe("Spam and trash from a selection", () => {
  const ariaButton = (c: HTMLElement, label: string) =>
    c.querySelector<HTMLElement>(`button[aria-label="${label}"]`);

  it("reports the checked group as spam in one call, drops the rows and undoes the logged batch", async () => {
    // The reload that follows the call finds the rows gone, as the server would.
    rpcMock.moveMany.mockImplementation(async ({ messageIds }: { messageIds: string[] }) => {
      rpcMock.list.mockResolvedValue(list(updates.filter((r) => !messageIds.includes(r.id))));
      return { done: messageIds, failed: [], batchId: "batch-1" };
    });
    const c = await render("/app/inbox?pile=updates");
    await click(boxes(c)[0]);
    await click(ariaButton(c, "Spam"));
    expect(rpcMock.moveMany).toHaveBeenCalledWith({ op: "spam", messageIds: ["a1", "a2", "a3"] });
    expect(rowIds(c)).toEqual(["s1"]);
    const toast = c.querySelector('[role="status"]') as HTMLElement;
    expect(toast.textContent).toContain("Marked 3 as spam");
    await click(byText(toast, "Undo"));
    expect(rpcMock.undo).toHaveBeenCalledWith({ batchId: "batch-1" });
  });

  it("moves the checked rows to trash with an Undo", async () => {
    const c = await render("/app/inbox?pile=updates");
    await click(boxes(c)[0]);
    await click(ariaButton(c, "Trash"));
    expect(rpcMock.moveMany).toHaveBeenCalledWith({ op: "trash", messageIds: ["a1", "a2", "a3"] });
    expect((c.querySelector('[role="status"]') as HTMLElement).textContent).toContain(
      "Moved 3 to trash",
    );
  });

  it("brings the list back when the call fails", async () => {
    rpcMock.moveMany.mockRejectedValue(new Error("Gmail is busy"));
    const c = await render("/app/inbox?pile=updates");
    await click(boxes(c)[0]);
    await click(ariaButton(c, "Trash"));
    expect(rpcMock.list.mock.calls.length).toBeGreaterThan(1);
    expect(c.textContent).toContain("Gmail is busy");
  });

  it("offers Not spam, not Spam, in the Spam pile", async () => {
    rpcMock.list.mockResolvedValue(
      list([row("g1", { pile: "spam", inInbox: false, fromAddress: "x@spam.example" })]),
    );
    const c = await render("/app/inbox?pile=spam");
    await click(boxes(c)[0]);
    expect(ariaButton(c, "Spam")).toBeNull();
    await click(ariaButton(c, "Not spam"));
    expect(rpcMock.moveMany).toHaveBeenCalledWith({ op: "notSpam", messageIds: ["g1"] });
  });
});

describe("Cleanup entry", () => {
  it("shows a Cleanup button beside Filter when an account is connected", async () => {
    const c = await render("/app/inbox?pile=updates");
    expect(c.querySelector('[data-testid="inbox-cleanup"]')?.getAttribute("aria-label")).toBe(
      "Cleanup",
    );
  });

  it("opens the cleanup screen from the button and returns to the list from its Back", async () => {
    const c = await render("/app/inbox?pile=updates");
    await click(c.querySelector('[data-testid="inbox-cleanup"]'));
    expect(c.querySelector('[data-testid="cleanup-screen"]')).not.toBeNull();
    expect(c.querySelector('[data-testid="inbox-cleanup"]')).toBeNull();
    await click(byText(c, "leave"));
    expect(c.querySelector('[data-testid="cleanup-screen"]')).toBeNull();
    expect(c.querySelector('[data-testid="inbox-cleanup"]')).not.toBeNull();
  });

  it("hides it while no account is connected", async () => {
    rpcMock.list.mockResolvedValue(list([], { accounts: [] }));
    const c = await render("/app/inbox");
    expect(c.querySelector('[data-testid="inbox-cleanup"]')).toBeNull();
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
