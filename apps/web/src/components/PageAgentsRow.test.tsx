// @vitest-environment jsdom

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
  const label = (heldFor?: "answer" | "takeover") => {
    act(() =>
      root.render(<PageAgentsRow open count={3} needsYou heldFor={heldFor} onToggle={onToggle} />),
    );
    return container.querySelector('[data-testid="page-agents-dot"]')?.getAttribute("aria-label");
  };
  expect(label("answer")).toBe("Needs your answer");
  expect(label("takeover")).toBe("Needs takeover");
  expect(label()).toBe("Needs you");
  container.remove();
});
