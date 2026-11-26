// @vitest-environment jsdom

import type { BotAppControl } from "@rakazo/contracts";
import type { ComponentProps, ReactNode } from "react";
import { act, createContext, useContext } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((text, part, i) => `${text}${i > 0 ? values[i - 1] : ""}${part}`, ""),
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@rakazo/ui-web", () => {
  const Menu = createContext<(open: boolean) => void>(() => undefined);
  return {
    Button: ({
      variant: _v,
      size: _s,
      ...props
    }: ComponentProps<"button"> & Record<string, unknown>) => <button {...props} />,
    Switch: ({
      checked,
      onCheckedChange,
      ...props
    }: ComponentProps<"button"> & {
      checked?: boolean;
      onCheckedChange?: (c: boolean) => void;
    }) => (
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onCheckedChange?.(!checked)}
        {...props}
      />
    ),
    DropdownMenu: ({
      children,
      onOpenChange,
    }: {
      children: ReactNode;
      onOpenChange?: (open: boolean) => void;
    }) => <Menu.Provider value={onOpenChange ?? (() => undefined)}>{children}</Menu.Provider>,
    DropdownMenuTrigger: ({ children, render }: { children: ReactNode; render: ReactNode }) => {
      const setOpen = useContext(Menu);
      const el = render as React.ReactElement<ComponentProps<"button">>;
      return (
        <button
          type="button"
          data-testid="add-app"
          disabled={el.props.disabled}
          onClick={() => setOpen(true)}
        >
          {children}
        </button>
      );
    },
    DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    DropdownMenuItem: ({
      children,
      onClick,
      disabled,
    }: {
      children: ReactNode;
      onClick?: () => void;
      disabled?: boolean;
    }) => (
      <button type="button" data-testid="menu-item" disabled={disabled} onClick={onClick}>
        {children}
      </button>
    ),
  };
});
const api = vi.hoisted(() => ({ status: vi.fn(), apps: vi.fn() }));
vi.mock("../lib/rpc", () => ({ rpc: { appControl: api } }));
const desktop = vi.hoisted(() => ({ value: undefined as { platform: string } | undefined }));
vi.mock("../lib/desktop", () => ({ desktopBridge: () => desktop.value }));

import { BotAppControlSection } from "./BotAppControlSection";

const music = { id: "com.apple.Music", name: "Music" };
const notes = { id: "com.apple.Notes", name: "Notes" };
const off: BotAppControl = { enabled: false, apps: [], headed: false };

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const onChange = vi.fn();

async function show(value: BotAppControl, runsOnThisMac = false) {
  await act(async () => {
    root.render(
      <BotAppControlSection value={value} onChange={onChange} runsOnThisMac={runsOnThisMac} />,
    );
  });
}
const text = () => container.textContent ?? "";
const click = async (el: Element | null) => {
  await act(async () => {
    (el as HTMLElement).click();
  });
};

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.resetAllMocks();
  desktop.value = { platform: "darwin" };
  api.status.mockResolvedValue({ available: true, accessibility: "granted", platform: "macos" });
  api.apps.mockResolvedValue({ apps: [music, notes] });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

it("renders nothing outside the desktop app, when unavailable, or for a this-mac bot", async () => {
  desktop.value = undefined;
  await show(off);
  expect(text()).toBe("");
  desktop.value = { platform: "darwin" };
  api.status.mockResolvedValue({ available: false, accessibility: "unknown", platform: null });
  await show(off);
  expect(text()).toBe("");
  api.status.mockResolvedValue({ available: true, accessibility: "granted", platform: "macos" });
  await show(off, true);
  expect(text()).toBe("");
});

it("names the computer by platform and saves the switch", async () => {
  await show(off);
  expect(text()).toContain("Use apps on this Mac");
  expect(text()).not.toContain("Add app");
  await click(container.querySelector('[role="switch"]'));
  expect(onChange).toHaveBeenCalledWith({ enabled: true });
  desktop.value = { platform: "win32" };
  await show(off);
  expect(text()).toContain("Use apps on this computer");
});

it("lists allowed apps, removes one, and adds only apps not already allowed", async () => {
  await show({ enabled: true, apps: [music], headed: false });
  expect(text()).toContain("Music");
  await click(container.querySelector('[aria-label="Remove Music"]'));
  expect(onChange).toHaveBeenCalledWith({ apps: [] });
  await click(container.querySelector('[data-testid="add-app"]'));
  const items = [...container.querySelectorAll('[data-testid="menu-item"]')];
  expect(items.map((i) => i.textContent)).toEqual(["Notes"]);
  await click(items[0] ?? null);
  expect(onChange).toHaveBeenCalledWith({ apps: [music, notes] });
});

