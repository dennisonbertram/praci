// @vitest-environment jsdom

import type { AccountSecurity } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const localeMock = vi.hoisted(() => ({
  setUiLocale: vi.fn((locale: string) => Promise.resolve(locale)),
}));

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: (strings: TemplateStringsArray) => strings.join("") }),
  Trans: ({ children }: { children: ReactNode }) => children,
  Plural: ({ value, other }: { value: number; other: string }) => other.replace("#", String(value)),
}));

vi.mock("@rakazo/ui-web", async () => ({
  ...(await vi.importActual("@rakazo/ui-web/components/ui/command")),
  ...(await vi.importActual("@rakazo/ui-web/components/ui/popover")),
  BotAvatar: () => null,
  Button: ({ children, ...props }: React.ComponentProps<"button">) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  Field: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  FieldLabel: ({ children, htmlFor }: { children?: ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
  Input: (props: React.ComponentProps<"input">) => <input {...props} />,
  Label: ({ children, htmlFor }: { children?: ReactNode; htmlFor?: string }) => (
    <label htmlFor={htmlFor}>{children}</label>
  ),
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
  Toggle: ({
    children,
    onPressedChange,
    pressed: _pressed,
    variant: _variant,
    ...props
  }: {
    children?: ReactNode;
    onPressedChange?: () => void;
    pressed?: boolean;
    variant?: string;
  } & React.ComponentProps<"button">) => (
    <button type="button" onClick={() => onPressedChange?.()} {...props}>
      {children}
    </button>
  ),
  cn: (...values: unknown[]) => values.filter(Boolean).join(" "),
}));

const accountPolicy = vi.hoisted(() => ({
  passwordChangeEnabled: undefined as boolean | undefined,
}));
vi.mock("../components/AccountAccess", () => ({
  AccountAccess: ({ onSecurity }: { onSecurity: (value: AccountSecurity) => void }) => {
    useEffect(
      () =>
        onSecurity({
          hasPassword: true,
          passwordChangeEnabled: accountPolicy.passwordChangeEnabled,
          freshOidcAuth: false,
          ssoLinked: false,
          emailDeletion: false,
          sso: null,
        }),
      [onSecurity],
    );
    return <button type="button">Delete account</button>;
  },
}));

vi.mock("../components/AiDataSharing", () => ({ AiDataSharingSection: () => null }));
vi.mock("../components/NotificationSettings", () => ({ NotificationSettingsSection: () => null }));
vi.mock("../components/DataExport", () => ({ DataExportSection: () => null }));
vi.mock("../components/ApprovalRulesSettings", () => ({ ApprovalRulesSettings: () => null }));
vi.mock("../components/ai/primitives", () => ({
  SuccessPop: ({ label }: { label: string }) => <span>{label}</span>,
}));
vi.mock("../components/ComputersUnavailableHint", () => ({
  ComputersUnavailableHint: () => null,
}));
vi.mock("../components/DesktopUpdates", () => ({ DesktopUpdateSection: () => null }));
vi.mock("../components/SoftwareUpdateSection", () => ({ SoftwareUpdateSection: () => null }));
vi.mock("../lib/auth", () => ({ authClient: { changePassword: vi.fn() } }));
vi.mock("../lib/i18n", () => ({
  getActiveUiLocale: () => "en",
  setUiLocale: localeMock.setUiLocale,
}));
vi.mock("../lib/ui-appearance", () => ({
  getUiAppearancePreference: () => "system",
  setUiAppearance: vi.fn(),
}));
vi.mock("../lib/rpc", () => ({ rpc: { models: { credentials: async () => [] } } }));
vi.mock("react-router-dom", () => ({ Link: ({ children }: { children?: ReactNode }) => children }));

import { getRemoteImagesEnabled } from "../lib/remote-images-preference";
import { TOOL_ACTIVITY_STORAGE_KEY } from "../lib/tool-activity-preference";
import { GeneralSettingsPanels, UsageSettingsPanel } from "./AccountSettingsOverlay";

async function renderLocalePicker() {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <GeneralSettingsPanels
        name="Jamie"
        avatarStyle="robot"
        onAvatarStyleChange={async () => undefined}
      />,
    );
  });
  const trigger = container.querySelector<HTMLButtonElement>('[data-testid="ui-locale-select"]');
  if (!trigger) throw new Error("Missing language control");
  return { container, root, trigger };
}

