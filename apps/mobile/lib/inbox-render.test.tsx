// @vitest-environment jsdom

import type { ReactElement } from "react";
import { act, cloneElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { type InboxItem, useInboxRenderItem } from "../components/inbox-render-item";
import { BotRow } from "../components/inbox-rows";
import type { MobileBot } from "./api";
import { formatThreadTime } from "./inbox";
import { retainInboxValue } from "./inbox-retention";
import { useInboxDay } from "./use-inbox-day";

const state = vi.hoisted(() => ({
  avatarRenders: 0,
  show: "time" as "time" | "label",
  focused: true,
  onAppStateChange: undefined as undefined | ((state: string) => void),
  removeListener: undefined as undefined | (() => void),
}));

vi.mock("expo-router", async () => {
  const { useEffect } = await import("react");
  return {
    useFocusEffect: (effect: () => (() => void) | undefined) => {
      useEffect(() => (state.focused ? effect() : undefined), [effect, state.focused]);
    },
  };
});
vi.mock("react-native", () => ({
  AppState: {
    addEventListener: (_event: string, listener: (appState: string) => void) => {
      state.onAppStateChange = listener;
      return {
        remove: () => {
          state.onAppStateChange = undefined;
        },
      };
    },
  },
  Pressable: () => null,
  Text: () => null,
  View: () => null,
  StyleSheet: { create: (styles: unknown) => styles },
}));
vi.mock("./i18n", () => ({
  useI18n: () => ({ t: (text: string) => text }),
  dateLocaleForUi: () => "en-US",
}));
vi.mock("./native", () => ({ useThemedStyles: () => ({}), native: {} }));
vi.mock("./appearance", () => ({ mobileTokens: () => ({}) }));
vi.mock("./bot-avatar", () => ({
  mobileBotAvatarPresentation: () => {
    state.avatarRenders++;
    return { kind: "color", color: "gray" };
  },
}));
vi.mock("./api", () => ({}));
vi.mock("@expo/ui/community/menu", () => ({ MenuView: () => null }));
vi.mock("../components/native-symbol", () => ({ NativeSymbol: () => null }));
vi.mock("../components/WorkingIndicator", () => ({ WorkingIndicator: () => null }));
vi.mock("../components/group-avatar", () => ({ GroupAvatar: () => null }));
vi.mock("../components/bot-avatar", () => ({
  BotAvatar: ({ muted }: { muted: boolean }) => (muted ? " muted" : null),
}));
vi.mock("../components/inbox-styles", () => ({ createHomeStyles: () => ({}) }));
vi.mock("../components/conversation-row", () => ({
  ConversationRow: ({
    time,
    tag,
    preview,
    accessibilityLabel,
    avatar,
  }: {
    time: string;
    tag: string;
    preview: string;
    accessibilityLabel: string;
    avatar: ReactElement;
  }) => (
    <span>
      {state.show === "time" ? time : [tag, preview, accessibilityLabel].join("|")}
      {state.show === "label" ? avatar : null}
    </span>
  ),
}));

const noop = () => undefined;
const collapsed = new Set<string>();
const noStyles = {};
/** Renders items through the production renderer with the same stable inputs the screen gives it. */
function useRows(items: InboxItem[], day: number, seen?: unknown[]) {
  const renderItem = useInboxRenderItem({
    appearance: "light",
    chooseInboxSpace: noop,
    collapsedRosterParents: collapsed,
    confirmDeleteSpace: noop,
    day,
    meSpaceId: "space-1",
    openBot: noop,
    openGroup: noop,
    openSearchHit: noop,
    organizeBot: noop,
    organizeGroup: noop,
    spaceBusy: false,
    spaceRecoveryId: null,
    styles: noStyles,
    t: identity,
    toggleRosterParent: noop,
  });
  seen?.push(renderItem);
  return items.map((item, index) => cloneElement(renderItem({ item }), { key: index }));
}
const identity = (text: string) => text;

const bot = (index: number) =>
  ({
    id: `bot-${index}`,
    name: `Helper ${index}`,
    spaceId: "space-1",
    preview: "",
    title: "",
    color: "gray",
    status: "idle",
    notifyOnFinish: true,
    unread: false,
  }) as MobileBot;

it("skips unchanged inbox rows for 12 idle polls and renders only the changed bot", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const identities: unknown[] = [];
  const List = ({ bots }: { bots: MobileBot[] }) => (
    <>
      {useRows(
        bots.map((item) => ({ type: "bot", bot: item, depth: 0, hasChildren: false }) as InboxItem),
        0,
        identities,
      )}
    </>
  );
  let bots = Array.from({ length: 30 }, (_, index) => bot(index));
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    state.avatarRenders = 0;
    act(() => root.render(<List bots={bots} />));
    expect(state.avatarRenders).toBe(30);
    for (let poll = 0; poll < 12; poll++) {
      // A poll returns fresh JSON; retainInboxValue keeps the previous objects when nothing changed.
      bots = retainInboxValue(bots, structuredClone(bots));
      act(() => root.render(<List bots={bots} />));
    }
    expect(state.avatarRenders).toBe(30);
    // The renderer keeps one identity, so the list never re-renders rows on its account.
    expect(new Set(identities).size).toBe(1);
    const fetched = structuredClone(bots);
    fetched[0]!.status = "running";
    fetched[0]!.unread = true;
    bots = retainInboxValue(bots, fetched);
    act(() => root.render(<List bots={bots} />));
    expect(state.avatarRenders).toBe(31);
  } finally {
    act(() => root.unmount());
    vi.unstubAllGlobals();
  }
});

