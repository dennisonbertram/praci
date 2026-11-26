// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { Sheet, SheetBody, SheetContent, SheetTitle } from "./sheet.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom has no layout, so this checks the class that keeps wheel/touch scroll
// from chaining to the page behind the sheet.
it("contains overscroll inside the sheet", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <Sheet open>
        <SheetContent>
          <SheetTitle>Title</SheetTitle>
          <SheetBody>Body</SheetBody>
        </SheetContent>
      </Sheet>,
    ),
  );
  const popup = document.querySelector('[data-slot="sheet-content"]')?.className ?? "";
  expect(popup).toContain("overscroll-contain");
  await act(async () => root.unmount());
});
