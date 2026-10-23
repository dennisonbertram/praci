// @vitest-environment jsdom
import { UI_ARTIFACT_MIME_TYPE } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act, useEffect } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { Platform } from "react-native";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DataRoomScreen from "../app/data-room";
import DataRoomItemScreen from "../app/data-room-item";
import type * as DataRoomModule from "./data-room";

const state = vi.hoisted(() => ({
  folders: vi.fn(),
  items: vi.fn(),
  item: vi.fn(),
  download: vi.fn(),
  share: vi.fn(),
  push: vi.fn(),
  setOptions: vi.fn(),
  dispose: vi.fn(),
  params: {} as { folderId?: string; itemId?: string },
  inputChange: undefined as ((value: string) => void) | undefined,
  sessionListener: undefined as (() => void) | undefined,
}));
vi.mock("expo-router", () => ({
  useFocusEffect: (callback: () => () => void) => useEffect(callback, [callback]),
  useLocalSearchParams: () => state.params,
  useRouter: () => ({ push: state.push }),
  useNavigation: () => ({ setOptions: state.setOptions }),
}));
vi.mock("./data-room", async (original) => ({
  ...(await original<typeof DataRoomModule>()),
  listDataRoomFolders: state.folders,
  listDataRoomItems: state.items,
  getDataRoomItem: state.item,
}));
vi.mock("./data-room-file", () => ({ downloadDataRoomFile: state.download }));
vi.mock("./artifact-open", () => ({ shareLocalFile: state.share }));
vi.mock("./api", () => ({
  currentApiBase: () => "https://api.example.test",
  selectedSpaceId: () => "space-a",
}));
vi.mock("./session", () => ({
  currentSessionGeneration: () => 1,
  subscribeSessionGeneration: (listener: () => void) => {
    state.sessionListener = listener;
    return () => {
      state.sessionListener = undefined;
    };
  },
}));
vi.mock("expo-file-system", () => ({ File: class {}, Directory: class {}, Paths: {} }));
vi.mock("./i18n", () => {
  const t = (text: string) => text;
  return { t, useI18n: () => ({ t }) };
});
vi.mock("./native", () => ({ native: {}, useThemedStyles: (create: () => unknown) => create() }));
vi.mock("./appearance", () => ({ mobileTokens: () => ({ destructive: "red" }) }));
vi.mock("./floating-header", () => ({ useFloatingHeaderInset: () => 0 }));
vi.mock("../components/native-symbol", () => ({ NativeSymbol: () => null }));
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
    <button type="button" onClick={onPress} disabled={disabled}>
      {label}
    </button>
  ),
}));
vi.mock("../components/pdf-preview", () => ({
  PdfPreview: ({ uri }: { uri: string }) => <div data-testid="pdf">{uri}</div>,
}));
vi.mock("../components/sheet-artifact-preview", () => ({
  SheetArtifactPreview: ({ source }: { source: { dataRoomItemId: string } }) => (
    <div data-testid="sheet">{source.dataRoomItemId}</div>
  ),
}));
vi.mock("../components/ui-artifact-preview", () => ({
  UiArtifactPreview: ({ source }: { source: string }) => <div data-testid="ui">{source}</div>,
}));
vi.mock("react-native", () => ({
  ActivityIndicator: () => <div role="status">Loading</div>,
  Alert: { alert: vi.fn() },
  Image: ({ source }: { source: { uri: string } }) => <div data-testid="image">{source.uri}</div>,
  Platform: { OS: "ios" },
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  TextInput: ({
    accessibilityLabel,
    value,
    onChangeText,
  }: {
    accessibilityLabel: string;
    value: string;
    onChangeText: (value: string) => void;
  }) => {
    state.inputChange = onChangeText;
    return <input aria-label={accessibilityLabel} value={value} readOnly />;
  },
  Pressable: ({
    children,
    onPress,
    accessibilityLabel,
  }: {
    children: ReactNode;
    onPress: () => void;
    accessibilityLabel: string;
  }) => (
    <button type="button" onClick={onPress} aria-label={accessibilityLabel}>
      {children}
    </button>
  ),
  RefreshControl: () => null,
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  FlatList: ({
    data,
    renderItem,
    ListHeaderComponent,
    ListEmptyComponent,
    ListFooterComponent,
  }: {
    data: { id: string }[];
    renderItem: (input: { item: { id: string } }) => ReactNode;
    ListHeaderComponent: ReactNode;
    ListEmptyComponent: ReactNode;
    ListFooterComponent: ReactNode;
  }) => (
    <div>
      {ListHeaderComponent}
      {data.length
        ? data.map((item) => <div key={item.id}>{renderItem({ item })}</div>)
        : ListEmptyComponent}
      {ListFooterComponent}
    </div>
  ),
}));

