import { Alert } from "react-native";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  push: vi.fn(),
  dismissTo: vi.fn(),
  closeSettingsSheet: vi.fn(),
  currentSessionGeneration: 1,
  outboxSession: 1,
  currentApiBase: "https://api.example.test",
  currentUserId: "user-1",
  currentCacheSession: "cache-1",
  mountedThreadKey: null as string | null,
  selectedSpaceId: "s1" as string | null,
  config: undefined as { notDelivered: (attempt: SendAttempt) => void } | undefined,
}));

vi.mock("react-native", () => ({
  AccessibilityInfo: { announceForAccessibility: vi.fn() },
  Alert: { alert: vi.fn() },
  AppState: { addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
}));
vi.mock("expo-router", () => ({ router: { push: state.push, dismissTo: state.dismissTo } }));
vi.mock("./api", () => ({
  captureApiRequestContext: vi.fn(async () => ({ headers: {} })),
  currentApiBase: () => state.currentApiBase,
  isServerReachable: () => false,
  rpc: vi.fn(),
  selectedSpaceId: () => state.selectedSpaceId,
  subscribeServerReachable: vi.fn(() => vi.fn()),
}));
vi.mock("./artifact-cache-session", () => ({ artifactCacheSession: vi.fn(async () => "cache-1") }));
vi.mock("./i18n", () => ({ t: (value: string) => value }));
vi.mock("./integrations-cache", () => ({ integrationsCacheScope: vi.fn() }));
vi.mock("./outbox-disk", () => ({ outboxDisk: {} }));
vi.mock("./session", () => ({
  currentSessionGeneration: () => state.currentSessionGeneration,
  loadSessionToken: vi.fn(async () => "token"),
  loadVerifiedIntegrationsScope: vi.fn(async () => ({
    apiBase: state.currentApiBase,
    selectionId: state.selectedSpaceId,
    spaceId: state.selectedSpaceId,
    userId: state.currentUserId,
  })),
}));
vi.mock("./settings-sheet", () => ({ closeSettingsSheet: state.closeSettingsSheet }));
vi.mock("./thread-feedback", () => ({
  configureUnsentSends: (config: typeof state.config) => {
    state.config = config;
  },
  isSendAttemptInScope: (value: SendAttempt) =>
    value.session === state.outboxSession &&
    value.apiBase === state.currentApiBase &&
    value.userId === state.currentUserId &&
    value.cacheSession === state.currentCacheSession,
  isThreadMounted: (key: string) => state.mountedThreadKey === key,
  restoreUnsentSends: vi.fn(),
  sendWaitingMessages: vi.fn(),
}));
vi.mock("./user-error", () => ({ errorText: vi.fn() }));

import type { SendAttempt } from "./thread-feedback";
import { prepareUnsentSends } from "./unsent-sends";

function attempt(overrides: Partial<SendAttempt> = {}): SendAttempt {
  return {
    payload: {
      originThreadKey: "group-1",
      displayText: "Hi",
      replyPreview: null,
      groupTarget: "group-1",
      reroutedToGroup: false,
      plan: {} as SendAttempt["payload"]["plan"],
      attachments: [],
      replyQuote: null,
      ...overrides.payload,
    },
    clientNonce: "nonce-1",
    artifactIds: new Map(),
    state: "failed",
    apiBase: state.currentApiBase,
    spaceId: "s2",
    userId: "user-1",
    cacheSession: "cache-1",
    session: 1,
    error: "No response",
    ...overrides,
  } as SendAttempt;
}

describe("unsent send alerts", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    state.currentSessionGeneration = 1;
    state.outboxSession = 1;
    state.currentApiBase = "https://api.example.test";
    state.currentUserId = "user-1";
    state.currentCacheSession = "cache-1";
    state.mountedThreadKey = null;
    state.selectedSpaceId = "s1";
    await prepareUnsentSends();
  });

  it("opens the origin group when the send mentions a different group", () => {
    state.config?.notDelivered(
      attempt({ payload: { originThreadKey: "g1", groupTarget: "g2" } as SendAttempt["payload"] }),
    );
    const [, , buttons] = vi.mocked(Alert.alert).mock.calls[0]!;
    expect(buttons?.map(({ text }) => text)).toEqual(["Not now", "Open conversation"]);
    expect(buttons?.[0]?.style).toBe("cancel");
    buttons?.[1]?.onPress?.();
    expect(state.closeSettingsSheet).toHaveBeenCalledOnce();
    expect(state.dismissTo).toHaveBeenCalledWith("/");
    expect(state.dismissTo.mock.invocationCallOrder[0]).toBeLessThan(
      state.push.mock.invocationCallOrder[0] ?? 0,
    );
    expect(state.push).toHaveBeenCalledWith({
      pathname: "/group-thread",
      params: { groupId: "g1", spaceId: "s2" },
    });
  });

  it("opens the origin bot when its send was rerouted to a group", () => {
    state.config?.notDelivered(
      attempt({
        payload: {
          originThreadKey: "bot-1",
          groupTarget: "group-2",
          reroutedToGroup: true,
          initialBotTarget: "bot-1",
        } as SendAttempt["payload"],
        spaceId: null,
      }),
    );
    const [, , buttons] = vi.mocked(Alert.alert).mock.calls[0]!;
    expect(buttons?.map(({ text }) => text)).toEqual(["Not now", "Open conversation"]);
    buttons?.[1]?.onPress?.();
    expect(state.push).toHaveBeenCalledWith({ pathname: "/thread", params: { botId: "bot-1" } });
  });

  it("omits Open conversation when the attempt has no origin route", () => {
    state.config?.notDelivered(
      attempt({
        payload: { originThreadKey: "", groupTarget: undefined } as SendAttempt["payload"],
      }),
    );
    const [, , buttons] = vi.mocked(Alert.alert).mock.calls[0]!;
    expect(buttons?.map(({ text }) => text)).toEqual(["Not now"]);
    expect(buttons?.[0]?.style).toBe("cancel");
  });

  it.each([
    ["API base", () => (state.currentApiBase = "https://other.example.test")],
    ["user", () => (state.currentUserId = "user-2")],
    ["session", () => (state.outboxSession += 1)],
    ["cache session", () => (state.currentCacheSession = "cache-2")],
  ])("does not open after the %s changes", (_scopePart, changeScope) => {
    state.config?.notDelivered(attempt());
    const buttons = vi.mocked(Alert.alert).mock.calls[0]?.[2];
    changeScope();
    buttons?.[1]?.onPress?.();
    expect(state.push).not.toHaveBeenCalled();
    expect(state.dismissTo).not.toHaveBeenCalled();
  });

  it("returns to a mounted origin route instead of pushing another copy", () => {
    state.mountedThreadKey = "group-1";
    state.selectedSpaceId = "s2";
    state.config?.notDelivered(attempt({ spaceId: "s2" }));
    vi.mocked(Alert.alert).mock.calls[0]?.[2]?.[1]?.onPress?.();
    expect(state.dismissTo).toHaveBeenCalledWith({
      pathname: "/group-thread",
      params: { groupId: "group-1", spaceId: "s2" },
    });
    expect(state.push).not.toHaveBeenCalled();
  });
});
