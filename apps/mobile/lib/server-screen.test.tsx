// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ServerScreen from "../app/server";

const state = vi.hoisted(() => ({
  probe: vi.fn(),
  save: vi.fn(),
  back: vi.fn(),
  save_: undefined as undefined | (() => void),
}));

vi.mock("expo-router", () => ({
  Stack: {
    Screen: ({ options }: { options: { onSave?: () => void } }) => {
      state.save_ = options.onSave;
      return null;
    },
  },
  useRouter: () => ({ canGoBack: () => true, back: state.back, replace: vi.fn() }),
}));
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));
vi.mock("react-native", () => {
  const box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    KeyboardAvoidingView: box,
    ScrollView: box,
    Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
    Platform: { OS: "ios" },
    TextInput: ({
      value,
      onChangeText,
    }: {
      value?: string;
      onChangeText?: (value: string) => void;
    }) => <input value={value ?? ""} onChange={(event) => onChangeText?.(event.target.value)} />,
  };
});
vi.mock("../components/native-action-button", () => ({ NativeActionButton: () => null }));
vi.mock("../components/sheet-header", () => ({
  cancelHeaderOptions: () => ({}),
  trailingHeaderOptions: (_label: string, onSave: () => void) => ({ onSave }),
}));
vi.mock("./api", () => ({
  apiBaseWarning: () => null,
  currentApiBase: () => "https://api.rakazo.test",
  defaultApiBase: () => "https://api.rakazo.test",
  normalizeApiBase: (value: string) => ({ ok: true, url: value }),
  probeApiBase: state.probe,
  resetApiBase: vi.fn(),
  saveApiBase: state.save,
  usesCustomApiBase: () => false,
}));
vi.mock("./i18n", () => ({ useI18n: () => ({ t: (text: string) => text }) }));
vi.mock("./native", () => ({
  useMobileTokens: () => ({ background: "", mutedForeground: "", muted: "", foreground: "" }),
}));

let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  state.probe.mockReset().mockImplementation(async (url: string) => ({ ok: true, url }));
  state.save.mockReset().mockResolvedValue({ ok: true });
  state.back.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const typeUrl = (value: string) =>
  act(async () => {
    const el = container.querySelector("input")!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(el, value);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
const save = () => act(async () => state.save_!());

it("checks the typed server, stores its origin, then closes", async () => {
  await act(async () => root.render(<ServerScreen />));
  await typeUrl("https://my.server.test");
  await save();
  expect(state.probe).toHaveBeenCalledWith("https://my.server.test");
  expect(state.save).toHaveBeenCalledWith("https://my.server.test");
  expect(state.back).toHaveBeenCalledOnce();
});

it("shows the probe error and stores nothing when the server cannot be reached", async () => {
  state.probe.mockResolvedValue({ ok: false, error: "Could not reach that server" });
  await act(async () => root.render(<ServerScreen />));
  await typeUrl("https://down.server.test");
  await save();
  expect(container.textContent).toContain("Could not reach that server");
  expect(state.save).not.toHaveBeenCalled();
  expect(state.back).not.toHaveBeenCalled();
});
