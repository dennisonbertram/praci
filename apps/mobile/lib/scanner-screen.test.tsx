// @vitest-environment jsdom
import type { EffectCallback, ReactNode } from "react";
import { act, useEffect } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ScannerScreen from "../app/scanner";

const state = vi.hoisted(() => ({ rpc: vi.fn(), push: vi.fn(), alert: vi.fn() }));
vi.mock("expo-router", () => ({
  Stack: {
    Screen: ({ options }: { options: { headerRight: () => ReactNode } }) => (
      <>{options.headerRight()}</>
    ),
  },
  useRouter: () => ({ push: state.push }),
  useFocusEffect: (callback: EffectCallback) => {
    useEffect(callback, [callback]);
  },
}));
vi.mock("../lib/api", () => ({
  rpc: state.rpc,
  currentApiBase: () => "http://localhost",
  selectedSpaceId: () => "space-a",
}));
vi.mock("../lib/session", () => ({ currentSessionGeneration: () => 1 }));
vi.mock("../lib/i18n", () => ({ useI18n: () => ({ t: (text: string) => text }) }));
vi.mock("../lib/user-error", () => ({ errorText: (cause: unknown) => String(cause) }));
vi.mock("../components/native-action-button", () => ({
  NativeActionButton: ({ label, onPress }: { label: string; onPress: () => void }) => (
    <button type="button" onClick={onPress}>
      {label}
    </button>
  ),
}));
vi.mock("../app/data-room", () => ({ default: () => null }));
vi.mock("react-native", () => ({ Alert: { alert: state.alert } }));

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.rpc.mockReset();
  state.push.mockReset();
  state.alert.mockReset();
  host = document.createElement("div");
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  vi.unstubAllGlobals();
});

describe("scanner screen", () => {
  it("ignores a second Ask agent tap while its request is pending", async () => {
    let finish!: (bot: { id: string; name: string }) => void;
    state.rpc.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    await act(async () => root.render(<ScannerScreen />));
    const button = host.querySelector("button");
    expect(button).toBeTruthy();
    await act(async () => {
      button?.click();
      button?.click();
    });
    expect(
      state.rpc.mock.calls.filter(([procedure]) => procedure === "scanner/agent"),
    ).toHaveLength(2);
    await act(async () => finish({ id: "bot-a", name: "Scanner" }));
    expect(state.push).toHaveBeenCalledTimes(1);
  });

  it("allows another Ask agent tap after a request fails", async () => {
    state.rpc.mockImplementationOnce(() => Promise.resolve(undefined));
    state.rpc.mockImplementationOnce(() => Promise.reject(new Error("offline")));
    state.rpc.mockImplementationOnce(() => Promise.resolve({ id: "bot-a", name: "Scanner" }));
    await act(async () => root.render(<ScannerScreen />));
    const button = host.querySelector("button");
    expect(button).toBeTruthy();
    await act(async () => button?.click());
    await act(async () => button?.click());
    expect(
      state.rpc.mock.calls.filter(([procedure]) => procedure === "scanner/agent"),
    ).toHaveLength(3);
    expect(state.push).toHaveBeenCalledTimes(1);
    expect(state.alert).toHaveBeenCalledWith("Scanner", "Error: offline");
  });
});
