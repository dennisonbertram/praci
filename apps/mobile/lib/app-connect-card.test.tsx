// @vitest-environment jsdom

import type { MessageBlock } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());

vi.mock("react-native", async () => {
  const { createElement } = await import("react");
  return {
    Linking: { openURL: vi.fn() },
    Text: (props: { children?: ReactNode }) => createElement("span", null, props.children),
    View: (props: { children?: ReactNode; accessibilityLabel?: string }) =>
      createElement("div", { "aria-label": props.accessibilityLabel }, props.children),
  };
});

vi.mock("./api", () => ({ rpc }));

vi.mock("./native", () => ({
  native: { fill: "fill", fillPressed: "fill-pressed" },
  useMobileTokens: () => ({
    foreground: "foreground",
    mutedForeground: "muted",
    success: "success",
    destructive: "destructive",
  }),
}));

vi.mock("../components/native-action-button", async () => {
  const { createElement } = await import("react");
  return {
    NativeActionButton: (props: { label: string; onPress: () => void }) =>
      createElement("button", { type: "button", onClick: props.onPress }, props.label),
  };
});

import { AppConnectCard } from "../components/AppConnectCard";

type AppConnectBlock = Extract<MessageBlock, { kind: "app_connect" }>;

const block = {
  kind: "app_connect",
  connectorId: "connector-1",
  provider: "provider-1",
  name: "Example",
  description: "Example app",
  status: "pending",
} as AppConnectBlock;

describe("AppConnectCard", () => {
  let root: Root | undefined;
  let container: HTMLDivElement | undefined;

  beforeEach(() => {
    rpc.mockReset();
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    container?.remove();
    root = undefined;
    container = undefined;
  });

  it("stays connected when the onboarding notification fails", async () => {
    rpc.mockImplementation(async (method: string) => {
      if (method === "connections/begin") {
        return { connectionId: "connection-1", authorizationUrl: null };
      }
      if (method === "connections/complete") return { status: "connected" };
      throw new Error("Network down");
    });
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    act(() => {
      root?.render(<AppConnectCard botId="bot-1" block={block} />);
    });

    await act(async () => {
      container?.querySelector("button")?.click();
      for (let i = 0; i < 10; i += 1) await Promise.resolve();
    });

    expect(container.textContent).toContain("Connected");
    expect(container.textContent).not.toContain("Could not authorize this app");
    expect(rpc.mock.calls.filter(([method]) => method === "connections/begin")).toHaveLength(1);
  });
});
