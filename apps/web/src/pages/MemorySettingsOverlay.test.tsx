// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray) => parts.join(""),
    i18n: {
      _: (descriptor: { message?: string } | string) =>
        typeof descriptor === "string" ? descriptor : (descriptor.message ?? ""),
    },
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
const { connectProvider } = vi.hoisted(() => ({ connectProvider: vi.fn() }));
vi.mock("../lib/rpc", () => ({ rpc: { memory: { connectProvider } } }));
vi.mock("./KnowledgeSection", () => ({ SpaceMemorySection: () => null }));

import { MemorySettingsOverlay } from "./MemorySettingsOverlay";

it("reloads config after a connect conflict and shows the connected view", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  connectProvider.mockRejectedValueOnce({ code: "CONFLICT", message: "Conflict" });
  const onRetryLoad = vi.fn().mockResolvedValue(undefined);
  const onConfigChange = vi.fn();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const props = {
    embedded: true,
    onClose: () => undefined,
    onConfigChange,
    onRetryLoad,
  };
  try {
    await act(async () => root.render(<MemorySettingsOverlay {...props} config={null} />));
    container.querySelector("summary")?.click();
    const keyInput = container.querySelector("input[type='password']");
    expect(keyInput).not.toBeNull();
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
        keyInput,
        "sm_test_key_12345",
      );
      keyInput?.dispatchEvent(new Event("input", { bubbles: true }));
      keyInput?.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const connect = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Connect",
    );
    await act(async () => {
      connect?.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(onRetryLoad).toHaveBeenCalledOnce();
    expect(container.textContent).not.toContain("Conflict");
    await act(async () =>
      root.render(
        <MemorySettingsOverlay
          {...props}
          config={{
            provider: "supermemory",
            settings: { mode: "cloud", baseUrl: "https://api.supermemory.ai" },
            defaultMemoryScope: "isolated",
            updatedAt: "2026-08-19T00:00:00.000Z",
          }}
        />,
      ),
    );
    expect(container.textContent).toContain("Connected");
    expect(container.querySelector("[data-testid='memory-provider-advanced']")).toBeNull();
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    connectProvider.mockReset();
  }
});

it("speaks plainly, marks the chosen memory default, and tucks provider setup under Advanced", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <MemorySettingsOverlay
          embedded
          config={null}
          onClose={() => undefined}
          onConfigChange={() => undefined}
        />,
      ),
    );
    const text = container.textContent ?? "";
    // The section title already says it; the first card starts where every Settings section does.
    expect(text).not.toContain("What your bots remember between chats");
    expect(text).not.toMatch(/semantic|MEMORY\.md|Isolated/);

    const pressed = [...container.querySelectorAll("[aria-pressed='true']")].map(
      (node) => node.textContent,
    );
    expect(pressed).toContain("Each bot keeps its own");
    expect(pressed).not.toContain("All bots share one memory");

    const advanced = container.querySelector("[data-testid='memory-provider-advanced']");
    expect(advanced?.tagName).toBe("DETAILS");
    expect(advanced?.hasAttribute("open")).toBe(false);
    expect(advanced?.textContent).toContain("Supermemory");
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});

it("keeps a failed provider-config read separate from the setup form and retries", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  let resolveRetry: (() => void) | undefined;
  const onRetryLoad = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        resolveRetry = resolve;
      }),
  );
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () =>
      root.render(
        <MemorySettingsOverlay
          embedded
          config={undefined}
          loadFailed
          onRetryLoad={onRetryLoad}
          onClose={() => undefined}
          onConfigChange={() => undefined}
        />,
      ),
    );

    expect(container.textContent).toContain("Could not load");
    expect(container.textContent).toContain("Try again");
    expect(container.querySelector("[data-testid='memory-provider-advanced']")).toBeNull();
    expect(container.querySelector("[aria-pressed]")).toBeNull();
    expect(
      [...container.querySelectorAll("button")].some((button) => button.textContent === "Connect"),
    ).toBe(false);

    const retry = [...container.querySelectorAll("button")].find(
      (button) => button.textContent === "Try again",
    );
    expect(retry).toBeDefined();
    await act(async () => {
      retry?.click();
      await Promise.resolve();
    });
    expect(onRetryLoad).toHaveBeenCalledOnce();
    expect(retry?.disabled).toBe(true);
    expect(container.textContent).not.toContain("Loading memory settings…");
    await act(async () => resolveRetry?.());
    expect(retry?.disabled).toBe(false);
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});
