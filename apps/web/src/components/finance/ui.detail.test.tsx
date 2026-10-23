// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { expect, it, vi } from "vitest";
import { DetailPage } from "./ui";

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
