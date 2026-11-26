// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act, useEffect } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { Alert } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AgentList from "../app/agent-list";
import AgentPage from "../app/agent-page";
import { savePins } from "../lib/agent-pins";

const state = vi.hoisted(() => ({
  params: { botId: "bot-a", pageId: "page-a" as string | undefined } as {
    botId: string;
    pageId?: string;
  },
  rpc: vi.fn(),
  pins: vi.fn(),
  focus: undefined as (() => undefined | (() => void)) | undefined,
  t: (text: string) => text,
}));
vi.mock("expo-router", () => ({
  Stack: {
    Screen: ({ options }: { options?: { title?: string } }) => <span>{options?.title}</span>,
  },
  useLocalSearchParams: () => state.params,
  useNavigation: () => ({ setOptions: vi.fn() }),
  useFocusEffect: (callback: () => undefined | (() => void)) => {
    state.focus = callback;
    useEffect(callback, [callback]);
  },
}));
vi.mock("../lib/api", () => ({ rpc: state.rpc }));
vi.mock("../lib/agent-pins", () => ({
  getPins: state.pins,
  savePins: vi.fn(),
}));
vi.mock("../lib/i18n", () => ({ useI18n: () => ({ t: state.t }) }));
vi.mock("../lib/hide-amounts", () => ({
  maskAmountsWhenHidden: (text: string) => text,
  maskSvgWhenHidden: (text: string) => text,
  setHideAmounts: vi.fn(),
  useHideAmounts: () => false,
}));
vi.mock("../lib/native", () => ({
  native: { page: "white", label: "black", secondaryLabel: "gray" },
  useResolvedAppearance: () => "light",
  useThemedStyles: (factory: () => unknown) => factory(),
}));
vi.mock("../lib/appearance", () => ({
  mobileTokens: () => ({ warning: "orange" }),
}));
vi.mock("../lib/native-controls", () => ({ iosAtLeast: () => false }));
vi.mock("../lib/user-error", () => ({
  errorText: (error: unknown) =>
    error instanceof Error ? error.message : "Could not load this page.",
}));
vi.mock("../components/native-symbol", () => ({ NativeSymbol: () => null }));
vi.mock("../components/native-action-button", () => ({
  NativeActionButton: ({ label, onPress }: { label: string; onPress: () => void }) => (
    <button type="button" onClick={onPress}>
      {label}
    </button>
  ),
}));
vi.mock("../components/menu-picker", () => ({
  MenuPicker: ({
    choices,
    value,
    onChange,
  }: {
    choices: { key: string; label: string }[];
    value: string;
    onChange: (id: string) => void;
  }) => (
    <select aria-label="Page" value={value} onChange={(event) => onChange(event.target.value)}>
      {choices.map((choice) => (
        <option key={choice.key} value={choice.key}>
          {choice.label}
        </option>
      ))}
    </select>
  ),
}));
vi.mock("../components/sandboxed-html-preview", () => ({
  SandboxedHtmlPreview: ({ html }: { html: string }) => <div>{html}</div>,
}));
vi.mock("../components/capped-list", () => ({ CappedList: () => null }));
vi.mock("@rakazo/chat-ui/native", () => ({
  ChatMarkdown: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("react-native-svg", () => ({ SvgXml: () => null }));
vi.mock("react-native", () => {
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    AccessibilityInfo: { announceForAccessibility: vi.fn() },
    ActivityIndicator: () => <i>loading</i>,
    Pressable: ({
      children,
      onPress,
      onAccessibilityAction,
      accessibilityActions,
      accessibilityRole,
    }: {
      children?: ReactNode;
      onPress?: () => void;
      onAccessibilityAction?: (event: { nativeEvent: { actionName: string } }) => void;
      accessibilityActions?: { name: string; label: string }[];
      accessibilityRole?: string;
    }) => {
      const Element = accessibilityRole === "checkbox" ? "button" : "div";
      return (
        <Element
          onClick={onPress}
          onContextMenu={(event) => {
            event.preventDefault();
            onAccessibilityAction?.({ nativeEvent: { actionName: "delete" } });
          }}
          data-accessibility-actions={JSON.stringify(accessibilityActions ?? [])}
          data-accessibility-role={accessibilityRole}
        >
          {children}
        </Element>
      );
    },
    RefreshControl: ({ onRefresh }: { onRefresh: () => void }) => (
      <button type="button" onClick={onRefresh}>
        Refresh
      </button>
    ),
    ScrollView: ({
      children,
      refreshControl,
    }: {
      children?: ReactNode;
      refreshControl?: ReactNode;
    }) => (
      <div>
        {refreshControl}
        {children}
      </div>
    ),
    StyleSheet: { create: (styles: unknown) => styles },
    Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
    View: Box,
    Alert: { alert: vi.fn() },
    TextInput: ({
      value,
      onChangeText,
      onSubmitEditing,
      onEndEditing,
      placeholder,
      defaultValue,
      accessibilityLabel,
    }: {
      value?: string;
      defaultValue?: string;
      placeholder?: string;
      accessibilityLabel?: string;
      onChangeText?: (text: string) => void;
      onSubmitEditing?: () => void;
      onEndEditing?: (event: { nativeEvent: { text: string } }) => void;
    }) => (
      <input
        aria-label={accessibilityLabel ?? placeholder}
        placeholder={placeholder}
        value={value}
        defaultValue={defaultValue}
        onChange={(event) => onChangeText?.(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") onSubmitEditing?.();
        }}
        onBlur={(event) => onEndEditing?.({ nativeEvent: { text: event.target.value } })}
      />
    ),
  };
});

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.params = { botId: "bot-a", pageId: "page-a" };
  state.rpc.mockReset();
  state.pins.mockReset();
  state.focus = undefined;
  vi.mocked(savePins).mockReset();
  vi.mocked(Alert.alert).mockReset();
  host = document.createElement("div");
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("agent page screen", () => {
  const page = (id: string) => ({
    id,
    title: id,
    kind: "blocks",
    revision: 1,
    content: '```metric\n{"label":"Value","source":"test","path":"/value"}\n```',
  });
  const data = (pageId: string, value: string) => ({
    pageId,
    revision: 1,
    blocks: [{ status: "ok", text: value }],
  });

  it("does not render the previous bot page after botId changes", async () => {
    state.rpc.mockImplementation(async (procedure: string, input: { botId: string }) => {
      if (procedure === "pages/list") return [];
      if (input.botId === "bot-b") return new Promise(() => {});
      return {
        id: "page-a",
        title: "A",
        kind: "markdown",
        revision: 1,
        content: "OLD BOT PAGE",
      };
    });
    await act(async () => root.render(<AgentPage />));
    expect(host.textContent).toContain("OLD BOT PAGE");
    state.params = { botId: "bot-b", pageId: "page-b" };
    await act(async () => root.render(<AgentPage />));
    expect(host.textContent).not.toContain("OLD BOT PAGE");
  });

  it("shows a retry action when the page list fails and clears it on success", async () => {
    let fail = true;
    state.rpc.mockImplementation(async (procedure: string) => {
      if (procedure === "pages/list") {
        if (fail) throw new Error("list failed");
        return [];
      }
      return {
        id: "page-a",
        title: "A",
        kind: "markdown",
        revision: 1,
        content: "PAGE",
      };
    });
    await act(async () => root.render(<AgentPage />));
    expect(host.textContent).toContain("Try again");
    fail = false;
    const retry = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "Try again",
    );
    expect(retry).toBeTruthy();
    await act(async () => {
      retry?.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(host.textContent).not.toContain("Try again");
  });

  it("ignores refresh data for page A after switching to page B", async () => {
    let finishRefresh!: (value: unknown) => void;
    state.rpc.mockImplementation((procedure: string, input: { pageId?: string }) => {
      if (procedure === "pages/list")
        return Promise.resolve([
          { id: "page-a", title: "A" },
          { id: "page-b", title: "B" },
        ]);
      if (procedure === "pages/get") return Promise.resolve(page(input.pageId ?? "page-a"));
      if (procedure === "pages/data")
        return Promise.resolve(
          data(input.pageId ?? "page-a", input.pageId === "page-b" ? "B value" : "A value"),
        );
      if (procedure === "pages/refresh")
        return new Promise((resolve) => {
          finishRefresh = resolve;
        });
      return Promise.resolve(null);
    });
    await act(async () => root.render(<AgentPage />));
    expect(host.textContent).toContain("A value");
    await act(async () => {
      [...host.querySelectorAll("button")]
        .find((button) => button.textContent === "Refresh")
        ?.click();
    });
    const select = host.querySelector<HTMLSelectElement>("select");
    expect(select).toBeTruthy();
    await act(async () => {
      if (select) {
        select.value = "page-b";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    expect(host.textContent).toContain("B value");
    await act(async () => finishRefresh(data("page-a", "stale A value")));
    expect(host.textContent).toContain("B value");
    expect(host.textContent).not.toContain("stale A value");
  });

  it("does not show agent A live data after agent B data fails", async () => {
    state.rpc.mockImplementation((procedure: string, input: { botId: string }) => {
      if (procedure === "pages/list") return Promise.resolve([]);
      if (procedure === "pages/get") return Promise.resolve(page("page-a"));
      if (procedure === "pages/data")
        return input.botId === "bot-a"
          ? Promise.resolve(data("page-a", "Agent A value"))
          : Promise.reject(new Error("offline"));
      return Promise.resolve(null);
    });
    await act(async () => root.render(<AgentPage />));
    expect(host.textContent).toContain("Agent A value");
    state.params = { botId: "bot-b", pageId: "page-a" };
    await act(async () => root.render(<AgentPage />));
    expect(host.textContent).not.toContain("Agent A value");
  });

  it("shows a page error and retries pages/get after switching", async () => {
    let failPageB = true;
    state.rpc.mockImplementation((procedure: string, input: { pageId?: string }) => {
      if (procedure === "pages/list")
        return Promise.resolve([
          { id: "page-a", title: "A" },
          { id: "page-b", title: "B" },
        ]);
      if (procedure === "pages/get") {
        if (input.pageId === "page-b" && failPageB) return Promise.reject(new Error("page failed"));
        return Promise.resolve(page(input.pageId ?? "page-a"));
      }
      if (procedure === "pages/data")
        return Promise.resolve(
          data(input.pageId ?? "page-a", input.pageId === "page-b" ? "B value" : "A value"),
        );
      return Promise.resolve(null);
    });
    await act(async () => root.render(<AgentPage />));
    const select = host.querySelector<HTMLSelectElement>("select");
    expect(select).toBeTruthy();
    await act(async () => {
      if (select) {
        select.value = "page-b";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    expect(host.textContent).toContain("page failed");
    expect(host.textContent).toContain("Try again");
    expect(host.textContent).not.toContain("loading");
    failPageB = false;
    const retry = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "Try again",
    );
    await act(async () => retry?.click());
    expect(host.textContent).toContain("B value");
    expect(host.textContent).not.toContain("A value");
    expect(host.textContent).not.toContain("Try again");
  });

  it("clears the page when a focus refresh returns not found", async () => {
    let getCount = 0;
    state.rpc.mockImplementation((procedure: string) => {
      if (procedure === "pages/list") return Promise.resolve([]);
      if (procedure === "pages/get") {
        getCount += 1;
        return getCount === 1
          ? Promise.resolve({ ...page("page-a"), content: "Loaded page content" })
          : Promise.reject(Object.assign(new Error("missing page"), { status: 404 }));
      }
      if (procedure === "pages/data") return Promise.resolve(null);
      return Promise.resolve(null);
    });
    await act(async () => root.render(<AgentPage />));
    expect(host.textContent).toContain("Loaded page content");

    await act(async () => {
      state.focus?.();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(host.textContent).toContain("missing page");
    expect(host.textContent).toContain("Try again");
    expect(host.textContent).not.toContain("Loaded page content");
  });

  it("keeps the page when a focus refresh fails with a non-404 error", async () => {
    let getCount = 0;
    state.rpc.mockImplementation((procedure: string) => {
      if (procedure === "pages/list") return Promise.resolve([]);
      if (procedure === "pages/get") {
        getCount += 1;
        return getCount === 1
          ? Promise.resolve({ ...page("page-a"), content: "Loaded page content" })
          : Promise.reject(Object.assign(new Error("offline"), { status: 503 }));
      }
      if (procedure === "pages/data") return Promise.resolve(null);
      return Promise.resolve(null);
    });
    await act(async () => root.render(<AgentPage />));
    await act(async () => {
      state.focus?.();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(host.textContent).toContain("Loaded page content");
    expect(host.textContent).not.toContain("Try again");
  });

  it("shows refresh errors without discarding blocks and clears them after success", async () => {
    let failRefresh = true;
    state.rpc.mockImplementation((procedure: string, input: { pageId?: string }) => {
      if (procedure === "pages/list") return Promise.resolve([]);
      if (procedure === "pages/get") return Promise.resolve(page(input.pageId ?? "page-a"));
      if (procedure === "pages/data")
        return Promise.resolve(data(input.pageId ?? "page-a", "Saved value"));
      if (procedure === "pages/refresh")
        return failRefresh
          ? Promise.reject(new Error("refresh failed"))
          : Promise.resolve(data(input.pageId ?? "page-a", "Fresh value"));
      return Promise.resolve(null);
    });
    await act(async () => root.render(<AgentPage />));
    await act(async () => {
      [...host.querySelectorAll("button")]
        .find((button) => button.textContent === "Refresh")
        ?.click();
    });
    expect(host.textContent).toContain("refresh failed");
    expect(host.textContent).toContain("Saved value");
    failRefresh = false;
    await act(async () => {
      [...host.querySelectorAll("button")]
        .find((button) => button.textContent === "Refresh")
        ?.click();
    });
    expect(host.textContent).not.toContain("refresh failed");
    expect(host.textContent).toContain("Fresh value");
  });
});

describe("agent list screen", () => {
  const initialList = { title: "List", items: [] };

  async function renderList() {
    state.pins.mockResolvedValue({ revision: 7, list: initialList });
    await act(async () => root.render(<AgentList />));
  }

  function addDraft(text: string) {
    const input = host.querySelector<HTMLInputElement>('input[placeholder="Add item"]');
    if (!input) throw new Error("Add item input was not rendered");
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  }

  it("retries a failed save once with the same candidate and revision", async () => {
    vi.useFakeTimers();
    await renderList();
    vi.mocked(savePins)
      .mockRejectedValueOnce(new Error("temporary failure"))
      .mockResolvedValueOnce({
        ok: true,
        pins: {
          revision: 8,
          list: { ...initialList, items: [{ id: "item-1", text: "Keep me", done: false }] },
        },
      } as never);
    await act(async () => addDraft("Keep me"));
    await act(async () => vi.advanceTimersByTimeAsync(1500));
    expect(savePins).toHaveBeenCalledTimes(2);
    expect(savePins).toHaveBeenNthCalledWith(
      1,
      "bot-a",
      {
        ...initialList,
        items: [{ id: expect.any(String), text: "Keep me", done: false }],
      },
      7,
    );
    const calls = (savePins as unknown as { mock: { calls: [string, unknown, number][] } }).mock
      .calls;
    expect(calls[1]).toEqual(calls[0]);
    expect([...host.querySelectorAll("input")].some((input) => input.value === "Keep me")).toBe(
      true,
    );
  });

  it("restores a failed addition draft and excludes it from the next saved edit", async () => {
    vi.useFakeTimers();
    await renderList();
    vi.mocked(savePins).mockRejectedValue(new Error("offline"));
    await act(async () => addDraft("Failed item"));
    await act(async () => vi.advanceTimersByTimeAsync(1500));
    expect(
      [...host.querySelectorAll<HTMLInputElement>('input:not([placeholder="Add item"])')].some(
        (input) => input.value === "Failed item",
      ),
    ).toBe(false);
    expect(host.querySelector<HTMLInputElement>('input[placeholder="Add item"]')?.value).toBe(
      "Failed item",
    );
    vi.mocked(savePins).mockResolvedValue({
      ok: true,
      pins: { revision: 8, list: initialList },
    } as never);
    await act(async () => addDraft("Saved item"));
    expect(savePins).toHaveBeenLastCalledWith(
      "bot-a",
      {
        ...initialList,
        items: [{ id: expect.any(String), text: "Saved item", done: false }],
      },
      7,
    );
    expect([...host.querySelectorAll("input")].some((input) => input.value === "Saved item")).toBe(
      true,
    );
    expect(
      [...host.querySelectorAll<HTMLInputElement>('input:not([placeholder="Add item"])')].some(
        (input) => input.value === "Failed item",
      ),
    ).toBe(false);
  });

  it("opens delete confirmation from the checkbox accessibility action", async () => {
    await renderList();
    state.pins.mockResolvedValue({
      revision: 7,
      list: { title: "List", items: [{ id: "item-1", text: "Delete me", done: false }] },
    });
    await act(async () => root.unmount());
    root = createRoot(host);
    await act(async () => root.render(<AgentList />));
    const checkbox = host.querySelector<HTMLButtonElement>(
      'button[data-accessibility-role="checkbox"]',
    );
    expect(checkbox?.dataset.accessibilityActions).toContain('"name":"delete"');
    await act(async () =>
      checkbox?.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true })),
    );
    expect(vi.mocked(Alert.alert)).toHaveBeenCalledWith(
      "Delete",
      undefined,
      expect.arrayContaining([expect.objectContaining({ text: "Delete", style: "destructive" })]),
    );
  });

  it("ignores a late answer for the old bot and retries the current bot", async () => {
    let finishOld!: (value: unknown) => void;
    state.pins.mockImplementation((botId: string) =>
      botId === "bot-a"
        ? new Promise((resolve) => {
            finishOld = resolve;
          })
        : Promise.reject(new Error("offline")),
    );
    await act(async () => root.render(<AgentList />));
    state.params = { botId: "bot-b" };
    await act(async () => root.render(<AgentList />));
    expect(host.textContent).toContain("Try again");
    await act(async () => finishOld({ revision: 1, list: { title: "Old bot", items: [] } }));
    expect(host.textContent).not.toContain("Old bot");
    state.pins.mockResolvedValue({
      revision: 2,
      list: { title: "New bot", items: [] },
    });
    const retry = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "Try again",
    );
    expect(retry).toBeTruthy();
    await act(async () => retry?.click());
    expect(host.textContent).toContain("New bot");
  });
});
