// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({ t: text }));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));
const portal = vi.hoisted(() => ({ openPortal: vi.fn() }));
vi.mock("../../lib/portal", async () => {
  class PortalDeadError extends Error {}
  return { openPortal: portal.openPortal, PortalDeadError };
});

import { PortalDeadError } from "../../lib/portal";
import { PortalOpen } from "./PortalOpen";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  window.history.replaceState(null, "", "/");
  vi.clearAllMocks();
});

const show = async (hash: string) => {
  window.history.replaceState(null, "", `/portal/open${hash}`);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/portal/open"]}>
        <Routes>
          <Route path="/portal/open" element={<PortalOpen />} />
          <Route path="/portal/home" element={<p>home page</p>} />
        </Routes>
      </MemoryRouter>,
    ),
  );
};
const openButton = () =>
  [...container.querySelectorAll("button")].find((b) => b.textContent === "Open");

it("shows only an Open button, with no company name, and makes no request until it is pressed", async () => {
  await show("#link-token");
  expect(container.textContent).toBe("Open");
  expect(container.querySelectorAll("button")).toHaveLength(1);
  expect(portal.openPortal).not.toHaveBeenCalled();
});

it("posts the token from the fragment, then clears the fragment and goes home", async () => {
  portal.openPortal.mockResolvedValue(undefined);
  await show("#link-token");
  await act(async () => openButton()?.click());
  expect(portal.openPortal).toHaveBeenCalledWith("link-token");
  expect(window.location.hash).toBe("");
  expect(window.location.href).not.toContain("link-token");
  expect(container.textContent).toBe("home page");
});

it("a link that no longer works shows its sentence and nothing else", async () => {
  portal.openPortal.mockRejectedValue(new PortalDeadError());
  await show("#expired");
  await act(async () => openButton()?.click());
  expect(container.textContent).toBe("This link no longer works.");
  expect(container.querySelector("button")).toBeNull();
});

it("a missing fragment is the same dead link", async () => {
  await show("");
  expect(container.textContent).toBe("This link no longer works.");
  expect(portal.openPortal).not.toHaveBeenCalled();
});

it("a failed request keeps the button and says so, without losing the link", async () => {
  portal.openPortal.mockRejectedValue(new Error("offline"));
  await show("#link-token");
  await act(async () => openButton()?.click());
  expect(container.querySelector('[role="alert"]')?.textContent).toBe(
    "Something went wrong. Try again.",
  );
  expect(openButton()?.hasAttribute("disabled")).toBe(false);
  expect(window.location.hash).toBe("#link-token");
});
