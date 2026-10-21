// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act, useEffect } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import type { Mock } from "vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GranolaKeyGroup } from "../components/granola-key-group";
import { rpc } from "./api";
import type { NativeActionButtonProps } from "./native-controls";

type Status = {
  connectionId: string;
  status: "connected" | "needs_reconnect" | "disconnected";
  syncedThrough: string | null;
  lastSyncedAt: string | null;
  syncedCount: number;
  consentOff: boolean;
  agentBotId: string | null;
} | null;

const push = vi.hoisted(() => vi.fn());

vi.mock("expo-router", () => ({
  useRouter: () => ({ push }),
  useFocusEffect: (effect: () => void) => {
    // Run on mount, like a screen that gains focus.
    useEffect(effect, [effect]);
  },
}));
vi.mock("react-native", () => ({
  ActivityIndicator: () => <span data-testid="spinner" />,
  StyleSheet: { create: <T,>(styles: T) => styles },
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TextInput: ({
    value,
    onChangeText,
    secureTextEntry,
    autoComplete,
    textContentType,
    accessibilityLabel,
  }: {
    value: string;
    onChangeText: (value: string) => void;
    secureTextEntry?: boolean;
    autoComplete?: string;
    textContentType?: string;
    accessibilityLabel?: string;
  }) => (
    <input
      aria-label={accessibilityLabel}
      type={secureTextEntry ? "password" : "text"}
      data-autocomplete={autoComplete}
      data-content-type={textContentType}
      value={value}
      onChange={(event) => onChangeText(event.target.value)}
    />
  ),
}));
vi.mock("../components/settings-group", () => ({
  SettingsGroup: ({
    label,
    footer,
    children,
  }: {
    label?: string;
    footer?: string;
    children: ReactNode;
  }) => (
    <section>
      <h2>{label}</h2>
      {children}
      {footer ? <footer>{footer}</footer> : null}
    </section>
  ),
  SettingsRow: ({
    title,
    onPress,
    trailing,
  }: {
    title: string;
    onPress?: () => void;
    trailing?: ReactNode;
  }) => (
    <div data-row>
      {onPress ? (
        <button type="button" onClick={onPress}>
          {title}
        </button>
      ) : (
        <span>{title}</span>
      )}
      {trailing}
    </div>
  ),
}));
vi.mock("../components/native-action-button", () => ({
  NativeActionButton: ({ label, busy, disabled, onPress }: NativeActionButtonProps) => (
    <button type="button" data-busy={busy ? "1" : "0"} disabled={disabled} onClick={onPress}>
      {label}
    </button>
  ),
}));
vi.mock("./native", () => ({
  native: { secondaryLabel: "gray", tertiaryLabel: "gray", label: "black", fillPressed: "gray" },
  useThemedStyles: (create: () => unknown) => create(),
}));
vi.mock("./appearance", () => ({ mobileTokens: () => ({ warning: "orange" }) }));
vi.mock("./i18n", () => ({
  useI18n: () => ({
    t: (text: string, values?: Record<string, string | number>) =>
      text.replace(/\{(\w+)\}/g, (_, key: string) => String(values?.[key] ?? key)),
  }),
}));
vi.mock("./api", () => ({ rpc: vi.fn() }));

const KEEP = "Praci keeps your meetings and to-dos.";
const CONSENT = "Sends your meeting notes and transcripts to your AI model.";
const base = {
  connectionId: "c1",
  syncedThrough: "2026-10-20T00:00:00.000Z",
  lastSyncedAt: null,
  syncedCount: 4,
  consentOff: false,
  agentBotId: null,
};

let host: HTMLDivElement;
let root: Root;
let status: Status;
let connect: Mock<(body: unknown) => Promise<unknown>>;

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  push.mockReset();
  connect = vi.fn<(body: unknown) => Promise<unknown>>().mockResolvedValue({ ok: true });
  vi.mocked(rpc).mockImplementation((async (proc: string, body?: unknown) => {
    if (proc === "meetings/status") return status;
    if (proc === "meetings/connect") return connect(body);
    if (proc === "meetings/disconnect") {
      status = { ...base, status: "disconnected" };
      return { ok: true };
    }
    throw new Error(`unexpected ${proc}`);
  }) as typeof rpc);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

