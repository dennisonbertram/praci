// @vitest-environment jsdom

import { act } from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { openOnRowClick } from "./row-click";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("opens from the row, not from its controls or from a menu portaled out of it", async () => {
  const open = vi.fn();
  const container = document.createElement("div");
  const menu = document.createElement("div");
  document.body.append(container, menu);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <table>
        <tbody>
          <tr onClick={openOnRowClick(open)}>
            <td data-cell>CS-1</td>
            <td>
              <button type="button">Actions</button>
              {createPortal(
                <div role="menuitem" tabIndex={-1}>
                  Transfer
                </div>,
                menu,
              )}
            </td>
          </tr>
        </tbody>
      </table>,
    );
  });
  await act(async () => (menu.querySelector("[role=menuitem]") as HTMLElement).click());
  await act(async () => container.querySelector("button")!.click());
  expect(open).not.toHaveBeenCalled();
  await act(async () => (container.querySelector("[data-cell]") as HTMLElement).click());
  expect(open).toHaveBeenCalledTimes(1);
  await act(async () => root.unmount());
});