const item = {
  id: "item-a",
  name: "Invented plan.pdf",
  mimeType: "application/pdf",
  size: 120,
  status: "indexing",
  notIndexed: false,
  error: null,
};
let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  state.params = {};
  Platform.OS = "ios";
  state.inputChange = undefined;
  state.folders.mockReset().mockResolvedValue([
    { id: "folder-a", name: "Plans", parentId: null },
    { id: "folder-b", name: "Archive", parentId: "folder-a" },
  ]);
  state.items.mockReset().mockResolvedValue({ items: [item], nextCursor: null });
  state.item.mockReset().mockResolvedValue(item);
  state.download.mockReset().mockResolvedValue({
    file: { uri: "file:///cache/plan.pdf", size: 120, text: async () => "invented ui" },
    assertCurrent: vi.fn(),
    dispose: state.dispose,
  });
  state.share.mockReset().mockResolvedValue(undefined);
  state.push.mockReset();
  state.setOptions.mockReset();
  state.dispose.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
});
async function render(node: ReactNode) {
  await act(async () => root.render(node));
}
async function click(text: string) {
  const button = [...host.querySelectorAll("button")].find((node) => node.textContent === text);
  expect(button).toBeTruthy();
  await act(async () => button?.click());
}

describe("native Data room list", () => {
  it("shows root folders and status, opens a folder or file, and has no upload control", async () => {
    await render(<DataRoomScreen />);
    expect(host.textContent).toContain("Processing…");
    expect(host.textContent).not.toContain("Archive");
    expect(host.textContent).not.toContain("Upload");
    await click("Plans");
    expect(state.push).toHaveBeenLastCalledWith({
      pathname: "/data-room",
      params: { folderId: "folder-a" },
    });
    await act(async () =>
      (host.querySelector('[aria-label="Invented plan.pdf"]') as HTMLButtonElement).click(),
    );
    expect(state.push).toHaveBeenLastCalledWith({
      pathname: "/data-room-item",
      params: { itemId: "item-a" },
    });
  });
  it("uses the native search bar with the selected folder and loads the next search page", async () => {
    vi.useFakeTimers();
    state.params = { folderId: "folder-a" };
    await render(<DataRoomScreen />);
    expect(host.textContent).toContain("Archive");
    state.items.mockResolvedValueOnce({ items: [item], nextCursor: "cursor-a" });
    const options = state.setOptions.mock.calls.at(-1)?.[0];
    await act(async () => {
      options.headerSearchBarOptions.onChangeText({ nativeEvent: { text: "budget" } });
    });
    await act(async () => vi.advanceTimersByTime(250));
    expect(state.items).toHaveBeenLastCalledWith({ folderId: "folder-a", query: "budget" });
    expect(host.textContent).not.toContain("Archive");
    state.items.mockResolvedValueOnce({
      items: [{ ...item, id: "item-b", name: "Invented budget.csv" }],
      nextCursor: null,
    });
    await click("Load more");
    expect(state.items).toHaveBeenLastCalledWith({
      folderId: "folder-a",
      query: "budget",
      cursor: "cursor-a",
    });
    expect(host.textContent).toContain("Invented plan.pdf");
    expect(host.textContent).toContain("Invented budget.csv");
  });
  it("supports empty and failed requests, and clears displayed files on session changes", async () => {
    state.items.mockRejectedValueOnce(new Error("offline"));
    await render(<DataRoomScreen />);
    state.items.mockResolvedValueOnce({ items: [], nextCursor: null });
    await click("Retry");
    expect(host.textContent).toContain("No files");
    await act(async () => state.sessionListener?.());
    expect(host.textContent).toContain("session changed");
  });
  it("uses a controlled Android search field and clears the filter without a header search bar", async () => {
    vi.useFakeTimers();
    Platform.OS = "android";
    await render(<DataRoomScreen />);
    expect(state.setOptions.mock.calls.at(-1)?.[0].headerSearchBarOptions).toBeUndefined();
    expect(host.querySelector('[aria-label="Search files"]')).toBeTruthy();
    await act(async () => state.inputChange?.("budget"));
    await act(async () => vi.advanceTimersByTime(250));
    expect(state.items).toHaveBeenLastCalledWith({ folderId: undefined, query: "budget" });
    expect((host.querySelector("input") as HTMLInputElement).value).toBe("budget");
    await click("Clear");
    await act(async () => vi.advanceTimersByTime(250));
    expect(state.items).toHaveBeenLastCalledWith({ folderId: undefined, query: "" });
  });
  it("ignores a response that arrives after leaving the screen", async () => {
    let resolve!: (value: unknown) => void;
    state.items.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    await render(<DataRoomScreen />);
    await render(<div>Another page</div>);
    await act(async () => resolve({ items: [item], nextCursor: null }));
    expect(host.textContent).toBe("Another page");
  });
});

