import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("expo-modules-core", () => ({ requireNativeModule: vi.fn() }));
vi.mock("expo-notifications", () => ({
  setNotificationHandler: vi.fn(),
  getPresentedNotificationsAsync: vi.fn(async () => []),
}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));

import * as Notifications from "expo-notifications";
import {
  configureForegroundNotifications,
  notificationTargetsThread,
  setOpenNotificationThread,
} from "./live-notifications";
import { setOpenSurface } from "./open-surface";

beforeEach(() => vi.clearAllMocks());

describe("notification thread targeting", () => {
  it("matches Expo and native notification keys for the open agent", () => {
    expect(notificationTargetsThread({ botId: "bot-1" }, { botId: "bot-1" })).toBe(true);
    expect(
      notificationTargetsThread(
        { "rakazo.threadId": "thread-1" },
        { botId: "bot-1", threadId: "thread-1" },
      ),
    ).toBe(true);
  });

  it("keeps other agents visible", () => {
    expect(notificationTargetsThread({ botId: "bot-2" }, { botId: "bot-1" })).toBe(false);
    expect(notificationTargetsThread({ botId: "bot-1" }, null)).toBe(false);
  });

  it("does not confuse an open DM with a group notification from the same agent", () => {
    expect(
      notificationTargetsThread(
        { botId: "bot-1", threadId: "group-thread" },
        { botId: "bot-1", threadId: "dm-thread" },
      ),
    ).toBe(false);
  });

  it("hides only foreground notifications for the open agent", async () => {
    configureForegroundNotifications();
    await setOpenNotificationThread({ botId: "bot-1" });
    const handler = vi.mocked(Notifications.setNotificationHandler).mock.calls[0]?.[0];
    expect(handler).toBeTruthy();

    await expect(
      handler?.handleNotification({ request: { content: { data: { botId: "bot-1" } } } } as never),
    ).resolves.toMatchObject({ shouldShowBanner: false, shouldShowList: false });
    await expect(
      handler?.handleNotification({ request: { content: { data: { botId: "bot-2" } } } } as never),
    ).resolves.toMatchObject({ shouldShowBanner: true, shouldShowList: true });

    // New notification kinds carry data.notificationId and a page surface.
    const show = (surface: string) =>
      handler?.handleNotification({
        request: { content: { data: { notificationId: "n1", surface } } },
      } as never);
    // Unified and legacy thread pushes are both hidden for the open thread.
    await setOpenNotificationThread({ botId: "bot-1", threadId: "t-1" });
    const thread = (data: Record<string, unknown>) =>
      handler?.handleNotification({ request: { content: { data } } } as never);
    await expect(
      thread({
        kind: "notification",
        notificationId: "n2",
        surface: "thread",
        botId: "bot-1",
        threadId: "t-1",
      }),
    ).resolves.toMatchObject({ shouldShowBanner: false });
    await expect(
      thread({ kind: "completion", botId: "bot-1", threadId: "t-1" }),
    ).resolves.toMatchObject({ shouldShowBanner: false });
    await expect(
      thread({
        kind: "notification",
        notificationId: "n3",
        surface: "thread",
        botId: "bot-1",
        threadId: "t-9",
      }),
    ).resolves.toMatchObject({ shouldShowBanner: true });
    await setOpenNotificationThread(null);

    setOpenSurface("inbox");
    await expect(show("inbox")).resolves.toMatchObject({ shouldShowBanner: false });
    await expect(show("finance")).resolves.toMatchObject({ shouldShowBanner: true });
    setOpenSurface(null);
  });
});
