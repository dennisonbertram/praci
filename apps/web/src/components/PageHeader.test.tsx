// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it } from "vitest";
import { PAGE_HEADER_ROW, PageHeader } from "./PageHeader";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => {
  document.body.innerHTML = "";
});

it("renders the title as h1 with meta and actions in a fixed-height row", () => {
  const host = document.createElement("div");
  document.body.append(host);
  act(() => {
    createRoot(host).render(
      <PageHeader
        title="Example"
        meta={<span>Updated now</span>}
        actions={<button type="button">Go</button>}
      />,
    );
  });
  expect(host.querySelector("h1")?.textContent).toBe("Example");
  expect(host.textContent).toContain("Updated now");
  expect(host.querySelector("button")?.textContent).toBe("Go");
  const row = host.querySelector("[data-page-header]");
  expect(row?.className).toContain("h-10");
  expect(PAGE_HEADER_ROW).toContain("h-10");
});
