// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Account from "../app/(settings)/account";

const state = vi.hoisted(() => ({
  security: {} as Record<string, unknown>,
  push: vi.fn(),
  deleteAccount: vi.fn(),
  signOut: vi.fn(),
  fetchAccountSecurity: vi.fn(),
  replaceWithSignIn: vi.fn(),
  prompt: vi.fn(),
  requestCode: vi.fn(),
}));

vi.mock("expo-router", () => ({
  useRouter: () => ({ push: state.push }),
  useLocalSearchParams: () => ({}),
  useFocusEffect: () => undefined,
}));
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));
vi.mock("react-native", () => {
  const box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    View: ({ children, accessibilityRole }: Record<string, unknown>) => (
      <div role={accessibilityRole as string}>{children as ReactNode}</div>
    ),
    ScrollView: box,
    KeyboardAvoidingView: box,
    Modal: box,
    ActivityIndicator: () => <i data-testid="spinner" />,
    Text: ({ children, accessibilityRole }: Record<string, unknown>) => (
      <span role={accessibilityRole as string}>{children as ReactNode}</span>
    ),
    TextInput: ({
      accessibilityLabel,
      value,
      onChangeText,
    }: {
      accessibilityLabel?: string;
      value?: string;
      onChangeText?: (value: string) => void;
    }) => (
      <input
        aria-label={accessibilityLabel}
        value={value ?? ""}
        onChange={(event) => onChangeText?.(event.target.value)}
      />
    ),
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
    Alert: { prompt: state.prompt },
  };
});
vi.mock("../components/app-mark", () => ({ AppMark: () => null }));
vi.mock("../components/avatar-style", () => ({
  useAvatarStyle: () => ({ avatarStyle: "organic", updateAvatarStyle: vi.fn() }),
}));
vi.mock("../components/bot-avatar", () => ({ BotAvatar: () => null }));
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
  SettingsGroup: ({ children }: { children?: ReactNode }) => <section>{children}</section>,
  SettingsSwitch: () => null,
  SettingsRow: ({
    title,
    onPress,
    disabled,
  }: {
    title: string;
    onPress?: () => void;
    disabled?: boolean;
  }) =>
    onPress ? (
      <button type="button" disabled={disabled} onClick={onPress}>
        {title}
      </button>
    ) : (
      <div>{title}</div>
    ),
}));
vi.mock("./api", () => ({
  currentApiBase: () => "https://api.test",
  deleteAccount: state.deleteAccount,
  fetchAccountSecurity: state.fetchAccountSecurity,
  loadSessionToken: async () => "token",
  requestAccountDeletionCode: state.requestCode,
  rpc: async (proc: string) => {
    if (proc === "me") return { email: "me@example.test", name: "Me" };
    if (proc === "usage/summary") return { runs: 1, totalTokens: 2 };
    return [];
  },
  selectedSpaceId: () => null,
  signOut: state.signOut,
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
vi.mock("./auth-routing", () => ({ replaceWithSignIn: state.replaceWithSignIn }));
vi.mock("./i18n", () => {
  const t = (text: string) => text;
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
  state.security = { hasPassword: true };
  for (const fn of [state.push, state.deleteAccount, state.signOut, state.replaceWithSignIn]) {
    fn.mockReset();
  }
  state.prompt.mockReset();
  state.requestCode.mockReset().mockResolvedValue(undefined);
  state.fetchAccountSecurity.mockReset().mockImplementation(async () => state.security);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = () => act(async () => root.render(<Account />));
const buttons = (label: string) =>
  [...container.querySelectorAll("button")].filter((b) => b.textContent === label);
const press = (label: string, index = 0) =>
  act(async () => {
    buttons(label)[index]!.click();
  });
const type = (label: string, value: string) =>
  act(async () => {
    const el = container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
const alerts = () => [...container.querySelectorAll('[role="alert"]')].map((a) => a.textContent);
/** Runs the "Delete" action of the iOS secure prompt, as the user typing a password would. */
const submitPrompt = async (password: string) => {
  const actions = state.prompt.mock.calls[0]![2] as {
    text: string;
    onPress?: (v: string) => void;
  }[];
  await act(async () => actions.find((a) => a.text === "Delete")!.onPress!(password));
};

describe("Account delete", () => {
  it("shows no password field until the Delete account row is tapped, then asks via the secure prompt", async () => {
    await render();
    expect(container.querySelector("input")).toBeNull();
    expect(state.prompt).not.toHaveBeenCalled();
    await press("Delete account");
    expect(state.prompt).toHaveBeenCalledOnce();
    expect(state.prompt.mock.calls[0]![0]).toBe("Delete your account?");
    expect(state.deleteAccount).not.toHaveBeenCalled();
  });

  it("deletes with the entered password, then goes to sign-in", async () => {
    await render();
    await press("Delete account");
    await submitPrompt("hunter2");
    expect(state.deleteAccount).toHaveBeenCalledOnce();
    expect(state.deleteAccount).toHaveBeenCalledWith("hunter2");
    expect(state.replaceWithSignIn).toHaveBeenCalledWith("/sign-in");
  });

  it("keeps the user signed in and shows the failure on the delete row when deletion fails", async () => {
    state.deleteAccount.mockRejectedValue(new Error("Wrong password"));
    await render();
    await press("Delete account");
    await submitPrompt("nope");
    expect(state.replaceWithSignIn).not.toHaveBeenCalled();
    expect(alerts()).toEqual(["Wrong password"]);
    expect(state.signOut).not.toHaveBeenCalled();
  });

  it("without a password, opens the in-app dialog and keeps it open with an alert when deletion fails", async () => {
    state.security = { hasPassword: false, freshOidcAuth: true };
    state.deleteAccount.mockRejectedValue(new Error("Server said no"));
    await render();
    await press("Delete account");
    expect(state.prompt).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Delete your account?");
    await press("Delete");
    expect(state.deleteAccount).toHaveBeenCalledWith(undefined, undefined);
    expect(state.replaceWithSignIn).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Delete your account?");
    expect(alerts()).toEqual(["Server said no"]);
  });

  it("deletes from the dialog after a fresh sign-in and routes to sign-in", async () => {
    state.security = { hasPassword: false, freshOidcAuth: true };
    await render();
    await press("Delete account");
    await press("Delete");
    expect(state.deleteAccount).toHaveBeenCalledWith(undefined, undefined);
    expect(state.replaceWithSignIn).toHaveBeenCalledWith("/sign-in");
  });

  it("refreshes an expired proof and keeps the dialog open without deleting", async () => {
    state.security = { hasPassword: false, freshOidcAuth: true };
    await render();
    await press("Delete account");
    // The sign-in proof expires while the dialog is open.
    state.security = { hasPassword: false, freshOidcAuth: false };
    await press("Delete");
    expect(state.fetchAccountSecurity).toHaveBeenCalled();
    expect(state.deleteAccount).not.toHaveBeenCalled();
    expect(state.replaceWithSignIn).not.toHaveBeenCalled();
    expect(container.textContent).toContain("Delete your account?");
  });

  it("sends the trimmed email code once a code was requested", async () => {
    state.security = { hasPassword: false, freshOidcAuth: false, emailDeletion: true };
    await render();
    await press("Delete account");
    await press("Send deletion code");
    expect(state.requestCode).toHaveBeenCalledOnce();
    await type("Deletion code", " 123456 ");
    await press("Delete");
    expect(state.deleteAccount).toHaveBeenCalledWith(undefined, "123456");
    expect(state.replaceWithSignIn).toHaveBeenCalledWith("/sign-in");
  });

  it("does not submit a whitespace-only code after authentication expired", async () => {
    state.security = { hasPassword: false, freshOidcAuth: false, emailDeletion: true };
    await render();
    await press("Delete account");
    await press("Send deletion code");
    await type("Deletion code", "   ");
    expect(buttons("Delete")[0]!.disabled).toBe(true);
    await press("Delete");
    expect(state.deleteAccount).not.toHaveBeenCalled();
    expect(state.replaceWithSignIn).not.toHaveBeenCalled();
  });

  it("shows a sign-out failure next to Sign out, not on the delete row", async () => {
    state.signOut.mockRejectedValue(new Error("Offline"));
    await render();
    await press("Sign out");
    expect(state.replaceWithSignIn).not.toHaveBeenCalled();
    const [alert] = container.querySelectorAll('[role="alert"]');
    expect(alert!.textContent).toBe("Offline");
    expect(alert!.closest("div")!.textContent).toContain("Sign out");
    expect(alert!.closest("div")!.textContent).not.toContain("Delete account");
  });

  it.each([
    [undefined, true],
    [true, true],
    [false, false],
  ])("password-change policy %s shows Change password: %s", async (enabled, shown) => {
    state.security = { hasPassword: true, passwordChangeEnabled: enabled };
    await render();
    expect(buttons("Change password")).toHaveLength(shown ? 1 : 0);
    expect(buttons("Delete account")).toHaveLength(1);
  });
});
