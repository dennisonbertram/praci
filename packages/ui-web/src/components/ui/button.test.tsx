// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { Button } from "./button.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => vi.restoreAllMocks());

async function mount(node: React.ReactNode) {
  const container = document.createElement("div");
  const root = createRoot(container);
  await act(async () => root.render(node));
  return { container, unmount: () => act(() => root.unmount()) };
}

it("renders a link passed as render as a link with the button styles, without a Base UI error", async () => {
  const error = vi.spyOn(console, "error").mockImplementation(() => {});
  const { container, unmount } = await mount(
    <Button variant="outline" render={<a href="/accounts" />}>
      Accounts
    </Button>,
  );
  const link = container.querySelector("a");
  expect(link?.getAttribute("href")).toBe("/accounts");
  expect(link?.dataset.slot).toBe("button");
  expect(link?.className).toContain("border-border");
  expect(link?.getAttribute("role")).toBeNull();
  expect(error).not.toHaveBeenCalled();
  unmount();
});

it("still renders a native button by default", async () => {
  const { container, unmount } = await mount(<Button>Save</Button>);
  expect(container.querySelector("button")?.getAttribute("type")).toBe("button");
  unmount();
});

it("enumerates the transitioned properties instead of transition-all", async () => {
  const { container, unmount } = await mount(<Button>Save</Button>);
  const className = container.querySelector("button")?.className ?? "";
  expect(className).not.toContain("transition-all");
  // The focus ring (box-shadow) and the :active press (transform) keep animating.
  expect(className).toContain("box-shadow");
  expect(className).toContain("transform");
  unmount();
});
