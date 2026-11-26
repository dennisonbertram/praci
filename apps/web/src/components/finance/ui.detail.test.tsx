// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { BackHere, DetailPage, ValueLink } from "./ui";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: unknown }) => children,
}));

it("keeps a gap between the page actions that arrive together", async () => {
  const el = document.createElement("div");
  document.body.append(el);
  const root = createRoot(el);
  await act(async () => {
    root.render(
      <MemoryRouter>
        <DetailPage
          crumbs={[]}
          title="Account"
          loading={false}
          error=""
          onRetry={() => undefined}
          action={
            <>
              <button type="button">Upload statement</button>
              <button type="button">Rename</button>
            </>
          }
        />
      </MemoryRouter>,
    );
  });
  const wrap = el.querySelector("button")?.parentElement as HTMLElement;
  expect(wrap.className).toContain("gap-2");
  act(() => root.unmount());
  el.remove();
});

it("ValueLink carries the page it is on as Back state", async () => {
  const el = document.createElement("div");
  document.body.append(el);
  const root = createRoot(el);
  await act(async () => {
    root.render(
      <MemoryRouter>
        <BackHere value={{ label: "Spend", to: "/app/finance#spend" }}>
          <ValueLink to="/app/finance/vendor/globex">Globex</ValueLink>
        </BackHere>
        <LocationState />
      </MemoryRouter>,
    );
  });
  await act(async () => el.querySelector("a")?.click());
  expect(el.querySelector("pre")?.textContent).toContain('"label":"Spend"');
  act(() => root.unmount());
  el.remove();
});

function LocationState() {
  return <pre>{JSON.stringify(useLocation().state)}</pre>;
}
