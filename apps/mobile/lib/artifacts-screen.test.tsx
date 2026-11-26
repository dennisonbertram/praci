// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rpc: vi.fn(),
  list: vi.fn(),
  options: vi.fn(),
  alert: vi.fn(),
  focus: undefined as (() => undefined | (() => void)) | undefined,
  apiBase: "https://api.example.test",
  selection: 0,
  session: 0,
  apiListeners: new Set<() => void>(),
  selectionListeners: new Set<() => void>(),
  sessionListeners: new Set<() => void>(),
}));
vi.mock("expo-router", () => ({
  useFocusEffect: (callback: () => undefined | (() => void)) => {
    const { useEffect } = require("react") as typeof import("react");
    state.focus = callback;
    useEffect(() => callback(), [callback]);
  },
  useNavigation: () => ({ setOptions: state.options }),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("../lib/api", () => ({
  rpc: state.rpc,
  subscribeApiBase: (listener: () => void) => {
    state.apiListeners.add(listener);
    return () => state.apiListeners.delete(listener);
  },
  currentApiBase: () => state.apiBase,
  subscribeSpaceSelection: (listener: () => void) => {
    state.selectionListeners.add(listener);
    return () => state.selectionListeners.delete(listener);
  },
  currentSpaceSelectionGeneration: () => state.selection,
}));
vi.mock("../lib/session", () => ({
  subscribeSessionGeneration: (listener: () => void) => {
    state.sessionListeners.add(listener);
    return () => state.sessionListeners.delete(listener);
  },
  currentSessionGeneration: () => state.session,
}));
vi.mock("../lib/artifacts", () => ({
  listSpaceArtifacts: state.list,
  removeArtifact: vi.fn(),
}));
vi.mock("../lib/appearance", () => ({
  mobileTokens: () => ({
    primary: "black",
    primaryForeground: "white",
    destructive: "red",
  }),
}));
vi.mock("../lib/native", () => ({
  native: {
    page: "white",
    label: "black",
    secondaryLabel: "gray",
    fill: "#eee",
  },
  useThemedStyles: (factory: () => unknown) => factory(),
}));
vi.mock("../lib/i18n", () => {
  const t = (s: string) => s;
  return { t, useI18n: () => ({ t }) };
});
vi.mock("../lib/activity", () => ({ formatActivityRelativeTime: () => "now" }));
vi.mock("../components/bot-avatar", () => ({ BotAvatar: () => null }));
vi.mock("../components/native-symbol", () => ({ NativeSymbol: () => null }));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0 }),
}));
vi.mock("react-native", () => {
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Pressable = ({
    children,
    onPress,
    accessibilityState,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    accessibilityState?: { selected?: boolean };
  }) => (
    <button type="button" data-selected={accessibilityState?.selected} onClick={onPress}>
      {children}
    </button>
  );
  return {
    ActivityIndicator: () => <span>Loading</span>,
    Alert: { alert: state.alert },
    FlatList: ({
      data,
      renderItem,
      ListHeaderComponent,
      ListEmptyComponent,
      ListFooterComponent,
      refreshControl,
      onEndReached,
    }: {
      data: { id: string }[];
      renderItem: (info: { item: never }) => ReactNode;
      ListHeaderComponent?: ReactNode;
      ListEmptyComponent?: ReactNode;
      ListFooterComponent?: ReactNode;
      refreshControl?: ReactNode;
      onEndReached?: () => void;
    }) => (
      <div>
        {ListHeaderComponent}
        {refreshControl}
        {data.map((item) => (
          <div key={item.id}>{renderItem({ item: item as never })}</div>
        ))}
        {data.length ? null : ListEmptyComponent}
        {ListFooterComponent}
        <button type="button" onClick={onEndReached}>
          Next
        </button>
      </div>
    ),
    Pressable,
    RefreshControl: ({ onRefresh }: { onRefresh: () => void }) => (
      <button type="button" onClick={onRefresh}>
        Refresh
      </button>
    ),
    ScrollView: Box,
    StyleSheet: { create: (x: unknown) => x, hairlineWidth: 1 },
    Text: Box,
    View: Box,
  };
});

import ArtifactsScreen from "../app/artifacts";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

const page = (items: object[], nextCursor: string | null = null) => ({
  items,
  nextCursor,
});
const row = (id: string, name: string) => ({
  id,
  name,
  description: "",
  mimeType: "text/plain",
  version: 1,
  versionCount: 1,
  botId: null,
  groupId: null,
  createdAt: new Date().toISOString(),
});
let root: Root;
let host: HTMLDivElement;
const render = async () =>
  act(async () => {
    root.render(<ArtifactsScreen />);
    await Promise.resolve();
  });
const flush = async () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

