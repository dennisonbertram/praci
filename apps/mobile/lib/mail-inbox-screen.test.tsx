// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act, useEffect } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
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
vi.mock("./appearance", () => ({
  mobileTokens: () => ({ destructive: "red", warning: "amber", card: "white", primary: "black" }),
}));
vi.mock("./native", () => ({
  native: {},
  useThemedStyles: (factory: () => unknown) => factory(),
}));
vi.mock("./i18n", () => {
  // The real t is one module-level function; a fresh one per render would retrigger focus effects.
  const t = (text: string) => text;
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
    options,
    onChange,
  }: {
    options: { value: string; label: string }[];
    onChange: (value: string) => void;
  }) => (
    <div data-testid="segments">
      {options.map((option) => (
        <button key={option.value} type="button" onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
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
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  listReply = () => inboxList();
  todosReply = () => ({ enabled: true, todos: [] });
  setDoneReply = () => Promise.resolve({});
  state.push.mockReset();
  state.setOptions.mockReset();
  state.alert.mockReset();
  state.rpc.mockReset().mockImplementation(async (proc: string) => {
    if (proc === "inbox/list") return listReply();
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
        unstable_headerRightItems?: () => { accessibilityLabel: string; onPress: () => void }[];
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
  expect(state.rpc).toHaveBeenCalledWith("inbox/list", { connectionId: "c2" });
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
  expect(lists.at(-2)?.[1]).toEqual({ connectionId: "c2" });
  expect(lists.at(-1)?.[1]).toEqual({});
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
  expect(rowText("r1")).toContain("Needs reply");
  expect(rowText("r2")).toContain("Newsletter");
  expect(rowText("r3")).toContain("Spam");
  expect(rowText("r4")).toContain("Junk");
  expect(rowText("r5")).toContain("Junk");
  expect(rowText("r6")).not.toMatch(/Needs reply|Newsletter|Spam|Junk/);
  expect(rowText("r7")).not.toMatch(/Needs reply|Newsletter|Spam|Junk/);
});
