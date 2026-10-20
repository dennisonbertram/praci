// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act, useEffect } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InboxScreen from "../app/inbox";

const state = vi.hoisted(() => ({
  rpc: vi.fn(),
  push: vi.fn(),
  setOptions: vi.fn(),
  alert: vi.fn(),
}));
vi.mock("expo-router", () => ({
  useFocusEffect: (callback: () => undefined | (() => void)) => {
    useEffect(() => callback(), [callback]);
  },
  useNavigation: () => ({ setOptions: state.setOptions }),
  useRouter: () => ({ push: state.push }),
}));
vi.mock("./api", () => ({ rpc: state.rpc }));
vi.mock("./unseen-notifications", () => ({ markSurfaceSeen: vi.fn() }));
vi.mock("./appearance", () => ({
  mobileTokens: () => ({ destructive: "red", warning: "amber", card: "white", primary: "black" }),
}));
vi.mock("./native", () => ({
  native: {},
  useThemedStyles: (factory: () => unknown) => factory(),
  useResolvedAppearance: () => "light",
}));
vi.mock("@expo/ui/community/menu", () => ({ MenuView: () => null }));
vi.mock("./i18n", () => {
  // The real t is one module-level function; a fresh one per render would retrigger focus effects.
  const t = (text: string, values?: Record<string, string | number>) =>
    text.replace(/\{(\w+)\}/g, (token, key: string) => String(values?.[key] ?? token));
  return { t, useI18n: () => ({ t }), dateLocaleForUi: () => "en-US" };
});
vi.mock("../components/native-symbol", () => ({ NativeSymbol: () => null }));
vi.mock("../components/native-action-button", () => ({
  NativeActionButton: ({ label, onPress }: { label: string; onPress: () => void }) => (
    <button type="button" onClick={onPress}>
      {label}
    </button>
  ),
}));
vi.mock("../components/native-segmented-control", () => ({
  NativeSegmentedControl: ({
    accessibilityLabel,
    options,
    onChange,
  }: {
    accessibilityLabel: string;
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
  }) => (
    <div data-testid={accessibilityLabel === "Inbox" ? "piles" : "segments"}>
      {options.map((option) => (
        <button key={option.value} type="button" onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  ),
}));
// The system menu is native; this stand-in renders its actions as buttons beside the row.
vi.mock("../components/mail-row-menu", () => ({
  MailRowMenu: ({
    onArchive,
    onSpam,
    onNotSpam,
    onTrash,
    children,
  }: {
    onArchive: () => void;
    onSpam?: () => void;
    onNotSpam?: () => void;
    onTrash?: () => void;
    children: ReactNode;
  }) => (
    <div>
      {children}
      <button type="button" data-menu="archive" onClick={onArchive}>
        Archive
      </button>
      {onSpam ? (
        <button type="button" data-menu="spam" onClick={onSpam}>
          Spam
        </button>
      ) : null}
      {onNotSpam ? (
        <button type="button" data-menu="notSpam" onClick={onNotSpam}>
          Not spam
        </button>
      ) : null}
      {onTrash ? (
        <button type="button" data-menu="trash" onClick={onTrash}>
          Trash
        </button>
      ) : null}
    </div>
  ),
}));
vi.mock("../components/menu-picker", () => ({
  MenuPicker: ({
    choices,
    onChange,
  }: {
    choices: { key: string; label: string }[];
    onChange: (key: string) => void;
  }) => (
    <div data-testid="account-menu">
      {choices.map((choice) => (
        <button key={choice.key} type="button" onClick={() => onChange(choice.key)}>
          {choice.label}
        </button>
      ))}
    </div>
  ),
}));
vi.mock("react-native", () => {
  const View = ({
    children,
    testID,
    accessibilityLabel,
  }: {
    children?: ReactNode;
    testID?: string;
    accessibilityLabel?: string;
  }) => (
    <div data-testid={testID} data-label={accessibilityLabel}>
      {children}
    </div>
  );
  return {
    View,
    ActivityIndicator: () => <div data-testid="spinner" />,
    Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
    Pressable: ({
      children,
      onPress,
      accessibilityLabel,
    }: {
      children?: ReactNode;
      onPress?: () => void;
      accessibilityLabel?: string;
    }) => (
      <button type="button" aria-label={accessibilityLabel} onClick={onPress}>
        {children}
      </button>
    ),
    RefreshControl: () => null,
    SectionList: ({
      sections,
      renderItem,
      renderSectionHeader,
      ListHeaderComponent,
      ListEmptyComponent,
    }: {
      sections: { key: string; data: unknown[] }[];
      renderItem: (info: { item: unknown; index: number; section: unknown }) => ReactNode;
      renderSectionHeader: (info: { section: unknown }) => ReactNode;
      ListHeaderComponent?: ReactNode;
      ListEmptyComponent?: ReactNode;
    }) => (
      <div>
        {ListHeaderComponent}
        {sections.length === 0 ? ListEmptyComponent : null}
        {sections.map((section) => (
          <div key={section.key}>
            {renderSectionHeader({ section })}
            {section.data.map((item, index) => (
              <div key={(item as { id: string }).id}>{renderItem({ item, index, section })}</div>
            ))}
          </div>
        ))}
      </div>
    ),
    StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
    Platform: { OS: "ios", Version: "26.0" },
    Alert: { alert: state.alert },
  };
});

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const mailRow = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  connectionId: "c1",
  threadId: `thread-${id}`,
  from: `Sender ${id}`,
  subject: `Subject ${id}`,
  snippet: `Snippet ${id}`,
  receivedAt: daysAgo(0),
  unread: false,
  inInbox: true,
  needsReply: null,
  priority: null,
  reason: null,
  category: null,
  feedback: null,
  ...extra,
});
const inboxList = (extra: Record<string, unknown> = {}) => ({
  accounts: [{ connectionId: "c1", label: "Work" }],
  agent: { botId: "bot-1", name: "Mail helper" },
  rows: [],
  syncedAt: null,
  failedAccounts: [],
  reconnectAccounts: [],
  enabled: true,
  triagePending: false,
  ...extra,
});
const todo = (id: string, text: string) => ({
  id,
  connectionId: "c1",
  messageId: null,
  text,
  detail: null,
  from: null,
  priority: null,
  dueOn: null,
  doneAt: null,
});

let root: Root;
let container: HTMLDivElement;
let listReply: () => unknown;
let todosReply: () => unknown;
let setDoneReply: () => Promise<unknown>;
let archiveReply: (body: { messageIds: string[] }) => unknown;
let moveReply: (body: { op: string; messageIds: string[] }) => unknown;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  listReply = () => inboxList();
  todosReply = () => ({ enabled: true, todos: [] });
  setDoneReply = () => Promise.resolve({});
  archiveReply = (body) => ({ done: body.messageIds, failed: [] });
  moveReply = (body) => ({ done: body.messageIds, failed: [], batchId: "batch-1" });
  state.push.mockReset();
  state.setOptions.mockReset();
  state.alert.mockReset();
  state.rpc.mockReset().mockImplementation(async (proc: string, body?: unknown) => {
    if (proc === "inbox/list") return listReply();
    if (proc === "inbox/archiveMany") return archiveReply(body as { messageIds: string[] });
    if (proc === "inbox/moveMany") return moveReply(body as { op: string; messageIds: string[] });
    if (proc === "inbox/refresh") return { ok: true };
    if (proc === "inbox/todos/list") return todosReply();
    if (proc === "inbox/todos/setDone") return setDoneReply();
    if (proc === "inbox/agent") return { id: "bot-9", name: "Inbox agent" };
    throw new Error(`unexpected rpc ${proc}`);
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});
async function render() {
  await act(async () => root.render(<InboxScreen />));
}
const procs = () => state.rpc.mock.calls.map(([proc]) => proc as string);
const button = (label: string) =>
  [...container.querySelectorAll("button")].find((item) => item.textContent === label);
const headerItems = () => {
  const options = state.setOptions.mock.calls.at(-1)?.[0] as
    | undefined
    | {
        unstable_headerRightItems?: () => {
          type: string;
          accessibilityLabel: string;
          onPress: () => void;
          menu?: { items: { label: string; onPress: () => void }[] };
        }[];
      };
  return options?.unstable_headerRightItems?.() ?? [];
};

it("shows only Connect mail when no account is connected, and the button opens Integrations", async () => {
  listReply = () => inboxList({ accounts: [], agent: null });
  await render();
  expect(procs()).toEqual(["inbox/list"]);
  await act(async () => button("Connect mail")?.click());
  expect(state.push).toHaveBeenCalledWith("/integrations");
});

it("hides the account picker for one account and shows it for two", async () => {
  await render();
  expect(container.querySelector('[data-testid="segments"]')).toBeNull();
  listReply = () =>
    inboxList({
      accounts: [
        { connectionId: "c1", label: "Work" },
        { connectionId: "c2", label: "Home" },
      ],
    });
  await act(async () => root.render(<InboxScreen key="two" />));
  expect(container.querySelector('[data-testid="segments"]')?.textContent).toBe("AllWorkHome");
  await act(async () => button("Home")?.click());
  expect(state.rpc).toHaveBeenCalledWith("inbox/list", { connectionId: "c2", pile: "important" });
});

it("uses a menu instead of segments for more than three accounts", async () => {
  listReply = () =>
    inboxList({
      accounts: ["a", "b", "c", "d"].map((id) => ({ connectionId: id, label: `Mail ${id}` })),
    });
  await render();
  expect(container.querySelector('[data-testid="segments"]')).toBeNull();
  expect(container.querySelector('[data-testid="account-menu"]')?.textContent).toBe(
    "AllMail aMail bMail cMail d",
  );
});

it("groups mail into Needs reply, Today and Earlier, and hides empty groups", async () => {
  listReply = () =>
    inboxList({
      rows: [
        mailRow("r1", { needsReply: true }),
        mailRow("r2"),
        mailRow("r3", { receivedAt: daysAgo(5), needsReply: false }),
      ],
    });
  await render();
  const text = container.textContent ?? "";
  expect(text.indexOf("Needs reply")).toBeGreaterThanOrEqual(0);
  expect(text.indexOf("Needs reply")).toBeLessThan(text.indexOf("Subject r2"));
  expect(text.indexOf("Today")).toBeLessThan(text.indexOf("Earlier"));
  expect(text.indexOf("Earlier")).toBeLessThan(text.indexOf("Subject r3"));

  listReply = () => inboxList({ rows: [mailRow("r2")] });
  await act(async () => root.render(<InboxScreen key="today-only" />));
  expect(container.textContent).not.toContain("Needs reply");
  expect(container.textContent).not.toContain("Earlier");
  expect(container.textContent).toContain("Subject r2");
});

it("says No mail when accounts are connected and the synced list is empty", async () => {
  await render();
  expect(container.textContent).toContain("No mail");
});

it("lists, refreshes, then lists again, fetching to-dos only while triage is enabled", async () => {
  await render();
  expect(procs().filter((proc) => proc !== "inbox/todos/list")).toEqual([
    "inbox/list",
    "inbox/refresh",
    "inbox/list",
  ]);
  expect(procs()).toContain("inbox/todos/list");

  state.rpc.mockClear();
  listReply = () => inboxList({ enabled: false });
  await act(async () => root.render(<InboxScreen key="disabled" />));
  expect(procs()).not.toContain("inbox/todos/list");
});

it("removes a completed to-do at once and puts it back with an alert when the call fails", async () => {
  todosReply = () => ({ enabled: true, todos: [todo("t1", "Send the invoice")] });
  let rejectDone!: (error: Error) => void;
  setDoneReply = () =>
    new Promise((_resolve, reject) => {
      rejectDone = reject;
    });
  await render();
  expect(container.textContent).toContain("To do");
  const check = () => container.querySelector('button[aria-label="Send the invoice"]');
  await act(async () => (check() as HTMLElement).click());
  expect(state.rpc).toHaveBeenCalledWith("inbox/todos/setDone", { id: "t1", done: true });
  expect(check()).toBeNull();
  await act(async () => rejectDone(new Error("Offline")));
  expect(check()).not.toBeNull();
  expect(state.alert).toHaveBeenCalledTimes(1);
});

it("keeps a completed to-do removed when the call succeeds", async () => {
  todosReply = () => ({ enabled: true, todos: [todo("t1", "Send the invoice")] });
  await render();
  await act(async () =>
    (container.querySelector('button[aria-label="Send the invoice"]') as HTMLElement).click(),
  );
  expect(container.querySelector('button[aria-label="Send the invoice"]')).toBeNull();
  expect(container.textContent).not.toContain("To do");
});

it("opens the Inbox agent as a normal thread from the header item", async () => {
  await render();
  const [item] = headerItems();
  expect(item?.accessibilityLabel).toBe("Mail helper");
  await act(async () => item?.onPress());
  expect(state.push).toHaveBeenCalledWith({
    pathname: "/thread",
    params: { botId: "bot-1", name: "Mail helper" },
  });
  expect(procs()).not.toContain("inbox/agent");
});

it("offers Cleanup in a header menu that opens the cleanup screen", async () => {
  await render();
  const menu = headerItems().find((item) => item.type === "menu");
  expect(menu?.menu?.items.map((item) => item.label)).toEqual(["Cleanup"]);
  await act(async () => menu?.menu?.items[0]?.onPress());
  expect(state.push).toHaveBeenCalledWith("/inbox-cleanup");
});

it("hides the header items until an account is connected", async () => {
  listReply = () => inboxList({ accounts: [], agent: null });
  await render();
  expect(headerItems()).toEqual([]);
});

it("creates the Inbox agent first when the list returned none", async () => {
  listReply = () => inboxList({ agent: null });
  await render();
  const [item] = headerItems();
  expect(item?.accessibilityLabel).toBe("Inbox agent");
  await act(async () => item?.onPress());
  expect(procs()).toContain("inbox/agent");
  expect(state.push).toHaveBeenCalledWith({
    pathname: "/thread",
    params: { botId: "bot-9", name: "Inbox agent" },
  });
});

it("refetches every 5 seconds while triage is pending, at most 6 times", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  listReply = () => inboxList({ triagePending: true });
  await render();
  const lists = () => procs().filter((proc) => proc === "inbox/list").length;
  expect(lists()).toBe(2);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(4_900);
  });
  expect(lists()).toBe(2);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(100);
  });
  expect(lists()).toBe(3);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(120_000);
  });
  expect(lists()).toBe(8);
});

