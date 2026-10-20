// @vitest-environment jsdom

import type { NotificationPreferences } from "@rakazo/contracts";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (strings: TemplateStringsArray) => strings[0],
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@rakazo/ui-web", () => ({
  Switch: ({
    checked,
    onCheckedChange,
    ...props
  }: {
    checked: boolean;
    onCheckedChange?: (checked: boolean) => void;
  } & React.ComponentProps<"button">) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    />
  ),
}));
const api = vi.hoisted(() => ({ preferences: vi.fn(), updatePreferences: vi.fn() }));
vi.mock("../lib/rpc", () => ({ rpc: { notifications: api } }));
const browser = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("../lib/browser-notifications", () => ({
  requestBrowserNotificationPermission: browser.request,
}));
vi.mock("../lib/user-error", () => ({ errorText: () => "Something went wrong" }));

import { NotificationSettingsSection } from "./NotificationSettings";

const prefs = (over: Partial<NotificationPreferences> = {}): NotificationPreferences => ({
  finish: true,
  help: true,
  takeover: true,
  channels: {},
  hasPhone: false,
  hasImessage: false,
  ...over,
});

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const setPermission = (permission: string) =>
  vi.stubGlobal("Notification", { permission, requestPermission: vi.fn() });

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.resetAllMocks();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

const render = () => act(async () => root.render(<NotificationSettingsSection />));
const row = (name: string) =>
  container.querySelector(`[aria-label="${name}"]`) as HTMLElement | null;
const click = (el: HTMLElement | null) => act(async () => el?.click());

it("hides Phone until a phone is registered", async () => {
  setPermission("granted");
  api.preferences.mockResolvedValue(prefs());
  await render();
  expect(row("Browser")).not.toBeNull();
  expect(row("Phone")).toBeNull();
});

it("turns Phone off through the channel switch", async () => {
  setPermission("granted");
  api.preferences.mockResolvedValue(prefs({ hasPhone: true }));
  api.updatePreferences.mockResolvedValue(prefs({ hasPhone: true, channels: { push: false } }));
  await render();
  await click(row("Phone"));
  expect(api.updatePreferences).toHaveBeenCalledExactlyOnceWith({ channels: { push: false } });
  expect(row("Phone")?.getAttribute("aria-checked")).toBe("false");
});

it("shows iMessage only with a linked number and turns it off through the channel switch", async () => {
  setPermission("granted");
  api.preferences.mockResolvedValueOnce(prefs());
  await render();
  expect(row("iMessage")).toBeNull();
  await act(async () => root.unmount());
  root = createRoot(container);
  api.preferences.mockResolvedValue(prefs({ hasImessage: true }));
  api.updatePreferences.mockResolvedValue(
    prefs({ hasImessage: true, channels: { imessage: false } }),
  );
  await render();
  await click(row("iMessage"));
  expect(api.updatePreferences).toHaveBeenCalledExactlyOnceWith({ channels: { imessage: false } });
  expect(row("iMessage")?.getAttribute("aria-checked")).toBe("false");
});

it("asks for browser permission when Browser is turned on, and stores it once granted", async () => {
  setPermission("default");
  browser.request.mockImplementation(async () => {
    setPermission("granted");
    return "granted";
  });
  api.preferences.mockResolvedValue(prefs());
  api.updatePreferences.mockResolvedValue(prefs({ channels: { browser: true } }));
  await render();
  await click(row("Browser"));
  expect(browser.request).toHaveBeenCalledTimes(1);
  expect(api.updatePreferences).toHaveBeenCalledExactlyOnceWith({ channels: { browser: true } });
});

it("does not store Browser when permission is refused", async () => {
  setPermission("default");
  browser.request.mockResolvedValue("denied");
  api.preferences.mockResolvedValue(prefs());
  await render();
  await click(row("Browser"));
  expect(api.updatePreferences).not.toHaveBeenCalled();
});

it("says where it is blocked and disables Browser when the browser denied notifications", async () => {
  setPermission("denied");
  api.preferences.mockResolvedValue(prefs());
  await render();
  expect(container.textContent).toContain("Blocked in browser settings");
  expect((row("Browser") as HTMLButtonElement).disabled).toBe(true);
});

it("says Not supported here when the Notification API is missing", async () => {
  vi.stubGlobal("Notification", undefined);
  api.preferences.mockResolvedValue(prefs());
  await render();
  expect(container.textContent).toContain("Not supported here");
  expect(container.textContent).not.toContain("Blocked");
  expect((row("Browser") as HTMLButtonElement).disabled).toBe(true);
});
