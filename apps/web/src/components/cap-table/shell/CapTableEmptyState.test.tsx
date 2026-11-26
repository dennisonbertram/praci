// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: text, i18n: { locale: "en" } }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { CapTableEmptyState } from "./CapTableEmptyState";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: ReturnType<typeof createRoot> | null = null;
afterEach(async () => {
  if (root)
    await act(async () => {
      root?.unmount();
    });
  root = null;
});

async function render(node: ReactNode) {
  const container = document.createElement("div");
  root = createRoot(container);
  await act(async () => {
    root?.render(node);
  });
  return container;
}

it("shows the one line", async () => {
  const container = await render(<CapTableEmptyState message="No plans yet" />);
  expect(container.textContent).toBe("No plans yet");
});

it("shows the action when there is one", async () => {
  const container = await render(
    <CapTableEmptyState
      message="No rounds yet"
      action={<button type="button">Add round</button>}
    />,
  );
  expect(container.querySelector("button")?.textContent).toBe("Add round");
});
