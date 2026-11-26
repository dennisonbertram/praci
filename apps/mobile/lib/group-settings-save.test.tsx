// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GroupSettings from "../app/group-settings";

const state = vi.hoisted(() => ({
  rpc: vi.fn(),
  alert: vi.fn(),
  translate: (text: string) => text,
  pickerOnChange: undefined as ((ids: string[]) => void) | undefined,
}));

vi.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({ groupId: "group-1" }),
  useRouter: () => ({ back: vi.fn(), replace: vi.fn() }),
}));
vi.mock("../lib/api", () => ({ rpc: state.rpc }));
vi.mock("../lib/i18n", () => ({ useI18n: () => ({ t: state.translate }) }));
vi.mock("../lib/native", () => ({
  native: { fill: "fill" },
  useMobileTokens: () => ({
    background: "bg",
    mutedForeground: "muted",
    foreground: "ink",
    destructive: "red",
  }),
}));
vi.mock("../lib/user-error", () => ({
  errorText: (error: unknown) => (error instanceof Error ? error.message : "error"),
}));
vi.mock("../components/glass-title", () => ({ glassHeaderOptions: () => ({}) }));
vi.mock("../components/bot-member-picker", () => ({
  BotMemberPicker: ({
    onChange,
    disabled,
  }: {
    onChange: (ids: string[]) => void;
    disabled?: boolean;
  }) => {
    state.pickerOnChange = onChange;
    return (
      <button type="button" disabled={disabled} onClick={() => onChange(["b", "a"])}>
        Change members
      </button>
    );
  },
}));
vi.mock("../components/native-action-button", () => ({
  NativeActionButton: ({
    label,
    onPress,
    disabled,
  }: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" disabled={disabled} onClick={onPress}>
      {label}
    </button>
  ),
}));
vi.mock("react-native", () => {
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    ActivityIndicator: () => <i data-testid="spinner" />,
    Alert: { alert: state.alert },
    ScrollView: Box,
    View: Box,
    Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
    TextInput: ({
      value,
      editable,
      onChangeText,
    }: {
      value?: string;
      editable?: boolean;
      onChangeText?: (value: string) => void;
    }) => (
      <input
        value={value ?? ""}
        readOnly={!editable}
        onChange={(event) => onChangeText?.(event.target.value)}
      />
    ),
  };
});

let root: Root;
let container: HTMLDivElement;
let groupMembers: { botId: string }[];

function button(label: string) {
  return [...container.querySelectorAll("button")].find((item) => item.textContent === label)!;
}

async function renderScreen() {
  await act(async () => root.render(<GroupSettings />));
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.pickerOnChange = undefined;
  state.alert.mockReset();
  groupMembers = [{ botId: "a" }, { botId: "b" }];
  state.rpc.mockReset().mockImplementation(async (procedure: string) => {
    if (procedure === "groups/list") {
      return [{ id: "group-1", name: "Fixture", members: groupMembers }];
    }
    if (procedure === "bots/list") return [];
    return undefined;
  });
  container = document.createElement("div");
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  vi.unstubAllGlobals();
});

describe("group settings save", () => {
  it("keeps the original member order when the picker returns it reversed", async () => {
    await renderScreen();

    await act(async () => state.pickerOnChange?.(["b", "a"]));
    await act(async () => button("Save").click());

    expect(
      state.rpc.mock.calls.filter(([procedure]) => procedure === "groups/update"),
    ).toHaveLength(0);
  });

  it("sends a genuinely changed member order", async () => {
    groupMembers = [{ botId: "a" }, { botId: "b" }];
    await renderScreen();

    await act(async () => state.pickerOnChange?.(["b", "c"]));
    await act(async () => button("Save").click());

    expect(state.rpc).toHaveBeenCalledWith("groups/update", {
      groupId: "group-1",
      botIds: ["b", "c"],
    });
  });

  it("disables editing and deletion while a save is pending", async () => {
    let resolveUpdate!: () => void;
    state.rpc.mockImplementation((procedure: string) => {
      if (procedure === "groups/list") {
        return Promise.resolve([{ id: "group-1", name: "Fixture", members: groupMembers }]);
      }
      if (procedure === "bots/list") return Promise.resolve([]);
      if (procedure === "groups/update")
        return new Promise<void>((resolve) => (resolveUpdate = resolve));
      return Promise.resolve(undefined);
    });
    await renderScreen();

    await act(async () => state.pickerOnChange?.(["b", "c"]));
    await act(async () => button("Save").click());

    expect(button("Delete group").disabled).toBe(true);
    expect(button("Saving…").disabled).toBe(true);
    expect(container.querySelector("input")?.readOnly).toBe(true);
    expect(button("Change members").disabled).toBe(true);
    await act(async () => resolveUpdate());
  });

  it("does not issue another delete while the first delete is pending", async () => {
    let resolveRemove!: () => void;
    state.rpc.mockImplementation((procedure: string) => {
      if (procedure === "groups/list") {
        return Promise.resolve([{ id: "group-1", name: "Fixture", members: groupMembers }]);
      }
      if (procedure === "bots/list") return Promise.resolve([]);
      if (procedure === "groups/remove")
        return new Promise<void>((resolve) => (resolveRemove = resolve));
      return Promise.resolve(undefined);
    });
    await renderScreen();
    await act(async () => button("Delete group").click());
    const actions = state.alert.mock.calls.at(-1)?.[2] as {
      onPress?: () => void;
      style?: string;
    }[];
    const destructive = actions.find((action) => action.style === "destructive")!;

    await act(async () => destructive.onPress?.());
    expect(
      state.rpc.mock.calls.filter(([procedure]) => procedure === "groups/remove"),
    ).toHaveLength(1);
    expect(button("Delete group").disabled).toBe(true);

    await act(async () => button("Delete group").click());
    expect(
      state.rpc.mock.calls.filter(([procedure]) => procedure === "groups/remove"),
    ).toHaveLength(1);
    await act(async () => resolveRemove());
  });

  it("reenables deletion and preserves the error alert when removal fails", async () => {
    state.rpc.mockImplementation(async (procedure: string) => {
      if (procedure === "groups/list") {
        return [{ id: "group-1", name: "Fixture", members: groupMembers }];
      }
      if (procedure === "bots/list") return [];
      if (procedure === "groups/remove") throw new Error("remove failed");
      return undefined;
    });
    await renderScreen();
    await act(async () => button("Delete group").click());
    const actions = state.alert.mock.calls.at(-1)?.[2] as {
      onPress?: () => void;
      style?: string;
    }[];
    const destructive = actions.find((action) => action.style === "destructive")!;

    await act(async () => {
      destructive.onPress?.();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(button("Delete group").disabled).toBe(false);
    expect(state.alert).toHaveBeenLastCalledWith("Could not delete group", "remove failed");
  });

  it("includes the irreversible warning in the delete confirmation", async () => {
    await renderScreen();
    await act(async () => button("Delete group").click());

    expect(state.alert).toHaveBeenCalledWith(
      "Fixture",
      "Delete this group? Bots and their solo threads are kept. This can't be undone.",
      expect.any(Array),
    );
  });
});
