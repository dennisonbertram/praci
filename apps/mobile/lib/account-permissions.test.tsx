// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act, createElement, useEffect } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { Alert } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Account from "../app/(settings)/account";

const state = vi.hoisted(() => ({
  rpc: vi.fn(),
  permissions: { level: null as string | null, effectiveDefault: "ask_changes" },
  permissionFailures: new Set<string>(),
  approvalRules: [] as Record<string, unknown>[],
  saved: undefined as { level?: unknown } | undefined,
  focusEffects: new Set<() => (() => void) | undefined>(),
}));

vi.mock("expo-router", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: (effect: () => (() => void) | undefined) =>
    useEffect(() => {
      state.focusEffects.add(effect);
      const cleanup = effect();
      return () => {
        state.focusEffects.delete(effect);
        cleanup?.();
      };
    }, [effect]),
}));
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));
vi.mock("react-native", () => {
  const box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    View: ({
      children,
      accessibilityRole,
      accessibilityLabel,
      accessibilityValue,
    }: Record<string, unknown>) =>
      createElement(
        "div",
        {
          role: accessibilityRole as string,
          "aria-label": accessibilityLabel as string,
          "aria-valuetext": (accessibilityValue as { text?: string } | undefined)?.text,
        },
        children as ReactNode,
      ),
    ScrollView: box,
    KeyboardAvoidingView: box,
    Modal: box,
    ActivityIndicator: () => <i data-testid="spinner" />,
    Text: ({ children, accessibilityRole }: Record<string, unknown>) => (
      <span role={accessibilityRole as string}>{children as ReactNode}</span>
    ),
    TextInput: () => <input />,
    Pressable: ({
      children,
      onPress,
      disabled,
      accessibilityLabel,
    }: {
      children?: ReactNode;
      onPress?: () => void;
      disabled?: boolean;
      accessibilityLabel?: string;
    }) => (
      <button type="button" disabled={disabled} aria-label={accessibilityLabel} onClick={onPress}>
        {children}
      </button>
    ),
    StyleSheet: { create: (styles: unknown) => styles, absoluteFill: {} },
    Platform: { OS: "ios" },
    Alert: { alert: vi.fn(), prompt: vi.fn() },
  };
});
vi.mock("@expo/ui/community/menu", () => ({
  MenuView: ({
    children,
    actions,
    onPressAction,
    title,
  }: {
    children?: ReactNode;
    actions: { id: string; title: string; state?: string }[];
    onPressAction: (event: { nativeEvent: { event: string } }) => void;
    title: string;
  }) =>
    createElement(
      "section",
      { "data-menu": title },
      children,
      ...actions.map((action) =>
        createElement(
          "button",
          {
            type: "button",
            key: action.id,
            "data-state": action.state,
            onClick: () => onPressAction({ nativeEvent: { event: action.id } }),
          },
          action.title,
        ),
      ),
    ),
}));
vi.mock("../components/app-mark", () => ({ AppMark: () => null }));
vi.mock("../components/avatar-style", () => ({
  useAvatarStyle: () => ({ avatarStyle: "organic", updateAvatarStyle: vi.fn() }),
}));
vi.mock("../components/bot-avatar", () => ({ BotAvatar: () => null }));
vi.mock("../components/data-export-row", () => ({ DataExportRow: () => null }));
vi.mock("../components/native-symbol", () => ({ NativeSymbol: () => null }));
vi.mock("../components/native-segmented-control", () => ({ NativeSegmentedControl: () => null }));
vi.mock("../components/native-action-button", () => ({
  NativeActionButton: ({
    label,
    onPress,
    disabled,
  }: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" disabled={disabled} onClick={onPress}>
      {label}
    </button>
  ),
}));
vi.mock("../components/settings-group", () => ({
  useStackedSettings: () => false,
  SettingsLabel: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  SettingsGroup: ({
    children,
    footer,
    label,
  }: {
    children?: ReactNode;
    footer?: string;
    label?: string;
  }) => (
    <section>
      {label ? <span>{label}</span> : null}
      {children}
      {footer ? <p>{footer}</p> : null}
    </section>
  ),
  SettingsSwitch: ({ label }: { label: string }) => <button type="button">{label}</button>,
  SettingsRow: ({
    title,
    detail,
    value,
    onPress,
    disabled,
  }: {
    title: string;
    detail?: string;
    value?: string;
    onPress?: () => void;
    disabled?: boolean;
  }) =>
    onPress ? (
      <button type="button" disabled={disabled} onClick={onPress}>
        {title}
        {detail ? ` ${detail}` : ""}
        {value ? ` ${value}` : ""}
      </button>
    ) : (
      <div>
        {title}
        {detail ? ` ${detail}` : ""}
        {value ? ` ${value}` : ""}
      </div>
    ),
}));
vi.mock("./api", () => ({
  currentApiBase: () => "https://api.test",
  deleteAccount: vi.fn(),
  fetchAccountSecurity: async () => ({ hasPassword: true }),
  loadSessionToken: async () => "token",
  requestAccountDeletionCode: vi.fn(),
  rpc: state.rpc,
  selectedSpaceId: () => null,
  signOut: vi.fn(),
}));
vi.mock("./app-version", () => ({
  formatUpdateLabel: () => "",
  getAppVersionInfo: () => ({ nativeLabel: "", update: null }),
}));
vi.mock("./appearance", () => ({
  getCachedAppearancePreference: () => "system",
  mobileTokens: () => ({ destructive: "red" }),
  setAppearancePreference: vi.fn(),
}));
vi.mock("./auth-routing", () => ({ replaceWithSignIn: vi.fn() }));
vi.mock("./i18n", () => {
  const t = (text: string, values?: Record<string, string | number>) =>
    text.replace(/\{(\w+)\}/g, (match, key: string) => String(values?.[key] ?? match));
  return { t, useI18n: () => ({ t, locale: "en" }), setUiLocale: vi.fn() };
});
vi.mock("./live-notifications", () => ({
  canPostPromotedNotifications: vi.fn(),
  DEFAULT_LIVE_NOTIFICATION_SETTINGS: {},
  getLiveNotificationSettings: vi.fn(),
  openLiveNotificationSettings: vi.fn(),
  openPromotedNotificationSettings: vi.fn(),
  setLiveNotificationSettings: vi.fn(),
}));
vi.mock("./message-action-sheet", () => ({ presentMessageActionSheet: vi.fn() }));
vi.mock("./native", () => ({
  native: {},
  useResolvedAppearance: () => "light",
  useThemedStyles: (factory: () => unknown) => factory(),
}));
vi.mock("./push", () => ({ registerPushToken: vi.fn() }));
vi.mock("./hide-amounts", () => ({
  useHideAmounts: () => false,
  setHideAmounts: vi.fn(),
}));
vi.mock("./remote-images-preference", () => ({
  getCachedRemoteImagesEnabled: () => false,
  setRemoteImagesPreference: vi.fn(),
  subscribeRemoteImages: () => () => undefined,
}));
vi.mock("./response-streaming", () => ({
  getCachedResponseStreamingEnabled: () => false,
  setResponseStreamingPreference: vi.fn(),
  subscribeResponseStreaming: () => () => undefined,
}));
vi.mock("./sso", () => ({ continueWithSso: vi.fn() }));
vi.mock("./user-error", () => ({
  errorText: (error: unknown, fallback: string) =>
    error instanceof Error ? error.message : fallback,
}));

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  state.permissionFailures.clear();
  state.permissions = { level: null, effectiveDefault: "ask_changes" };
  state.approvalRules = [];
  state.focusEffects.clear();
  vi.mocked(Alert.alert).mockClear();
  state.saved = undefined;
  state.rpc.mockReset().mockImplementation(async (proc: string, input?: unknown) => {
    if (proc === "me") return { email: "me@example.test", name: "Me" };
    if (proc === "usage/summary") return { runs: 1, totalTokens: 2 };
    if (proc === "notifications/preferences") return { hasPhone: true, channels: { push: true } };
    if (proc === "permissions/get") {
      if (state.permissionFailures.has(proc)) throw new Error("Could not load permissions.");
      return { ...state.permissions };
    }
    if (proc === "permissions/set") {
      if (state.permissionFailures.has(proc)) throw new Error("Could not save permissions");
      state.saved = input as { level?: unknown };
      state.permissions = {
        ...state.permissions,
        level: (state.saved?.level ?? null) as string | null,
      };
      return { ...state.permissions };
    }
    if (proc === "approvalRules/list") {
      if (state.permissionFailures.has(proc)) throw new Error("Could not load saved rules");
      return state.approvalRules;
    }
    if (proc === "approvalRules/remove") {
      if (state.permissionFailures.has(proc)) throw new Error("Could not remove saved rule");
      const { id } = input as { id: string };
      state.approvalRules = state.approvalRules.filter((rule) => rule.id !== id);
      return { ok: true };
    }
    return [];
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = () => act(async () => root.render(<Account />));
const permissionMenu = () => container.querySelector('[data-menu="Permissions"]');
const menuButtons = () => [...(permissionMenu()?.querySelectorAll("button") ?? [])];
const pressChoice = (title: string) =>
  act(async () => {
    menuButtons()
      .find((button) => button.textContent === title)!
      .click();
  });
const sets = () => state.rpc.mock.calls.filter((call) => call[0] === "permissions/set");
const gets = () => state.rpc.mock.calls.filter((call) => call[0] === "permissions/get");
const refocus = () =>
  act(async () => {
    for (const effect of state.focusEffects) effect();
  });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("space permissions picker", () => {
  it("offers the deployment default and marks it current while inheriting", async () => {
    await render();
    const titles = menuButtons().map((button) => button.textContent);
    expect(titles).toEqual([
      "Default (Ask for changes)",
      "Open",
      "Ask for changes",
      "Ask for everything",
    ]);
    expect(menuButtons().map((button) => button.getAttribute("data-state"))).toEqual([
      "on",
      "off",
      "off",
      "off",
    ]);
  });

  it("saves a chosen level and marks it current", async () => {
    await render();
    await pressChoice("Ask for everything");
    expect(sets()).toEqual([["permissions/set", { level: "ask_everything" }]]);
    expect(menuButtons().map((button) => button.getAttribute("data-state"))).toEqual([
      "off",
      "off",
      "off",
      "on",
    ]);
  });

  it("does not let a focus refresh overwrite a permission save", async () => {
    await render();
    const staleRead = deferred<{ level: string | null; effectiveDefault: string }>();
    const saved = deferred<{ level: string | null; effectiveDefault: string }>();
    state.rpc.mockImplementation(async (proc: string, input?: unknown) => {
      if (proc === "permissions/get") return staleRead.promise;
      if (proc === "permissions/set") {
        state.saved = input as { level?: unknown };
        return saved.promise;
      }
      return [];
    });

    await pressChoice("Ask for everything");
    await refocus();
    saved.resolve({ level: "ask_everything", effectiveDefault: "ask_changes" });
    await act(async () => {});
    staleRead.resolve({ level: null, effectiveDefault: "ask_changes" });
    await act(async () => {});

    expect(menuButtons().map((button) => button.getAttribute("data-state"))).toEqual([
      "off",
      "off",
      "off",
      "on",
    ]);
  });

  it("sends null for the default, restoring inheritance", async () => {
    state.permissions = { level: "ask_everything", effectiveDefault: "ask_changes" };
    await render();
    await pressChoice("Default (Ask for changes)");
    expect(sets()).toEqual([["permissions/set", { level: null }]]);
    expect(menuButtons().map((button) => button.getAttribute("data-state"))).toEqual([
      "on",
      "off",
      "off",
      "off",
    ]);
  });

  it("shows the saved level, not the default, when one is set", async () => {
    state.permissions = { level: "ask_changes", effectiveDefault: "open" };
    await render();
    expect(menuButtons().map((button) => button.getAttribute("data-state"))).toEqual([
      "off",
      "off",
      "on",
      "off",
    ]);
  });

  it("keeps the stored level and reports the error when a save fails", async () => {
    state.permissions = { level: "ask_everything", effectiveDefault: "ask_changes" };
    await render();
    state.permissionFailures.add("permissions/set");
    await pressChoice("Open");
    expect(sets()).toEqual([["permissions/set", { level: "open" }]]);
    expect(menuButtons().map((button) => button.getAttribute("data-state"))).toEqual([
      "off",
      "off",
      "off",
      "on",
    ]);
    expect(container.textContent).toContain("Could not save permissions");
    state.permissionFailures.delete("permissions/set");
    await pressChoice("Open");
    expect(menuButtons().map((button) => button.getAttribute("data-state"))).toEqual([
      "off",
      "on",
      "off",
      "off",
    ]);
    expect(container.textContent).not.toContain("Could not save permissions");
  });

  it("recovers a failed load from the row's retry", async () => {
    state.permissionFailures.add("permissions/get");
    await render();
    expect(permissionMenu()).toBeNull();
    expect(container.textContent).toContain("Could not load permissions.");
    state.permissionFailures.delete("permissions/get");
    const retries = [...container.querySelectorAll("button")].filter(
      (button) => button.textContent === "Try again",
    );
    await act(async () => retries[0]!.click());
    expect(gets().length).toBeGreaterThanOrEqual(2);
    expect(permissionMenu()).not.toBeNull();
  });

  it("shows the open-level caveat only while the effective level is open", async () => {
    await render();
    expect(container.textContent).not.toContain(
      "Sending to new people, payments, permanent deletes and access requests always ask.",
    );
    await pressChoice("Open");
    expect(container.textContent).toContain(
      "Sending to new people, payments, permanent deletes and access requests always ask.",
    );
  });
});

describe("saved approval rules", () => {
  const savedAllow = {
    id: "rule-1",
    effect: "always_allow",
    matchKind: "tool",
    matchValue: "mail_send",
    createdAt: "2026-11-25T00:00:00.000Z",
  };
  const openSavedRules = () =>
    act(async () => {
      [...container.querySelectorAll("button")]
        .find((button) => button.textContent === "Saved rules")
        ?.click();
    });

  it("shows saved choices and removes a rule after native confirmation", async () => {
    state.approvalRules = [
      savedAllow,
      {
        ...savedAllow,
        id: "rule-ask",
        effect: "require_approval",
        matchValue: "calendar_update",
      },
      {
        ...savedAllow,
        id: "rule-block",
        effect: "block",
        matchValue: "delete_data",
      },
      {
        ...savedAllow,
        id: "rule-agent-site",
        matchValue: "web_fetch",
        botId: "bot-1",
        botName: "Browser",
      },
      {
        ...savedAllow,
        id: "rule-routine",
        effect: "require_approval",
        matchValue: "calendar_update",
        routineId: "routine-1",
        routineName: "Daily sync",
      },
    ];
    await render();
    expect(container.textContent).toContain("Saved rules");
    expect(container.textContent).not.toContain("mail_send");
    expect(state.rpc).not.toHaveBeenCalledWith("approvalRules/list");
    await openSavedRules();
    expect(container.textContent).toContain("Mail send");
    expect(container.textContent).not.toContain("mail_send");
    expect(container.textContent).toContain("Allow · Tool · In this space");
    expect(container.textContent).toContain("Ask · Tool · In this space");
    expect(container.textContent).toContain("Block · Tool · In this space");
    expect(container.textContent).toContain("Allow · Fetches any site · Agent: Browser");
    expect(container.textContent).toContain("Ask · Tool · Routine: Daily sync");
    expect(container.textContent).toContain("Delete data");

    const row = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Mail send"),
    );
    await act(async () => row?.click());
    expect(Alert.alert).toHaveBeenCalledWith(
      "Remove saved rule?",
      expect.stringContaining("Mail send · Allow · Tool · In this space"),
      expect.arrayContaining([expect.objectContaining({ text: "Remove", style: "destructive" })]),
    );
    const buttons = vi.mocked(Alert.alert).mock.calls.at(-1)?.[2] ?? [];
    await act(async () => buttons.find((button) => button.text === "Remove")?.onPress?.());
    expect(state.rpc).toHaveBeenCalledWith("approvalRules/remove", { id: "rule-1" });
    expect(container.textContent).toContain("Ask · Tool · In this space");
    expect(container.textContent).toContain("Block · Tool · In this space");
  });

  it("keeps a rule and reports an error when removal fails", async () => {
    state.approvalRules = [savedAllow];
    await render();
    await openSavedRules();
    const row = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Mail send"),
    );
    await act(async () => row?.click());
    const buttons = vi.mocked(Alert.alert).mock.calls.at(-1)?.[2] ?? [];
    state.permissionFailures.add("approvalRules/remove");
    await act(async () => buttons.find((button) => button.text === "Remove")?.onPress?.());
    expect(container.textContent).toContain("Mail send");
    expect(container.textContent).toContain("Could not remove saved rule");
  });

  it("does not restore a stale rules list after a successful removal", async () => {
    state.approvalRules = [savedAllow];
    await render();
    await openSavedRules();
    const row = [...container.querySelectorAll("button")].find((button) =>
      button.textContent?.includes("Mail send"),
    );
    await act(async () => row?.click());
    const buttons = vi.mocked(Alert.alert).mock.calls.at(-1)?.[2] ?? [];
    const oldList = deferred<Record<string, unknown>[]>();
    const removal = deferred<{ ok: true }>();
    state.rpc.mockImplementation(async (proc: string) => {
      if (proc === "approvalRules/list") return oldList.promise;
      if (proc === "approvalRules/remove") {
        state.approvalRules = [];
        return removal.promise;
      }
      if (proc === "permissions/get") return { level: null, effectiveDefault: "ask_changes" };
      return [];
    });

    await act(async () => buttons.find((button) => button.text === "Remove")?.onPress?.());
    await refocus();
    removal.resolve({ ok: true });
    await act(async () => {});
    oldList.resolve([savedAllow]);
    await act(async () => {});

    expect(container.textContent).toContain("No saved rules.");
    expect(container.textContent).not.toContain("Mail send");
  });

  it("retries a failed saved-rules load", async () => {
    state.permissionFailures.add("approvalRules/list");
    await render();
    await openSavedRules();
    expect(container.textContent).toContain("Could not load saved rules.");
    state.permissionFailures.delete("approvalRules/list");
    const retry = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Try again",
    );
    await act(async () => retry?.click());
    expect(container.textContent).toContain("No saved rules.");
  });
});