it("drops a slow response for the previous account after the tab changes", async () => {
  const twoAccounts = [
    { connectionId: "c1", label: "Work" },
    { connectionId: "c2", label: "Home" },
  ];
  let releaseRefresh!: () => void;
  state.rpc.mockImplementation(async (proc: string, body?: { connectionId?: string }) => {
    if (proc === "inbox/list") {
      const home = body?.connectionId === "c2";
      return inboxList({
        accounts: twoAccounts,
        rows: [mailRow(home ? "home" : "all")],
      });
    }
    if (proc === "inbox/refresh") {
      await new Promise<void>((resolve) => {
        releaseRefresh = resolve;
      });
      return { ok: true };
    }
    return { enabled: true, todos: [] };
  });
  await render();
  expect(container.textContent).toContain("Subject all");
  await act(async () => button("Home")?.click());
  expect(container.textContent).toContain("Subject home");
  await act(async () => releaseRefresh());
  expect(container.textContent).toContain("Subject home");
  expect(container.textContent).not.toContain("Subject all");
});

it("falls back to All when the chosen account can no longer be loaded", async () => {
  state.rpc.mockImplementation(async (proc: string, body?: { connectionId?: string }) => {
    if (proc === "inbox/list") {
      if (body?.connectionId === "c2") throw new Error("Gone");
      return inboxList({
        accounts: [
          { connectionId: "c1", label: "Work" },
          { connectionId: "c2", label: "Home" },
        ],
        rows: [mailRow("all")],
      });
    }
    if (proc === "inbox/refresh") return { ok: true };
    return { enabled: true, todos: [] };
  });
  await render();
  await act(async () => button("Home")?.click());
  const lists = state.rpc.mock.calls.filter(([proc]) => proc === "inbox/list");
  expect(lists.at(-2)?.[1]).toEqual({ connectionId: "c2", pile: "important" });
  expect(lists.at(-1)?.[1]).toEqual({ pile: "important" });
  expect(container.textContent).toContain("Subject all");
});

