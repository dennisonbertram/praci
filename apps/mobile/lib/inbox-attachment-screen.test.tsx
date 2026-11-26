// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  kind: "pdf" as "pdf" | "other",
  download: vi.fn(),
  share: vi.fn(),
  setOptions: vi.fn(),
  alert: vi.fn(),
}));

vi.mock("expo-router", () => ({
  useLocalSearchParams: () => ({
    messageId: "message-a",
    attachmentId: "attachment-a",
    filename: "file.pdf",
    mimeType: "application/pdf",
    size: "10",
  }),
  useNavigation: () => ({ setOptions: state.setOptions }),
}));
vi.mock("../lib/artifact-open", () => ({ shareLocalFile: state.share }));
vi.mock("../lib/mail-attachment", () => ({
  attachmentKind: () => state.kind,
  downloadMailAttachment: state.download,
}));
vi.mock("../lib/i18n", () => {
  const t = (text: string) => text;
  return { useI18n: () => ({ t }) };
});
vi.mock("../lib/native", () => ({
  native: { page: "white", secondaryLabel: "gray", label: "black", separator: "gray" },
  useThemedStyles: (factory: () => unknown) => factory(),
}));
vi.mock("../lib/user-error", () => ({ errorText: (error: unknown) => String(error) }));
vi.mock("../components/native-action-button", () => ({
  NativeActionButton: ({ label, onPress }: { label: string; onPress: () => void }) => (
    <button type="button" onClick={onPress}>
      {label}
    </button>
  ),
}));
vi.mock("../components/pdf-preview", () => ({ PdfPreview: () => null }));
vi.mock("../components/sheet-artifact-preview", () => ({ SheetArtifactPreview: () => null }));
vi.mock("react-native", () => {
  const Box = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  return {
    ActivityIndicator: () => <span>Loading</span>,
    Alert: { alert: state.alert },
    Image: () => null,
    Platform: { OS: "android" },
    Pressable: ({ children, onPress }: { children?: ReactNode; onPress?: () => void }) => (
      <button type="button" onClick={onPress}>
        {children}
      </button>
    ),
    StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
    Text: Box,
    View: Box,
  };
});

const { default: InboxAttachmentScreen } = await import("../app/inbox-attachment");
vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

let root: Root;
let host: HTMLDivElement;
const render = () =>
  act(() => {
    root.render(<InboxAttachmentScreen />);
  });
const flush = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

beforeEach(() => {
  state.kind = "pdf";
  state.download.mockReset().mockResolvedValue({ uri: "file:///attachment" });
  state.share.mockReset().mockRejectedValue(new Error("share failed"));
  state.setOptions.mockReset();
  state.alert.mockReset();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe("inbox attachment screen sharing", () => {
  it("shows an alert when sharing a previewable attachment fails", async () => {
    render();
    await flush();
    const share = [...host.querySelectorAll("button")].find(
      (button) => button.textContent === "Share",
    )!;
    await act(async () => {
      share.click();
      await Promise.resolve();
    });

    expect(state.alert).toHaveBeenCalledWith("Could not share this file", "Error: share failed");
  });

  it("shows an alert when the automatic share for an unpreviewed attachment fails", async () => {
    state.kind = "other";
    render();
    await flush();

    expect(state.share).toHaveBeenCalledOnce();
    expect(state.alert).toHaveBeenCalledWith("Could not share this file", "Error: share failed");
  });
});
