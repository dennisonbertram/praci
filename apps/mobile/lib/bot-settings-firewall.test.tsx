// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act, createElement, useEffect } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BotSettingsScreen from "../app/bot-settings";
import { rpc } from "./api";

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  rpc: vi.fn(),
  failures: new Set<string>(),
  calls: new Map<string, number>(),
  firewall: false,
  checkInFailure: false,
  checkInCadence: "off",
  skills: [] as Array<{
    id: string;
    name: string;
    description: string;
    source: string;
    readOnly: boolean;
    enabled: boolean;
  }>,
}));

function deferredSave() {
  let resolve!: () => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<void>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}

const fixture = {
  id: "bot-fixture",
  name: "Fixture",
  title: "",
  color: "#8B5CF6",
  computerMode: "team",
  autoSpeak: false,
  notifyOnFinish: true,
  firewall: false,
  spawnKey: null as string | null,
};

vi.mock("./bot-voices", () => ({
  voiceLabel: (voice: { language: string; name: string }) => `${voice.language} · ${voice.name}`,
  deviceVoices: async () => [],
  voiceForBot: async () => undefined,
  setVoiceForBot: async () => undefined,
}));
vi.mock("./device-voice", () => ({ loadDeviceVoiceEnabled: async () => false }));
vi.mock("./voice", () => ({ stopVoicePlayback: () => undefined }));
vi.mock("expo-speech", () => ({ stop: async () => undefined, speak: () => undefined }));
vi.mock("./api", () => ({
  rpc: mocks.rpc,
}));
vi.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ back: vi.fn() }),
  useLocalSearchParams: () => ({ botId: "bot-fixture" }),
  useFocusEffect: (effect: () => (() => void) | undefined) => useEffect(effect, [effect]),
}));
vi.mock("react-native", () => {
  const view = ({
    children,
    style,
    accessibilityLabel,
    accessibilityRole,
    accessibilityState,
  }: {
    children?: ReactNode;
    style?: unknown;
    accessibilityLabel?: string;
    accessibilityRole?: string;
    accessibilityState?: { disabled?: boolean };
  }) =>
    createElement(
      "div",
      {
        "data-style": JSON.stringify(style),
        "aria-label": accessibilityLabel,
        role: accessibilityRole,
        "aria-disabled": accessibilityState?.disabled ? "true" : undefined,
      },
      children,
    );
  return {
    ActivityIndicator: () => createElement("i", { "data-testid": "spinner" }),
    Platform: { OS: "ios" },
    StyleSheet: { create: (styles: unknown) => styles },
    ScrollView: view,
    View: view,
    Text: ({ children }: { children?: ReactNode }) => createElement("span", null, children),
    TextInput: ({
      value,
      placeholder,
      onChangeText,
    }: {
      value?: string;
      placeholder?: string;
      onChangeText?: (text: string) => void;
    }) =>
      createElement("input", {
        "aria-label": placeholder,
        value,
        onChange: (event: { currentTarget: { value: string } }) =>
          onChangeText?.(event.currentTarget.value),
      }),
    Pressable: ({ children, onPress }: { children?: ReactNode; onPress: () => void }) =>
      createElement("button", { type: "button", onClick: onPress }, children),
    Alert: { alert: mocks.alert },
  };
});
vi.mock("./native", () => ({
  native: { tertiaryLabel: "muted" },
  useMobileTokens: () => ({ mutedForeground: "muted", foreground: "ink", destructive: "error" }),
  useResolvedAppearance: () => "light",
  useThemedStyles: (createStyles: () => unknown) => createStyles(),
}));
vi.mock("./i18n", () => {
  const t = (text: string, values?: { name: string }) => text.replace("{name}", values?.name ?? "");
  return { t, useI18n: () => ({ t }) };
});
vi.mock("./user-error", () => ({ errorText: (error: unknown) => String(error) }));
vi.mock("../components/bot-avatar", () => ({ BotAvatar: () => null }));
vi.mock("../components/capped-list", () => ({
  CappedList: ({
    items,
    renderItem,
  }: {
    items: unknown[];
    renderItem: (item: unknown) => ReactNode;
  }) => createElement("div", null, items.map(renderItem)),
}));
vi.mock("../components/computer-mode-picker", () => ({ ComputerModePicker: () => null }));
vi.mock("../components/native-action-button", () => ({
  NativeActionButton: ({
    label,
    onPress,
    disabled,
  }: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
  }) =>
    createElement(
      "button",
      { type: "button", "aria-label": label, disabled, onClick: onPress },
      label,
    ),
}));
vi.mock("../components/native-switch", () => ({
  NativeSwitch: ({
    value,
    onValueChange,
    accessibilityLabel,
    disabled,
  }: {
    value: boolean;
    onValueChange?: (next: boolean) => void;
    accessibilityLabel?: string;
    disabled?: boolean;
  }) =>
    createElement(
      "button",
      {
        type: "button",
        role: "switch",
        "aria-checked": value,
        "aria-label": accessibilityLabel,
        disabled,
        // A toggle that slipped past the platform's disabled state still reaches the handler,
        // so the screen's own guard is what the overlapping-save test exercises.
        onClick: () => onValueChange?.(!value),
      },
      accessibilityLabel,
    ),
}));
vi.mock("../components/row-accessories", () => ({ Chevron: () => null }));
vi.mock("../components/native-symbol", () => ({ NativeSymbol: () => null }));
vi.mock("@expo/ui/community/menu", () => ({
  MenuView: ({
    children,
    actions,
    onPressAction,
    title,
  }: {
    children?: ReactNode;
    actions: { id: string; title: string; state?: string; attributes?: { disabled?: boolean } }[];
    onPressAction: (event: { nativeEvent: { event: string } }) => void;
    title: string;
  }) =>
    createElement(
      "section",
      { "data-menu": title },
      children,
      ...actions.map((action) =>
        createElement(
          "button",
          {
            type: "button",
            key: action.id,
            disabled: action.attributes?.disabled,
            "data-state": action.state,
            onClick: () => onPressAction({ nativeEvent: { event: action.id } }),
          },
          action.title,
        ),
      ),
    ),
}));

