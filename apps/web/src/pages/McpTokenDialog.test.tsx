// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: (strings: TemplateStringsArray) => strings.join("") }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@rakazo/ui-web", () => ({
  Button: ({ children, ...props }: React.ComponentProps<"button">) => (
    <button {...props}>{children}</button>
  ),
}));

import { CopyBox } from "./McpTokenDialog";

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

async function renderCopyBox() {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<CopyBox label="Copy token" value="secret-token" />));
  return { container, root };
}

it("shows copy failure and clears it after a successful retry", async () => {
  const writeText = vi
    .fn()
    .mockRejectedValueOnce(new Error("denied"))
    .mockResolvedValueOnce(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  const { container, root } = await renderCopyBox();
  try {
    const button = container.querySelector<HTMLButtonElement>("button")!;
    await act(async () => button.click());
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Couldn't copy");

    await act(async () => button.click());
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(button.querySelector('[aria-label="Copied"]')).not.toBeNull();
  } finally {
    await act(async () => root.unmount());
  }
});

it("shows copy failure when the clipboard API is unavailable", async () => {
  vi.stubGlobal("navigator", {});
  const { container, root } = await renderCopyBox();
  try {
    await act(async () => container.querySelector("button")?.click());
    expect(container.querySelector('[role="alert"]')?.textContent).toBe("Couldn't copy");
  } finally {
    await act(async () => root.unmount());
  }
});
