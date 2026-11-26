// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({ plural: (n: number) => `${n} due soon` }));

import { LEGAL_DUE_SOON_PATH } from "../../lib/legal-format";
import { DueSoonChip } from "./DueSoonChip";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const html = (count: number) => {
  const el = document.createElement("div");
  act(() =>
    createRoot(el).render(
      <MemoryRouter>
        <DueSoonChip count={count} />
      </MemoryRouter>,
    ),
  );
  return el;
};

it("links to the due-soon deadlines, and is absent at zero", () => {
  const chip = html(2).querySelector("a");
  expect(chip?.textContent).toBe("2 due soon");
  expect(chip?.getAttribute("href")).toBe(LEGAL_DUE_SOON_PATH);
  expect(html(0).querySelector("a")).toBeNull();
});