beforeEach(() => {
  vi.useFakeTimers();
  state.rpc.mockReset().mockResolvedValue([]);
  state.list.mockReset();
  state.options.mockReset();
  state.alert.mockReset();
  state.apiBase = "https://api.example.test";
  state.selection = 0;
  state.session = 0;
  state.apiListeners.clear();
  state.selectionListeners.clear();
  state.sessionListeners.clear();
  state.focus = undefined;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe("artifact list screen", () => {
  it.each(["space selection", "session generation", "api base"])(
    "discards the pending response and reloads after a %s change",
    async (change) => {
      let resolveA!: (value: ReturnType<typeof page>) => void;
      let resolveB!: (value: ReturnType<typeof page>) => void;
      state.rpc
        .mockResolvedValueOnce([{ id: "bot-a", name: "Bot A", color: "blue" }])
        .mockResolvedValue([{ id: "bot-b", name: "Bot B", color: "green" }]);
      state.list.mockResolvedValue(page([row("initial", "Initial row")]));
      await render();
      await flush();
      const botA = [...host.querySelectorAll("button")].find(
        (button) => button.textContent === "Bot A",
      )!;
      act(() => botA.click());
      await flush();
      expect(botA.dataset.selected).toBe("true");

      state.list
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveA = resolve;
            }),
        )
        .mockImplementation((input: { botId?: string }) => {
          if (input.botId) return Promise.resolve(page([]));
          return new Promise((resolve) => {
            resolveB = resolve;
          });
        });
      const refresh = [...host.querySelectorAll("button")].find(
        (button) => button.textContent === "Refresh",
      )!;
      act(() => refresh.click());
      expect(state.list).toHaveBeenCalledTimes(3);

      act(() => {
        if (change === "space selection") state.selection += 1;
        else if (change === "session generation") state.session += 1;
        else state.apiBase = "https://new-api.example.test";
        const listeners =
          change === "space selection"
            ? state.selectionListeners
            : change === "session generation"
              ? state.sessionListeners
              : state.apiListeners;
        listeners.forEach((listener) => {
          listener();
        });
      });
      await flush();
      expect(state.list).toHaveBeenCalledTimes(5);
      expect(state.rpc).toHaveBeenCalledTimes(2);

      await act(async () => {
        resolveA(page([row("a", "Space A row")]));
        await Promise.resolve();
      });
      expect(host.textContent).not.toContain("Space A row");

      await act(async () => {
        resolveB(page([row("b", "Space B row")]));
        await Promise.resolve();
      });
      expect(host.textContent).toContain("Space B row");
      const allBots = [...host.querySelectorAll("button")].find(
        (button) => button.textContent === "All bots",
      );
      expect(allBots?.dataset.selected).toBe("true");
      expect(host.textContent).toContain("Bot B");
    },
  );

  it("alerts on a failed pull refresh and keeps the current rows", async () => {
    state.list.mockResolvedValueOnce(page([row("one", "Visible row")]));
    await render();
    await flush();
    state.list.mockRejectedValueOnce(new Error("offline"));
    const refresh = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "Refresh",
    )!;
    await act(async () => {
      refresh.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(state.alert).toHaveBeenCalledTimes(1);
    expect(state.alert).toHaveBeenCalledWith("Could not load artifacts.", "offline");
    expect(host.textContent).toContain("Visible row");
  });

  it("keeps a failed focus refresh silent", async () => {
    state.list.mockResolvedValueOnce(page([row("one", "Visible row")]));
    await render();
    await flush();
    state.list.mockRejectedValueOnce(new Error("offline"));
    await act(async () => {
      state.focus?.();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(state.list).toHaveBeenCalledTimes(2);
    expect(state.alert).not.toHaveBeenCalled();
    expect(host.textContent).toContain("Visible row");
  });

  it("sends the settled query and ignores an older query response", async () => {
    let resolveOld!: (value: ReturnType<typeof page>) => void;
    state.list.mockImplementation((input: { q?: string }) =>
      input.q === "old"
        ? new Promise((resolve) => {
            resolveOld = resolve;
          })
        : Promise.resolve(page([row("new", "New match")])),
    );
    await render();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
      await Promise.resolve();
    });
    const onChangeText = state.options.mock.calls.at(-1)?.[0]?.headerSearchBarOptions
      ?.onChangeText as (event: { nativeEvent: { text: string } }) => void;
    act(() => {
      onChangeText({ nativeEvent: { text: "old" } });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(state.list).toHaveBeenLastCalledWith(expect.objectContaining({ q: "old" }));
    act(() => {
      onChangeText({ nativeEvent: { text: "new" } });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    await flush();
    await act(async () => {
      resolveOld(page([row("old", "Old match")]));
      await Promise.resolve();
    });
    expect(host.textContent).toContain("New match");
    expect(host.textContent).not.toContain("Old match");
  });

  it("shows Try again after an initial failure", async () => {
    state.list.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(page([]));
    await render();
    await flush();
    expect(host.textContent).toContain("Try again.");
    const retry = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "Try again.",
    )!;
    await act(async () => {
      retry.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(state.list).toHaveBeenCalledTimes(2);
  });

  it("keeps rows visible and offers a retry after next page fails", async () => {
    state.list.mockResolvedValueOnce(page([row("one", "Visible row")], "cursor-1"));
    state.list.mockRejectedValueOnce(new Error("offline"));
    await render();
    await flush();
    const next = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "Next",
    )!;
    await act(async () => {
      next.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(host.textContent).toContain("Visible row");
    expect(host.textContent).toContain("Try again.");
    const retry = [...host.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Try again."),
    )!;
    state.list.mockResolvedValueOnce(page([row("two", "Next row")]));
    await act(async () => {
      retry.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(state.list).toHaveBeenCalledTimes(3);
    expect(host.textContent).toContain("Visible row");
    expect(host.textContent).toContain("Next row");
  });
});
