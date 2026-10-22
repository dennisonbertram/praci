// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: (parts: TemplateStringsArray) => parts.join("") }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("../lib/rpc", () => ({ rpc: { memory: {} } }));
vi.mock("./KnowledgeSection", () => ({ SpaceMemorySection: () => null }));

import { MemorySettingsOverlay } from "./MemorySettingsOverlay";

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
