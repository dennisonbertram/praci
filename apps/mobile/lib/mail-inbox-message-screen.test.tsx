// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import InboxMessageScreen from "../app/inbox-message";

const state = vi.hoisted(() => ({
  rpc: vi.fn(),
  push: vi.fn(),
  setOptions: vi.fn(),
  openBrowser: vi.fn(),
  alert: vi.fn(),
}));
vi.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ messageId: "m1" }),
  useNavigation: () => ({ setOptions: state.setOptions }),
  useRouter: () => ({ push: state.push }),
}));
vi.mock("expo-router/react-navigation", () => ({ useHeaderHeight: () => 96 }));
vi.mock("expo-web-browser", () => ({ openBrowserAsync: state.openBrowser }));
vi.mock("./api", () => ({ rpc: state.rpc }));
vi.mock("./native", () => ({
  native: {},
  useThemedStyles: (factory: () => unknown) => factory(),
}));
vi.mock("./i18n", () => {
  const t = (text: string) => text;
  return { t, useI18n: () => ({ t }), dateLocaleForUi: () => "en-US" };
});
vi.mock("../components/native-symbol", () => ({ NativeSymbol: () => null }));
vi.mock("../components/sandboxed-html-preview", () => ({
  SandboxedHtmlPreview: ({
    html,
    scripts,
    email,
    onOpenLink,
  }: {
    html: string;
    scripts?: boolean;
    email?: boolean;
    onOpenLink?: (url: string) => void;
  }) => (
    <button
      type="button"
      data-testid="preview"
      data-scripts={String(scripts)}
      data-email={String(email)}
      onClick={() => onOpenLink?.("https://example.com/offer")}
    >
      {html}
    </button>
  ),
}));
vi.mock("react-native", () => ({
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  ScrollView: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  ActivityIndicator: () => <div data-testid="spinner" />,
  Text: ({ children, selectable }: { children: ReactNode; selectable?: boolean }) => (
    <span data-selectable={selectable ? "yes" : undefined}>{children}</span>
  ),
  Pressable: ({
    children,
    onPress,
    accessibilityLabel,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    accessibilityLabel?: string;
  }) => (
    <button type="button" aria-label={accessibilityLabel} onClick={onPress}>
      {children}
    </button>
  ),
  StyleSheet: { create: (styles: unknown) => styles },
  Platform: { OS: "ios", Version: "26.0" },
  Alert: { alert: state.alert },
}));

const message = (extra: Record<string, unknown> = {}) => ({
  from: "Ada <ada@example.test>",
  to: "me@example.test",
  date: "2026-10-12T09:30:00.000Z",
  subject: "Quarterly plan",
  html: null,
  text: "Plain body line",
  ...extra,
});

let root: Root;
let container: HTMLDivElement;
let getReply: () => Promise<unknown>;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  getReply = async () => message();
  state.push.mockReset();
  state.setOptions.mockReset();
  state.openBrowser.mockReset().mockResolvedValue({ type: "dismiss" });
  state.alert.mockReset();
  state.rpc.mockReset().mockImplementation(async (proc: string) => {
    if (proc === "inbox/get") return getReply();
    if (proc === "inbox/agent") return { id: "bot-9", name: "Inbox agent" };
    throw new Error(`unexpected rpc ${proc}`);
  });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});
const render = () => act(async () => root.render(<InboxMessageScreen />));
const headerItems = () => {
  const options = state.setOptions.mock.calls.at(-1)?.[0] as
    | undefined
    | { unstable_headerRightItems?: () => { accessibilityLabel: string; onPress: () => void }[] };
  return options?.unstable_headerRightItems?.() ?? [];
};

it("fetches the message by id and shows from, to and the subject as the title", async () => {
  await render();
  expect(state.rpc).toHaveBeenCalledWith("inbox/get", { messageId: "m1" });
  expect(container.textContent).toContain("Ada <ada@example.test>");
  expect(container.textContent).toContain("me@example.test");
  expect(
    state.setOptions.mock.calls.some(([o]) => (o as { title?: string }).title === "Quarterly plan"),
  ).toBe(true);
});

it("shows a spinner while the message loads", async () => {
  getReply = () => new Promise(() => undefined);
  await render();
  expect(container.querySelector('[data-testid="spinner"]')).not.toBeNull();
});

it("renders the HTML part in the sandbox in email mode", async () => {
  getReply = async () => message({ html: "<p>Hello</p>", text: "ignored" });
  await render();
  const preview = container.querySelector('[data-testid="preview"]');
  expect(preview?.textContent).toBe("<p>Hello</p>");
  expect(preview?.getAttribute("data-email")).toBe("true");
  expect(preview?.getAttribute("data-scripts")).not.toBe("true");
  expect(container.textContent).not.toContain("ignored");
});

it("opens a tapped link in the system browser", async () => {
  getReply = async () => message({ html: "<a>Offer</a>" });
  await render();
  await act(async () =>
    (container.querySelector('[data-testid="preview"]') as HTMLElement).click(),
  );
  expect(state.openBrowser).toHaveBeenCalledWith("https://example.com/offer");
});

it("falls back to selectable plain text when there is no HTML part", async () => {
  await render();
  expect(container.querySelector('[data-testid="preview"]')).toBeNull();
  const body = [...container.querySelectorAll("span")].find(
    (s) => s.textContent === "Plain body line",
  );
  expect(body?.getAttribute("data-selectable")).toBe("yes");
});

it("shows an inline error when the message cannot be loaded", async () => {
  getReply = async () => {
    throw new Error("Offline");
  };
  await render();
  expect(container.textContent).toContain("Offline");
  expect(container.querySelector('[data-testid="spinner"]')).toBeNull();
});

it("opens the Inbox agent thread from the header item", async () => {
  await render();
  const [item] = headerItems();
  expect(item?.accessibilityLabel).toBe("Inbox agent");
  await act(async () => item?.onPress());
  expect(state.rpc).toHaveBeenCalledWith("inbox/agent");
  expect(state.push).toHaveBeenCalledWith({
    pathname: "/thread",
    params: { botId: "bot-9", name: "Inbox agent" },
  });
});
