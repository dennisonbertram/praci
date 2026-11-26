// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act, useEffect } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import VoiceSettings from "../app/(settings)/voice";

const mocks = vi.hoisted(() => ({
  calls: vi.fn(),
  waiting: vi.fn(),
  saveCalls: vi.fn(),
  saveWaiting: vi.fn(),
  cue: vi.fn(),
  rpc: vi.fn(),
  failCatalog: false,
  failCatalogOnCall: 0,
  catalogCalls: 0,
  failVoices: false,
  failSetVoice: false,
  connected: false,
  focused: true,
  t: (text: string) => text,
}));
vi.mock("expo-router", () => ({
  useFocusEffect: (callback: () => void) => {
    useEffect(() => {
      if (mocks.focused) callback();
    }, [callback, mocks.focused]);
  },
}));
vi.mock("./call-sounds", () => ({
  loadCallSoundsEnabled: mocks.calls,
  loadWaitSoundEnabled: mocks.waiting,
  saveCallSoundsEnabled: mocks.saveCalls,
  saveWaitSoundEnabled: mocks.saveWaiting,
  playCallCue: mocks.cue,
}));
vi.mock("./api", () => ({ rpc: mocks.rpc }));
vi.mock("./device-voice", () => ({
  loadDeviceVoiceEnabled: async () => false,
  saveDeviceVoiceEnabled: vi.fn(),
}));
vi.mock("./voice", () => ({ speakText: vi.fn() }));
vi.mock("./i18n", () => ({ t: mocks.t, useI18n: () => ({ t: mocks.t }) }));
vi.mock("./user-error", () => ({ errorText: (error: unknown) => String(error) }));
vi.mock("./appearance", () => ({ mobileTokens: () => ({ destructive: "red" }) }));
vi.mock("./native", () => ({ native: {}, useThemedStyles: (factory: () => unknown) => factory() }));
vi.mock("../components/row-accessories", () => ({ Checkmark: () => null, Chevron: () => null }));
vi.mock("../components/native-action-button", () => ({
  NativeActionButton: ({ label, onPress }: { label: string; onPress: () => void }) => (
    <button type="button" onClick={onPress}>
      {label}
    </button>
  ),
}));
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));
vi.mock("../components/native-switch", () => ({
  NativeSwitch: (props: {
    accessibilityLabel: string;
    value: boolean;
    disabled?: boolean;
    onValueChange: (value: boolean) => void;
  }) => (
    <input
      type="checkbox"
      aria-label={props.accessibilityLabel}
      checked={props.value}
      disabled={props.disabled}
      onChange={(event) => props.onValueChange(event.target.checked)}
    />
  ),
}));
vi.mock("react-native", () => {
  const View = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    View,
    ScrollView: View,
    Text: View,
    ActivityIndicator: () => null,
    TextInput: (props: {
      accessibilityLabel?: string;
      value?: string;
      onChangeText?: (value: string) => void;
    }) => (
      <input
        aria-label={props.accessibilityLabel}
        value={props.value}
        onChange={(event) => props.onChangeText?.(event.target.value)}
      />
    ),
    Pressable: ({
      children,
      onPress,
      accessibilityState,
    }: {
      children?: ReactNode;
      onPress?: () => void;
      accessibilityState?: { selected?: boolean };
    }) => (
      <button type="button" data-selected={accessibilityState?.selected} onClick={onPress}>
        {children}
      </button>
    ),
    StyleSheet: { create: (styles: unknown) => styles },
    useWindowDimensions: () => ({ fontScale: 1 }),
  };
});

