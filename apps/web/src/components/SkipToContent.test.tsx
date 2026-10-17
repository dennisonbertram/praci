// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { MAIN_CONTENT_ID, SkipToContent } from "./SkipToContent";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("moves keyboard focus past the sidebar to the page, without changing the URL", async () => {
  const el = document.createElement("div");
  document.body.append(el);
  const root = createRoot(el);
  await act(async () =>
    root.render(
      <>
        <SkipToContent />
        <button type="button">Sidebar link</button>
        <main id={MAIN_CONTENT_ID} tabIndex={-1}>
          Page
        </main>
      </>,
    ),
  );
  const before = window.location.href;
  await act(async () => el.querySelector("a")?.click());
  expect(document.activeElement?.id).toBe(MAIN_CONTENT_ID);
  expect(window.location.href).toBe(before);
  act(() => root.unmount());
});
