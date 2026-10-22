// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { LinkedInPostPreview } from "./LinkedInPostPreview";
import { XPostPreview } from "./XPostPreview";

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));
let host: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
it("shows the exact X text and weighted count, with an over-limit warning", () => {
  act(() => root.render(<XPostPreview text="Hi 😀 https://example.com/a-long-url" />));
  expect(host.querySelector("p")?.textContent).toBe("Hi 😀 https://example.com/a-long-url");
  expect(host.textContent).toContain("29 / 280");
  act(() => root.render(<XPostPreview text={"a".repeat(281)} />));
  expect(host.querySelector(".text-destructive")?.textContent).toBe("281 / 280");
});
it("shows LinkedIn as plain text, never interpreted markup", () => {
  const text = "<script>alert(1)</script>\nA new line";
  act(() => root.render(<LinkedInPostPreview text={text} />));
  expect(host.querySelector("script")).toBeNull();
  expect(host.querySelector("p")?.textContent).toBe(text);
  expect(host.textContent).toContain(`${text.length} / 3,000`);
});
