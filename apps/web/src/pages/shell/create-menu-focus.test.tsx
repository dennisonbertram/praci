// @vitest-environment jsdom

import { Popover, PopoverContent, PopoverTrigger } from "@rakazo/ui-web";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, it } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// A popover whose content is unmounted by hand never finishes closing, so Base UI keeps two
// tab-stop focus guards around the trigger and Tab loops there. The content must stay mounted.
function Menu({ unmountByHand }: { unmountByHand: boolean }) {
  const [open, setOpen] = useState(false);
  const content = <PopoverContent>menu</PopoverContent>;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger data-testid="trigger">+</PopoverTrigger>
      {unmountByHand ? (open ? content : null) : content}
    </Popover>
  );
}

async function guardsAfterOpenAndClose(unmountByHand: boolean) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<Menu unmountByHand={unmountByHand} />));
  const trigger = container.querySelector<HTMLElement>("[data-testid=trigger]");
  await act(async () => trigger?.click());
  await act(async () => trigger?.click());
  await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
  const guards = container.querySelectorAll("[data-base-ui-focus-guard]").length;
  await act(async () => root.unmount());
  container.remove();
  return guards;
}

it("leaves no focus guard around a popover trigger once it has closed", async () => {
  expect(await guardsAfterOpenAndClose(false)).toBe(0);
});

it("documents the failure: unmounting the content by hand keeps the guards", async () => {
  expect(await guardsAfterOpenAndClose(true)).toBeGreaterThan(0);
});
