// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useInboxKeyboard } from "./inbox-keyboard";

const toggle = vi.fn();
const archive = vi.fn();
const select = vi.fn();
let root: ReturnType<typeof createRoot>;

function Harness(props: { selectedId: string | undefined; hasPicked: boolean }) {
  useInboxKeyboard({
    ids: ["group:news@example.test", "m1", "m2"],
    selectedId: props.selectedId,
    hasPicked: props.hasPicked,
    enabled: true,
    select,
    open: () => {},
    focusSearch: () => {},
    compose: undefined,
    toggle,
    archive,
    help: () => {},
  });
  return null;
}

const show = (selectedId: string | undefined, hasPicked = false) =>
  act(async () => root.render(<Harness selectedId={selectedId} hasPicked={hasPicked} />));
const press = (key: string) =>
  act(async () => {
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  root = createRoot(document.body.appendChild(document.createElement("div")));
});
afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
  vi.clearAllMocks();
});

it("x checks the selected row, or the whole group when a group is selected", async () => {
  await show("m1");
  await press("x");
  expect(toggle).toHaveBeenLastCalledWith("m1");
  await show("group:news@example.test");
  await press("x");
  expect(toggle).toHaveBeenLastCalledWith("group:news@example.test");
});

it("x does nothing without a selected row", async () => {
  await show(undefined);
  await press("x");
  expect(toggle).not.toHaveBeenCalled();
});

it("e archives the selected row, and also works with checked rows and no selection", async () => {
  await show("m2");
  await press("e");
  expect(archive).toHaveBeenLastCalledWith("m2");
  await show(undefined, true);
  await press("e");
  expect(archive).toHaveBeenLastCalledWith(undefined);
});

it("e does nothing with no selection and nothing checked", async () => {
  await show(undefined, false);
  await press("e");
  expect(archive).not.toHaveBeenCalled();
});