it("does not refetch when triage is not pending", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  await render();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60_000);
  });
  expect(procs().filter((proc) => proc === "inbox/list")).toHaveLength(2);
});

it("opens a mail row in the message screen", async () => {
  listReply = () => inboxList({ rows: [mailRow("r1")] });
  await render();
  const row = [...container.querySelectorAll("button")].find((item) =>
    item.textContent?.includes("Subject r1"),
  );
  await act(async () => row?.click());
  expect(state.push).toHaveBeenCalledWith({
    pathname: "/inbox-message",
    params: { messageId: "r1" },
  });
});

it("flags suspicious, spam and scam mail with a named warning and never hides it", async () => {
  listReply = () =>
    inboxList({
      rows: [
        mailRow("r1", { category: "scam" }),
        mailRow("r2", { category: "spam" }),
        mailRow("r3", { category: "suspicious" }),
        mailRow("r4", { category: "billing" }),
        mailRow("r5"),
      ],
    });
  await render();
  const text = container.textContent ?? "";
  for (const id of ["r1", "r2", "r3", "r4", "r5"]) expect(text).toContain(`Subject ${id}`);
  expect(container.querySelectorAll('[data-label="Suspicious"]')).toHaveLength(3);
});

it("shows one triage label per row, and none on an untriaged row", async () => {
  listReply = () =>
    inboxList({
      rows: [
        mailRow("r1", { needsReply: true, priority: "important", category: "reply" }),
        mailRow("r2", { category: "newsletter" }),
        mailRow("r3", { category: "spam" }),
        mailRow("r4", { category: "bulk" }),
        mailRow("r5", { category: "scam" }),
        mailRow("r6"),
        mailRow("r7", { category: "billing" }),
      ],
    });
  await render();
  const rowText = (id: string) =>
    [...container.querySelectorAll("button")]
      .find((item) => item.textContent?.includes(`Subject ${id}`))
      ?.textContent?.replace(`Sender ${id}`, "")
      .replace(`Subject ${id}`, "")
      .replace(`Snippet ${id}`, "");
  expect(rowText("r1")).toContain("Needs attention");
  expect(rowText("r2")).toContain("Newsletter");
  expect(rowText("r3")).toContain("Spam");
  expect(rowText("r4")).toContain("Junk");
  expect(rowText("r5")).toContain("Junk");
  expect(rowText("r6")).not.toMatch(/Needs attention|Newsletter|Spam|Junk/);
  expect(rowText("r7")).not.toMatch(/Needs attention|Newsletter|Spam|Junk/);
});

