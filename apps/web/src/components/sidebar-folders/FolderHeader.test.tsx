// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((text, part, i) => `${text}${part}${i < values.length ? values[i] : ""}`, ""),
  }),
}));
vi.mock("@lingui/react", async (original) => ({
  ...(await original<typeof import("@lingui/react")>()),
  useLingui: () => ({
    _: (d: { message: string; values?: Record<string, unknown> }) =>
      d.message.replace(/\{(\w+)\}/g, (_m, key: string) => String(d.values?.[key])),
  }),
}));
vi.mock("../sidebar-glance", () => ({ StatusMark: () => null }));

import { FolderHeader } from "./FolderHeader";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("keeps the rename open with an error when another folder has the name", async () => {
  const onRename = vi.fn();
  const container = document.createElement("div");
  document.body.append(container);
  await act(async () =>
    createRoot(container).render(
      <FolderHeader
        id="f1"
        name="Untitled folder"
        count={0}
        collapsed={false}
        editing
        takenNames={["Apps"]}
        onToggle={() => undefined}
        onStartRename={() => undefined}
        onRename={onRename}
        onCancelRename={() => undefined}
        onDelete={() => undefined}
      />,
    ),
  );
  const input = container.querySelector("input")!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Apps");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => {
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  expect(onRename).not.toHaveBeenCalled();
  expect(container.querySelector("[role=alert]")?.textContent).toBe(
    "A folder with that name already exists",
  );
});

it("pins the header while its folder is open, not when collapsed", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const render = (collapsed: boolean) =>
    act(async () =>
      root.render(
        <FolderHeader
          id="f1"
          name="Tool Agents"
          count={4}
          collapsed={collapsed}
          editing={false}
          onToggle={() => undefined}
          onStartRename={() => undefined}
          onRename={() => undefined}
          onCancelRename={() => undefined}
          onDelete={() => undefined}
        />,
      ),
    );
  await render(false);
  const header = container.querySelector("[data-sidebar-folder]")!;
  expect(header.classList.contains("sticky")).toBe(true);
  expect(header.classList.contains("bg-sidebar")).toBe(true);
  await render(true);
  expect(header.classList.contains("sticky")).toBe(false);
});

it("announces unread chats when a collapsed folder shows its unread dot", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const render = (collapsed: boolean, unread: boolean, status?: "urgent") =>
    act(async () =>
      root.render(
        <FolderHeader
          id="f1"
          name="Team"
          count={2}
          collapsed={collapsed}
          unread={unread}
          status={status}
          editing={false}
          onToggle={() => undefined}
          onStartRename={() => undefined}
          onRename={() => undefined}
          onCancelRename={() => undefined}
          onDelete={() => undefined}
        />,
      ),
    );

  await render(true, true);
  let row = container.querySelector<HTMLButtonElement>("[data-roster-row='folder:f1']")!;
  expect(row.getAttribute("aria-label")).toBe("Expand Team (unread)");
  expect(row.querySelector("[data-testid=folder-unread]")).toBeTruthy();
  await render(true, false);
  row = container.querySelector<HTMLButtonElement>("[data-roster-row='folder:f1']")!;
  expect(row.getAttribute("aria-label")).toBe("Expand Team");
  await render(true, true, "urgent");
  row = container.querySelector<HTMLButtonElement>("[data-roster-row='folder:f1']")!;
  expect(row.getAttribute("aria-label")).toBe("Expand Team");
  expect(row.querySelector("[data-testid=folder-unread]")).toBeNull();
  await act(async () => root.unmount());
});

async function openDeleteMenu(count: number, onDelete: () => void) {
  document.body.innerHTML = "";
  const container = document.createElement("div");
  document.body.append(container);
  await act(async () =>
    createRoot(container).render(
      <FolderHeader
        id="f1"
        name="Apps"
        count={count}
        collapsed={false}
        editing={false}
        onToggle={() => undefined}
        onStartRename={() => undefined}
        onRename={() => undefined}
        onCancelRename={() => undefined}
        onDelete={onDelete}
      />,
    ),
  );
  const trigger = container.querySelector<HTMLElement>("[data-roster-actions]")!;
  await act(async () => {
    trigger.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    trigger.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    trigger.click();
  });
  const item = [...document.querySelectorAll<HTMLElement>("[role=menuitem]")].find((el) =>
    el.textContent?.includes("Delete folder"),
  )!;
  await act(async () => item.click());
  return container;
}

it("deletes a folder with chats at once, with no confirmation", async () => {
  const onDelete = vi.fn();
  await openDeleteMenu(2, onDelete);
  expect(document.querySelector("[role=alertdialog]")).toBeNull();
  expect(onDelete).toHaveBeenCalledTimes(1);
});

it("deletes an empty folder at once", async () => {
  const onDelete = vi.fn();
  await openDeleteMenu(0, onDelete);
  expect(onDelete).toHaveBeenCalledTimes(1);
  expect(document.querySelector("[role=alertdialog]")).toBeNull();
});
