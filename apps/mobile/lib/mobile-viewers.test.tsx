// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act, useEffect } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  params: {
    messageId: "message-a",
    attachmentId: "attachment-a",
    filename: "a.png",
    mimeType: "image/png",
    size: "1",
  },
  preview: vi.fn(),
  imageUri: vi.fn(),
  spreadsheetPreview: vi.fn(),
  download: vi.fn(),
  share: vi.fn(),
}));
vi.mock("expo-router", () => ({
  useLocalSearchParams: () => state.params,
  useNavigation: () => ({ setOptions: vi.fn() }),
}));
vi.mock("../lib/artifact-open", () => ({
  imageArtifactPreview: state.preview,
  imageArtifactUri: state.imageUri,
  shareLocalFile: state.share,
}));
vi.mock("../lib/artifacts", () => ({ getSpreadsheetPreview: state.spreadsheetPreview }));
vi.mock("../lib/mail-attachment", () => ({
  attachmentKind: () => "image",
  downloadMailAttachment: state.download,
}));
// One stable t: components that list t as an effect dependency would reload on every render otherwise.
vi.mock("../lib/i18n", () => {
  const t = (text: string) => text;
  return { useI18n: () => ({ t }) };
});
vi.mock("../lib/native", () => ({
  native: { page: "white", secondaryLabel: "gray", label: "black", separator: "gray" },
  useThemedStyles: (factory: () => unknown) => factory(),
}));
vi.mock("../lib/user-error", () => ({ errorText: (error: unknown) => String(error) }));
vi.mock("../lib/inline-image", () => ({ fitImageSize: () => ({ width: 100, height: 100 }) }));
vi.mock("../lib/native-controls", () => ({ iosAtLeast: () => false }));
vi.mock("../lib/appearance", () => ({
  mobileTokens: () => ({
    background: "white",
    border: "gray",
    foreground: "black",
    mutedForeground: "gray",
  }),
}));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
vi.mock("react-native-gesture-handler", () => ({
  Gesture: new Proxy(
    {},
    {
      get: () => () => ({
        onUpdate() {
          return this;
        },
        onEnd() {
          return this;
        },
        numberOfTaps() {
          return this;
        },
        runOnJS() {
          return this;
        },
        maxPointers() {
          return this;
        },
      }),
    },
  ),
  GestureDetector: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
vi.mock("react-native-reanimated", () => ({
  default: {
    Image: ({ onError }: { onError?: () => void }) => (
      <button type="button" onClick={onError}>
        Fail image
      </button>
    ),
  },
  useAnimatedStyle: () => ({}),
  useSharedValue: (value: number) => ({ value }),
  withTiming: (value: number) => value,
}));
vi.mock("../components/glass-icon-button", () => ({
  GlassIconButton: ({
    accessibilityLabel,
    onPress,
  }: {
    accessibilityLabel: string;
    onPress: () => void;
  }) => <button type="button" aria-label={accessibilityLabel} onClick={onPress} />,
}));
vi.mock("../components/native-action-button", () => ({
  NativeActionButton: ({ label, onPress }: { label: string; onPress: () => void }) => (
    <button type="button" onClick={onPress}>
      {label}
    </button>
  ),
}));
vi.mock("../components/pdf-preview", () => ({ PdfPreview: () => null }));
vi.mock("react-native", () => {
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const View = ({
    children,
    onLayout,
  }: {
    children?: ReactNode;
    onLayout?: (event: { nativeEvent: { layout: { width: number; height: number } } }) => void;
  }) => {
    useEffect(
      () => onLayout?.({ nativeEvent: { layout: { width: 200, height: 200 } } }),
      [onLayout],
    );
    return <div>{children}</div>;
  };
  return {
    Alert: { alert: vi.fn() },
    ActivityIndicator: () => <i>Loading</i>,
    Image: ({ onError, source }: { onError?: () => void; source?: { uri?: string } }) => (
      <button type="button" data-uri={source?.uri} onClick={onError}>
        Fail rendered image
      </button>
    ),
    Platform: { OS: "ios" },
    Pressable: ({ children, onPress }: { children?: ReactNode; onPress?: () => void }) => (
      <button type="button" onClick={onPress}>
        {children}
      </button>
    ),
    ScrollView: Box,
    StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
    Text: Box,
    View,
  };
});

const { ImageArtifactViewer } = await import("../components/image-artifact-viewer");
const { default: InboxAttachmentScreen } = await import("../app/inbox-attachment");
const { SheetArtifactPreview } = await import("../components/sheet-artifact-preview");
let root: Root;
let host: HTMLDivElement;
const flush = async () =>
  act(async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
  });
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  state.params = {
    messageId: "message-a",
    attachmentId: "attachment-a",
    filename: "a.png",
    mimeType: "image/png",
    size: "1",
  };
  state.preview.mockReset();
  state.imageUri.mockReset();
  state.spreadsheetPreview.mockReset();
  state.download.mockReset();
  state.share.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe("mobile viewers", () => {
  it("retries a failed spreadsheet preview and displays its rows", async () => {
    state.spreadsheetPreview.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({
      status: "ready",
      sheets: [{ name: "Sheet1" }],
      sheet: "Sheet1",
      header: ["Name"],
      rows: [{ cells: ["Row one"] }],
      truncated: false,
    });
    await act(async () =>
      root.render(<SheetArtifactPreview source={{ artifactId: "a" } as never} />),
    );
    await flush();
    expect(host.textContent).toContain("offline");
    const retry = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "Retry",
    );
    await act(async () => retry?.click());
    await flush();
    expect(state.spreadsheetPreview).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain("Row one");
  });

  it("retries a failed artifact image load and displays the result", async () => {
    state.preview
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ uri: "file:///image", size: { width: 10, height: 10 } });
    await act(async () =>
      root.render(
        <ImageArtifactViewer
          threadTarget={{ botId: "bot" }}
          target={{ artifactId: "a", name: "A", mimeType: "image/png" }}
          onClose={() => undefined}
        />,
      ),
    );
    await flush();
    expect(host.textContent).toContain("offline");
    const retry = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "Try again",
    );
    await act(async () => retry?.click());
    await flush();
    expect(state.preview).toHaveBeenCalledTimes(2);
    expect(host.textContent).toContain("Fail image");
  });

  it("ignores repeat image share taps while a share is pending and recovers after failure", async () => {
    state.preview.mockResolvedValue({ uri: "file:///image", size: { width: 10, height: 10 } });
    state.imageUri.mockResolvedValue("file:///image");
    let rejectShare!: (error: Error) => void;
    state.share.mockImplementationOnce(
      () => new Promise<void>((_resolve, reject) => (rejectShare = reject)),
    );
    state.share.mockResolvedValue(undefined);

    await act(async () =>
      root.render(
        <ImageArtifactViewer
          threadTarget={{ botId: "bot" }}
          target={{ artifactId: "a", name: "A", mimeType: "image/png" }}
          onClose={() => undefined}
        />,
      ),
    );
    await flush();
    const share = () =>
      host.querySelector<HTMLButtonElement>("button[aria-label='Share {name}']")?.click();
    await act(async () => {
      share();
      share();
    });
    await flush();
    expect(state.share).toHaveBeenCalledTimes(1);

    await act(async () => rejectShare(new Error("cancelled")));
    await flush();
    await act(async () => share());
    await flush();
    expect(state.share).toHaveBeenCalledTimes(2);
  });

  it("retries a failed attachment download", async () => {
    state.download
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ uri: "file:///a.png" });
    await act(async () => root.render(<InboxAttachmentScreen />));
    await flush();
    const retry = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "Try again",
    );
    await act(async () => retry?.click());
    await flush();
    expect(state.download).toHaveBeenCalledTimes(2);
    expect(host.querySelector("button")?.textContent).toBe("Fail rendered image");
  });

  it("keeps a downloaded image shareable after its render fails", async () => {
    state.download.mockResolvedValue({ uri: "file:///a.png" });
    await act(async () => root.render(<InboxAttachmentScreen />));
    await flush();
    await act(async () => host.querySelector("button")?.click());
    expect(host.textContent).toContain("Could not load image");
    expect(host.textContent).toContain("Share");
  });

  it("clears the old attachment and ignores its late download after params change", async () => {
    let resolveOld!: (value: { uri: string }) => void;
    state.download
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveOld = resolve;
          }),
      )
      .mockResolvedValue({ uri: "file:///b.png" });
    await act(async () => root.render(<InboxAttachmentScreen />));
    state.params = {
      messageId: "message-b",
      attachmentId: "attachment-b",
      filename: "b.png",
      mimeType: "image/png",
      size: "2",
    };
    await act(async () => root.render(<InboxAttachmentScreen />));
    await flush();
    expect(host.querySelector("[data-uri='file:///b.png']")).not.toBeNull();
    resolveOld({ uri: "file:///a.png" });
    await flush();
    expect(host.querySelector("[data-uri='file:///b.png']")).not.toBeNull();
    expect(state.download).toHaveBeenLastCalledWith(
      "message-b",
      expect.objectContaining({ id: "attachment-b" }),
      expect.anything(),
    );
    // Switching attachments cancels the first download instead of letting it finish unseen.
    expect((state.download.mock.calls[0]?.[2] as AbortSignal | undefined)?.aborted).toBe(true);
  });
});
