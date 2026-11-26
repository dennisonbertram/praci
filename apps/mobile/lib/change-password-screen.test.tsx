// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  changePassword: vi.fn(),
  back: vi.fn(),
}));

vi.mock("expo-router", () => ({
  useRouter: () => ({ canGoBack: () => true, back: state.back, replace: vi.fn() }),
}));
vi.mock("../lib/api", () => ({ changePassword: state.changePassword }));
vi.mock("../lib/i18n", () => {
  const t = (text: string) => text;
  return { useI18n: () => ({ t }) };
});
vi.mock("../lib/appearance", () => ({ mobileTokens: () => ({ destructive: "red" }) }));
vi.mock("../lib/native", () => ({
  native: { page: "white", fill: "white", tertiaryLabel: "gray", label: "black" },
  useThemedStyles: (factory: () => unknown) => factory(),
}));
vi.mock("../components/native-action-button", () => ({
  NativeActionButton: ({ label, onPress }: { label: string; onPress: () => void }) => (
    <button type="button" onClick={onPress}>
      {label}
    </button>
  ),
}));
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("react-native", () => {
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    KeyboardAvoidingView: Box,
    Platform: { OS: "ios" },
    ScrollView: Box,
    StyleSheet: { create: (styles: unknown) => styles },
    Text: Box,
    TextInput: (props: {
      accessibilityLabel: string;
      onChangeText: (value: string) => void;
      onSubmitEditing?: () => void;
      value: string;
    }) => (
      <input
        aria-label={props.accessibilityLabel}
        value={props.value}
        onChange={(event) => props.onChangeText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") props.onSubmitEditing?.();
        }}
      />
    ),
  };
});

const { default: ChangePassword } = await import("../app/(settings)/change-password");
vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

let root: Root;
let host: HTMLDivElement;
const render = () =>
  act(() => {
    root.render(<ChangePassword />);
  });

beforeEach(() => {
  state.changePassword.mockReset().mockResolvedValue(undefined);
  state.back.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("change password screen", () => {
  it("submits valid values when Return is pressed in Confirm password", async () => {
    render();
    const current = host.querySelector<HTMLInputElement>('[aria-label="Current password"]')!;
    const next = host.querySelector<HTMLInputElement>('[aria-label="New password"]')!;
    const confirm = host.querySelector<HTMLInputElement>('[aria-label="Confirm password"]')!;
    await act(async () => {
      for (const [input, value] of [
        [current, "current-secret"],
        [next, "new-password"],
        [confirm, "new-password"],
      ] as const) {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
        setter.call(input, value);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    });
    await act(async () => {
      confirm.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      await Promise.resolve();
    });
    expect(state.changePassword).toHaveBeenCalledTimes(1);
    expect(state.changePassword).toHaveBeenCalledWith("current-secret", "new-password");
  });
});
