// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { Switch } from "./switch.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("enumerates the transitioned properties instead of transition-all", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<Switch />));
  const className = container.querySelector('[data-slot="switch"]')?.className ?? "";
  expect(className).not.toContain("transition-all");
  // The focus-visible ring is box-shadow; it must keep animating.
  expect(className).toContain("box-shadow");
  await act(async () => root.unmount());
});