describe("piles", () => {
  const sender = (id: string, address = `${id}@shop.example`) => ({
    from: `Shop ${id}`,
    fromAddress: address,
  });
  const piles = () => container.querySelector('[data-testid="piles"]');
  const pileList = (pile: string | undefined, rows: ReturnType<typeof mailRow>[]) =>
    inboxList({ rows, pileCounts: { important: 1, updates: 4, newsletters: 0, spam: 0 }, pile });
  const updates = [
    mailRow("a1", {
      ...sender("a", "shop@example.test"),
      pile: "updates",
      reason: "Order shipped",
      receivedAt: daysAgo(0.1),
    }),
    mailRow("a2", {
      ...sender("a", "shop@example.test"),
      pile: "updates",
      receivedAt: daysAgo(0.2),
    }),
    mailRow("a3", {
      ...sender("a", "shop@example.test"),
      pile: "updates",
      receivedAt: daysAgo(0.3),
    }),
    mailRow("b1", { ...sender("b"), pile: "updates", receivedAt: daysAgo(0.4) }),
  ];
  const alertButtons = () =>
    (state.alert.mock.calls.at(-1)?.[2] ?? []) as { text: string; onPress?: () => void }[];

  it("asks for the Important pile first and offers the three piles", async () => {
    await render();
    expect(state.rpc).toHaveBeenCalledWith("inbox/list", { pile: "important" });
    expect(piles()?.textContent).toBe("ImportantUpdatesNewsletters");
  });

  it("offers Spam behind its count, only when there is spam", async () => {
    listReply = () =>
      inboxList({ pileCounts: { important: 0, updates: 0, newsletters: 0, spam: 3 } });
    await render();
    expect(piles()?.textContent).toBe("ImportantUpdatesNewslettersSpam 3");
  });

  it("shows no pile picker before an account is connected", async () => {
    listReply = () => inboxList({ accounts: [], agent: null });
    await render();
    expect(piles()).toBeNull();
  });

  it("switches to Updates, asks for that pile, and groups the rows by sender", async () => {
    listReply = () => pileList("important", [mailRow("r1")]);
    await render();
    listReply = () => pileList("updates", updates);
    await act(async () => button("Updates")?.click());
    expect(state.rpc).toHaveBeenCalledWith("inbox/list", { pile: "updates" });
    const text = container.textContent ?? "";
    // One header for the three-message sender, and the single-message sender as a plain row.
    expect(text).toContain("Shop a");
    expect(text).toContain("3");
    expect(text).toContain("Order shipped");
    expect(text).toContain("Shop b");
    expect(text).not.toContain("Subject a2");
    expect(text).not.toContain("Needs reply");
  });

  it("does not show the previous pile's rows while the next pile loads", async () => {
    listReply = () => pileList("important", [mailRow("r1")]);
    await render();
    expect(container.textContent).toContain("Subject r1");
    state.rpc.mockImplementation(async (proc: string) => {
      if (proc === "inbox/list") return new Promise(() => {});
      return { enabled: true, todos: [] };
    });
    await act(async () => button("Newsletters")?.click());
    expect(container.textContent).not.toContain("Subject r1");
  });

  it("opens a group on tap to list its messages, and closes it on a second tap", async () => {
    listReply = () => pileList("important", [mailRow("r1")]);
    await render();
    listReply = () => pileList("updates", updates);
    await act(async () => button("Updates")?.click());
    const header = () =>
      [...container.querySelectorAll("button")].find((item) =>
        item.textContent?.includes("Shop a"),
      );
    expect(header()?.getAttribute("aria-expanded") ?? "").not.toBe("true");
    await act(async () => header()?.click());
    expect(container.textContent).toContain("Subject a2");
    expect(container.textContent).toContain("Subject a3");
    await act(async () => header()?.click());
    expect(container.textContent).not.toContain("Subject a2");
  });

  it("asks before archiving a group, then archives all of its threads in one call", async () => {
    listReply = () => pileList("important", [mailRow("r1")]);
    await render();
    listReply = () => pileList("updates", updates);
    await act(async () => button("Updates")?.click());
    const menu = container.querySelectorAll<HTMLElement>('button[data-menu="archive"]')[0];
    await act(async () => menu?.click());
    expect(state.alert).toHaveBeenCalledTimes(1);
    expect(state.alert.mock.calls[0]?.[0]).toBe("Archive 3 conversations from Shop a?");
    expect(procs()).not.toContain("inbox/archiveMany");
    expect(alertButtons().map((b) => b.text)).toEqual(["Cancel", "Archive"]);
    await act(async () => alertButtons()[1]?.onPress?.());
    expect(state.rpc).toHaveBeenCalledWith("inbox/archiveMany", {
      messageIds: ["a1", "a2", "a3"],
    });
    expect(container.textContent).not.toContain("Shop a");
    expect(container.textContent).toContain("Shop b");
  });

  it("archives one message from its menu at once", async () => {
    listReply = () => pileList("important", [mailRow("r1"), mailRow("r2")]);
    await render();
    await act(async () =>
      container.querySelectorAll<HTMLElement>('button[data-menu="archive"]')[0]?.click(),
    );
    expect(state.alert).not.toHaveBeenCalled();
    expect(state.rpc).toHaveBeenCalledWith("inbox/archiveMany", { messageIds: ["r1"] });
    expect(container.textContent).not.toContain("Subject r1");
    expect(container.textContent).toContain("Subject r2");
  });

  it("brings failed threads back with the real list and says how many failed", async () => {
    listReply = () => pileList("important", [mailRow("r1"), mailRow("r2")]);
    archiveReply = () => ({ done: ["r1"], failed: [{ messageId: "r2", reason: "unavailable" }] });
    await render();
    const lists = procs().filter((proc) => proc === "inbox/list").length;
    await act(async () =>
      container.querySelectorAll<HTMLElement>('button[data-menu="archive"]')[1]?.click(),
    );
    expect(state.alert).toHaveBeenCalledWith("Could not archive 1");
    expect(procs().filter((proc) => proc === "inbox/list").length).toBeGreaterThan(lists);
    expect(container.textContent).toContain("Subject r2");
  });

  it("shows the error and reloads when the archive call fails", async () => {
    listReply = () => pileList("important", [mailRow("r1")]);
    archiveReply = () => {
      throw new Error("Offline");
    };
    await render();
    await act(async () =>
      container.querySelectorAll<HTMLElement>('button[data-menu="archive"]')[0]?.click(),
    );
    expect(state.alert).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Subject r1");
  });

  it("archives spam only from the Spam pile, where it passes allowSpam", async () => {
    const spam = [
      mailRow("s1", { pile: "spam", ...sender("s") }),
      mailRow("s2", { pile: "spam", inInbox: false, ...sender("t") }),
    ];
    listReply = () =>
      inboxList({ rows: spam, pileCounts: { important: 0, updates: 0, newsletters: 0, spam: 2 } });
    await render();
    await act(async () => button("Spam 2")?.click());
    expect(state.rpc).toHaveBeenCalledWith("inbox/list", { pile: "spam" });
    // A Spam row that left the inbox cannot be archived; the other can.
    const menus = container.querySelectorAll<HTMLElement>('button[data-menu="archive"]');
    await act(async () => menus[1]?.click());
    expect(procs()).not.toContain("inbox/archiveMany");
    await act(async () => menus[0]?.click());
    expect(state.rpc).toHaveBeenCalledWith("inbox/archiveMany", {
      messageIds: ["s1"],
      allowSpam: true,
    });
  });

  it("never sends a spam-pile row from another pile", async () => {
    listReply = () => pileList("important", [mailRow("p1", { pile: "spam" })]);
    await render();
    await act(async () =>
      container.querySelectorAll<HTMLElement>('button[data-menu="archive"]')[0]?.click(),
    );
    expect(procs()).not.toContain("inbox/archiveMany");
  });

  it("shows the summary under the subject in place of the snippet", async () => {
    listReply = () => pileList("important", [mailRow("r1", { reason: "Invoice due Friday" })]);
    await render();
    expect(container.textContent).toContain("Invoice due Friday");
    expect(container.textContent).not.toContain("Snippet r1");
  });

  it("fetches to-dos only in the Important pile", async () => {
    await render();
    expect(procs()).toContain("inbox/todos/list");
    state.rpc.mockClear();
    listReply = () => pileList("updates", updates);
    await act(async () => button("Updates")?.click());
    expect(procs()).not.toContain("inbox/todos/list");
  });
});

