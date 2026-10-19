// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({ t: (parts: TemplateStringsArray) => parts.join("") }));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { UserTextBubble } from "./UserTextBubble";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("shows what the person wrote and a chip per Data room file, never the raw id line", () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() =>
    root.render(
      <MemoryRouter>
        <UserTextBubble text={"Summarise this\n\nData room item itm_9: Sample agreement.pdf"} />
      </MemoryRouter>,
    ),
  );
  expect(container.querySelector('[data-testid="message-user-bubble"]')?.textContent).toBe(
    "Summarise this",
  );
  const chip = container.querySelector<HTMLAnchorElement>('[data-testid="data-room-ref-chip"]');
  expect(chip?.textContent).toBe("Sample agreement.pdf");
  expect(chip?.getAttribute("href")).toBe("/app/data-room?item=itm_9");
  expect(container.textContent).not.toContain("itm_9");
  act(() => root.unmount());
});

it("shows only chips when the person wrote nothing", () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() =>
    root.render(
      <MemoryRouter>
        <UserTextBubble text="Data room item itm_9: Sample agreement.pdf" />
      </MemoryRouter>,
    ),
  );
  expect(container.querySelector('[data-testid="message-user-bubble"]')).toBeNull();
  expect(container.querySelectorAll('[data-testid="data-room-ref-chip"]')).toHaveLength(1);
  act(() => root.unmount());
});
