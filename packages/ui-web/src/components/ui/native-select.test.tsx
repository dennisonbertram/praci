// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { NativeSelect, NativeSelectOption } from "./native-select.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// A native <select> with appearance-none needs an explicit background and color,
// or Windows dark mode styles the control and its option popup with system colors.
it("sets an explicit background and color on the select", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <NativeSelect>
        <NativeSelectOption value="a">A</NativeSelectOption>
      </NativeSelect>,
    ),
  );
  const className = container.querySelector('[data-slot="native-select"]')?.className ?? "";
  expect(className).not.toContain("bg-transparent");
  expect(className).toContain("text-foreground");
  await act(async () => root.unmount());
});
