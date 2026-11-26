// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act, useEffect } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  navigationOptions: vi.fn(),
  rpc: vi.fn(),
  search: vi.fn(),
  loadToken: vi.fn(),
  loadActivityMode: vi.fn(),
  selectInboxSpace: vi.fn(),
  chooseSpace: undefined as undefined | ((id: string) => void),
  menuActions: [] as { id: string }[],
  menuActionHistory: [] as { id: string }[][],
  rpcSettled: [] as Promise<unknown>[],
  iosAtLeastValue: false,
  selectedSpace: "space-a",
  appState: "background",
  focusEffects: [] as (() => undefined | (() => void))[],
  t: (value: string) => value,
}));

vi.mock("expo-router", () => ({
  Redirect: () => null,
  useFocusEffect: (callback: () => undefined | (() => void)) => {
    state.focusEffects.push(callback);
    useEffect(callback, [callback]);
  },
  useNavigation: () => ({ setOptions: state.navigationOptions }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@expo/ui/community/menu", () => ({
  MenuView: ({ children, actions }: { children: ReactNode; actions: { id: string }[] }) => {
    state.menuActions = actions;
    state.menuActionHistory.push(actions);
    return children;
  },
}));
vi.mock("../lib/api", () => ({
  currentApiBase: () => "api",
  loadSessionToken: state.loadToken,
  currentSpaceSelectionGeneration: () => 1,
  rpc: (...args: unknown[]) => {
    const pending = state.rpc(...args);
    state.rpcSettled.push(pending);
    return pending;
  },
  selectedSpaceId: () => state.selectedSpace,
  selectInitialSpace: async () => true,
}));
vi.mock("../lib/appearance", () => ({
  mobileTokens: () => ({
    foreground: "black",
    mutedForeground: "gray",
    primary: "black",
    primaryForeground: "white",
    muted: "gray",
  }),
  resolveMobileAppearance: () => "light",
}));
vi.mock("../lib/company", () => ({ mobileCompanyAvailable: () => false }));
vi.mock("../lib/native", () => ({
  native: { secondaryLabel: "gray" },
  useThemedStyles: (factory: () => unknown) => factory(),
}));
vi.mock("../lib/native-controls", () => ({ iosAtLeast: () => state.iosAtLeastValue }));
vi.mock("../lib/i18n", () => ({ t: state.t, useI18n: () => ({ t: state.t, locale: "en" }) }));
vi.mock("../lib/activity", () => ({
  fetchSpaceActivity: vi.fn(),
  activityStatusLabel: vi.fn(),
  formatActivityRelativeTime: vi.fn(),
}));
vi.mock("../lib/activity-mode", () => ({
  loadActivityMode: state.loadActivityMode,
  saveActivityMode: vi.fn(),
}));
vi.mock("../lib/agent-page", () => ({
  sidebarBotPages: (value: { pages?: { pageId: string; botId: string; title: string }[] }) =>
    value.pages ?? [],
}));
vi.mock("../lib/inbox", () => ({ filterBots: (bots: unknown[]) => bots, userInitials: () => "A" }));
vi.mock("../lib/inbox-retention", () => ({
  retainInboxValue: (_current: unknown, next: unknown) => next,
}));
vi.mock("../lib/inbox-spaces", () => ({
  canDeleteInboxSpace: () => false,
  inboxNeedsCreateHint: () => false,
  removeInboxSpace: vi.fn(),
  renameInboxSpace: vi.fn(),
  retryInboxSpaceFallback: vi.fn(),
  selectInboxSpace: state.selectInboxSpace,
  spaceInboxItems: (spaces: { bots?: { id: string; name: string }[] }[]) =>
    spaces.flatMap((space) => space.bots ?? []).map((bot) => ({ type: "bot", bot, id: bot.id })),
}));
vi.mock("../lib/live-notifications", () => ({
  dismissThreadNotifications: vi.fn(),
  resumeLiveNotifications: vi.fn(),
}));
vi.mock("../lib/push", () => ({ registerPushToken: async () => undefined }));
vi.mock("../lib/saved-chats", () => ({ loadSavedInbox: async () => null, saveInbox: vi.fn() }));
vi.mock("../lib/search", () => ({ querySpaceSearch: state.search }));
vi.mock("../lib/search-destination", () => ({ mobileSearchDestination: vi.fn() }));
vi.mock("../lib/search-list", () => ({
  dedupeSearchHits: (hits: unknown[]) => hits,
  searchHitListKey: () => "hit",
  searchHitRowPreview: () => "",
}));
vi.mock("../lib/session", () => ({
  currentSessionGeneration: () => 1,
  currentReadySessionGeneration: () => 1,
  subscribeSessionGeneration: () => () => {},
}));
vi.mock("../lib/timezone", () => ({ reportTimezone: async () => undefined }));
vi.mock("../lib/unseen-notifications", () => ({
  refreshUnseenCounts: vi.fn(),
  useUnseenCount: () => 0,
}));
vi.mock("../lib/use-inbox-day", () => ({ useInboxDay: () => new Date() }));
vi.mock("../lib/user-error", () => ({ errorText: () => "Could not continue" }));
vi.mock("../components/bot-avatar", () => ({ BotAvatar: () => null }));
vi.mock("../components/bot-organize-modal", () => ({ BotOrganizeModal: () => null }));
vi.mock("../components/conversation-row", () => ({ ConversationRow: () => null }));
vi.mock("../components/inbox-render-item", () => ({
  useInboxRenderItem: (options: { chooseInboxSpace: (id: string) => void }) => {
    state.chooseSpace = options.chooseInboxSpace;
    return ({
      item,
    }: {
      item: { type: string; hit?: { title?: string }; bot?: { name?: string } };
    }) =>
      item.type === "search" ? (
        <span>{item.hit?.title}</span>
      ) : item.type === "bot" ? (
        <span>{item.bot?.name}</span>
      ) : null;
  },
}));
vi.mock("../components/inbox-rows", () => ({
  BotRow: ({ bot }: { bot: { name: string } }) => <span>{bot.name}</span>,
  FALLBACK_COLOR: "gray",
  GroupRow: () => null,
}));
vi.mock("../components/inbox-styles", () => ({
  createHomeStyles: () => new Proxy({}, { get: () => ({}) }),
}));
vi.mock("../components/native-action-button", () => ({
  NativeActionButton: ({ label, onPress }: { label: string; onPress?: () => void }) => (
    <button type="button" onClick={onPress}>
      {label}
    </button>
  ),
}));
vi.mock("../components/native-symbol", () => ({ NativeSymbol: () => null }));
vi.mock("../components/settings-group", () => ({
  SettingsRow: ({ title, onPress }: { title: string; onPress?: () => void }) => (
    <button type="button" onClick={onPress}>
      {title}
    </button>
  ),
}));
vi.mock("react-native-keyboard-controller", () => ({
  KeyboardController: { dismiss: async () => {} },
}));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
vi.mock("react-native", () => {
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    ActivityIndicator: () => <i />,
    Alert: { alert: vi.fn(), prompt: vi.fn() },
    AppState: {
      get currentState() {
        return state.appState;
      },
    },
    FlatList: ({
      data,
      renderItem,
      ListHeaderComponent,
      ListEmptyComponent,
    }: {
      data: { type: string; hit?: { title?: string } }[];
      renderItem: (arg: { item: never }) => ReactNode;
      ListHeaderComponent?: ReactNode;
      ListEmptyComponent?: ReactNode;
    }) => (
      <div>
        {ListHeaderComponent}
        {data.map((item, index) => (
          <div key={index}>{renderItem({ item: item as never })}</div>
        ))}
        {data.length ? null : ListEmptyComponent}
        <button type="button" onClick={() => state.chooseSpace?.("space-b")}>
          Switch space
        </button>
      </div>
    ),
    Platform: { OS: "android" },
    Pressable: ({ children, onPress }: { children?: ReactNode; onPress?: () => void }) => (
      <button type="button" onClick={onPress}>
        {children}
      </button>
    ),
    RefreshControl: () => null,
    StyleSheet: { create: (value: unknown) => value },
    Text: Box,
    TextInput: ({ onChangeText }: { onChangeText?: (value: string) => void }) => (
      <input aria-label="Search" onChange={(event) => onChangeText?.(event.target.value)} />
    ),
    View: Box,
  };
});
vi.mock("@rakazo/contracts", () => ({
  GROUP_MEMBER_MIN: 2,
  normalizeCreateBotProfile: (value: unknown) => value,
}));