async function selectAnotherLocale(trigger: HTMLButtonElement, avoidText?: string) {
  await act(async () => trigger.click());
  const selected = document.querySelector('[role="option"][aria-selected="true"]');
  const target = [...document.querySelectorAll<HTMLButtonElement>('[role="option"]')].find(
    (option) => option !== selected && option.textContent !== avoidText,
  );
  if (!target) throw new Error("Missing alternate language");
  const label = target.textContent;
  await act(async () => target.click());
  return label;
}

it("restores the active language and shows an error when changing language fails", async () => {
  // setUiLocale does not throw when a catalog fails: it falls back and returns the active language.
  localeMock.setUiLocale.mockImplementationOnce(() => Promise.resolve("en"));
  const { container, root, trigger } = await renderLocalePicker();
  try {
    const initial = trigger.textContent;
    await selectAnotherLocale(trigger, initial);
    await act(async () => {});
    expect(trigger.textContent).toBe(initial);
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Could not save");
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});

it("does not let an older failed language choice undo a newer success", async () => {
  let rejectFirst!: (error: Error) => void;
  localeMock.setUiLocale
    .mockImplementationOnce(
      () =>
        new Promise((_resolve, reject) => {
          rejectFirst = reject;
        }),
    )
    .mockImplementationOnce((locale) => Promise.resolve(locale));
  const { container, root, trigger } = await renderLocalePicker();
  try {
    const initial = trigger.textContent;
    await selectAnotherLocale(trigger, initial);
    await selectAnotherLocale(trigger, initial);
    const newer = trigger.textContent;
    await act(async () => {});
    rejectFirst(new Error("offline"));
    await act(async () => {});
    expect(trigger.textContent).toBe(newer);
    expect(newer).not.toBe(initial);
    expect(container.querySelector('[role="alert"]')).toBeNull();
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});

beforeEach(() => {
  localeMock.setUiLocale.mockReset().mockImplementation((locale) => Promise.resolve(locale));
});

afterEach(() => {
  localStorage.clear();
  document.body.innerHTML = "";
  localeMock.setUiLocale.mockReset();
});

// cmdk measures and scrolls its list, which jsdom does not implement.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView ??= () => {};

async function renderTimezone(onTimezoneChange: (zone: string) => Promise<void>) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <GeneralSettingsPanels
        name="Jamie"
        avatarStyle="robot"
        onAvatarStyleChange={async () => undefined}
        timezone="America/New_York"
        onTimezoneChange={onTimezoneChange}
      />,
    );
  });
  const trigger = container.querySelector<HTMLButtonElement>('[aria-label="Time zone"]');
  if (!trigger) throw new Error("Missing time zone control");
  await act(async () => trigger.click());
  return { container, trigger, root };
}

const zoneOptions = () => [...document.querySelectorAll('[data-slot="command-item"]')];

it("lists the browser time zone first with its UTC offset", async () => {
  vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
    timeZone: "Asia/Tokyo",
  } as Intl.ResolvedDateTimeFormatOptions);
  const { root } = await renderTimezone(async () => undefined);
  try {
    expect(zoneOptions()[0]?.textContent).toContain("Tokyo (UTC+9)");
  } finally {
    vi.restoreAllMocks();
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});

it("narrows the time zone list as you type", async () => {
  const { root } = await renderTimezone(async () => undefined);
  try {
    const input = document.querySelector<HTMLInputElement>('[data-slot="command-input"]');
    if (!input) throw new Error("Missing search box");
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
        input,
        "york",
      );
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const options = zoneOptions();
    expect(options.length).toBeLessThan(10);
    expect(options[0]?.textContent).toMatch(/New York \(UTC-[45]\)/);
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});

