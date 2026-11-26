// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useInboxKeyboard } from "./inbox-keyboard";

const toggle = vi.fn();
const archive = vi.fn();
const select = vi.fn();
const read = vi.fn();
const undo = vi.fn();
const noReply = vi.fn();
let clock = Date.now();
let root: ReturnType<typeof createRoot>;

function Harness(props: {
  selectedId: string | undefined;
  hasPicked: boolean;
  withUndo?: boolean;
}) {
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
    read,
    undo: props.withUndo === false ? undefined : undo,
    noReply,
    help: () => {},
  });
  return null;
}

const show = (selectedId: string | undefined, hasPicked = false) =>
  act(async () => root.render(<Harness selectedId={selectedId} hasPicked={hasPicked} />));
const press = (key: string, target: Element = document.body) =>
  act(async () => {
    target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  });

beforeEach(() => {
  // j/k are throttled to one step per 150ms; each press here counts as a new moment.
  vi.spyOn(Date, "now").mockImplementation(() => (clock += 200));
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  root = createRoot(document.body.appendChild(document.createElement("div")));
});
afterEach(() => {
  act(() => root.unmount());
  document.body.innerHTML = "";
  vi.clearAllMocks();
  vi.restoreAllMocks();
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

const toast = () => {
  const el = document.body.appendChild(document.createElement("div"));
  el.setAttribute("role", "alertdialog");
  el.setAttribute("data-slot", "notification-toast");
  return el;
};

it("j works while a toast shows", async () => {
  await show(undefined);
  toast();
  await press("j");
  expect(select).toHaveBeenLastCalledWith("group:news@example.test");
});

it("j stays off under a real dialog, even beside a toast", async () => {
  await show(undefined);
  toast();
  document.body.appendChild(document.createElement("div")).setAttribute("role", "dialog");
  await press("j");
  expect(select).not.toHaveBeenCalled();
});

it("j works with focus on the main landmark, but not elsewhere in it", async () => {
  await show(undefined);
  const main = document.body.appendChild(document.createElement("main"));
  main.id = "main-content";
  const bar = main.appendChild(document.createElement("div"));
  await press("j", bar);
  expect(select).not.toHaveBeenCalled();
  await press("j", main);
  expect(select).toHaveBeenCalledTimes(1);
});

it("j works with focus on the current page's sidebar link", async () => {
  await show(undefined);
  const link = document.body.appendChild(document.createElement("a"));
  link.setAttribute("aria-current", "page");
  await press("j", link);
  expect(select).toHaveBeenCalledTimes(1);
});

it("u marks the selected message read or unread, and does nothing with no selection", async () => {
  await show("m1");
  await press("u");
  expect(read).toHaveBeenLastCalledWith("m1");
  read.mockClear();
  await show(undefined);
  await press("u");
  expect(read).not.toHaveBeenCalled();
});

it("u fires with checked rows and no selection, so the list can mark them all", async () => {
  await show(undefined, true);
  await press("u");
  expect(read).toHaveBeenLastCalledWith(undefined);
});

it("z undoes once; held keys, inputs and a missing undo do nothing", async () => {
  await show("m1");
  await press("z");
  expect(undo).toHaveBeenCalledTimes(1);
  await act(async () => {
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", { key: "z", repeat: true, bubbles: true }),
    );
  });
  const input = document.body.appendChild(document.createElement("input"));
  await press("z", input);
  expect(undo).toHaveBeenCalledTimes(1);
});

it("n dismisses the selected row, and does nothing without one", async () => {
  await show("m1");
  await press("n");
  expect(noReply).toHaveBeenLastCalledWith("m1");
  noReply.mockClear();
  await show(undefined);
  await press("n");
  expect(noReply).not.toHaveBeenCalled();
});

it("a held n dismisses once, and n inside a field does nothing", async () => {
  await show("m1");
  await press("n");
  await act(async () => {
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", { key: "n", repeat: true, bubbles: true }),
    );
  });
  const input = document.body.appendChild(document.createElement("input"));
  await press("n", input);
  expect(noReply).toHaveBeenCalledTimes(1);
});

it("n stays off under a dialog", async () => {
  await show("m1");
  document.body.appendChild(document.createElement("div")).setAttribute("role", "dialog");
  await press("n");
  expect(noReply).not.toHaveBeenCalled();
});

it("z does nothing when there is no undo", async () => {
  await act(async () =>
    root.render(<Harness selectedId="m1" hasPicked={false} withUndo={false} />),
  );
  await press("z");
  expect(undo).not.toHaveBeenCalled();
});

it("a held e archives once", async () => {
  await show("m1");
  await press("e");
  await act(async () => {
    document.body.dispatchEvent(
      new KeyboardEvent("keydown", { key: "e", repeat: true, bubbles: true }),
    );
  });
  expect(archive).toHaveBeenCalledTimes(1);
});
