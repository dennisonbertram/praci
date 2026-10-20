// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act, useEffect } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import InboxCleanupScreen from "../app/inbox-cleanup";

const state = vi.hoisted(() => ({
  rpc: vi.fn(),
  setOptions: vi.fn(),
  alert: vi.fn(),
  openURL: vi.fn(),
}));
vi.mock("expo-router", () => ({
  useFocusEffect: (callback: () => undefined | (() => void)) => {
    useEffect(() => callback(), [callback]);
  },
  useNavigation: () => ({ setOptions: state.setOptions }),
}));
vi.mock("@expo/ui/community/menu", () => ({ MenuView: () => null }));
vi.mock("./api", () => ({ rpc: state.rpc }));
vi.mock("./appearance", () => ({
  mobileTokens: () => ({
    destructive: "red",
    warning: "amber",
    foreground: "black",
    card: "white",
    primary: "black",
  }),
}));
vi.mock("./native", () => ({
  native: {},
  useThemedStyles: (factory: () => unknown) => factory(),
  useResolvedAppearance: () => "light",
}));
vi.mock("./native-controls", () => ({ iosAtLeast: () => true }));
vi.mock("./i18n", () => {
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
vi.mock("react-native", () => ({
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  ActivityIndicator: () => <div data-testid="spinner" />,
  Pressable: ({
    children,
    onPress,
    accessibilityLabel,
    accessibilityRole,
    accessibilityState,
    disabled,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    accessibilityLabel?: string;
    accessibilityRole?: string;
    accessibilityState?: { checked?: boolean };
    disabled?: boolean;
  }) =>
    accessibilityRole === "checkbox" ? (
      <label>
        <input
          type="checkbox"
          checked={accessibilityState?.checked ?? false}
          aria-label={accessibilityLabel}
          disabled={disabled}
          onChange={onPress}
        />
        {children}
      </label>
    ) : (
      <button type="button" aria-label={accessibilityLabel} disabled={disabled} onClick={onPress}>
        {children}
      </button>
    ),
  FlatList: ({
    data,
    renderItem,
    ListEmptyComponent,
    ListFooterComponent,
  }: {
    data: unknown[];
    renderItem: (info: { item: unknown }) => ReactNode;
    ListEmptyComponent?: ReactNode;
    ListFooterComponent?: ReactNode;
  }) => (
    <div>
      {data.length === 0 ? ListEmptyComponent : null}
      {data.map((item, index) => (
        <div key={index}>{renderItem({ item })}</div>
      ))}
      {ListFooterComponent}
    </div>
  ),
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  Platform: { OS: "ios", Version: "26.0" },
  Alert: { alert: state.alert },
  Linking: { openURL: state.openURL },
}));

type Sender = Record<string, unknown>;
const sender = (address: string, patch: Sender = {}): Sender => ({
  connectionId: "c1",
  address,
  name: address.split("@")[0],
  messageCount: 10,
  readCount: 0,
  lastReceivedAt: new Date().toISOString(),
  inboxThreads: 4,
  preselected: true,
  spamLike: false,
  unsubscribe: "link",
  skipInbox: false,
  unsubscribeStatus: null,
  ...patch,
});
const news = sender("news@lists.example.test");
const deals = sender("deals@shop.example.test", { inboxThreads: 6 });
const friend = sender("friend@example.test", { preselected: false, inboxThreads: 2 });

let root: Root;
let container: HTMLDivElement;
let listReply: () => unknown;
let historyReply: () => unknown;
let archiveReply: (body: Record<string, unknown>) => unknown;
let unsubscribeReply: (body: Record<string, unknown>) => unknown;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  listReply = () => ({
    accounts: [{ connectionId: "c1", label: "Me" }],
    senders: [news, deals, friend],
    syncedAt: null,
  });
  historyReply = () => ({ actions: [] });
  archiveReply = () => ({ batchId: "batch-1", done: 4, failed: 0, remaining: 0 });
  unsubscribeReply = () => ({ status: "done", method: "one_click" });
  state.setOptions.mockReset();
  state.alert.mockReset();
  state.openURL.mockReset();
  state.rpc.mockReset().mockImplementation(async (proc: string, body?: unknown) => {
    if (proc === "inbox/cleanup/list") return listReply();
    if (proc === "inbox/actions/list") return historyReply();
    if (proc === "inbox/cleanup/archive") return archiveReply(body as Record<string, unknown>);
    if (proc === "inbox/unsubscribe") return unsubscribeReply(body as Record<string, unknown>);
    if (proc === "inbox/actions/undo") return { restored: 4, failed: 0 };
    if (proc === "inbox/cleanup/forget") return { ok: true };
    throw new Error(`unexpected rpc ${proc}`);
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
const render = () => act(async () => root.render(<InboxCleanupScreen />));
const procs = () => state.rpc.mock.calls.map(([proc]) => proc as string);
const boxes = () => [...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')];
const checks = () => boxes().map((el) => String(el.checked));
type Item = { label: string; disabled?: boolean; onPress: () => void };
const menuItems = (): Item[] => {
  const options = state.setOptions.mock.calls.at(-1)?.[0] as {
    unstable_headerRightItems?: () => { menu: { items: Item[] } }[];
  };
  return options.unstable_headerRightItems?.()[0]?.menu.items ?? [];
};
const choose = async (label: string) => {
  await act(async () =>
    menuItems()
      .find((item) => item.label === label)
      ?.onPress(),
  );
  // The native alert confirms; press its action button.
  const [, , buttons] = state.alert.mock.calls.at(-1) as [
    string,
    unknown,
    { text: string; onPress?: () => void }[],
  ];
  await act(async () => buttons.find((b) => b.text === label)?.onPress?.());
};

describe("cleanup screen", () => {
  it("ticks the preselected senders and shows the counts in the native menu", async () => {
    await render();
    expect(checks()).toEqual(["true", "true", "false"]);
    expect(menuItems().map((item) => item.label)).toEqual([
      "Archive 10",
      "Unsubscribe 10",
      "Skip inbox 10",
      "Spam 10",
    ]);
  });

  it("asks to confirm, then archives the ticked senders", async () => {
    await render();
    await choose("Archive 10");
    expect(state.rpc).toHaveBeenCalledWith("inbox/cleanup/archive", {
      kind: "archive",
      connectionId: "c1",
      address: "news@lists.example.test",
    });
    expect(procs().filter((p) => p === "inbox/cleanup/archive")).toHaveLength(2);
  });

  it("changes the counts when a sender is unticked and disables an empty choice", async () => {
    await render();
    await act(async () => boxes()[0]?.click());
    expect(menuItems()[0]?.label).toBe("Archive 6");
    await act(async () => boxes()[1]?.click());
    expect(menuItems().every((item) => item.disabled)).toBe(true);
  });

  it("does nothing when a choice with no conversations is picked", async () => {
    await render();
    await act(async () => boxes()[0]?.click());
    await act(async () => boxes()[1]?.click());
    state.alert.mockClear();
    await act(async () => menuItems()[0]?.onPress());
    expect(state.alert).not.toHaveBeenCalled();
  });

  it("unsubscribes first, shows the link of an opened one to tap, and archives", async () => {
    listReply = () => ({
      accounts: [{ connectionId: "c1", label: "Me" }],
      senders: [news],
      syncedAt: null,
    });
    unsubscribeReply = () => ({
      status: "opened",
      method: "link",
      openUrl: "https://lists.example.test/u",
    });
    await render();
    await choose("Unsubscribe 4");
    expect(procs()).toContain("inbox/unsubscribe");
    expect(procs()).toContain("inbox/cleanup/archive");
    const open = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("Open link"),
    );
    await act(async () => open?.click());
    expect(state.openURL).toHaveBeenCalledWith("https://lists.example.test/u");
  });

  it("asks before sending an unsubscribe email and sends only after Send", async () => {
    listReply = () => ({
      accounts: [{ connectionId: "c1", label: "Me" }],
      senders: [news],
      syncedAt: null,
    });
    unsubscribeReply = (body) =>
      body.confirmMailto
        ? { status: "sent", method: "mailto" }
        : { status: "needs_confirmation", method: "mailto", mailTo: "unsub@lists.example.test" };
    await render();
    await choose("Unsubscribe 4");
    const [title, , buttons] = state.alert.mock.calls.at(-1) as [
      string,
      unknown,
      { text: string; onPress?: () => void }[],
    ];
    expect(title).toBe("Send an unsubscribe email to unsub@lists.example.test?");
    expect(state.rpc).not.toHaveBeenCalledWith("inbox/cleanup/archive", expect.anything());
    await act(async () => buttons.find((b) => b.text === "Send")?.onPress?.());
    expect(state.rpc).toHaveBeenCalledWith(
      "inbox/unsubscribe",
      expect.objectContaining({ confirmMailto: true }),
    );
    expect(procs()).toContain("inbox/cleanup/archive");
  });

  it("names a sender whose update failed", async () => {
    archiveReply = () => ({ batchId: "b", done: 0, failed: 4, remaining: 4 });
    listReply = () => ({
      accounts: [{ connectionId: "c1", label: "Me" }],
      senders: [news],
      syncedAt: null,
    });
    await render();
    await choose("Archive 4");
    expect(container.textContent).toContain("Could not update news");
  });

  it("flags spam-like senders and leaves them out of Skip inbox and Unsubscribe", async () => {
    const spam = sender("win@promo.example.test", {
      spamLike: true,
      preselected: false,
      unsubscribe: "refused",
    });
    listReply = () => ({
      accounts: [{ connectionId: "c1", label: "Me" }],
      senders: [spam, news],
      syncedAt: null,
    });
    await render();
    expect(container.textContent).toContain("Looks like spam");
    await act(async () => boxes()[0]?.click());
    expect(menuItems().map((item) => item.label)).toEqual([
      "Archive 8",
      "Unsubscribe 4",
      "Skip inbox 4",
      "Spam 8",
    ]);
  });

  it("shows Skipping with Stop, which forgets the decision", async () => {
    const skipping = sender("news@lists.example.test", { skipInbox: true, preselected: false });
    listReply = () => ({
      accounts: [{ connectionId: "c1", label: "Me" }],
      senders: [skipping],
      syncedAt: null,
    });
    await render();
    expect(container.textContent).toContain("Skipping");
    const stop = [...container.querySelectorAll("button")].find((b) => b.textContent === "Stop");
    await act(async () => stop?.click());
    expect(state.rpc).toHaveBeenCalledWith("inbox/cleanup/forget", {
      connectionId: "c1",
      address: "news@lists.example.test",
    });
  });

  it("lists the history and undoes an action after a confirm", async () => {
    historyReply = () => ({
      actions: [
        {
          batchId: "old-1",
          kind: "archive",
          source: "user",
          createdAt: new Date().toISOString(),
          undone: false,
          threadCount: 7,
          senders: ["news@lists.example.test"],
          senderCount: 1,
        },
      ],
    });
    await render();
    expect(container.textContent).toContain("History");
    expect(container.textContent).toContain("Archive · 7 · news@lists.example.test");
    const row = [...container.querySelectorAll("button")].find((b) =>
      b.textContent?.startsWith("Archive · 7"),
    );
    await act(async () => row?.click());
    const [, , buttons] = state.alert.mock.calls.at(-1) as [
      string,
      unknown,
      { text: string; onPress?: () => void }[],
    ];
    await act(async () => buttons.find((b) => b.text === "Undo")?.onPress?.());
    expect(state.rpc).toHaveBeenCalledWith("inbox/actions/undo", { batchId: "old-1" });
  });

  it("says there is nothing to clean up, and offers no menu", async () => {
    listReply = () => ({
      accounts: [{ connectionId: "c1", label: "Me" }],
      senders: [],
      syncedAt: null,
    });
    await render();
    expect(container.textContent).toContain("Nothing to clean up");
    expect(menuItems()).toEqual([]);
  });

  it("shows the load error with Retry, which loads again", async () => {
    listReply = () => {
      throw new Error("offline");
    };
    await render();
    expect(container.textContent).toContain("offline");
    listReply = () => ({
      accounts: [{ connectionId: "c1", label: "Me" }],
      senders: [news],
      syncedAt: null,
    });
    const retry = [...container.querySelectorAll("button")].find((b) => b.textContent === "Retry");
    await act(async () => retry?.click());
    expect(checks()).toEqual(["true"]);
  });
});