async function render(next: Status) {
  status = next;
  await act(async () => root.render(<GranolaKeyGroup />));
}
const text = () => host.textContent ?? "";
const field = () => host.querySelector("input") as HTMLInputElement;
const button = (label: string) =>
  [...host.querySelectorAll("button")].find((b) => b.textContent === label) as HTMLButtonElement;
async function type(value: string) {
  const input = field();
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function press(label: string) {
  await act(async () => button(label).click());
}

it("renders a secure key field with the exact props and the group header", async () => {
  await render(null);
  expect(host.querySelector("h2")?.textContent).toBe("Granola");
  expect(text()).toContain("Granola API key");
  expect(text()).toContain("Business plan");
  expect(field().type).toBe("password");
  expect(field().dataset.autocomplete).toBe("off");
  expect(field().dataset.contentType).toBe("none");
});

it("submits only on Connect, with the typed key", async () => {
  await render(null);
  await type("grn_abc");
  expect(connect).not.toHaveBeenCalled();
  await press("Connect");
  expect(connect).toHaveBeenCalledWith({ apiKey: "grn_abc" });
});

it.each([
  ["Granola rejected this key", "Granola rejected this key"],
  ["Could not reach Granola", "Could not reach Granola"],
])("shows %s, keeps the key and clears the line on edit", async (message, shown) => {
  await render(null);
  connect.mockRejectedValueOnce(new Error(message));
  await type("bad");
  await press("Connect");
  expect(text()).toContain(shown);
  expect(field().value).toBe("bad");
  await type("bad2");
  expect(text()).not.toContain(shown);
});

it("shows the keep sentence when disconnected and the consent footer in Connect states", async () => {
  await render({ ...base, status: "disconnected" });
  expect(text()).toContain(KEEP);
  expect(host.querySelector("footer")?.textContent).toBe(CONSENT);
});

it("shows the consent footer on first connect without the keep sentence", async () => {
  await render(null);
  expect(text()).not.toContain(KEEP);
  expect(host.querySelector("footer")?.textContent).toBe(CONSENT);
});

it("shows Reconnect needed with the field, Connect and Disconnect, never Synced", async () => {
  await render({ ...base, status: "needs_reconnect" });
  expect(text()).toContain("Reconnect needed");
  expect(text()).not.toContain("Synced");
  expect(field()).toBeTruthy();
  expect(button("Connect")).toBeTruthy();
  expect(button("Disconnect")).toBeTruthy();
  expect(host.querySelector("footer")?.textContent).toBe(CONSENT);
});

it("shows Synced count with Disconnect, no field and no footer, when connected", async () => {
  await render({ ...base, status: "connected" });
  expect(text()).toContain("Synced 4 meetings");
  expect(button("Disconnect")).toBeTruthy();
  expect(host.querySelector("input")).toBeNull();
  expect(host.querySelector("footer")).toBeNull();
});

it("says Synced 1 meeting for a single meeting", async () => {
  await render({ ...base, status: "connected", syncedCount: 1 });
  expect(text()).toContain("Synced 1 meeting");
  expect(text()).not.toContain("Synced 1 meetings");
});

it("shows Syncing with a spinner until syncedThrough is set", async () => {
  await render({ ...base, status: "connected", syncedThrough: null });
  expect(text()).toContain("Syncing");
  expect(host.querySelector('[data-testid="spinner"]')).toBeTruthy();
});

it("replaces Synced with AI data sharing off and links to its settings", async () => {
  await render({ ...base, status: "connected", consentOff: true });
  expect(text()).toContain("AI data sharing off");
  expect(text()).not.toContain("Synced");
  await press("AI data sharing off");
  expect(push).toHaveBeenCalledWith("/ai-data-sharing");
});

it("Disconnect calls meetings/disconnect and reloads", async () => {
  await render({ ...base, status: "connected" });
  await press("Disconnect");
  expect(text()).toContain(KEEP);
});