describe("native Data room item", () => {
  it("uses the local PDF preview and native share flow with the original display name", async () => {
    state.params = { itemId: "item-a" };
    await render(<DataRoomItemScreen />);
    expect(host.querySelector('[data-testid="pdf"]')?.textContent).toBe("file:///cache/plan.pdf");
    const options = state.setOptions.mock.calls.at(-1)?.[0];
    await render(
      <>
        <DataRoomItemScreen />
        {options.headerRight()}
      </>,
    );
    await click("Share");
    expect(state.share).toHaveBeenCalledWith(
      "file:///cache/plan.pdf",
      "application/pdf",
      "Invented plan.pdf",
    );
    await render(<div>Another page</div>);
    expect(state.dispose).toHaveBeenCalled();
  });
  it("reuses the spreadsheet preview with the Data room source rather than an artifact ID", async () => {
    state.params = { itemId: "item-a" };
    state.item.mockResolvedValue({ ...item, name: "Invented budget.csv", mimeType: "text/csv" });
    await render(<DataRoomItemScreen />);
    expect(host.querySelector('[data-testid="sheet"]')?.textContent).toBe("item-a");
    expect(state.download).not.toHaveBeenCalled();
  });
  it.each([
    ["image/png", "image"],
    [UI_ARTIFACT_MIME_TYPE, "ui"],
  ])("reuses the native %s preview", async (mimeType, testId) => {
    state.params = { itemId: "item-a" };
    state.item.mockResolvedValue({ ...item, mimeType });
    await render(<DataRoomItemScreen />);
    expect(host.querySelector(`[data-testid="${testId}"]`)?.textContent).toBe(
      testId === "ui" ? "invented ui" : "file:///cache/plan.pdf",
    );
  });
  it("surfaces a preview failure without preventing a file download through Share", async () => {
    state.params = { itemId: "item-a" };
    state.download.mockRejectedValueOnce(new Error("offline"));
    await render(<DataRoomItemScreen />);
    expect(host.textContent).toContain("Retry");
    expect(state.setOptions.mock.calls.at(-1)?.[0].headerRight().props.disabled).toBe(false);
  });
});
