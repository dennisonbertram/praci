// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogTitle } from "./dialog.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom has no layout, so this checks the classes that cap the height and scroll the body.
it("caps its height to the viewport and scrolls only the body", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
          <DialogBody>Body</DialogBody>
          <DialogFooter>Footer</DialogFooter>
        </DialogContent>
      </Dialog>,
    ),
  );
  const popup = document.querySelector('[data-slot="dialog-content"]')?.className ?? "";
  expect(popup).toContain("max-h-[calc(100dvh-2rem)]");
  const body = document.querySelector('[data-slot="dialog-body"]')?.className ?? "";
  expect(body).toContain("overflow-y-auto");
  expect(body).toContain("min-h-0");
  expect(document.querySelector('[data-slot="dialog-footer"]')?.className).toContain("shrink-0");
  await act(async () => root.unmount());
});
