// @vitest-environment jsdom

import { DropdownMenuItem } from "@rakazo/ui-web";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { PageAgentsRow } from "./PageAgentsRow";

vi.mock("@lingui/react/macro", () => ({ useLingui: () => ({ t: (s: unknown) => String(s) }) }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("shows a dot only when a page agent needs the person, and toggles", () => {
  const container = document.createElement("div");
  document.body.append(container);
  const onToggle = vi.fn();
  const root = createRoot(container);
  act(() => root.render(<PageAgentsRow open={false} count={3} needsYou onToggle={onToggle} />));
  expect(container.querySelector('[data-testid="page-agents-dot"]')).not.toBeNull();
  act(() => container.querySelector("button")?.click());
  expect(onToggle).toHaveBeenCalledOnce();
  act(() => root.render(<PageAgentsRow open count={3} needsYou={false} onToggle={onToggle} />));
  expect(container.querySelector('[data-testid="page-agents-dot"]')).toBeNull();
  expect(container.querySelector("button")?.getAttribute("aria-expanded")).toBe("true");
  // Open, the header sticks to the top of the list so the fold can always be closed.
  expect(container.querySelector("button")?.parentElement?.classList.contains("sticky")).toBe(true);
  const label = (heldFor?: "answer" | "takeover") => {
    act(() =>
      root.render(<PageAgentsRow open count={3} needsYou heldFor={heldFor} onToggle={onToggle} />),
    );
    return container.querySelector('[data-testid="page-agents-dot"]')?.getAttribute("aria-label");
  };
  expect(label("answer")).toBe("Needs your answer");
  expect(label("takeover")).toBe("Needs takeover");
  expect(label()).toBe("New");
  container.remove();
});

it("scrolls to its own header only when the person opens it, not when a shared open flag flips", () => {
  const container = document.createElement("div");
  document.body.append(container);
  const scroll = vi.fn();
  Element.prototype.scrollIntoView = scroll;
  const root = createRoot(container);
  act(() =>
    root.render(<PageAgentsRow open={false} count={3} needsYou={false} onToggle={vi.fn()} />),
  );
  act(() => root.render(<PageAgentsRow open count={3} needsYou={false} onToggle={vi.fn()} />));
  expect(scroll).not.toHaveBeenCalled();
  act(() =>
    root.render(<PageAgentsRow open={false} count={3} needsYou={false} onToggle={vi.fn()} />),
  );
  act(() => container.querySelector("button")?.click());
  expect(scroll).toHaveBeenCalledOnce();
  container.remove();
});

it("keeps its menu beside the toggle, not inside it, and runs the chosen action", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const onToggle = vi.fn();
  const onMarkRead = vi.fn();
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <PageAgentsRow
        open={false}
        count={3}
        needsYou={false}
        onToggle={onToggle}
        actions={<DropdownMenuItem onClick={onMarkRead}>Mark all read</DropdownMenuItem>}
      />,
    ),
  );
  const toggle = container.querySelector<HTMLButtonElement>("[data-roster-fold]");
  const trigger = container.querySelector<HTMLButtonElement>('[aria-label^="Actions for"]');
  expect(trigger).not.toBeNull();
  expect(toggle?.contains(trigger)).toBe(false);
  await act(async () => trigger?.click());
  const item = [...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
    (entry) => entry.textContent === "Mark all read",
  );
  await act(async () => item?.click());
  expect(onMarkRead).toHaveBeenCalledOnce();
  expect(onToggle).not.toHaveBeenCalled();
  await act(async () => root.render(<PageAgentsRow open count={3} needsYou onToggle={onToggle} />));
  expect(container.querySelector('[aria-label^="Actions for"]')).toBeNull();
  container.remove();
});
