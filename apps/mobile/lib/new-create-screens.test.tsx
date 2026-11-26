// @vitest-environment jsdom

import { GROUP_NAME_MAX } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  rpc: vi.fn(),
  params: { spaceId: "space-1", name: "Support" } as { spaceId?: string; name?: string },
  back: vi.fn(),
  replace: vi.fn(),
  dismissAll: vi.fn(),
  selectSpace: vi.fn(),
  options: undefined as undefined | { title?: string },
}));
vi.mock("expo-router", () => ({
  Stack: {
    Screen: ({ options }: { options: { title?: string } }) => {
      state.options = options;
      return null;
    },
  },
  useLocalSearchParams: () => state.params,
  useRouter: () => ({ back: state.back, replace: state.replace, dismissAll: state.dismissAll }),
}));
vi.mock("../lib/api", () => ({ rpc: state.rpc, selectSpace: state.selectSpace }));
vi.mock("../lib/i18n", () => ({ useI18n: () => ({ t: (value: string) => value }) }));
vi.mock("../lib/native", () => ({
  native: { fill: "fill" },
  useMobileTokens: () => ({
    background: "background",
    mutedForeground: "muted",
    foreground: "foreground",
    destructive: "red",
  }),
}));
vi.mock("../lib/user-error", () => ({
  errorText: (_reason: unknown, fallback: string) => fallback,
}));
vi.mock("../lib/inbox-spaces", () => ({ SPACE_NAME_MAX: 80 }));
vi.mock("../components/sheet-header", () => ({ cancelHeaderOptions: () => ({}) }));
vi.mock("../components/native-action-button", () => ({
  NativeActionButton: ({
    label,
    onPress,
    prominence,
  }: {
    label: string;
    onPress: () => void;
    prominence?: string;
  }) =>
    createElement(
      "button",
      { type: "button", onClick: onPress, "data-prominence": prominence },
      label,
    ),
}));
vi.mock("../components/bot-member-picker", () => ({
  BotMemberPicker: ({
    bots,
    selected,
    onChange,
  }: {
    bots: Array<{ id: string; name: string }>;
    selected: string[];
    onChange: (value: string[]) => void;
  }) =>
    createElement(
      "div",
      null,
      bots.map((bot) =>
        createElement(
          "button",
          {
            key: bot.id,
            type: "button",
            role: "switch",
            "aria-checked": selected.includes(bot.id),
            onClick: () =>
              onChange(
                selected.includes(bot.id)
                  ? selected.filter((id) => id !== bot.id)
                  : [...selected, bot.id],
              ),
          },
          bot.name,
        ),
      ),
    ),
}));
vi.mock("react-native", () => {
  const box = ({ children }: { children?: ReactNode }) => createElement("div", null, children);
  return {
    ActivityIndicator: () => createElement("i", { "data-testid": "spinner" }),
    Alert: { alert: vi.fn() },
    ScrollView: box,
    StyleSheet: { create: (styles: unknown) => styles },
    Text: box,
    TextInput: ({
      value,
      onChangeText,
      maxLength,
      returnKeyType,
      onSubmitEditing,
    }: {
      value?: string;
      onChangeText?: (value: string) => void;
      maxLength?: number;
      returnKeyType?: string;
      onSubmitEditing?: () => void;
    }) =>
      createElement("input", {
        value,
        maxLength,
        "data-return-key-type": returnKeyType,
        onChange: (event: { target: { value: string } }) => onChangeText?.(event.target.value),
        onKeyDown: (event: { key: string; preventDefault: () => void }) => {
          if (event.key === "Enter") {
            event.preventDefault();
            onSubmitEditing?.();
          }
        },
      }),
  };
});

import NewGroup from "../app/new-group";
import NewSpace from "../app/new-space";

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.rpc.mockReset();
  state.back.mockReset();
  state.replace.mockReset();
  state.dismissAll.mockReset();
  state.selectSpace.mockReset();
  state.selectSpace.mockResolvedValue(true);
  state.options = undefined;
  state.params = { spaceId: "space-1", name: "Support" };
  host = document.createElement("div");
  root = createRoot(host);
});
afterEach(() => act(() => root.unmount()));