describe("bot settings Firewall", () => {
  let root: Root;
  let container: HTMLDivElement;
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.failures.clear();
    mocks.calls.clear();
    mocks.firewall = false;
    mocks.checkInFailure = false;
    mocks.checkInCadence = "off";
    mocks.skills = [];
    mocks.rpc.mockReset().mockImplementation(async (procedure: string) => {
      mocks.calls.set(procedure, (mocks.calls.get(procedure) ?? 0) + 1);
      if (mocks.failures.has(procedure)) throw new Error(`failed ${procedure}`);
      if (procedure === "checkIn/get" && mocks.checkInFailure) throw new Error("check in failed");
      if (procedure === "bots/get") return { ...fixture, firewall: mocks.firewall };
      if (procedure === "checkIn/get") return { cadence: mocks.checkInCadence };
      if (procedure === "agentSkills/forBot") return mocks.skills;
      if (procedure === "me") return {};
      if (procedure === "models/list" && mocks.failures.has(procedure)) {
        throw new Error(`failed ${procedure}`);
      }
      if (procedure === "models/list")
        return [{ provider: "acme", providerName: "Acme", id: "acme-1", label: "Connected Model" }];
      if (procedure === "models/credentials")
        return [{ provider: "acme", modelId: "acme-1", label: "Acme", hasKey: true }];
      return [];
    });
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    container = document.createElement("div");
    root = createRoot(container);
  });
  afterEach(() => {
    act(() => root.unmount());
    vi.unstubAllGlobals();
  });

  const render = async () => act(async () => root.render(<BotSettingsScreen />));
  const firewallSwitch = () =>
    container.querySelector<HTMLButtonElement>('button[aria-label="Firewall"]')!;
  const updates = () =>
    vi.mocked(rpc).mock.calls.filter(([procedure]) => procedure === "bots/update");
  const typeName = async (text: string) => {
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Name this bot"]')!;
    const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    await act(async () => {
      setValue.call(input, text);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
  };
  const pressSave = async () => {
    const save = container.querySelector<HTMLButtonElement>('button[aria-label="Save"]')!;
    await act(async () => save.click());
  };

  it("saves Firewall on at once, and only after confirming the turn-off", async () => {
    await render();
    expect(firewallSwitch().getAttribute("aria-checked")).toBe("false");

    await act(async () => firewallSwitch().click());
    expect(updates()).toEqual([["bots/update", { botId: "bot-fixture", firewall: true }]]);
    expect(firewallSwitch().getAttribute("aria-checked")).toBe("true");

    await act(async () => firewallSwitch().click());
    const [title, body, buttons] = mocks.alert.mock.calls.at(-1)!;
    expect(title).toBe("Turn off Firewall?");
    expect(body).toBeUndefined();
    expect(
      buttons.map((button: { text: string; style?: string }) => [button.text, button.style]),
    ).toEqual([
      ["Cancel", "cancel"],
      ["Turn off", "destructive"],
    ]);
    // Cancel sends nothing and leaves the switch on.
    expect(updates()).toHaveLength(1);
    expect(firewallSwitch().getAttribute("aria-checked")).toBe("true");

    const turnOff = buttons.find((button: { style?: string }) => button.style === "destructive");
    await act(async () => turnOff.onPress());
    expect(updates().at(-1)).toEqual(["bots/update", { botId: "bot-fixture", firewall: false }]);
    expect(firewallSwitch().getAttribute("aria-checked")).toBe("false");
  });

  it("disables the switch and ignores a second toggle while a save is in flight", async () => {
    const pending = deferredSave();
    vi.mocked(rpc).mockImplementation(async (procedure: string) => {
      mocks.calls.set(procedure, (mocks.calls.get(procedure) ?? 0) + 1);
      if (procedure === "bots/get") return { ...fixture };
      if (procedure === "checkIn/get") return { cadence: "off" };
      if (procedure === "me") return {};
      if (procedure === "bots/update") return pending.promise;
      return [];
    });
    await render();
    await act(async () => firewallSwitch().click());
    expect(firewallSwitch().getAttribute("aria-checked")).toBe("true");
    expect(firewallSwitch().disabled).toBe(true);
    // An older request must not be beaten by a later one, so a second toggle is ignored.
    await act(async () => firewallSwitch().click());
    expect(updates()).toHaveLength(1);
    expect(mocks.alert).not.toHaveBeenCalled();
    await act(async () => pending.resolve());
    expect(firewallSwitch().disabled).toBe(false);
    expect(firewallSwitch().getAttribute("aria-checked")).toBe("true");
  });

  it("keeps Firewall out of the general save", async () => {
    await render();
    await typeName("Renamed");
    await pressSave();
    expect(updates()).toHaveLength(1);
    const [, input] = updates()[0]!;
    expect(input).toMatchObject({ botId: "bot-fixture", name: "Renamed" });
    expect(input).not.toHaveProperty("firewall");
  });

  it("hides Firewall from a voice agent", async () => {
    vi.mocked(rpc).mockImplementation(async (procedure: string) => {
      if (procedure === "bots/get") return { ...fixture, spawnKey: "voice-agent:user-1" };
      if (procedure === "checkIn/get") return { cadence: "off" };
      if (procedure === "me") return {};
      return [];
    });
    await render();
    expect(firewallSwitch()).toBeNull();
  });

  it("hides the form on load failure and retries with the loaded Firewall value", async () => {
    mocks.failures.add("bots/get");
    await render();
    expect(container.textContent).toContain("failed bots/get");
    expect(container.querySelector('button[aria-label="Firewall"]')).toBeNull();
    const retry = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Try again",
    )!;
    expect(retry).toBeTruthy();
    mocks.failures.delete("bots/get");
    mocks.firewall = true;
    await act(async () => retry.click());
    expect(mocks.calls.get("bots/get")).toBe(2);
    expect(firewallSwitch().getAttribute("aria-checked")).toBe("true");
  });

  it("retries a failed check-in read and shows the loaded cadence", async () => {
    mocks.checkInFailure = true;
    await render();
    expect(container.textContent).toContain("Try again");
    const retry = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Check inTry again",
    )!;
    mocks.checkInFailure = false;
    mocks.checkInCadence = "daily";
    await act(async () => retry.click());
    expect(mocks.calls.get("checkIn/get")).toBe(2);
    expect(
      [...container.querySelectorAll('[data-menu="Check in"] button')]
        .find((button) => button.textContent === "Daily")
        ?.getAttribute("data-state"),
    ).toBe("on");
  });

  it("disables check-in choices while a save is in flight", async () => {
    const pending = deferredSave();
    vi.mocked(rpc).mockImplementation(async (procedure: string) => {
      if (procedure === "bots/get") return { ...fixture };
      if (procedure === "checkIn/get") return { cadence: "off" };
      if (procedure === "checkIn/set") return pending.promise;
      if (procedure === "me") return {};
      if (procedure === "models/list" || procedure === "models/credentials") return [];
      return [];
    });
    await render();
    const daily = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Daily",
    )!;
    await act(async () => daily.click());
    // While the save runs there is no menu to open, so no second choice can be made.
    expect(container.querySelector('[data-menu="Check in"]')).toBeNull();
    expect(
      vi.mocked(rpc).mock.calls.filter(([procedure]) => procedure === "checkIn/set"),
    ).toHaveLength(1);
    await act(async () => pending.reject(new Error("save failed")));
    expect(container.textContent).toContain("Could not save check-in");
    const off = [...container.querySelectorAll('[data-menu="Check in"] button')].find(
      (button) => button.textContent === "Off",
    );
    expect(off?.getAttribute("data-state")).toBe("on");
  });

  it("retries model metadata from Advanced and shows the connected model", async () => {
    mocks.failures.add("models/list");
    await render();
    const advanced = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Advanced",
    )!;
    await act(async () => advanced.click());
    expect(container.textContent).toContain("failed models/list");
    const retry = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Try again",
    )!;
    mocks.failures.delete("models/list");
    await act(async () => retry.click());
    expect(container.textContent).toContain("Connected Model");
    expect(mocks.calls.get("me")).toBe(2);
    expect(mocks.calls.get("models/list")).toBe(2);
    expect(mocks.calls.get("models/credentials")).toBe(2);
  });

  it("disables only the skill being saved", async () => {
    const pending = deferredSave();
    mocks.skills = [
      {
        id: "skill-a",
        name: "Skill A",
        description: "",
        source: "user",
        readOnly: false,
        enabled: false,
      },
      {
        id: "skill-b",
        name: "Skill B",
        description: "",
        source: "user",
        readOnly: false,
        enabled: false,
      },
    ];
    vi.mocked(rpc).mockImplementation(async (procedure: string) => {
      if (procedure === "bots/get") return { ...fixture };
      if (procedure === "checkIn/get") return { cadence: "off" };
      if (procedure === "agentSkills/forBot") return mocks.skills;
      if (procedure === "agentSkills/setEnabled") return pending.promise;
      if (procedure === "me") return {};
      if (procedure === "models/list" || procedure === "models/credentials") return [];
      return [];
    });
    await render();
    const skillA = container.querySelector<HTMLButtonElement>('button[aria-label="Use Skill A"]')!;
    const skillB = container.querySelector<HTMLButtonElement>('button[aria-label="Use Skill B"]')!;
    await act(async () => skillA.click());
    expect(skillA.disabled).toBe(true);
    expect(skillB.disabled).toBe(false);
    await act(async () => pending.reject(new Error("save failed")));
    expect(skillA.getAttribute("aria-checked")).toBe("false");
  });
});