import HomeSession from "../app/index";
import { fetchSpaceActivity } from "../lib/activity";

let root: Root;
let host: HTMLDivElement;
const flush = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
const render = async () => {
  await act(async () => root.render(<HomeSession />));
  await flush();
};

const renderUntilMenu = async () => {
  await render();
  await act(async () => {
    await state.chooseSpace?.("space-a");
  });
  await act(async () => {
    await Promise.allSettled(state.rpcSettled);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(state.rpc).toHaveBeenCalledWith("spaces/list");
};

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.navigationOptions.mockReset();
  state.menuActions = [];
  state.menuActionHistory = [];
  state.rpcSettled = [];
  state.selectedSpace = "space-a";
  state.appState = "background";
  state.focusEffects = [];
  state.iosAtLeastValue = false;
  state.rpc.mockReset().mockImplementation(async (procedure: string) => {
    if (procedure === "sidebarPages/list") return { pages: [] };
    if (procedure === "spaces/list")
      return { spaces: [], current: { id: "space-a", bots: [], groups: [], botSections: [] } };
    if (procedure === "me") return { userId: "user", spaceId: "space-a", name: "A" };
    return [];
  });
  state.search.mockReset();
  state.loadToken.mockResolvedValue("token");
  state.loadActivityMode.mockResolvedValue(false);
  state.selectInboxSpace.mockImplementation(async (id: string, refresh: () => Promise<void>) => {
    state.selectedSpace = id;
    await refresh();
    return true;
  });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe("mobile home screen", () => {
  it("pauses activity polling while the app is backgrounded", async () => {
    vi.useFakeTimers();
    state.loadActivityMode.mockResolvedValue(true);
    vi.mocked(fetchSpaceActivity).mockReset().mockResolvedValue({ active: [], recent: [] });

    await render();
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(fetchSpaceActivity).not.toHaveBeenCalled();

    state.appState = "active";
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_000);
    });
    expect(fetchSpaceActivity).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("hides group creation when the live inbox has one bot", async () => {
    state.iosAtLeastValue = false;
    state.rpc.mockImplementation(async (procedure: string) => {
      if (procedure === "sidebarPages/list") return { pages: [] };
      if (procedure === "spaces/list")
        return {
          spaces: [],
          current: {
            id: "space-a",
            bots: [{ id: "bot-a", name: "A" }],
            groups: [],
            botSections: [],
          },
        };
      if (procedure === "me") return { userId: "user", spaceId: "space-a", name: "A" };
      return [];
    });
    await renderUntilMenu();
    expect(state.menuActionHistory.at(-1)?.map(({ id }) => id)).toEqual(["bot", "space"]);
  });

  it("shows group creation when the live inbox has two bots", async () => {
    state.iosAtLeastValue = false;
    state.rpc.mockImplementation(async (procedure: string) => {
      if (procedure === "sidebarPages/list") return { pages: [] };
      if (procedure === "spaces/list")
        return {
          spaces: [],
          current: {
            id: "space-a",
            bots: [
              { id: "bot-a", name: "A" },
              { id: "bot-b", name: "B" },
            ],
            groups: [],
            botSections: [],
          },
        };
      if (procedure === "me") return { userId: "user", spaceId: "space-a", name: "A" };
      return [];
    });
    await renderUntilMenu();
    expect(state.menuActionHistory.at(-1)?.map(({ id }) => id)).toContain("group");
  });

  it("keeps group creation available when live loading fails and nothing is saved", async () => {
    state.iosAtLeastValue = false;
    state.rpc.mockImplementation(async (procedure: string) => {
      if (procedure === "sidebarPages/list") return { pages: [] };
      if (procedure === "spaces/list") throw new Error("offline");
      if (procedure === "me") return { userId: "user", spaceId: "space-a", name: "A" };
      return [];
    });
    await renderUntilMenu();
    expect(state.menuActionHistory.at(-1)?.map(({ id }) => id)).toContain("group");
  });

  it("clears previous search hits as soon as the query changes", async () => {
    vi.useFakeTimers();
    state.iosAtLeastValue = true;
    state.search.mockResolvedValue([{ title: "Old hit" }]);
    await render();
    const options = state.navigationOptions.mock.calls.at(-1)?.[0];
    act(() => options.headerSearchBarOptions.onFocus());
    act(() => options.headerSearchBarOptions.onChangeText({ nativeEvent: { text: "old" } }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
      await Promise.resolve();
    });
    expect(host.textContent).toContain("Old hit");
    act(() => options.headerSearchBarOptions.onChangeText({ nativeEvent: { text: "new" } }));
    expect(host.textContent).not.toContain("Old hit");
    vi.useRealTimers();
  });

  it("shows a retry after search failure and retries the current query", async () => {
    vi.useFakeTimers();
    state.iosAtLeastValue = true;
    state.search
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue([{ title: "Recovered hit" }]);
    await render();
    const options = state.navigationOptions.mock.calls.at(-1)?.[0];
    act(() => options.headerSearchBarOptions.onFocus());
    act(() => options.headerSearchBarOptions.onChangeText({ nativeEvent: { text: "current" } }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(host.textContent).toContain("Could not search");
    expect(host.textContent).not.toContain("No results");
    const retry = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "Try again",
    );
    expect(retry).toBeTruthy();
    await act(async () => {
      retry?.click();
      await vi.advanceTimersByTimeAsync(200);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(host.textContent).toContain("Recovered hit");
    vi.useRealTimers();
  });

  it("replaces pinned pages after switching spaces and ignores late pages from the old space", async () => {
    let resolveOld!: (value: unknown) => void;
    let currentSpace = "space-a";
    state.rpc.mockImplementation(async (procedure: string) => {
      if (procedure === "sidebarPages/list") {
        return currentSpace === "space-a"
          ? new Promise((resolve) => {
              resolveOld = resolve;
            })
          : { pages: [{ pageId: "b", botId: "bot-b", title: "Space B page" }] };
      }
      if (procedure === "spaces/list")
        return { spaces: [], current: { id: currentSpace, bots: [], groups: [], botSections: [] } };
      if (procedure === "me") return { userId: "user", spaceId: currentSpace, name: "A" };
      return [];
    });
    state.selectInboxSpace.mockImplementation(async (id: string, refresh: () => Promise<void>) => {
      currentSpace = id;
      state.selectedSpace = id;
      await refresh();
      return true;
    });
    await render();
    await act(async () => {
      await state.chooseSpace?.("space-a");
      await Promise.resolve();
    });
    await act(async () => {
      resolveOld({ pages: [{ pageId: "a", botId: "bot-a", title: "Space A page" }] });
      await Promise.resolve();
    });
    expect(host.textContent).toContain("Space A page");
    const switchButton = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "Switch space",
    );
    await act(async () => {
      switchButton?.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(host.textContent).not.toContain("Space A page");
    expect(host.textContent).toContain("Space B page");
    await act(async () => {
      resolveOld({ pages: [{ pageId: "a", botId: "bot-a", title: "Late old page" }] });
      await Promise.resolve();
    });
    expect(host.textContent).not.toContain("Late old page");
  });

  it("drops a late inbox response from the old space and reloads the selected space on focus", async () => {
    let resolveSpaceA!: (value: unknown) => void;
    let spacesCalls = 0;
    state.appState = "active";
    state.rpc.mockImplementation(async (procedure: string) => {
      if (procedure === "sidebarPages/list") return { pages: [] };
      if (procedure === "spaces/list") {
        spacesCalls += 1;
        if (spacesCalls === 1) {
          return new Promise((resolve) => {
            resolveSpaceA = resolve;
          });
        }
        return {
          spaces: [],
          current: {
            id: "space-b",
            bots: [{ id: "bot-b", name: "Space B bot" }],
            groups: [],
            botSections: [],
          },
        };
      }
      if (procedure === "me") return { userId: "user", spaceId: state.selectedSpace, name: "A" };
      return [];
    });

    await render();
    expect(state.rpc).toHaveBeenCalledWith("spaces/list");
    state.selectedSpace = "space-b";
    await act(async () => {
      resolveSpaceA({
        spaces: [],
        current: {
          id: "space-a",
          bots: [{ id: "bot-a", name: "Stale Space A bot" }],
          groups: [],
          botSections: [],
        },
      });
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(host.textContent).not.toContain("Stale Space A bot");

    let stopFocus: undefined | (() => void);
    await act(async () => {
      stopFocus = state.focusEffects.at(-2)?.();
      await Promise.allSettled(state.rpcSettled);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(host.textContent).toContain("Space B bot");
    if (typeof stopFocus === "function") stopFocus();
  });
});
