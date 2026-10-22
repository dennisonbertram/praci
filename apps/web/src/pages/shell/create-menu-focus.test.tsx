// @vitest-environment jsdom

import { Popover, PopoverContent, PopoverTrigger } from "@rakazo/ui-web";
import type { ReactNode } from "react";
import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray) => String.raw(parts),
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { BotCreatePicker, pickerInitialFocus } from "./bot-picker";

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

function Picker() {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger data-testid="trigger">+</PopoverTrigger>
      <PopoverContent initialFocus={pickerInitialFocus}>
        <BotCreatePicker
          onCreateBot={() => undefined}
          onCreateGroup={() => undefined}
          onCreateSpace={() => undefined}
          onShowGroupInfo={() => undefined}
          onShowSpaceInfo={() => undefined}
          canCreateSpace
        />
      </PopoverContent>
    </Popover>
  );
}

it("opens with focus off the info buttons, and Escape from an info button closes and refocuses the trigger", async () => {
  // cmdk observes the list size and scrolls the selected row into view; jsdom has neither.
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= () => undefined;
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<Picker />));
  const trigger = container.querySelector<HTMLElement>("[data-testid=trigger]");
  await act(async () => trigger?.click());
  await act(async () => new Promise((resolve) => setTimeout(resolve, 50)));
  expect(document.activeElement?.hasAttribute("cmdk-root")).toBe(true);
  expect(document.querySelector("[data-testid=bot-create-picker]")).not.toBeNull();

  const info = document.querySelector<HTMLElement>("[data-testid=picker-info-group]");
  info?.focus();
  await act(async () => {
    info?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
  await act(async () => new Promise((resolve) => setTimeout(resolve, 100)));
  expect(document.querySelector("[data-testid=bot-create-picker]")).toBeNull();
  expect(document.activeElement).toBe(trigger);
  await act(async () => root.unmount());
  container.remove();
});
