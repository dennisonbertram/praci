// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  artifactId: "artifact-a",
  versions: vi.fn(),
  get: vi.fn(),
  options: vi.fn(),
}));
vi.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ artifactId: state.artifactId }),
  useNavigation: () => ({ setOptions: state.options }),
  useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));
vi.mock("../lib/artifacts", () => ({
  artifactThreadTarget: () => null,
  getArtifactById: state.get,
  listArtifactVersions: state.versions,
  removeArtifact: vi.fn(),
}));
vi.mock("../lib/artifact-open", () => ({
  shareLocalFile: vi.fn(),
  writeArtifactCacheFile: () => ({ uri: "file:///artifact" }),
}));
vi.mock("../lib/artifact-preview", () => ({
  computePreview: async (artifact: { name: string }) => ({
    kind: "markdown",
    text: artifact.name,
  }),
}));
vi.mock("../lib/floating-header", () => ({ useFloatingHeaderInset: () => 0 }));
vi.mock("../lib/activity", () => ({ formatActivityRelativeTime: () => "now" }));
vi.mock("../lib/i18n", () => {
  const t = (s: string) => s;
  return { t, useI18n: () => ({ t }) };
});
vi.mock("../lib/message-action-sheet", () => ({
  presentMessageActionSheet: vi.fn(),
}));
vi.mock("../lib/native-controls", () => ({ iosAtLeast: () => false }));
vi.mock("../lib/native", () => ({
  native: { page: "white", secondaryLabel: "gray", label: "black" },
  useResolvedAppearance: () => "light",
  useThemedStyles: (factory: () => unknown) => factory(),
}));
vi.mock("../lib/appearance", () => ({
  mobileTokens: () => ({ destructive: "red" }),
}));
vi.mock("../components/native-symbol", () => ({ NativeSymbol: () => null }));
vi.mock("../components/pdf-preview", () => ({ PdfPreview: () => null }));
vi.mock("../components/sandboxed-html-preview", () => ({
  SandboxedHtmlPreview: () => null,
}));
vi.mock("../components/sheet-artifact-preview", () => ({
  SheetArtifactPreview: () => null,
}));
vi.mock("../components/ui-artifact-preview", () => ({
  UiArtifactPreview: () => null,
}));
vi.mock("@rakazo/chat-ui/native", () => ({
  ChatMarkdown: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("react-native", () => {
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    ActivityIndicator: () => <span>Loading</span>,
    Alert: { alert: vi.fn() },
    Image: () => null,
    Platform: { OS: "ios", Version: "26.0" },
    Pressable: ({ children, onPress }: { children?: ReactNode; onPress?: () => void }) => (
      <button onClick={onPress}>{children}</button>
    ),
    ScrollView: Box,
    StyleSheet: { create: (x: unknown) => x, hairlineWidth: 1 },
    Text: Box,
    View: Box,
  };
});
vi.mock("expo-file-system", () => ({ File: class {}, Paths: {} }));
vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

vi.stubGlobal("__DEV__", false);
const { default: ArtifactDetailScreen } = await import("../app/artifact");

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

const artifact = (id: string, name: string) => ({
  id,
  name,
  mimeType: "text/markdown",
  contentBase64: "",
  version: 1,
  createdAt: new Date().toISOString(),
  description: null,
  botId: null,
  groupId: null,
});
let root: Root;
let host: HTMLDivElement;
const render = async () =>
  act(async () => {
    root.render(<ArtifactDetailScreen />);
    await Promise.resolve();
    await Promise.resolve();
  });
const flush = async () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });

beforeEach(() => {
  state.artifactId = "artifact-a";
  state.versions.mockReset().mockResolvedValue([]);
  state.get.mockReset().mockImplementation(async (id: string) => artifact(id, `Content ${id}`));
  state.options.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("artifact detail screen", () => {
  it("does not render the prior artifact after artifactId changes", async () => {
    await render();
    await flush();
    expect(host.textContent).toContain("Content artifact-a");
    state.artifactId = "artifact-b";
    await render();
    expect(host.textContent).not.toContain("Content artifact-a");
    await flush();
    expect(host.textContent).toContain("Content artifact-b");
  });

  it("retries a failed detail request for the current version", async () => {
    state.get.mockRejectedValueOnce(new Error("offline"));
    await render();
    await flush();
    expect(host.textContent).toContain("Try again.");
    const retry = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "Try again.",
    )!;
    await act(async () => {
      retry.click();
      await Promise.resolve();
      await Promise.resolve();
    });
    await flush();
    expect(state.get).toHaveBeenCalledTimes(2);
    expect(state.get).toHaveBeenLastCalledWith("artifact-a");
    expect(host.textContent).toContain("Content artifact-a");
  });
});
