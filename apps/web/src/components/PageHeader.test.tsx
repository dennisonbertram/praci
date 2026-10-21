// @vitest-environment jsdom

import { i18n } from "@lingui/core";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it } from "vitest";
import { PAGE_HEADER_ROW, PageHeader, PageNavContext } from "./PageHeader";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
i18n.loadAndActivate({ locale: "en", messages: {} });
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
  expect(host.querySelector("h1")?.className).toContain("h-10");
  // jsdom cannot measure layout; the wrapping rules are checked in Storybook at 375px.
  expect(host.querySelector("[data-page-header-meta]")?.className).toContain("flex-wrap");
  expect(row?.className).toContain("flex-wrap");
  const actions = host.querySelector("button")?.parentElement;
  expect(actions?.className).toContain("flex-wrap");
  expect(actions?.className).toContain("justify-end");
  expect(actions?.className).toContain("min-w-0");
  expect(actions?.className).not.toContain("shrink-0");
  expect(PAGE_HEADER_ROW).toContain("h-10");
});

it("puts the navigation button on the title row and claims the shell's own menu band", () => {
  const host = document.createElement("div");
  document.body.append(host);
  let claims = 0;
  let opened = 0;
  const nav = {
    open: () => {
      opened += 1;
    },
    claim: () => {
      claims += 1;
      return () => {
        claims -= 1;
      };
    },
  };
  let root: ReturnType<typeof createRoot>;
  act(() => {
    root = createRoot(host);
    root.render(
      <PageNavContext.Provider value={nav}>
        <PageHeader title="Example" />
      </PageNavContext.Provider>,
    );
  });
  const button = host.querySelector<HTMLButtonElement>("[data-page-header] > button");
  expect(button?.className).toContain("lg:hidden");
  expect(claims).toBe(1);
  act(() => button?.click());
  expect(opened).toBe(1);
  act(() => root.unmount());
  expect(claims).toBe(0);
});

it("renders no navigation button without a shell", () => {
  const host = document.createElement("div");
  document.body.append(host);
  act(() => {
    createRoot(host).render(<PageHeader title="Example" />);
  });
  expect(host.querySelector("button")).toBeNull();
});
