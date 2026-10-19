import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-notifications", () => ({
  DEFAULT_ACTION_IDENTIFIER: "expo.modules.notifications.actions.DEFAULT",
  addNotificationResponseReceivedListener: vi.fn(),
  clearLastNotificationResponse: vi.fn(),
  getLastNotificationResponse: vi.fn(),
  useLastNotificationResponse: vi.fn(),
}));
vi.mock("expo-router", () => ({
  router: { push: vi.fn() },
}));
vi.mock("./api", () => ({
  loadSessionToken: vi.fn(),
  selectedSpaceId: vi.fn(() => "space-a"),
  selectSpace: vi.fn(async () => true),
}));
vi.mock("./unseen-notifications", () => ({ markSurfaceSeen: vi.fn() }));
vi.mock("./settings-sheet", () => ({
  closeSettingsSheet: vi.fn(),
}));

import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { loadSessionToken, selectSpace } from "./api";
import { openNotificationResponse } from "./open-notification";
import { closeSettingsSheet } from "./settings-sheet";
import { markSurfaceSeen } from "./unseen-notifications";

const DEFAULT_ACTION = "expo.modules.notifications.actions.DEFAULT";

function tap(id: string, data: Record<string, unknown> = { botId: "bot-1", threadId: "thread-1" }) {
  return {
    actionIdentifier: DEFAULT_ACTION,
    notification: { request: { identifier: id, content: { data } } },
  } as Notifications.NotificationResponse;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("opening a notification tap", () => {
  it("closes the settings sheet before opening the thread, so it doesn't open behind it", async () => {
    vi.mocked(loadSessionToken).mockResolvedValue("token");

    await expect(openNotificationResponse(tap("tap-over-settings"))).resolves.toBe(true);
    expect(closeSettingsSheet).toHaveBeenCalledTimes(1);
    expect(vi.mocked(closeSettingsSheet).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(router.push).mock.invocationCallOrder[0] ?? 0,
    );
  });

  it("opens a signed-in tap once when the cold start and the listener both see it", async () => {
    let release: (token: string) => void = () => undefined;
    vi.mocked(loadSessionToken).mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const response = tap("tap-signed-in");
    const first = openNotificationResponse(response);
    const second = openNotificationResponse(response);
    release("token");
    await expect(first).resolves.toBe(true);
    await expect(second).resolves.toBe(false);
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/thread",
      params: { botId: "bot-1", threadId: "thread-1" },
    });
    expect(Notifications.clearLastNotificationResponse).not.toHaveBeenCalled();
  });

  it("drops a signed-out tap so a later cold start cannot replay it", async () => {
    vi.mocked(loadSessionToken).mockResolvedValue("");
    const response = tap("tap-signed-out", {
      botId: "bot-1",
      threadId: "thread-1",
      spaceId: "space-2",
    });
    vi.mocked(Notifications.getLastNotificationResponse).mockReturnValue(response);
    await expect(openNotificationResponse(response)).resolves.toBe(false);
    expect(router.push).not.toHaveBeenCalled();
    expect(Notifications.clearLastNotificationResponse).toHaveBeenCalledTimes(1);

    vi.mocked(loadSessionToken).mockResolvedValue("token");
    await expect(openNotificationResponse(response)).resolves.toBe(true);
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it("leaves the last response in place when the tap cannot be opened or the session read fails", async () => {
    vi.mocked(loadSessionToken).mockResolvedValue("");
    await expect(openNotificationResponse(null)).resolves.toBe(false);
    await expect(openNotificationResponse(tap("tap-empty", { kind: "completion" }))).resolves.toBe(
      false,
    );
    expect(Notifications.clearLastNotificationResponse).not.toHaveBeenCalled();

    vi.mocked(loadSessionToken).mockRejectedValue(new Error("locked"));
    await expect(openNotificationResponse(tap("tap-locked"))).resolves.toBe(false);
    expect(router.push).not.toHaveBeenCalled();
    expect(Notifications.clearLastNotificationResponse).not.toHaveBeenCalled();

    vi.mocked(loadSessionToken).mockResolvedValue("token");
    await expect(openNotificationResponse(tap("tap-locked"))).resolves.toBe(true);
    expect(router.push).toHaveBeenCalledTimes(1);
  });

  it("leaves a newer last response in place when an older signed-out tap is rejected", async () => {
    let release: (token: string) => void = () => undefined;
    vi.mocked(loadSessionToken).mockImplementation(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const older = tap("tap-older");
    const newer = tap("tap-newer", { botId: "bot-2", threadId: "thread-2" });
    vi.mocked(Notifications.getLastNotificationResponse).mockReturnValue(older);
    const pending = openNotificationResponse(older);
    vi.mocked(Notifications.getLastNotificationResponse).mockReturnValue(newer);
    release("");
    await expect(pending).resolves.toBe(false);
    expect(Notifications.clearLastNotificationResponse).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();

    vi.mocked(loadSessionToken).mockResolvedValue("token");
    await expect(openNotificationResponse(newer)).resolves.toBe(true);
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/thread",
      params: { botId: "bot-2", threadId: "thread-2" },
    });
  });

  it("treats two deliveries that share a request identifier as different taps", async () => {
    const releases: Array<(token: string) => void> = [];
    vi.mocked(loadSessionToken).mockImplementation(
      () =>
        new Promise((resolve) => {
          releases.push(resolve);
        }),
    );
    const shared = { botId: "bot-1", threadId: "thread-1" };
    const older = tap("thread-shared-out", { ...shared, deliveryId: "delivery-out-1" });
    const newer = tap("thread-shared-out", { ...shared, deliveryId: "delivery-out-2" });
    vi.mocked(Notifications.getLastNotificationResponse).mockReturnValue(older);
    const pendingOlder = openNotificationResponse(older);
    vi.mocked(Notifications.getLastNotificationResponse).mockReturnValue(newer);
    const pendingNewer = openNotificationResponse(newer);

    releases[0]?.("");
    await expect(pendingOlder).resolves.toBe(false);
    expect(Notifications.clearLastNotificationResponse).not.toHaveBeenCalled();
    expect(router.push).not.toHaveBeenCalled();

    releases[1]?.("token");
    await expect(pendingNewer).resolves.toBe(true);
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(Notifications.clearLastNotificationResponse).toHaveBeenCalledTimes(1);
  });

  it("opens both signed-in deliveries that share a request identifier", async () => {
    const releases: Array<(token: string) => void> = [];
    vi.mocked(loadSessionToken).mockImplementation(
      () =>
        new Promise((resolve) => {
          releases.push(resolve);
        }),
    );
    const shared = { botId: "bot-1", threadId: "thread-1" };
    const first = tap("thread-shared-in", { ...shared, deliveryId: "delivery-in-1" });
    const second = tap("thread-shared-in", { ...shared, deliveryId: "delivery-in-2" });
    vi.mocked(Notifications.getLastNotificationResponse).mockReturnValue(second);
    const pendingFirst = openNotificationResponse(first);
    const pendingSecond = openNotificationResponse(second);
    releases[0]?.("token");
    releases[1]?.("token");
    await expect(pendingFirst).resolves.toBe(true);
    await expect(pendingSecond).resolves.toBe(true);
    expect(router.push).toHaveBeenCalledTimes(2);
    expect(Notifications.clearLastNotificationResponse).toHaveBeenCalledTimes(1);
  });

  it("opens one shared-identifier delivery only once", async () => {
    vi.mocked(loadSessionToken).mockResolvedValue("token");
    const data = { botId: "bot-1", threadId: "thread-1", deliveryId: "delivery-once" };
    await expect(openNotificationResponse(tap("thread-shared-once", data))).resolves.toBe(true);
    await expect(openNotificationResponse(tap("thread-shared-once", data))).resolves.toBe(false);
    expect(router.push).toHaveBeenCalledTimes(1);
  });
});

