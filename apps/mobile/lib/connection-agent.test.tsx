// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ConnectionAgent } from "../components/connection-agent";

const m = vi.hoisted(() => ({ rpc: vi.fn(), push: vi.fn(), close: vi.fn() }));
vi.mock("./api", () => ({ rpc: m.rpc }));
vi.mock("expo-router", async () => {
  const { useEffect } = await import("react");
  return {
    useRouter: () => ({ push: m.push }),
    useFocusEffect: (effect: () => (() => void) | undefined) => useEffect(effect, [effect]),
  };
});
vi.mock("./settings-sheet", () => ({ closeSettingsSheet: m.close }));
vi.mock("./appearance", () => ({ mobileTokens: () => ({ destructive: "red" }) }));
vi.mock("./native", () => ({ native: {}, useThemedStyles: (f: () => unknown) => f() }));
vi.mock("./i18n", () => ({ t: (s: string) => s, useI18n: () => ({ t: (s: string) => s }) }));
vi.mock("../components/row-accessories", () => ({ Chevron: () => null }));
vi.mock("../components/native-switch", () => ({
  NativeSwitch: (p: {
    value: boolean;
    disabled?: boolean;
    accessibilityLabel: string;
    onValueChange: (v: boolean) => void;
  }) =>
    createElement("input", {
      type: "checkbox",
      "aria-label": p.accessibilityLabel,
      checked: p.value,
      disabled: p.disabled,
      onChange: () => p.onValueChange(!p.value),
    }),
}));
vi.mock("react-native", () => {
  const V = ({ children }: { children?: ReactNode }) => createElement("div", null, children);
  return {
    View: V,
    Text: ({ children }: { children?: ReactNode }) => createElement("span", null, children),
    StyleSheet: { create: (s: unknown) => s },
    Pressable: ({ children, onPress }: { children?: ReactNode; onPress: () => void }) =>
      createElement("button", { type: "button", onClick: onPress }, children),
  };
});

let root: Root;
let host: HTMLElement;
const flush = () => act(async () => void (await new Promise((r) => setTimeout(r, 0))));
function serve(allAgents: boolean, setAccess: () => Promise<unknown> = async () => ({})) {
  m.rpc.mockImplementation(async (path: string) => {
    if (path === "connections/access") return { allAgents, botIds: ["botA"] };
    if (path === "bots/list") return [{ id: "bot1", name: "Calendar agent" }];
    return setAccess();
  });
}
async function mount() {
  await act(async () => {
    root.render(createElement(ConnectionAgent, { connectionId: "c1", botId: "bot1" }));
  });
  await flush();
}
const sw = () => host.querySelector("input") as HTMLInputElement;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  m.rpc.mockReset();
  m.push.mockReset();
  host = document.createElement("div");
  root = createRoot(host);
});
afterEach(() => act(() => root.unmount()));

it("shows the agent, opens its chat, and reflects the server switch state", async () => {
  serve(false);
  await mount();
  expect(host.textContent).toContain("Calendar agent");
  expect(sw().checked).toBe(false);
  await act(async () => host.querySelector("button")?.click());
  expect(m.push).toHaveBeenCalledWith({
    pathname: "/thread",
    params: { botId: "bot1", name: "Calendar agent" },
  });
});

it("saves the switch, disabled while saving", async () => {
  let done: () => void = () => undefined;
  serve(false, () => new Promise((r) => (done = () => r({}))));
  await mount();
  await act(async () => sw().click());
  expect(m.rpc).toHaveBeenCalledWith("connections/setAccess", {
    connectionId: "c1",
    allAgents: true,
    botIds: ["botA"],
  });
  expect(sw().disabled).toBe(true);
  expect(sw().checked).toBe(true);
  await act(async () => done());
  expect(sw().disabled).toBe(false);
});

it("restores the previous value on error", async () => {
  serve(false, async () => {
    throw new Error("nope");
  });
  await mount();
  await act(async () => sw().click());
  await flush();
  expect(sw().checked).toBe(false);
  expect(host.textContent).toContain("no");
});

it("shows Try again when loading fails and reloads on tap", async () => {
  m.rpc.mockRejectedValue(new Error("down"));
  await mount();
  expect(host.textContent).toContain("Try again.");
  serve(true);
  await act(async () => host.querySelector("button")?.click());
  await flush();
  expect(host.textContent).toContain("Calendar agent");
  expect(sw().checked).toBe(true);
});

it("ignores a stale load and saves with fresh botIds", async () => {
  serve(false);
  await mount();
  let n = 0;
  m.rpc.mockImplementation(async (path: string) => {
    if (path === "connections/access") return { allAgents: false, botIds: [`fresh${++n}`] };
    if (path === "bots/list") return [{ id: "bot1", name: "Calendar agent" }];
    return {};
  });
  await act(async () => sw().click());
  expect(m.rpc).toHaveBeenCalledWith("connections/setAccess", {
    connectionId: "c1",
    allAgents: true,
    botIds: ["fresh1"],
  });
});