it("shows the pointer hint only while real mouse and keyboard is on", async () => {
  await show({ enabled: true, apps: [music], headed: false });
  expect(text()).toContain("Use real mouse and keyboard");
  expect(text()).not.toContain("Moves your pointer");
  const switches = container.querySelectorAll('[role="switch"]');
  await click(switches[1] ?? null);
  expect(onChange).toHaveBeenCalledWith({ headed: true });
  await show({ enabled: true, apps: [music], headed: true });
  expect(text()).toContain("Moves your pointer and takes focus.");
});

it("keeps the list and Remove when permission is denied, and hides only Add app", async () => {
  api.status.mockResolvedValue({ available: true, accessibility: "denied", platform: "macos" });
  await show({ enabled: true, apps: [music], headed: false });
  expect(text()).toContain("Allow Praci in System Settings > Privacy & Security > Accessibility.");
  expect(text()).toContain("Music");
  expect(container.querySelector('[aria-label="Remove Music"]')).not.toBeNull();
  expect(text()).not.toContain("Add app");
});

it("refetches the status when the window regains focus", async () => {
  api.status.mockResolvedValueOnce({
    available: true,
    accessibility: "denied",
    platform: "macos",
  });
  await show({ enabled: true, apps: [music], headed: false });
  expect(text()).toContain("Allow Praci in System Settings");
  expect(text()).not.toContain("Add app");
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
  });
  expect(text()).not.toContain("Allow Praci in System Settings");
  expect(text()).toContain("Add app");
});

it("keeps the last status when a refetch on focus fails", async () => {
  await show({ enabled: true, apps: [music], headed: false });
  api.status.mockRejectedValue(new Error("down"));
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
  });
  expect(text()).toContain("Add app");
});

it("shows only the switch and the install line when agent-desktop is missing", async () => {
  api.status.mockResolvedValue({
    available: false,
    accessibility: "unknown",
    platform: null,
    needsInstall: true,
  });
  await show({ enabled: false, apps: [], headed: false });
  expect(text()).toContain("Use apps on this Mac");
  expect(text()).toContain("Needs agent-desktop:");
  expect(container.querySelector("code")?.textContent).toBe("npm install -g agent-desktop");
  const toggle = container.querySelector<HTMLButtonElement>('[role="switch"]');
  expect(toggle?.disabled).toBe(true);
  await show({ enabled: true, apps: [music], headed: true }, false);
  const on = container.querySelector<HTMLButtonElement>('[role="switch"]');
  expect(on?.disabled).toBe(false);
  expect(container.querySelectorAll('[role="switch"]').length).toBe(1);
  expect(text()).not.toContain("Add app");
  expect(text()).not.toContain("Music");
});

it("shows the real mouse switch only with allowed apps or when already on", async () => {
  await show({ enabled: true, apps: [], headed: false });
  expect(text()).not.toContain("Use real mouse and keyboard");
  await show({ enabled: true, apps: [], headed: true });
  expect(text()).toContain("Use real mouse and keyboard");
});

it("adds against the latest saved list, not a stale one", async () => {
  await show({ enabled: true, apps: [music], headed: false });
  await show({ enabled: true, apps: [], headed: false });
  await click(container.querySelector('[data-testid="add-app"]'));
  const items = [...container.querySelectorAll('[data-testid="menu-item"]')];
  await click(items.find((i) => i.textContent === "Notes") ?? null);
  expect(onChange).toHaveBeenLastCalledWith({ apps: [notes] });
});

it("looks for open apps on every open and recovers from a failed look", async () => {
  api.apps.mockRejectedValueOnce(new Error("down"));
  await show({ enabled: true, apps: [music], headed: false });
  const trigger = () => container.querySelector<HTMLButtonElement>('[data-testid="add-app"]');
  await click(trigger());
  expect(trigger()?.disabled).toBe(false);
  const items = () => [
    ...container.querySelectorAll<HTMLButtonElement>('[data-testid="menu-item"]'),
  ];
  expect(items().map((i) => [i.textContent, i.disabled])).toEqual([["Could not list apps", true]]);
  await click(trigger());
  expect(api.apps).toHaveBeenCalledTimes(2);
  expect(items().map((i) => i.textContent)).toEqual(["Notes"]);
});

it("says no other open apps for a real empty list", async () => {
  api.apps.mockResolvedValue({ apps: [music] });
  await show({ enabled: true, apps: [music], headed: false });
  await click(container.querySelector('[data-testid="add-app"]'));
  expect(
    [...container.querySelectorAll('[data-testid="menu-item"]')].map((i) => i.textContent),
  ).toEqual(["No other open apps"]);
});

it("shows no items while the apps are loading", async () => {
  let release: (value: { apps: unknown[] }) => void = () => undefined;
  api.apps.mockReturnValueOnce(new Promise((resolve) => (release = resolve)));
  await show({ enabled: true, apps: [], headed: false });
  await click(container.querySelector('[data-testid="add-app"]'));
  expect(container.querySelectorAll('[data-testid="menu-item"]').length).toBe(0);
  await act(async () => release({ apps: [music] }));
  expect(container.querySelectorAll('[data-testid="menu-item"]').length).toBe(1);
});