describe("opening a notification by surface", () => {
  it("opens the inbox and marks it seen", async () => {
    vi.mocked(loadSessionToken).mockResolvedValue("token");
    await openNotificationResponse(tap("n-inbox", { notificationId: "n1", surface: "inbox" }));
    expect(router.push).toHaveBeenCalledWith({ pathname: "/inbox" });
    expect(markSurfaceSeen).toHaveBeenCalledWith("inbox");
  });

  it("opens the thread for a thread notification without marking a page seen", async () => {
    vi.mocked(loadSessionToken).mockResolvedValue("token");
    await openNotificationResponse(
      tap("n-thread", { surface: "thread", botId: "bot-1", threadId: "t-1" }),
    );
    expect(router.push).toHaveBeenCalledWith({
      pathname: "/thread",
      params: { botId: "bot-1", threadId: "t-1" },
    });
    expect(markSurfaceSeen).not.toHaveBeenCalled();
  });

  it("marks a page with no mobile screen seen and does not navigate", async () => {
    vi.mocked(loadSessionToken).mockResolvedValue("token");
    await openNotificationResponse(tap("n-fin", { surface: "finance", link: "/finance" }));
    expect(router.push).not.toHaveBeenCalled();
    expect(markSurfaceSeen).toHaveBeenCalledWith("finance");
  });

  it("switches to the notification's space before opening and clearing its inbox", async () => {
    vi.mocked(loadSessionToken).mockResolvedValue("token");
    await openNotificationResponse(tap("n-space", { surface: "inbox", spaceId: "space-b" }));
    expect(selectSpace).toHaveBeenCalledWith("space-b");
    expect(vi.mocked(selectSpace).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(router.push).mock.invocationCallOrder[0] ?? 0,
    );
    expect(markSurfaceSeen).toHaveBeenCalledWith("inbox");
  });

  it("does nothing when the space cannot be selected", async () => {
    vi.mocked(loadSessionToken).mockResolvedValue("token");
    vi.mocked(selectSpace).mockResolvedValueOnce(false);
    await expect(
      openNotificationResponse(tap("n-nospace", { surface: "inbox", spaceId: "space-c" })),
    ).resolves.toBe(false);
    expect(router.push).not.toHaveBeenCalled();
    expect(markSurfaceSeen).not.toHaveBeenCalled();
  });

  it("ignores non-default actions", async () => {
    vi.mocked(loadSessionToken).mockResolvedValue("token");
    const response = tap("n-action", { surface: "finance" });
    response.actionIdentifier = "dismiss";
    await expect(openNotificationResponse(response)).resolves.toBe(false);
    expect(markSurfaceSeen).not.toHaveBeenCalled();
  });

  it("opens a thread from the unified push shape and from the legacy shape", async () => {
    vi.mocked(loadSessionToken).mockResolvedValue("token");
    await openNotificationResponse(
      tap("n-unified", {
        kind: "notification",
        notificationId: "n1",
        surface: "thread",
        botId: "bot-1",
        threadId: "t-1",
        link: "/bots/bot-1",
        spaceId: "space-a",
      }),
    );
    await openNotificationResponse(
      tap("n-legacy", { kind: "completion", botId: "bot-2", threadId: "t-2" }),
    );
    expect(router.push).toHaveBeenNthCalledWith(1, {
      pathname: "/thread",
      params: { botId: "bot-1", threadId: "t-1", spaceId: "space-a" },
    });
    expect(router.push).toHaveBeenNthCalledWith(2, {
      pathname: "/thread",
      params: { botId: "bot-2", threadId: "t-2" },
    });
    expect(markSurfaceSeen).not.toHaveBeenCalled();
  });

  it("falls back to the link when the unified push has no botId or groupId", async () => {
    vi.mocked(loadSessionToken).mockResolvedValue("token");
    await openNotificationResponse(
      tap("n-glink", {
        kind: "notification",
        surface: "thread",
        threadId: "t-1",
        link: "/app/g/grp-1",
      }),
    );
    await openNotificationResponse(
      tap("n-blink", {
        kind: "notification",
        surface: "thread",
        threadId: "t-2",
        link: "/app/bot-9",
      }),
    );
    expect(router.push).toHaveBeenNthCalledWith(1, {
      pathname: "/group-thread",
      params: { groupId: "grp-1", threadId: "t-1" },
    });
    expect(router.push).toHaveBeenNthCalledWith(2, {
      pathname: "/thread",
      params: { botId: "bot-9", threadId: "t-2" },
    });
  });
});