it.each(["midnight", "focus", "foreground"])(
  "refreshes unchanged bot and group timestamps on %s",
  (trigger) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 10, 23, 59));
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    state.show = "time";
    state.focused = true;
    const today = new Date(2026, 9, 10, 12, 30).toISOString();
    const sixDaysAgo = new Date(2026, 9, 4, 12, 30).toISOString();
    // Keep the response and every row object identical throughout the date change.
    const items = [today, sixDaysAgo].flatMap((updatedAt) => [
      { type: "bot", bot: { id: updatedAt, name: "Helper", preview: "", updatedAt }, depth: 0 },
      {
        type: "group",
        group: { id: updatedAt, name: "Team", preview: "", members: [], updatedAt },
      },
    ]) as InboxItem[];
    function List() {
      return <>{useRows(items, useInboxDay())}</>;
    }
    const container = document.createElement("div");
    const root = createRoot(container);
    const labels = () => Array.from(container.querySelectorAll("span"), (span) => span.textContent);
    try {
      act(() => root.render(<List />));
      const weekday = formatThreadTime(sixDaysAgo);
      expect(labels()).toEqual(["12:30", "12:30", weekday, weekday]);
      if (trigger === "focus") {
        state.focused = false;
        act(() => root.render(<List />));
        expect(state.onAppStateChange).toBeUndefined();
        expect(vi.getTimerCount()).toBe(0);
      }
      if (trigger === "midnight") {
        act(() => vi.advanceTimersByTime(60_000));
      } else {
        // Suspended native timers need not fire before the app returns.
        vi.setSystemTime(new Date(2026, 9, 11, 8));
        act(() => {
          if (trigger === "foreground") state.onAppStateChange?.("active");
          else {
            state.focused = true;
            root.render(<List />);
          }
        });
      }
      expect(labels()).toEqual([
        formatThreadTime(today),
        formatThreadTime(today),
        formatThreadTime(sixDaysAgo),
        formatThreadTime(sixDaysAgo),
      ]);
      expect(labels()[0]).not.toBe("12:30");
      expect(labels()[2]).not.toBe(weekday);
      expect(vi.getTimerCount()).toBe(1);
    } finally {
      act(() => root.unmount());
      expect(state.onAppStateChange).toBeUndefined();
      expect(vi.getTimerCount()).toBe(0);
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  },
);

it("renders saved bot rows without a title or notification setting", () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.show = "label";
  // Inboxes saved before titles and notification settings were kept have bots without them.
  const bots = [
    { id: "bot-a", name: "Alpha", title: "Research", preview: "", notifyOnFinish: true },
    { id: "bot-b", name: "Beta", preview: "" },
    { id: "bot-c", name: "Gamma", title: "", preview: "", notifyOnFinish: false },
  ] as MobileBot[];
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    act(() =>
      root.render(
        bots.map((item) => <BotRow key={item.id} bot={item} day={0} onPress={() => undefined} />),
      ),
    );
    expect(Array.from(container.querySelectorAll("span"), (span) => span.textContent)).toEqual([
      "Research|Research|Alpha, Research, Research",
      "|No messages yet|Beta, No messages yet",
      "|No messages yet|Gamma, notifications silenced, No messages yet muted",
    ]);
  } finally {
    act(() => root.unmount());
    vi.unstubAllGlobals();
  }
});
