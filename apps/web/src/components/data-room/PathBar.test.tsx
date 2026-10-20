// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({ t: (parts: TemplateStringsArray) => parts.join("") }));

import { folderNodes } from "./folders";
import { PathBar } from "./PathBar";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const folder = (id: string, parentId: string | null) => ({
  id,
  name: `Folder ${id}`,
  parentId,
  createdAt: "",
});
const nodes = folderNodes([
  folder("a", null),
  folder("b", "a"),
  folder("c", "b"),
  folder("d", "c"),
  folder("e", "d"),
]);

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

const render = (folderId: string | undefined, onSelect = vi.fn()) => {
  act(() => root.render(<PathBar nodes={nodes} folderId={folderId} onSelect={onSelect} />));
  return onSelect;
};

it("shows nothing at the top level", () => {
  render(undefined);
  expect(container.querySelector("nav")).toBeNull();
});

it("shows the path, links to every folder above and marks the open one", () => {
  const onSelect = render("c");
  expect(container.textContent).toBe("All itemsFolder aFolder bFolder c");
  const buttons = Array.from(container.querySelectorAll("button"));
  expect(buttons.map((b) => b.textContent)).toEqual(["All items", "Folder a", "Folder b"]);
  expect(container.querySelector('[aria-current="page"]')?.textContent).toBe("Folder c");
  act(() => buttons[1]?.click());
  expect(onSelect).toHaveBeenCalledWith("a");
  act(() => buttons[0]?.click());
  expect(onSelect).toHaveBeenLastCalledWith(undefined);
});

it("collapses the middle of a long path into a menu", () => {
  render("e");
  expect(container.textContent).toBe("All itemsFolder dFolder e");
  expect(container.querySelector('[aria-label="Hidden folders"]')).not.toBeNull();
  expect(container.querySelector('[aria-current="page"]')?.textContent).toBe("Folder e");
});