it("keeps the old time zone and shows an error when saving fails", async () => {
  const { container, trigger, root } = await renderTimezone(() => Promise.reject(new Error("no")));
  try {
    const tokyo = zoneOptions().find((el) => el.textContent?.includes("Tokyo"));
    if (!tokyo) throw new Error("Missing Tokyo");
    await act(async () => (tokyo as HTMLElement).click());
    expect(trigger.textContent).toContain("New York");
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Could not save time zone");
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});

it("shows a saved state after the time zone saves", async () => {
  const { container, root } = await renderTimezone(async () => undefined);
  try {
    const tokyo = zoneOptions().find((el) => el.textContent?.includes("Tokyo"));
    await act(async () => (tokyo as HTMLElement).click());
    expect(container.textContent).toContain("Time zone updated");
  } finally {
    await act(async () => root.unmount());
    vi.unstubAllGlobals();
  }
});

it("flips the stored tool activity preference from the settings toggle", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => {
      root.render(
        <GeneralSettingsPanels
          name="Jamie"
          avatarStyle="robot"
          onAvatarStyleChange={async () => undefined}
        />,
      );
    });

    const toggle = container.querySelector<HTMLButtonElement>(
      '[data-testid="tool-activity-toggle"]',
    );
    if (!toggle) throw new Error("Missing tool activity toggle");
    expect(toggle.getAttribute("aria-checked")).toBe("false");

    await act(async () => {
      toggle.click();
    });

    expect(localStorage.getItem(TOOL_ACTIVITY_STORAGE_KEY)).toBe("on");
    expect(toggle.getAttribute("aria-checked")).toBe("true");

    await act(async () => {
      toggle.click();
    });

    expect(localStorage.getItem(TOOL_ACTIVITY_STORAGE_KEY)).toBe("off");
    expect(toggle.getAttribute("aria-checked")).toBe("false");
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

it("turns loading web images on and off from the settings toggle", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => {
      root.render(
        <GeneralSettingsPanels
          name="Jamie"
          avatarStyle="robot"
          onAvatarStyleChange={async () => undefined}
        />,
      );
    });

    const toggle = container.querySelector<HTMLButtonElement>(
      '[data-testid="remote-images-toggle"]',
    );
    if (!toggle) throw new Error("Missing remote images toggle");
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(getRemoteImagesEnabled()).toBe(false);

    await act(async () => {
      toggle.click();
    });
    expect(toggle.getAttribute("aria-checked")).toBe("true");
    expect(getRemoteImagesEnabled()).toBe(true);

    await act(async () => {
      toggle.click();
    });
    expect(toggle.getAttribute("aria-checked")).toBe("false");
    expect(getRemoteImagesEnabled()).toBe(false);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

it.each([undefined, true, false])("respects the password-change policy (%s)", async (enabled) => {
  accountPolicy.passwordChangeEnabled = enabled;
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <GeneralSettingsPanels
          name="Test"
          avatarStyle="robot"
          onAvatarStyleChange={async () => undefined}
        />,
      ),
    );
    expect(container.textContent?.includes("Change password")).toBe(enabled !== false);
  } finally {
    await act(async () => root.unmount());
    accountPolicy.passwordChangeEnabled = undefined;
    vi.unstubAllGlobals();
  }
});

it("puts Delete account after every other setting", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => {
      root.render(
        <GeneralSettingsPanels
          name="Jamie"
          avatarStyle="robot"
          onAvatarStyleChange={async () => undefined}
        />,
      );
    });
    const panels = [...container.querySelectorAll("section")];
    const last = panels[panels.length - 1];
    expect(last?.textContent?.endsWith("Delete account")).toBe(true);
    expect(panels[0]?.textContent).not.toContain("Delete account");
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

it("shows the Usage card only once bots have done a task", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const usage = (runs: number) => ({ runs, inputTokens: null, outputTokens: null });
  await act(async () => root.render(<UsageSettingsPanel usage={usage(0)} />));
  expect(container.querySelector('[data-testid="usage-settings"]')).toBeNull();
  await act(async () => root.render(<UsageSettingsPanel usage={usage(3)} />));
  expect(container.querySelector('[data-testid="usage-settings"]')?.textContent).toContain("3");
  await act(async () => root.unmount());
  vi.unstubAllGlobals();
});