let container: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.clearAllMocks();
  mocks.focused = true;
  mocks.calls.mockResolvedValue(true);
  mocks.waiting.mockResolvedValue(true);
  mocks.saveCalls.mockResolvedValue(undefined);
  mocks.saveWaiting.mockResolvedValue(undefined);
  mocks.cue.mockResolvedValue(undefined);
  mocks.failCatalog = false;
  mocks.failCatalogOnCall = 0;
  mocks.catalogCalls = 0;
  mocks.failVoices = false;
  mocks.failSetVoice = false;
  mocks.connected = false;
  mocks.rpc.mockReset().mockImplementation(async (method: string) => {
    if (method === "voice/catalog") {
      mocks.catalogCalls += 1;
      if (mocks.failCatalog || mocks.catalogCalls === mocks.failCatalogOnCall)
        throw new Error("catalog failed");
      return [{ id: "fixture", name: "Fixture Voice", description: "", transcribe: false }];
    }
    if (method === "voice/credentials")
      return mocks.connected || mocks.failVoices
        ? [{ id: "credential", provider: "fixture", voiceId: "voice-one" }]
        : [];
    if (method === "voice/status") return { configured: false, ready: false, provider: null };
    if (method === "voice/voices") {
      if (mocks.failVoices) throw new Error("voices failed");
      return [
        { id: "voice-one", label: "Voice One" },
        { id: "voice-two", label: "Voice Two" },
      ];
    }
    if (method === "voice/connect") {
      mocks.connected = true;
      return {};
    }
    if (method === "voice/setVoice" && mocks.failSetVoice) throw new Error("set voice failed");
    return [];
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
async function render() {
  await act(async () => root.render(<VoiceSettings />));
}
function toggle(label: string) {
  return container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;
}

it.each([
  ["Call sounds", "calls", "Waiting sound"],
  ["Waiting sound", "waiting", "Call sounds"],
] as const)("keeps %s off and disabled when its read fails", async (label, read, other) => {
  mocks[read].mockRejectedValue(new Error("Could not load voice settings"));
  await render();
  expect(toggle(label).checked).toBe(false);
  expect(toggle(label).disabled).toBe(true);
  expect(toggle(other).checked).toBe(true);
  expect(toggle(other).disabled).toBe(false);
  expect(container.textContent).toContain("Could not load voice settings");
});

it("disables a previously loaded switch after a subsequent read failure", async () => {
  await render();
  expect(toggle("Call sounds").checked).toBe(true);
  mocks.focused = false;
  await render();
  mocks.calls.mockRejectedValue(new Error("Could not load voice settings"));
  mocks.focused = true;
  await render();
  expect(toggle("Call sounds").checked).toBe(false);
  expect(toggle("Call sounds").disabled).toBe(true);
});

it("previews only when call sounds are turned on and saved", async () => {
  mocks.calls.mockResolvedValue(false);
  await render();
  await act(async () => toggle("Call sounds").click());
  expect(mocks.saveCalls).toHaveBeenCalledWith(true);
  expect(mocks.cue).toHaveBeenCalledWith("start");
  await act(async () => toggle("Call sounds").click());
  expect(mocks.saveCalls).toHaveBeenLastCalledWith(false);
  expect(mocks.cue).toHaveBeenCalledTimes(1);
});

it("rolls a failed save back without playing a preview", async () => {
  mocks.calls.mockResolvedValue(false);
  mocks.saveCalls.mockRejectedValue(new Error("write failed"));
  await render();
  await act(async () => toggle("Call sounds").click());
  expect(toggle("Call sounds").checked).toBe(false);
  expect(mocks.cue).not.toHaveBeenCalled();
  expect(container.textContent).toContain("Could not save that preference");
});

it("shows retry after initial load failure and loads providers on retry", async () => {
  mocks.failCatalog = true;
  await render();
  expect(container.textContent).toContain("catalog failed");
  expect(container.textContent).not.toContain("Fixture Voice");
  const retry = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Try again",
  )!;
  expect(retry).toBeTruthy();
  mocks.failCatalog = false;
  await act(async () => retry.click());
  expect(container.textContent).not.toContain("catalog failed");
  expect(container.textContent).toContain("Fixture Voice");
  expect(mocks.rpc).toHaveBeenCalledWith("voice/catalog");
});

it("reports a refresh failure after connect without reporting connect failure", async () => {
  mocks.failCatalogOnCall = 2;
  await render();
  const key = container.querySelector<HTMLInputElement>('input[aria-label="API key"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
      key,
      "fake-api-key-123",
    );
    key.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const connect = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Connect",
  )!;
  await act(async () => connect.click());
  expect(mocks.rpc).toHaveBeenCalledWith(
    "voice/connect",
    expect.objectContaining({ apiKey: "fake-api-key-123" }),
  );
  expect(container.textContent).toContain("Could not load voice settings");
  expect(container.textContent).not.toContain("Could not connect");
});

it("restores the previous selected voice after saving the next voice fails", async () => {
  mocks.connected = true;
  await render();
  mocks.failSetVoice = true;
  const voiceOne = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Voice One",
  )!;
  const voiceTwo = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Voice Two",
  )!;
  expect(voiceOne.getAttribute("data-selected")).toBe("true");
  await act(async () => voiceTwo.click());
  expect(voiceOne.getAttribute("data-selected")).toBe("true");
});

it("saves one voice when two voices are tapped before the screen re-renders", async () => {
  mocks.connected = true;
  await render();
  const voiceTwo = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Voice Two",
  )!;
  await act(async () => {
    voiceTwo.click();
    voiceTwo.click();
  });
  expect(mocks.rpc.mock.calls.filter(([method]) => method === "voice/setVoice")).toHaveLength(1);
});

it("keeps provider controls available when loading voices fails", async () => {
  mocks.failVoices = true;
  mocks.connected = true;
  await render();
  expect(container.textContent).toContain("Fixture Voice");
  expect(container.textContent).not.toContain("Try again");
  expect(container.textContent).toContain("Disconnect");
});