it("shows retry after bots fail and reloads the bots", async () => {
  state.rpc
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce([{ id: "bot-1", name: "Basil", archivedAt: null }]);
  await act(async () => root.render(createElement(NewGroup)));
  expect(host.textContent).toContain("Could not load bots");
  const retry = [...host.querySelectorAll("button")].find(
    (button) => button.textContent === "Try again",
  );
  expect(retry?.getAttribute("data-prominence")).toBe("secondary");
  await act(async () => retry?.click());
  expect(host.textContent).toContain("Basil");
  expect(host.textContent).not.toContain("Could not load bots");
});

it("shows Saving while a rename request is pending", async () => {
  let finish!: () => void;
  state.rpc.mockReturnValue(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  await act(async () => root.render(createElement(NewSpace)));
  await act(async () => host.querySelector("button")?.click());
  expect(host.textContent).toContain("Saving…");
  await act(async () => finish());
});

it("shows the rename title and Save action", async () => {
  await act(async () => root.render(createElement(NewSpace)));
  expect(state.options?.title).toBe("Rename space");
  expect(host.textContent).toContain("Save");
});

it("does not navigate after a rename screen is dismissed", async () => {
  let finish!: () => void;
  state.rpc.mockReturnValue(
    new Promise<void>((resolve) => {
      finish = resolve;
    }),
  );
  await act(async () => root.render(createElement(NewSpace)));
  await act(async () => host.querySelector("button")?.click());
  await act(async () => root.unmount());
  await act(async () => finish());
  expect(state.back).not.toHaveBeenCalled();
});

it("does not select or navigate after a create screen is dismissed", async () => {
  let finish!: (space: { id: string }) => void;
  state.params = {};
  state.rpc.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  await act(async () => root.render(createElement(NewSpace)));
  const input = host.querySelector("input")!;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(
    input,
    "Community",
  );
  await act(async () => input.dispatchEvent(new Event("input", { bubbles: true })));
  await act(async () => host.querySelector("button")?.click());
  expect(state.rpc).toHaveBeenCalledWith("spaces/create", { name: "Community" });
  await act(async () => root.unmount());
  await act(async () => finish({ id: "space-2" }));
  expect(state.selectSpace).not.toHaveBeenCalled();
  expect(state.dismissAll).not.toHaveBeenCalled();
  expect(state.replace).not.toHaveBeenCalled();
});

it("does not navigate after a group create screen is dismissed", async () => {
  let finish!: (group: { id: string; name: string }) => void;
  state.rpc
    .mockResolvedValueOnce([
      { id: "bot-1", name: "Basil", archivedAt: null },
      { id: "bot-2", name: "Miso", archivedAt: null },
    ])
    .mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
  await act(async () => root.render(createElement(NewGroup)));
  const input = host.querySelector("input")!;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Support");
  await act(async () => input.dispatchEvent(new Event("input", { bubbles: true })));
  const switches = [...host.querySelectorAll<HTMLButtonElement>('[role="switch"]')];
  for (const switchButton of switches) await act(async () => switchButton.click());
  const create = [...host.querySelectorAll("button")].find(
    (button) => button.textContent === "Create group",
  )!;
  await act(async () => create.click());
  expect(state.rpc).toHaveBeenLastCalledWith("groups/create", {
    name: "Support",
    botIds: ["bot-1", "bot-2"],
  });
  await act(async () => root.unmount());
  await act(async () => finish({ id: "group-1", name: "Support" }));
  expect(state.replace).not.toHaveBeenCalled();
});

it("submits a valid group from the name field Done action", async () => {
  state.rpc
    .mockResolvedValueOnce([
      { id: "bot-1", name: "Basil", archivedAt: null },
      { id: "bot-2", name: "Miso", archivedAt: null },
    ])
    .mockResolvedValueOnce({ id: "group-1", name: "Support" });
  await act(async () => root.render(createElement(NewGroup)));
  const input = host.querySelector("input")!;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Support");
  await act(async () => input.dispatchEvent(new Event("input", { bubbles: true })));
  for (const switchButton of host.querySelectorAll<HTMLButtonElement>('[role="switch"]'))
    await act(async () => switchButton.click());
  await act(async () =>
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })),
  );
  expect(state.rpc).toHaveBeenCalledWith("groups/create", {
    name: "Support",
    botIds: ["bot-1", "bot-2"],
  });
});

it("limits group names to the contract maximum", async () => {
  state.rpc.mockResolvedValueOnce([]);
  await act(async () => root.render(createElement(NewGroup)));
  expect(GROUP_NAME_MAX).toBe(80);
  expect(host.querySelector("input")?.getAttribute("maxlength")).toBe(String(GROUP_NAME_MAX));
});
