// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { Table, TableBody, TableCell, TableRow } from "./table.js";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

async function mount(onOpen?: () => void) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () =>
    root.render(
      <Table>
        <TableBody>
          <TableRow onOpen={onOpen}>
            <TableCell>
              <button type="button" data-row-open>
                Name
              </button>
            </TableCell>
            <TableCell>Email</TableCell>
            <TableCell>
              <button type="button" id="other">
                Other
              </button>
              <a href="#x" id="link" aria-label="Open the sample link">
                Link
              </a>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    ),
  );
}
const click = (selector: string) =>
  act(async () => document.querySelector<HTMLElement>(selector)?.click());

it("opens from the name control, any other cell and the row itself", async () => {
  const onOpen = vi.fn();
  await mount(onOpen);
  await click("[data-row-open]");
  await click("td:nth-child(2)");
  await click("tr");
  expect(onOpen).toHaveBeenCalledTimes(3);
});

it("ignores clicks on other controls", async () => {
  const onOpen = vi.fn();
  await mount(onOpen);
  await click("#other");
  await click("#link");
  expect(onOpen).not.toHaveBeenCalled();
});

it("ignores a click that ends a text selection", async () => {
  const onOpen = vi.fn();
  await mount(onOpen);
  vi.spyOn(window, "getSelection").mockReturnValue({ toString: () => "Ema" } as Selection);
  await click("td:nth-child(2)");
  expect(onOpen).not.toHaveBeenCalled();
});

it("is a pointer only when it opens something", async () => {
  await mount();
  expect(document.querySelector("tr")?.className).not.toContain("cursor-pointer");
  document.body.innerHTML = "";
  await mount(() => {});
  expect(document.querySelector("tr")?.className).toContain("cursor-pointer");
});