describe("spam and trash from the row menu", () => {
  const menuButton = (name: string) =>
    container.querySelector<HTMLButtonElement>(`button[data-menu="${name}"]`);

  it("offers Spam and Trash on an inbox row, reports spam at once, and reloads for the counts", async () => {
    listReply = () => inboxList({ rows: [mailRow("r1")] });
    await render();
    expect(menuButton("notSpam")).toBeNull();
    state.rpc.mockClear();
    listReply = () => inboxList({ rows: [] });
    await act(async () => menuButton("spam")?.click());
    expect(state.rpc).toHaveBeenCalledWith("inbox/moveMany", { op: "spam", messageIds: ["r1"] });
    expect(container.textContent).not.toContain("Subject r1");
    expect(procs()).toContain("inbox/list");
  });

  it("moves a row to trash", async () => {
    listReply = () => inboxList({ rows: [mailRow("r1")] });
    await render();
    await act(async () => menuButton("trash")?.click());
    expect(state.rpc).toHaveBeenCalledWith("inbox/moveMany", { op: "trash", messageIds: ["r1"] });
  });

  it("offers Not spam, not Spam, in the Spam pile and sends notSpam", async () => {
    listReply = () => inboxList({ rows: [mailRow("g1", { pile: "spam", inInbox: false })] });
    await render();
    await act(async () => button("Spam")?.click());
    listReply = () => inboxList({ rows: [mailRow("g1", { pile: "spam", inInbox: false })] });
    await act(async () => root.render(<InboxScreen key="spam" />));
    expect(menuButton("spam")).toBeNull();
    await act(async () => menuButton("notSpam")?.click());
    expect(state.rpc).toHaveBeenCalledWith("inbox/moveMany", {
      op: "notSpam",
      messageIds: ["g1"],
    });
  });

  it("brings the list back and says how many failed", async () => {
    listReply = () => inboxList({ rows: [mailRow("r1")] });
    moveReply = (body) => ({
      done: [],
      failed: body.messageIds.map((messageId) => ({ messageId, reason: "unavailable" })),
      batchId: "batch-1",
    });
    await render();
    await act(async () => menuButton("trash")?.click());
    expect(state.alert).toHaveBeenCalledWith("Could not move 1");
    expect(container.textContent).toContain("Subject r1");
  });
});
